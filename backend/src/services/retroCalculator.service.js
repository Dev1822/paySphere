const RetroactiveAdjustment = require('../models/retroactiveAdjustment.model');
const SalaryStructure = require('../models/salaryStructure.model');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

/**
 * Calculates arrears for a backdated period using a new salary structure.
 */
async function calculateRetroactiveArrears(tenantId, employeeId, effectiveDate, newStructureId) {
  const newStructure = await SalaryStructure.findOne({ _id: newStructureId, tenantId }).lean();
  if (!newStructure) {
    throw new Error('New salary structure not found');
  }

  const employee = await Employee.findOne({ _id: employeeId, tenantId }).lean();
  if (!employee) {
    throw new Error('Employee not found');
  }

  const effective = new Date(effectiveDate);
  const startYear = effective.getFullYear();
  const startMonth = effective.getMonth() + 1;

  const current = new Date();
  const currentYear = current.getFullYear();
  const currentMonth = current.getMonth() + 1;

  const startOrdinal = startYear * 12 + (startMonth - 1);
  const endOrdinal = currentYear * 12 + (currentMonth - 2); // Exclude current month

  if (endOrdinal < startOrdinal) {
    return {
      calculatedArrears: [],
      totalArrears: 0,
      totalTaxLiability: 0,
    };
  }

  // Load finalized payroll records in the target range
  const payrolls = await PayrollUpdate.find({
    tenantId,
    employeeId,
    status: { $in: ['PAID', 'APPROVED', 'finalized'] },
  }).lean();

  const calculatedArrears = [];
  let totalArrears = 0;

  for (let cursor = startOrdinal; cursor <= endOrdinal; cursor++) {
    const year = Math.floor(cursor / 12);
    const month = (cursor % 12) + 1;

    const originalPayroll = payrolls.find(p => p.year === year && p.month === month);
    if (!originalPayroll) {
      continue; // Skip months with no finalized payroll
    }

    // Original values
    const origBasic = originalPayroll.baseSalary || 0;
    const origGross = origBasic + (originalPayroll.overtimePay || 0) + (originalPayroll.bonus || 0);
    const origPF = Math.round(0.12 * origBasic * 100) / 100;
    const origESI = origGross <= 21000 ? Math.round(0.0175 * origGross * 100) / 100 : 0;
    const origPT = origGross > 15000 ? 200 : 0;

    // Mock calculations with new structure
    const basicComp = newStructure.components?.find(c => c.code === 'BASIC');
    const newBasic = basicComp ? basicComp.value : (newStructure.grossMonthly * 0.5);
    const newGross = newStructure.grossMonthly;
    const newPF = Math.round(0.12 * newBasic * 100) / 100;
    const newESI = newGross <= 21000 ? Math.round(0.0175 * newGross * 100) / 100 : 0;
    const newPT = newGross > 15000 ? 200 : 0;

    // Deltas
    const grossDelta = Math.max(0, newGross - origGross);
    const pfDelta = Math.max(0, newPF - origPF);
    const esiDelta = Math.max(0, newESI - origESI);
    const ptDelta = Math.max(0, newPT - origPT);
    const netDelta = Math.max(0, grossDelta - pfDelta - esiDelta - ptDelta);

    calculatedArrears.push({
      year,
      month,
      originalGross: Math.round(origGross * 100) / 100,
      newGross: Math.round(newGross * 100) / 100,
      grossDelta: Math.round(grossDelta * 100) / 100,
      originalPF: Math.round(origPF * 100) / 100,
      newPF: Math.round(newPF * 100) / 100,
      pfDelta: Math.round(pfDelta * 100) / 100,
      originalESI: Math.round(origESI * 100) / 100,
      newESI: Math.round(newESI * 100) / 100,
      esiDelta: Math.round(esiDelta * 100) / 100,
      originalPT: Math.round(origPT * 100) / 100,
      newPT: Math.round(newPT * 100) / 100,
      ptDelta: Math.round(ptDelta * 100) / 100,
      netDelta: Math.round(netDelta * 100) / 100,
    });

    totalArrears += netDelta;
  }

  // Aggregate tax liabilities (assuming standard 10% TDS slab rate for arrears delta)
  const totalTaxLiability = Math.round(0.10 * totalArrears * 100) / 100;

  return {
    calculatedArrears,
    totalArrears: Math.round(totalArrears * 100) / 100,
    totalTaxLiability,
  };
}

/**
 * Apply retroactive adjustments to the active payroll run.
 * (Arrears Injector Middleware)
 */
async function injectApprovedArrears(tenantId, employeeId, calculatedNetSalary, calculatedDeductions) {
  const approvedAdjs = await RetroactiveAdjustment.find({
    tenantId,
    employeeId,
    status: 'APPROVED',
  });

  let arrearsAmount = 0;
  let taxAddition = 0;

  for (const adj of approvedAdjs) {
    arrearsAmount += adj.totalArrears;
    taxAddition += adj.totalTaxLiability;

    // Mark as processed
    adj.status = 'PROCESSED';
    await adj.save();
  }

  return {
    netSalary: Math.round((calculatedNetSalary + arrearsAmount) * 100) / 100,
    deductions: Math.round((calculatedDeductions + taxAddition) * 100) / 100,
    arrearsAmount,
    taxAddition,
  };
}

module.exports = {
  calculateRetroactiveArrears,
  injectApprovedArrears,
};
