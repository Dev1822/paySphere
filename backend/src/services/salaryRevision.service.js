/**
 * @fileoverview Salary Revision Simulator Service
 * @description Business logic for scenario creation, simulation, approval,
 *   batch application, and reporting.
 */

const {
  RevisionScenario,
  RevisionLineItem,
  RevisionBatch,
  RevisionAuditLog,
} = require('../models/salaryRevision.model');
const Employee = require('../models/employee.model');
const {
  calculateRevision,
  calculateStatutoryImpact,
  computeHikeStatistics,
  groupByDepartment,
  groupByLevel,
  validateScenarioTransition,
  compareScenarios,
} = require('../utils/salaryRevision.utils');
const logger = require('../utils/logger');

// ─── Scenario Management ────────────────────────────────────────────────────

async function createScenario(tenantId, data, userId) {
  const scenario = await RevisionScenario.create({
    ...data,
    tenantId,
    createdBy: userId,
    statusHistory: [
      {
        status: 'Draft',
        changedBy: userId,
        changedAt: new Date(),
        comment: 'Scenario created',
      },
    ],
  });

  await logAudit(tenantId, scenario._id, null, 'ScenarioCreated', null, {
    name: scenario.name,
    scenarioType: scenario.scenarioType,
  }, userId);

  logger.info('Revision scenario created', { scenarioId: scenario._id, tenantId });
  return scenario;
}

async function getScenarios(tenantId, filters = {}) {
  const query = { tenantId };
  if (filters.fiscalYear) query.fiscalYear = filters.fiscalYear;
  if (filters.status) query.status = filters.status;
  if (filters.scenarioType) query.scenarioType = filters.scenarioType;

  return RevisionScenario.find(query).sort({ createdAt: -1 });
}

async function getScenario(scenarioId, tenantId) {
  const scenario = await RevisionScenario.findOne({
    _id: scenarioId,
    tenantId,
  });
  if (!scenario) {
    throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
  }
  return scenario;
}

async function updateScenario(scenarioId, tenantId, data, userId) {
  const scenario = await RevisionScenario.findOne({
    _id: scenarioId,
    tenantId,
  });
  if (!scenario) {
    throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
  }
  if (scenario.status !== 'Draft' && scenario.status !== 'Simulated') {
    throw Object.assign(
      new Error('Can only edit Draft or Simulated scenarios'),
      { statusCode: 400 },
    );
  }

  Object.assign(scenario, data);
  await scenario.save();
  return scenario;
}

async function transitionScenario(scenarioId, tenantId, targetStatus, userId, comment) {
  const scenario = await RevisionScenario.findOne({
    _id: scenarioId,
    tenantId,
  });
  if (!scenario) {
    throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
  }

  const validation = validateScenarioTransition(scenario.status, targetStatus);
  if (!validation.allowed) {
    throw Object.assign(new Error(validation.reason), { statusCode: 400 });
  }

  scenario.status = targetStatus;
  scenario.statusHistory.push({
    status: targetStatus,
    changedBy: userId,
    changedAt: new Date(),
    comment: comment || '',
  });

  await scenario.save();

  await logAudit(
    tenantId,
    scenarioId,
    null,
    `Scenario${targetStatus.charAt(0) + targetStatus.slice(1)}`,
    { status: scenario.status },
    { status: targetStatus },
    userId,
  );

  return scenario;
}

// ─── Simulation Engine ──────────────────────────────────────────────────────

