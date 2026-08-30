/**
 * @fileoverview Flexible Benefit Plan (FBP) Tax Exemption & Claims Engine
 * @description Manages monthly flexible allowance declarations, statutory component limits,
 * reimbursement receipt verification, and year-end unspent taxable rollups.
 * Issue: #1664
 */

const FBP_STATUTORY_ANNUAL_CAPS = {
  TELECOM_BROADBAND: 36000,          // ₹3,000 / month
  BOOKS_PERIODICALS: 24000,          // ₹2,000 / month
  FUEL_DRIVER: 48000,                // ₹4,000 / month
  MEAL_COUPONS: 26400,               // ₹2,200 / month (₹50/meal * 2 * 22 days)
  PROFESSIONAL_DEVELOPMENT: 60000,   // ₹5,000 / month
};

/**
 * Validates employee's monthly FBP component declaration against statutory caps and eligible CTC.
 *
 * @param {object} monthlyAllocations - Object with component keys and monthly allocation amounts
 * @param {number} maxMonthlyFbpPool - Maximum FBP pool allowed for employee per month
 * @returns {{ isValid: boolean, validatedAllocations: object, totalMonthlyDeclared: number, annualDeclaredTotal: number, errors: Array<string> }}
 */
function validateFbpDeclaration(monthlyAllocations = {}, maxMonthlyFbpPool = 50000) {
  const validatedAllocations = {};
  const errors = [];
  let totalMonthlyDeclared = 0;

  for (const [key, cap] of Object.entries(FBP_STATUTORY_ANNUAL_CAPS)) {
    const requested = Math.max(0, Number(monthlyAllocations[key]) || 0);
    const monthlyMaxCap = Math.round(cap / 12);

    if (requested > monthlyMaxCap) {
      errors.push(`${key} allocation (₹${requested}) exceeds statutory monthly cap of ₹${monthlyMaxCap}`);
      validatedAllocations[key] = monthlyMaxCap;
      totalMonthlyDeclared += monthlyMaxCap;
    } else {
      validatedAllocations[key] = requested;
      totalMonthlyDeclared += requested;
    }
  }

  if (totalMonthlyDeclared > maxMonthlyFbpPool) {
    errors.push(`Total declared FBP (₹${totalMonthlyDeclared}) exceeds monthly flexible pool ceiling of ₹${maxMonthlyFbpPool}`);
  }

  return {
    isValid: errors.length === 0,
    validatedAllocations,
    totalMonthlyDeclared,
    annualDeclaredTotal: totalMonthlyDeclared * 12,
    errors,
  };
}

/**
 * Processes an FBP reimbursement claim against an employee's allocated balance.
 *
 * @param {number} allocatedAnnualAmount - Annual amount declared for this component
 * @param {number} previouslyClaimedAmount - Cumulative verified claims for this component
 * @param {number} claimAmount - Amount submitted for reimbursement
 * @param {boolean} isReceiptVerified - Whether valid proof/receipt is attached and verified
 * @returns {{ isApproved: boolean, approvedAmount: number, remainingAnnualBalance: number, taxablePortion: number, rejectionReason: string|null }}
 */
function processFbpClaim(
  allocatedAnnualAmount = 0,
  previouslyClaimedAmount = 0,
  claimAmount = 0,
  isReceiptVerified = true,
) {
  const safeAllocated = Math.max(0, Number(allocatedAnnualAmount) || 0);
  const safeClaimed = Math.max(0, Number(previouslyClaimedAmount) || 0);
  const safeCurrent = Math.max(0, Number(claimAmount) || 0);

  if (safeCurrent <= 0) {
    return {
      isApproved: false,
      approvedAmount: 0,
      remainingAnnualBalance: Math.max(0, safeAllocated - safeClaimed),
      taxablePortion: 0,
      rejectionReason: 'Claim amount must be greater than zero',
    };
  }

  const availableBalance = Math.max(0, safeAllocated - safeClaimed);
  if (availableBalance <= 0) {
    return {
      isApproved: false,
      approvedAmount: 0,
      remainingAnnualBalance: 0,
      taxablePortion: 0,
      rejectionReason: 'Annual allocated balance for this component is exhausted',
    };
  }

  if (!isReceiptVerified) {
    return {
      isApproved: false,
      approvedAmount: 0,
      remainingAnnualBalance: availableBalance,
      taxablePortion: safeCurrent,
      rejectionReason: 'Receipt proof verification failed. Amount remains taxable.',
    };
  }

  const approvedAmount = Math.min(safeCurrent, availableBalance);
  const remainingAnnualBalance = availableBalance - approvedAmount;

  return {
    isApproved: true,
    approvedAmount,
    remainingAnnualBalance,
    taxablePortion: 0,
    rejectionReason: null,
  };
}

/**
 * Computes year-end FBP tax rollup converting unspent allocations into taxable salary.
 *
 * @param {object} annualAllocations - Object with declared annual amounts per component
 * @param {object} verifiedClaims - Object with cumulative verified claim amounts per component
 * @returns {{ totalDeclaredAnnual: number, totalTaxExemptClaimed: number, totalUnspentTaxableRollup: number, componentSummary: Array<object> }}
 */
function calculateYearEndFbpRollup(annualAllocations = {}, verifiedClaims = {}) {
  let totalDeclaredAnnual = 0;
  let totalTaxExemptClaimed = 0;
  let totalUnspentTaxableRollup = 0;
  const componentSummary = [];

  for (const [key, cap] of Object.entries(FBP_STATUTORY_ANNUAL_CAPS)) {
    const declared = Math.min(cap, Math.max(0, Number(annualAllocations[key]) || 0));
    const claimed = Math.min(declared, Math.max(0, Number(verifiedClaims[key]) || 0));
    const unspent = declared - claimed;

    totalDeclaredAnnual += declared;
    totalTaxExemptClaimed += claimed;
    totalUnspentTaxableRollup += unspent;

    componentSummary.push({
      component: key,
      statutoryCap: cap,
      declaredAmount: declared,
      verifiedClaimedAmount: claimed,
      unspentTaxableAmount: unspent,
    });
  }

  return {
    totalDeclaredAnnual,
    totalTaxExemptClaimed,
    totalUnspentTaxableRollup,
    componentSummary,
  };
}

module.exports = {
  FBP_STATUTORY_ANNUAL_CAPS,
  validateFbpDeclaration,
  processFbpClaim,
  calculateYearEndFbpRollup,
};
