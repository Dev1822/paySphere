/**
 * Severance Calculator Service - Issue #1597
 *
 * Implements Industrial Disputes Act statutory retrenchment calculation formulas
 * (15 days average pay for every completed year of continuous service),
 * Section 10(10C) VRS tax exemption capping, and Section 89 multi-year relief spreads.
 */
'use strict';

const SeverancePackage = require('../models/severancePackage.model');
const logger = require('../utils/logger');

/**
 * Calculates statutory retrenchment pay:
 * Daily rate = Monthly Basic / 26 days (statutory standard)
 * Retrenchment Pay = 15 days * Daily Rate * completed years of service
 */
function calculateSeveranceBreakdown({
  lastDrawnMonthlySalary,
  tenureYears,
  noticePeriodDays = 30,
  voluntaryExGratia = 0,
  leaveEncashment = 0,
  statutoryExemptionCap = 500000,
}) {
  if (lastDrawnMonthlySalary <= 0 || tenureYears < 0) {
    throw new Error('Salary must be positive and tenure non-negative.');
  }

  const dailyRate = Math.round((lastDrawnMonthlySalary / 26) * 100) / 100;
  const noticePayAmount = Math.round(((lastDrawnMonthlySalary / 30) * noticePeriodDays) * 100) / 100;

  // 15 days average pay per completed year of service
  const completedYears = Math.floor(tenureYears);
  const statutoryRetrenchmentAmount = Math.round((15 * dailyRate * completedYears) * 100) / 100;

  const grossSeveranceAmount = Math.round(
    (noticePayAmount + statutoryRetrenchmentAmount + voluntaryExGratia + leaveEncashment) * 100
  ) / 100;

  // Exemption is capped under statutory rules (e.g., Section 10(10C) max limit)
  const exemptPortion = Math.min(grossSeveranceAmount, statutoryExemptionCap);
  const taxableSeveranceAmount = Math.round((grossSeveranceAmount - exemptPortion) * 100) / 100;

  // Section 89 Relief Simulation: Estimate marginal spread relief over 3 preceding financial years
  let section89ReliefAmount = 0;
  if (taxableSeveranceAmount > 100000) {
    // Progressive tax differential estimation: spread taxable lump sum across 3 tenure years
    const currentYearMarginalTaxRate = 0.30;
    const spreadAverageTaxRate = 0.20;
    const taxDifferential = currentYearMarginalTaxRate - spreadAverageTaxRate;
    section89ReliefAmount = Math.round((taxableSeveranceAmount * taxDifferential) * 100) / 100;
  }

  const estimatedTaxWithheld = Math.max(0, Math.round((taxableSeveranceAmount * 0.30 - section89ReliefAmount) * 100) / 100);
  const netDisbursementAmount = Math.round((grossSeveranceAmount - estimatedTaxWithheld) * 100) / 100;

  return {
    dailyRate,
    noticePayAmount,
    statutoryRetrenchmentAmount,
    grossSeveranceAmount,
    taxableSeveranceAmount,
    section89ReliefAmount,
    estimatedTaxWithheld,
    netDisbursementAmount,
  };
}

module.exports = {
  calculateSeveranceBreakdown,
};