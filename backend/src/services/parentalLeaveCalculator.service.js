/**
 * Parental Leave Top-Up Calculator Service - Issue #1817
 *
 * Implements wage replacement top-up math by deducting statutory social security/state insurance
 * daily allowances from pro-rated regular pay and calculating clawback reconciliation adjustments.
 */
'use strict';

const logger = require('../utils/logger');

// Standard monthly working days divisor for daily salary rate derivation
const STANDARD_MONTH_WORKING_DAYS = 22;

/**
 * Calculates parental leave wage replacement and employer top-up:
 * - Daily Base Rate = Monthly Salary / 22
 * - Pro-Rated Normal Salary = Daily Base Rate * Working Days on Leave
 * - Statutory Insurance Benefit = Statutory Daily Rate * Working Days on Leave
 * - Employer Top-Up = max(0, Pro-Rated Normal Salary - Statutory Insurance Benefit)
 */
function calculateParentalLeaveTopUp({
  regularMonthlySalary,
  workingDaysOnLeave,
  statutoryDailyInsuranceRate = 0,
}) {
  if (regularMonthlySalary <= 0 || workingDaysOnLeave <= 0) {
    throw new Error('Monthly salary and working days on leave must be strictly positive.');
  }

  const dailyBaseSalary = Math.round((regularMonthlySalary / STANDARD_MONTH_WORKING_DAYS) * 100) / 100;
  const proRatedNormalSalary = Math.round((dailyBaseSalary * workingDaysOnLeave) * 100) / 100;

  const totalStatutoryBenefitEstimated = Math.round(
    (statutoryDailyInsuranceRate * workingDaysOnLeave) * 100
  ) / 100;

  const employerTopUpAmount = Math.max(
    0,
    Math.round((proRatedNormalSalary - totalStatutoryBenefitEstimated) * 100) / 100
  );

  return {
    regularMonthlySalary,
    workingDaysOnLeave,
    dailyBaseSalary,
    proRatedNormalSalary,
    statutoryDailyInsuranceRate,
    totalStatutoryBenefitEstimated,
    employerTopUpAmount,
  };
}

/**
 * Calculates reconciliation adjustment if actual statutory receipt differs from estimation:
 * Adjustment = Estimated Benefit - Actual Benefit
 * (Positive means employer pays extra top-up; negative means clawback)
 */
function calculateReconciliationAdjustment(estimatedBenefit, actualBenefit) {
  if (estimatedBenefit < 0 || actualBenefit < 0) {
    throw new Error('Benefits cannot be negative.');
  }
  return Math.round((estimatedBenefit - actualBenefit) * 100) / 100;
}

module.exports = {
  calculateParentalLeaveTopUp,
  calculateReconciliationAdjustment,
  STANDARD_MONTH_WORKING_DAYS,
};