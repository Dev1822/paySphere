/**
 * @fileoverview Corporate Wellness Wallet & Section 80D Preventive Health Engine
 * @description Manages monthly wellness wallet quotas, claim adjudication,
 * Section 80D ₹5,000 statutory preventive health tax exemptions, and taxable perk splits.
 * Issue: #1961
 */

const STATUTORY_80D_PREVENTIVE_ANNUAL_CAP = 5000; // ₹5,000 statutory Section 80D exemption

const WELLNESS_CATEGORIES = {
  PREVENTIVE_HEALTH_CHECKUP: 'PREVENTIVE_HEALTH_CHECKUP', // Section 80D exempt up to ₹5,000
  GYM_FITNESS_MEMBERSHIP: 'GYM_FITNESS_MEMBERSHIP',       // Taxable perquisite reimbursement
  MENTAL_HEALTH_COUNSELING: 'MENTAL_HEALTH_COUNSELING',   // Taxable perquisite reimbursement
  SPORTS_EQUIPMENT: 'SPORTS_EQUIPMENT',                   // Taxable perquisite reimbursement
};

/**
 * Adjudicates a single wellness wallet claim and computes Section 80D tax exemption.
 *
 * @param {string} category - Category from WELLNESS_CATEGORIES
 * @param {number} claimedAmount - Claim invoice amount
 * @param {number} ytdPreventiveExemptClaimed - Already claimed 80D preventive exemption YTD
 * @param {boolean} isReceiptVerified - Proof of invoice verified
 * @returns {{ category: string, claimedAmount: number, taxExempt80DAmount: number, taxablePerkAmount: number, isApproved: boolean, auditNotes: string }}
 */
function evaluateWellnessClaim(
  category = WELLNESS_CATEGORIES.GYM_FITNESS_MEMBERSHIP,
  claimedAmount = 0,
  ytdPreventiveExemptClaimed = 0,
  isReceiptVerified = true,
) {
  const amount = Math.max(0, Number(claimedAmount) || 0);
  const cat = String(category).trim().toUpperCase();
  const ytdExempt = Math.max(0, Number(ytdPreventiveExemptClaimed) || 0);

  if (!isReceiptVerified) {
    return {
      category: cat,
      claimedAmount: amount,
      taxExempt80DAmount: 0,
      taxablePerkAmount: 0,
      isApproved: false,
      auditNotes: 'Merchant invoice / diagnostic receipt is unverified. Claim rejected.',
    };
  }

  if (cat === WELLNESS_CATEGORIES.PREVENTIVE_HEALTH_CHECKUP) {
    const remaining80DCap = Math.max(0, STATUTORY_80D_PREVENTIVE_ANNUAL_CAP - ytdExempt);
    const taxExempt80DAmount = Math.min(amount, remaining80DCap);
    const taxablePerkAmount = Math.max(0, Math.round((amount - taxExempt80DAmount) * 100) / 100);

    return {
      category: cat,
      claimedAmount: amount,
      taxExempt80DAmount,
      taxablePerkAmount,
      isApproved: true,
      auditNotes: taxExempt80DAmount > 0
        ? `₹${taxExempt80DAmount} exempt under Section 80D preventive health limit.`
        : 'Section 80D ₹5,000 preventive annual limit exhausted. Amount treated as taxable perk.',
    };
  }

  // All other fitness/wellness categories are taxable reimbursements
  return {
    category: cat,
    claimedAmount: amount,
    taxExempt80DAmount: 0,
    taxablePerkAmount: amount,
    isApproved: true,
    auditNotes: 'Approved as taxable employee wellness reimbursement.',
  };
}

/**
 * Calculates annual tax summary across wellness claims.
 */
function calculateAnnualWellnessTaxSplit(claims = []) {
  let totalClaimed = 0;
  let totalApproved = 0;
  let totalExempt80D = 0;
  let totalTaxablePerks = 0;
  let ytdPreventive = 0;

  const itemizedRecords = [];

  for (const c of claims) {
    const evalResult = evaluateWellnessClaim(
      c.category,
      c.amount,
      ytdPreventive,
      c.isReceiptVerified !== false,
    );

    totalClaimed += Number(c.amount) || 0;

    if (evalResult.isApproved) {
      totalApproved += evalResult.claimedAmount;
      totalExempt80D += evalResult.taxExempt80DAmount;
      totalTaxablePerks += evalResult.taxablePerkAmount;
      ytdPreventive += evalResult.taxExempt80DAmount;
    }

    itemizedRecords.push({
      claimId: c.id || c.claimId || `WLM-${itemizedRecords.length + 1}`,
      ...evalResult,
    });
  }

  return {
    totalClaimsCount: claims.length,
    totalClaimed: Math.round(totalClaimed * 100) / 100,
    totalApproved: Math.round(totalApproved * 100) / 100,
    totalExempt80D: Math.round(totalExempt80D * 100) / 100,
    totalTaxablePerks: Math.round(totalTaxablePerks * 100) / 100,
    remaining80DQuota: Math.max(0, STATUTORY_80D_PREVENTIVE_ANNUAL_CAP - totalExempt80D),
    itemizedRecords,
  };
}

module.exports = {
  STATUTORY_80D_PREVENTIVE_ANNUAL_CAP,
  WELLNESS_CATEGORIES,
  evaluateWellnessClaim,
  calculateAnnualWellnessTaxSplit,
};
