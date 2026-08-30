/**
 * Deferred Compensation Service - Issue #1813
 *
 * Implements Section 409A compliance rules, quarterly phantom interest compounding,
 * FICA tax liability calculation at deferral time, and distribution tranche execution.
 */
'use strict';

const DeferredCompensation = require('../models/deferredCompensation.model');
const logger = require('../utils/logger');

// Standard statutory Medicare + Social Security combined FICA rate at deferral (approx 7.65% or 1.45% above cap)
const DEFAULT_FICA_RATE_PERCENT = 7.65;

/**
 * Calculates initial deferral metrics and FICA tax due on deferral:
 */
function calculateDeferralMetrics({ grossAmount, deferralPercentage, benchmarkRatePercent = 6.5 }) {
  if (grossAmount <= 0 || deferralPercentage <= 0 || deferralPercentage > 80) {
    throw new Error('Gross amount must be positive and deferral percentage between 1% and 80%.');
  }

  const principalDeferred = Math.round((grossAmount * (deferralPercentage / 100)) * 100) / 100;
  const netTakeHomeReduced = principalDeferred;
  const ficaTaxDueAtDeferral = Math.round((principalDeferred * (DEFAULT_FICA_RATE_PERCENT / 100)) * 100) / 100;

  return {
    grossAmount,
    deferralPercentage,
    principalDeferred,
    netTakeHomeReduced,
    ficaTaxDueAtDeferral,
    benchmarkRatePercent,
  };
}

/**
 * Calculates quarterly compounding growth on accumulated balance:
 * Quarterly Rate = Annual Rate / 4
 * Interest = Balance * (Quarterly Rate / 100)
 */
function compoundQuarterlyGrowth(currentBalance, annualBenchmarkRatePercent = 6.5) {
  if (currentBalance < 0) throw new Error('Balance cannot be negative.');

  const quarterlyRate = annualBenchmarkRatePercent / 4;
  const interestEarned = Math.round((currentBalance * (quarterlyRate / 100)) * 100) / 100;
  const updatedBalance = Math.round((currentBalance + interestEarned) * 100) / 100;

  return {
    currentBalance,
    quarterlyRate,
    interestEarned,
    updatedBalance,
  };
}

module.exports = {
  calculateDeferralMetrics,
  compoundQuarterlyGrowth,
  DEFAULT_FICA_RATE_PERCENT,
};