async function runSimulation(scenarioId, tenantId, userId) {
  const scenario = await RevisionScenario.findOne({
    _id: scenarioId,
    tenantId,
  });
  if (!scenario) {
    throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
  }

  // Get all active employees
  const employees = await Employee.find({ tenantId, isActive: { $ne: false } });
  if (employees.length === 0) {
    throw Object.assign(new Error('No active employees found'), { statusCode: 400 });
  }

  // Clear previous simulation results
  await RevisionLineItem.deleteMany({ scenarioId });

  const lineItems = [];
  let totalCurrentPayroll = 0;
  let totalRevisedPayroll = 0;
  const hikes = [];

  for (const emp of employees) {
    const currentSalary = emp.monthlySalary || 0;
    if (currentSalary <= 0) continue;

    // Determine hike percentage based on scenario type
    let hikePercent = 0;

    switch (scenario.scenarioType) {
      case 'UniformPercent':
        hikePercent = scenario.globalHikePercent || 0;
        break;

      case 'DepartmentWise': {
        const deptHike = (scenario.departmentHikes || []).find(
          (d) => d.department === emp.department,
        );
        hikePercent = deptHike ? deptHike.hikePercent : scenario.globalHikePercent || 0;
        break;
      }

      case 'PerformanceBased': {
        const rating = emp.performanceRating || emp.lastRating || '';
        const band = (scenario.performanceBands || []).find(
          (b) => b.rating === rating,
        );
        hikePercent = band ? band.hikePercent : 0;
        break;
      }

      case 'Custom':
        // For custom, use global as default; individual overrides come via API
        hikePercent = scenario.globalHikePercent || 0;
        break;

      default:
        hikePercent = scenario.globalHikePercent || 0;
    }

    // Apply hike
    const { revisedSalary, hikeAmount, cappedHikePercent } = calculateRevision(
      currentSalary,
      hikePercent,
      scenario.maxHikeCapPercent,
    );

    // Calculate statutory impact
    const currentBasic = currentSalary * 0.5; // Assume 50% basic
    const revisedBasic = revisedSalary * 0.5;
    const statutoryImpact = calculateStatutoryImpact(
      currentBasic,
      revisedBasic,
      currentSalary,
      revisedSalary,
    );

    const lineItem = {
      tenantId,
      scenarioId,
      employeeId: emp._id,
      currentMonthlySalary: currentSalary,
      currentAnnualCTC: currentSalary * 12,
      currentBasicSalary: currentBasic,
      revisedMonthlySalary: revisedSalary,
      revisedAnnualCTC: revisedSalary * 12,
      revisedBasicSalary: revisedBasic,
      hikePercent: cappedHikePercent,
      hikeAmount,
      department: emp.department || '',
      role: emp.role || '',
      level: emp.jobLevel || emp.level || '',
      performanceRating: emp.performanceRating || '',
      tenureMonths: emp.joiningDate
        ? Math.floor((Date.now() - new Date(emp.joiningDate)) / (1000 * 60 * 60 * 24 * 30))
        : 0,
      pfImpact: statutoryImpact.pfImpact,
      esiImpact: statutoryImpact.esiImpact,
      gratuityImpact: statutoryImpact.gratuityImpact,
      totalStatutoryImpact: statutoryImpact.total,
      status: 'Pending',
    };

    lineItems.push(lineItem);
    totalCurrentPayroll += currentSalary;
    totalRevisedPayroll += revisedSalary;
    hikes.push(cappedHikePercent);
  }

  // Bulk insert line items
  if (lineItems.length > 0) {
    await RevisionLineItem.insertMany(lineItems);
  }

  // Compute statistics
  const stats = computeHikeStatistics(hikes);
  const totalIncrementCost = Math.round((totalRevisedPayroll - totalCurrentPayroll) * 100) / 100;

  // Group by department and level
  const deptGroups = groupByDepartment(lineItems);
  const levelGroups = groupByLevel(lineItems);

  // Update scenario with computed totals
  scenario.totalEmployees = lineItems.length;
  scenario.totalCurrentPayroll = Math.round(totalCurrentPayroll * 100) / 100;
  scenario.totalRevisedPayroll = Math.round(totalRevisedPayroll * 100) / 100;
  scenario.totalIncrementCost = totalIncrementCost;
  scenario.averageHikePercent = stats.mean;
  scenario.medianHikePercent = stats.median;
  scenario.maxHikePercent = stats.max;
  scenario.minHikePercent = stats.min;
  scenario.annualizedImpact = Math.round(totalIncrementCost * 12 * 100) / 100;
  scenario.budgetImpactPercent =
    totalCurrentPayroll > 0
      ? Math.round((totalIncrementCost / totalCurrentPayroll) * 10000) / 100
      : 0;
  scenario.headcountByDepartment = deptGroups;
  scenario.headcountByLevel = levelGroups;
  scenario.status = 'Simulated';

  scenario.statusHistory.push({
    status: 'Simulated',
    changedBy: userId,
    changedAt: new Date(),
    comment: `Simulation complete: ${lineItems.length} employees, ${stats.mean}% avg hike`,
  });

  await scenario.save();

  await logAudit(
    tenantId,
    scenarioId,
    null,
    'ScenarioSimulated',
    null,
    {
      totalEmployees: lineItems.length,
      averageHike: stats.mean,
      totalIncrementCost,
    },
    userId,
  );

  logger.info('Revision simulation complete', {
    scenarioId,
    employees: lineItems.length,
    avgHike: stats.mean,
  });

  return { scenario, stats };
}

