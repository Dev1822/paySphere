/**
 * Fringe Benefit Tax (FBT) Calculator Service - Issue #1600
 *
 * Computes statutory gross-up values, taxable perk reductions for employee contributions,
 * and employer quarterly FBT tax returns under Type 1 (GST creditable) and Type 2 (GST-free) rules.
 */
'use strict';

const logger = require('../utils/logger');

// Statutory Standard Rates
const GROSS_UP_MULTIPLIERS = {
  type_1_gst_credited: 2.0802,
  type_2_gst_free: 1.8868,
};

const DEFAULT_FBT_TAX_RATE = 47; // 47% statutory FBT rate

/**
 * Calculates FBT gross-up and employer liability:
 */
function calculateFbtMetrics({
  rawBenefitValue,
  employeeContribution = 0,
  grossUpFactorType = 'type_1_gst_credited',
  fbtRatePercent = DEFAULT_FBT_TAX_RATE,
}) {
  if (rawBenefitValue === undefined || rawBenefitValue < 0) {
    throw new Error('Raw benefit value must be non-negative.');
  }

  const netTaxableBenefitValue = Math.max(0, Math.round((rawBenefitValue - employeeContribution) * 100) / 100);
  const multiplier = GROSS_UP_MULTIPLIERS[grossUpFactorType] || GROSS_UP_MULTIPLIERS.type_1_gst_credited;

  const grossedUpTaxableValue = Math.round(netTaxableBenefitValue * multiplier * 100) / 100;
  const employerFbtLiability = Math.round(grossedUpTaxableValue * (fbtRatePercent / 100) * 100) / 100;

  return {
    rawBenefitValue,
    employeeContribution,
    netTaxableBenefitValue,
    grossUpFactorType,
    grossUpMultiplier: multiplier,
    grossedUpTaxableValue,
    fbtRatePercent,
    employerFbtLiability,
  };
}

module.exports = {
  calculateFbtMetrics,
  GROSS_UP_MULTIPLIERS,
};