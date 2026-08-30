const { SandboxSession, SimulatedPayroll } = require('../models/sandboxSession.model');
const SalaryStructure = require('../models/salaryStructure.model');
const Employee = require('../models/employee.model');
const { calculateNetSalary } = require('../utils/salaryCalculator');
const eventBus = require('./event.service');
const logger = require('../utils/logger');

/**
 * Execute draft calculation run on cloned target employees
 */
async function runSandboxSimulation(tenantId, sessionId) {
  const session = await SandboxSession.findOne({ _id: sessionId, tenantId });
  if (!session) {
    throw new Error('Sandbox session not found');
  }

  // Clear existing simulated records for this session
  await SimulatedPayroll.deleteMany({ sandboxSessionId: sessionId });

  // Resolve target employees
  const filter = { tenantId, isDeleted: { $ne: true } };
  const { departments, employeeIds } = session.targets;

  if (departments && departments.length > 0 && employeeIds && employeeIds.length > 0) {
    filter.$or = [
      { department: { $in: departments } },
      { _id: { $in: employeeIds } },
    ];
  } else if (departments && departments.length > 0) {
    filter.department = { $in: departments };
  } else if (employeeIds && employeeIds.length > 0) {
    filter._id = { $in: employeeIds };
  }

  const employees = await Employee.find(filter).lean();
  if (employees.length === 0) {
    return [];
  }

  const simulatedRecords = [];

  for (const emp of employees) {
    // Get active salary structure
    const activeStructure = await SalaryStructure.findOne({ employeeId: emp._id, tenantId })
      .sort({ effectiveFrom: -1 })
      .lean();

    if (!activeStructure) continue;

    // Apply draft components structure alterations
    const draftComps = session.draftComponents || [];
    let simulatedGross = activeStructure.grossMonthly;

    // Estimate simulated gross from draft adjustments
    const hikeFactor = draftComps.find(c => c.code === 'G_HIKE');
    if (hikeFactor) {
      simulatedGross = Math.round(activeStructure.grossMonthly * (1 + hikeFactor.value / 100) * 100) / 100;
    } else {
      const basicAdj = draftComps.find(c => c.code === 'BASIC');
      if (basicAdj) {
        simulatedGross = basicAdj.value * 2; // Estimate gross as BASIC * 2 if adjusted directly
      }
    }

    const originalCalc = calculateNetSalary({ monthlySalary: activeStructure.grossMonthly }, null);
    const simulatedCalc = calculateNetSalary({ monthlySalary: simulatedGross }, null);

    const originalTax = Math.round(0.10 * activeStructure.grossMonthly * 100) / 100;
    const simulatedTax = Math.round(0.10 * simulatedGross * 100) / 100;
    const simulatedCost = Math.round(1.17 * simulatedGross * 100) / 100; // gross + statutory additions

    const simPayroll = await SimulatedPayroll.create({
      sandboxSessionId: sessionId,
      employeeId: emp._id,
      employeeName: emp.fullName,
      department: emp.department || 'Unassigned',
      originalGross: activeStructure.grossMonthly,
      originalNet: originalCalc.netSalary,
      originalTax,
      simulatedGross,
      simulatedNet: simulatedCalc.netSalary,
      simulatedTax,
      simulatedEmployerCost: simulatedCost,
    });

    simulatedRecords.push(simPayroll);
  }

  return simulatedRecords;
}

/**
 * Returns a comparison delta report sorted by department
 */