// ─── Line Item Management ───────────────────────────────────────────────────

async function getLineItems(scenarioId, tenantId, filters = {}) {
  const query = { scenarioId, tenantId };
  if (filters.department) query.department = filters.department;
  if (filters.level) query.level = filters.level;
  if (filters.status) query.status = filters.status;

  return RevisionLineItem.find(query)
    .populate('employeeId', 'fullName email department')
    .sort({ hikePercent: -1 });
}

async function overrideRevision(lineItemId, tenantId, data, userId) {
  const item = await RevisionLineItem.findOne({ _id: lineItemId, tenantId });
  if (!item) {
    throw Object.assign(new Error('Line item not found'), { statusCode: 404 });
  }

  const previousHike = item.hikePercent;
  const previousSalary = item.revisedMonthlySalary;

  // Apply new revision
  const { revisedSalary, hikeAmount, cappedHikePercent } = calculateRevision(
    item.currentMonthlySalary,
    data.hikePercent,
  );

  item.revisedMonthlySalary = revisedSalary;
  item.revisedAnnualCTC = revisedSalary * 12;
  item.revisedBasicSalary = revisedSalary * 0.5;
  item.hikePercent = cappedHikePercent;
  item.hikeAmount = hikeAmount;
  item.isManualOverride = true;
  item.overrideReason = data.reason || '';

  // Recalculate statutory impact
  const currentBasic = item.currentMonthlySalary * 0.5;
  const revisedBasic = revisedSalary * 0.5;
  const impact = calculateStatutoryImpact(
    currentBasic,
    revisedBasic,
    item.currentMonthlySalary,
    revisedSalary,
  );
  item.pfImpact = impact.pfImpact;
  item.esiImpact = impact.esiImpact;
  item.gratuityImpact = impact.gratuityImpact;
  item.totalStatutoryImpact = impact.total;

  await item.save();

  await logAudit(
    tenantId,
    item.scenarioId,
    item.employeeId,
    'RevisionOverridden',
    { hikePercent: previousHike, revisedSalary: previousSalary },
    { hikePercent: cappedHikePercent, revisedSalary },
    userId,
  );

  // Recalculate scenario totals
  await recalculateScenarioTotals(item.scenarioId, tenantId);

  return item;
}

async function approveRevision(lineItemId, tenantId, userId) {
  const item = await RevisionLineItem.findOne({ _id: lineItemId, tenantId });
  if (!item) {
    throw Object.assign(new Error('Line item not found'), { statusCode: 404 });
  }

  item.status = 'Approved';
  item.approvedBy = userId;
  item.approvedAt = new Date();
  await item.save();

  await logAudit(
    tenantId,
    item.scenarioId,
    item.employeeId,
    'RevisionApproved',
    { status: 'Pending' },
    { status: 'Approved' },
    userId,
  );

  return item;
}

