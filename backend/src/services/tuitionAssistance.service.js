/**
 * Tuition Assistance Calculation Service - Issue #1816
 *
 * Enforces IRC Section 127 educational assistance annual limits ($5,250 / year),
 * splits claims into tax-exempt disbursements and taxable perquisite spillovers.
 */
'use strict';

const logger = require('../utils/logger');

// Statutory Section 127 annual tax-free educational assistance limit
const DEFAULT_SECTION_127_CAP = 5250;

/**
 * Calculates Section 127 exempt vs taxable spillover amounts:
 * - Remaining Exemption = max(0, Statutory Cap - Cumulative Prior Claims)
 * - Exempt Portion = min(Claimed Amount, Remaining Exemption)
 * - Taxable Spillover = Claimed Amount - Exempt Portion
 */
function calculateTuitionExemption({
  claimedAmount,
  cumulativePriorDisbursements = 0,
  statutoryCap = DEFAULT_SECTION_127_CAP,
}) {
  if (claimedAmount <= 0) {
    throw new Error('Claimed tuition amount must be strictly positive.');
  }

  const remainingExemptionHeadroom = Math.max(0, statutoryCap - cumulativePriorDisbursements);
  const exemptReimbursementAmount = Math.round(
    Math.min(claimedAmount, remainingExemptionHeadroom) * 100
  ) / 100;
  const taxableSpilloverPerquisiteAmount = Math.round(
    (claimedAmount - exemptReimbursementAmount) * 100
  ) / 100;

  const newCumulativeTotal = Math.round(
    (cumulativePriorDisbursements + claimedAmount) * 100
  ) / 100;

  return {
    claimedAmount,
    cumulativePriorDisbursements,
    statutoryCap,
    remainingExemptionHeadroom,
    exemptReimbursementAmount,
    taxableSpilloverPerquisiteAmount,
    newCumulativeTotal,
  };
}

module.exports = {
  calculateTuitionExemption,
  DEFAULT_SECTION_127_CAP,
};