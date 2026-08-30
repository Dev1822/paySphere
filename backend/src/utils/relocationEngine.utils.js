/**
 * @fileoverview Employee Relocation Allowance & Section 10(14) Tax Engine
 * @description Manages relocation package head allocations, statutory 15-day temporary
 * stay exemptions, GST invoice verification, and taxable perk splits.
 * Issue: #1765
 */

const STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS = 15; // Statutory 15-day temporary hotel exemption

const RELOCATION_CATEGORIES = {
  GOODS_PACKING_TRANSIT: 'GOODS_PACKING_TRANSIT',       // 100% exempt if GST invoice verified
  TRAVEL_TICKETS: 'TRAVEL_TICKETS',                     // 100% exempt for employee & dependents
  TEMPORARY_ACCOMMODATION: 'TEMPORARY_ACCOMMODATION',   // Exempt up to 15 days; excess taxable
  BROKERAGE_SETTLING_IN: 'BROKERAGE_SETTLING_IN',       // Taxable perquisite
};

/**
 * Classifies an individual relocation claim item into tax-exempt vs taxable perquisite.
 *
 * @param {string} category - Category from RELOCATION_CATEGORIES
 * @param {number} invoiceAmount - Total claimed amount
 * @param {number} stayDurationDays - Stay duration (applicable for TEMPORARY_ACCOMMODATION)
 * @param {boolean} isGstInvoiceVerified - Whether valid GST tax invoice is attached
 * @returns {{ category: string, invoiceAmount: number, taxExemptAmount: number, taxablePerkAmount: number, isFullyExempt: boolean, auditNotes: string }}
 */
function classifyRelocationExpense(
  category = RELOCATION_CATEGORIES.GOODS_PACKING_TRANSIT,
  invoiceAmount = 0,
  stayDurationDays = 0,
  isGstInvoiceVerified = true,
) {
  const amount = Math.max(0, Number(invoiceAmount) || 0);
  const cat = String(category).trim().toUpperCase();

  if (!isGstInvoiceVerified) {
    return {
      category: cat,
      invoiceAmount: amount,
      taxExemptAmount: 0,
      taxablePerkAmount: amount,
      isFullyExempt: false,
      auditNotes: 'GST proof unverified. Entire amount classified as taxable perquisite.',
    };
  }

  if (cat === RELOCATION_CATEGORIES.GOODS_PACKING_TRANSIT || cat === RELOCATION_CATEGORIES.TRAVEL_TICKETS) {
    return {
      category: cat,
      invoiceAmount: amount,
      taxExemptAmount: amount,
      taxablePerkAmount: 0,
      isFullyExempt: true,
      auditNotes: '100% statutory tax exemption under Section 10(14).',
    };
  }

  if (cat === RELOCATION_CATEGORIES.TEMPORARY_ACCOMMODATION) {
    const days = Math.max(1, Number(stayDurationDays) || 1);
    if (days <= STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS) {
      return {
        category: cat,
        invoiceAmount: amount,
        taxExemptAmount: amount,
        taxablePerkAmount: 0,
        isFullyExempt: true,
        auditNotes: `Stay duration ${days} days is within statutory ${STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS}-day exemption limit.`,
      };
    }

    const exemptRatio = STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS / days;
    const taxExemptAmount = Math.round(amount * exemptRatio * 100) / 100;
    const taxablePerkAmount = Math.round((amount - taxExemptAmount) * 100) / 100;

    return {
      category: cat,
      invoiceAmount: amount,
      taxExemptAmount,
      taxablePerkAmount,
      isFullyExempt: false,
      auditNotes: `Stay duration ${days} days exceeds ${STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS}-day limit. Excess ${days - STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS} days are taxable.`,
    };
  }

  // BROKERAGE_SETTLING_IN or other fringe benefits
  return {
    category: cat,
    invoiceAmount: amount,
    taxExemptAmount: 0,
    taxablePerkAmount: amount,
    isFullyExempt: false,
    auditNotes: 'Brokerage and settling-in allowances are taxable perquisites under Income Tax rules.',
  };
}

/**
 * Aggregates all relocation package claims into overall tax-exempt and taxable totals.
 */
function calculateRelocationPackageTaxSplit(claims = []) {
  let totalDisbursed = 0;
  let totalTaxExempt = 0;
  let totalTaxablePerks = 0;
  const itemizedEvaluations = [];

  for (const c of claims) {
    const evalResult = classifyRelocationExpense(
      c.category,
      c.amount,
      c.stayDurationDays,
      c.isGstInvoiceVerified !== false,
    );

    totalDisbursed += evalResult.invoiceAmount;
    totalTaxExempt += evalResult.taxExemptAmount;
    totalTaxablePerks += evalResult.taxablePerkAmount;

    itemizedEvaluations.push({
      claimId: c.id || c.claimId || `CLM-${Date.now()}`,
      ...evalResult,
    });
  }

  return {
    totalClaimsCount: claims.length,
    totalDisbursed: Math.round(totalDisbursed * 100) / 100,
    totalTaxExempt: Math.round(totalTaxExempt * 100) / 100,
    totalTaxablePerks: Math.round(totalTaxablePerks * 100) / 100,
    itemizedEvaluations,
  };
}

module.exports = {
  STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS,
  RELOCATION_CATEGORIES,
  classifyRelocationExpense,
  calculateRelocationPackageTaxSplit,
};