async function rejectRevision(lineItemId, tenantId, userId, reason) {
  if (!reason || reason.trim().length === 0) {
    throw Object.assign(new Error('Rejection reason is required'), { statusCode: 400 });
  }

  const item = await RevisionLineItem.findOne({ _id: lineItemId, tenantId });
  if (!item) {
    throw Object.assign(new Error('Line item not found'), { statusCode: 404 });
  }

  item.status = 'Rejected';
  item.rejectionReason = reason;
  await item.save();

  await logAudit(
    tenantId,
    item.scenarioId,
    item.employeeId,
    'RevisionRejected',
    { status: 'Pending' },
    { status: 'Rejected', reason },
    userId,
  );

  return item;
}

async function recalculateScenarioTotals(scenarioId, tenantId) {
  const items = await RevisionLineItem.find({ scenarioId, tenantId });
  const hikes = items.map((i) => i.hikePercent);

  const stats = computeHikeStatistics(hikes);
  const totalCurrentPayroll = items.reduce((s, i) => s + i.currentMonthlySalary, 0);
  const totalRevisedPayroll = items.reduce((s, i) => s + i.revisedMonthlySalary, 0);
  const totalIncrementCost = totalRevisedPayroll - totalCurrentPayroll;

  await RevisionScenario.findByIdAndUpdate(scenarioId, {
    $set: {
      totalEmployees: items.length,
      totalCurrentPayroll: Math.round(totalCurrentPayroll * 100) / 100,
      totalRevisedPayroll: Math.round(totalRevisedPayroll * 100) / 100,
      totalIncrementCost: Math.round(totalIncrementCost * 100) / 100,
      averageHikePercent: stats.mean,
      medianHikePercent: stats.median,
      maxHikePercent: stats.max,
      minHikePercent: stats.min,
      annualizedImpact: Math.round(totalIncrementCost * 12 * 100) / 100,
      budgetImpactPercent:
        totalCurrentPayroll > 0
          ? Math.round((totalIncrementCost / totalCurrentPayroll) * 10000) / 100
          : 0,
      headcountByDepartment: groupByDepartment(items),
      headcountByLevel: groupByLevel(items),
    },
  });
}

// ─── Batch Application ──────────────────────────────────────────────────────

async function createBatch(scenarioId, tenantId, data, userId) {
  const scenario = await RevisionScenario.findOne({
    _id: scenarioId,
    tenantId,
    status: 'Approved',
  });
  if (!scenario) {
    throw Object.assign(
      new Error('Scenario not found or not approved'),
      { statusCode: 404 },
    );
  }

  const approvedItems = await RevisionLineItem.find({
    scenarioId,
    status: 'Approved',
  });
  if (approvedItems.length === 0) {
    throw Object.assign(
      new Error('No approved revisions to apply'),
      { statusCode: 400 },
    );
  }

  const batchCount = await RevisionBatch.countDocuments({ tenantId });
  const batchNumber = `REV-${scenario.fiscalYear}-${String(batchCount + 1).padStart(4, '0')}`;

  const totalIncrementCost = approvedItems.reduce(
    (s, i) => s + i.hikeAmount,
    0,
  );

  const batch = await RevisionBatch.create({
    tenantId,
    scenarioId,
    batchNumber,
    effectiveDate: data.effectiveDate || scenario.effectiveDate,
    totalEmployees: approvedItems.length,
    totalIncrementCost: Math.round(totalIncrementCost * 100) / 100,
    notes: data.notes || '',
    createdBy: userId,
  });

  await logAudit(
    tenantId,
    scenarioId,
    null,
    'BatchCreated',
    null,
    {
      batchNumber,
      totalEmployees: approvedItems.length,
      totalIncrementCost,
    },
    userId,
  );

  logger.info('Revision batch created', {
    batchId: batch._id,
    batchNumber,
    scenarioId,
  });

  return batch;
}

