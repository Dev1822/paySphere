/**
 * Labor Allocation Service - Issue #1599
 *
 * Distributes gross compensation, employer tax liabilities, and statutory contributions
 * proportionally across activity codes and timesheet entries to generate split accounting entries.
 */
'use strict';

const LaborCostJournal = require('../models/laborCostJournal.model');
const logger = require('../utils/logger');

/**
 * Calculates activity-based split line items:
 */
function distributeLaborCost({
  employeeId,
  payrollRunId,
  grossSalary,
  overtime = 0,
  employerTaxes = 0,
  benefitsCost = 0,
  timesheetEntries, // [{ projectCode, costCenter, hours }]
}) {
  if (!timesheetEntries || !timesheetEntries.length) {
    throw new Error('Timesheet entries or project splits are required for allocation.');
  }

  const totalHours = timesheetEntries.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
  if (totalHours <= 0) {
    throw new Error('Total timesheet hours must be greater than zero.');
  }

  const journalEntries = timesheetEntries.map((entry) => {
    const ratio = Math.round(((Number(entry.hours) || 0) / totalHours) * 10000) / 10000;
    const allocatedBaseSalary = Math.round(grossSalary * ratio * 100) / 100;
    const allocatedOvertime = Math.round(overtime * ratio * 100) / 100;
    const allocatedEmployerTaxes = Math.round(employerTaxes * ratio * 100) / 100;
    const allocatedBenefitsCost = Math.round(benefitsCost * ratio * 100) / 100;

    const totalAllocatedCost = Math.round(
      (allocatedBaseSalary + allocatedOvertime + allocatedEmployerTaxes + allocatedBenefitsCost) * 100
    ) / 100;

    return {
      employeeId,
      payrollRunId,
      projectCode: entry.projectCode,
      costCenter: entry.costCenter,
      hoursLogged: Number(entry.hours) || 0,
      allocationRatio: ratio,
      allocatedBaseSalary,
      allocatedOvertime,
      allocatedEmployerTaxes,
      allocatedBenefitsCost,
      totalAllocatedCost,
    };
  });

  return {
    totalHours,
    journalEntries,
  };
}

module.exports = {
  distributeLaborCost,
};