async function getComparisonReport(tenantId, sessionId) {
  const simulated = await SimulatedPayroll.find({ sandboxSessionId: sessionId }).lean();
  
  const byDept = {};
  for (const row of simulated) {
    const dept = row.department || 'Unassigned';
    if (!byDept[dept]) {
      byDept[dept] = {
        department: dept,
        employeeCount: 0,
        originalGrossTotal: 0,
        simulatedGrossTotal: 0,
        originalNetTotal: 0,
        simulatedNetTotal: 0,
        originalTaxTotal: 0,
        simulatedTaxTotal: 0,
        simulatedEmployerCostTotal: 0,
        grossDelta: 0,
        netDelta: 0,
      };
    }

    const d = byDept[dept];
    d.employeeCount++;
    d.originalGrossTotal += row.originalGross;
    d.simulatedGrossTotal += row.simulatedGross;
    d.originalNetTotal += row.originalNet;
    d.simulatedNetTotal += row.simulatedNet;
    d.originalTaxTotal += row.originalTax;
    d.simulatedTaxTotal += row.simulatedTax;
    d.simulatedEmployerCostTotal += row.simulatedEmployerCost;
  }

  // Calculate deltas and round
  const report = Object.values(byDept).map(d => {
    d.originalGrossTotal = Math.round(d.originalGrossTotal * 100) / 100;
    d.simulatedGrossTotal = Math.round(d.simulatedGrossTotal * 100) / 100;
    d.originalNetTotal = Math.round(d.originalNetTotal * 100) / 100;
    d.simulatedNetTotal = Math.round(d.simulatedNetTotal * 100) / 100;
    d.originalTaxTotal = Math.round(d.originalTaxTotal * 100) / 100;
    d.simulatedTaxTotal = Math.round(d.simulatedTaxTotal * 100) / 100;
    d.simulatedEmployerCostTotal = Math.round(d.simulatedEmployerCostTotal * 100) / 100;
    d.grossDelta = Math.round((d.simulatedGrossTotal - d.originalGrossTotal) * 100) / 100;
    d.netDelta = Math.round((d.simulatedNetTotal - d.originalNetTotal) * 100) / 100;
    return d;
  });

  // Sort by department name
  return report.sort((a, b) => a.department.localeCompare(b.department));
}

/**
 * Commits the sandbox state to live records and logs the audit trail.
 */
async function commitSandboxSession(tenantId, sessionId, userId) {
  const session = await SandboxSession.findOne({ _id: sessionId, tenantId });
  if (!session || !session.isActive) {
    throw new Error('Active sandbox session not found');
  }

  const simulated = await SimulatedPayroll.find({ sandboxSessionId: sessionId }).lean();
  const journal = [];

  for (const row of simulated) {
    const employee = await Employee.findOne({ _id: row.employeeId, tenantId });
    if (!employee) continue;

    // Load original structure
    const originalStructure = await SalaryStructure.findOne({ employeeId: row.employeeId, tenantId })
      .sort({ effectiveFrom: -1 })
      .lean();

    if (!originalStructure) continue;

    // Record original in journal for rollback
    journal.push({
      employeeId: row.employeeId,
      monthlySalary: employee.monthlySalary,
      originalStructureId: originalStructure._id,
    });

    // Create a new salary structure revision (Append-only)
    const newStructure = new SalaryStructure({
      tenantId,
      employeeId: row.employeeId,
      effectiveFrom: new Date(),
      grossMonthly: row.simulatedGross,
      components: originalStructure.components.map(c => {
        if (c.code === 'BASIC') {
          // Adjust basic components values matching the hike
          const ratio = row.simulatedGross / originalStructure.grossMonthly;
          c.value = Math.round(c.value * ratio * 100) / 100;
        }
        return c;
      }),
      reason: 'revision',
      note: `Committed sandbox simulation: ${session.name}`,
      createdBy: userId,
    });

    await newStructure.save();

    // Update live Employee gross monthlySalary
    employee.monthlySalary = row.simulatedGross;
    await employee.save();
  }

  // Save journal entries and mark session inactive
  session.transactionJournal = journal;
  session.isActive = false;
  await session.save();

  // Raise Audit event
  eventBus.emit('AUDIT_LOG', {
    userId,
    action: 'SANDBOX_COMMITTED',
    resourceType: 'SandboxSession',
    resourceIds: [sessionId],
    details: {
      sessionName: session.name,
      employeeCount: simulated.length,
    },
  });

  return session;
}

/**
 * Discards sandbox state or rolls back a committed session using transactionJournal.
 */
async function rollbackSandboxSession(tenantId, sessionId) {
  const session = await SandboxSession.findOne({ _id: sessionId, tenantId });
  if (!session) {
    throw new Error('Sandbox session not found');
  }

  // If session was committed, restore original fields from journal
  const journal = session.transactionJournal || [];
  for (const j of journal) {
    const employee = await Employee.findOne({ _id: j.employeeId, tenantId });
    if (employee) {
      employee.monthlySalary = j.monthlySalary;
      await employee.save();
    }

    // Delete the committed revisions created by the session commit
    await SalaryStructure.deleteMany({
      employeeId: j.employeeId,
      tenantId,
      note: `Committed sandbox simulation: ${session.name}`,
    });
  }

  // Clean up simulated outcomes
  await SimulatedPayroll.deleteMany({ sandboxSessionId: sessionId });

  session.isActive = false;
  session.transactionJournal = [];
  await session.save();

  return session;
}

module.exports = {
  runSandboxSimulation,
  getComparisonReport,
  commitSandboxSession,
  rollbackSandboxSession,
};