async function applyBatch(batchId, tenantId, userId) {
  const batch = await RevisionBatch.findOne({
    _id: batchId,
    tenantId,
    status: 'Pending',
  });
  if (!batch) {
    throw Object.assign(
      new Error('Batch not found or not pending'),
      { statusCode: 404 },
    );
  }

  batch.status = 'Processing';
  await batch.save();

  const approvedItems = await RevisionLineItem.find({
    scenarioId: batch.scenarioId,
    status: 'Approved',
  });

  let processedCount = 0;
  let failedCount = 0;

  for (const item of approvedItems) {
    try {
      await Employee.findByIdAndUpdate(item.employeeId, {
        $set: { monthlySalary: item.revisedMonthlySalary },
      });
      item.status = 'Applied';
      await item.save();
      processedCount++;
    } catch (err) {
      failedCount++;
      logger.error('Failed to apply revision', {
        employeeId: item.employeeId,
        error: err.message,
      });
    }
  }

  batch.status = failedCount > 0 ? 'Applied' : 'Applied';
  batch.processedCount = processedCount;
  batch.failedCount = failedCount;
  batch.appliedAt = new Date();
  await batch.save();

  // Update scenario status
  await RevisionScenario.findByIdAndUpdate(batch.scenarioId, {
    $set: { status: 'Applied' },
  });

  await logAudit(
    tenantId,
    batch.scenarioId,
    null,
    'BatchApplied',
    null,
    { batchId, processedCount, failedCount },
    userId,
  );

  logger.info('Revision batch applied', {
    batchId,
    processedCount,
    failedCount,
  });

  return batch;
}

// ─── Reports ────────────────────────────────────────────────────────────────

async function getSimulationDashboard(tenantId, fiscalYear) {
  const scenarios = await RevisionScenario.find({ tenantId, fiscalYear });
  const totalScenarios = scenarios.length;
  const simulated = scenarios.filter((s) => s.status === 'Simulated');
  const approved = scenarios.filter((s) => s.status === 'Approved');
  const applied = scenarios.filter((s) => s.status === 'Applied');

  return {
    fiscalYear,
    totalScenarios,
    simulatedCount: simulated.length,
    approvedCount: approved.length,
    appliedCount: applied.length,
    totalCurrentPayroll: scenarios.reduce((s, sc) => s + (sc.totalCurrentPayroll || 0), 0),
    totalIncrementCost: scenarios.reduce((s, sc) => s + (sc.totalIncrementCost || 0), 0),
    averageHike: simulated.length > 0
      ? Math.round(
          simulated.reduce((s, sc) => s + (sc.averageHikePercent || 0), 0) /
            simulated.length *
            100,
        ) / 100
      : 0,
    scenarios: scenarios.map((s) => ({
      id: s._id,
      name: s.name,
      type: s.scenarioType,
      status: s.status,
      employees: s.totalEmployees,
      avgHike: s.averageHikePercent,
      incrementCost: s.totalIncrementCost,
    })),
  };
}

async function compareScenarioResults(tenantId, scenarioIds) {
  const scenarios = await RevisionScenario.find({
    _id: { $in: scenarioIds },
    tenantId,
  });

  return compareScenarios(scenarios);
}

// ─── Audit ──────────────────────────────────────────────────────────────────

async function logAudit(tenantId, scenarioId, employeeId, action, previousValue, newValue, userId) {
  await RevisionAuditLog.create({
    tenantId,
    scenarioId,
    employeeId,
    action,
    previousValue,
    newValue,
    performedBy: userId,
  });
}

async function getAuditLog(tenantId, scenarioId, options = {}) {
  const { limit = 50, skip = 0 } = options;
  const query = { tenantId };
  if (scenarioId) query.scenarioId = scenarioId;

  return RevisionAuditLog.find(query)
    .populate('performedBy', 'fullName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

module.exports = {
  createScenario,
  getScenarios,
  getScenario,
  updateScenario,
  transitionScenario,
  runSimulation,
  getLineItems,
  overrideRevision,
  approveRevision,
  rejectRevision,
  createBatch,
  applyBatch,
  getSimulationDashboard,
  compareScenarioResults,
  getAuditLog,
};
