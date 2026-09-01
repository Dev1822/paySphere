/**
 * @fileoverview Corporate Broadband & Telecommuting Tax Exemption Engine
 * @description Adjudicates broadband and remote work claims under Rule 3(7)(ix) of Income Tax Rules,
 * providing 100% tax-free classification for verified bills and taxing unreceipted allowances.
 * Issue: #2065
 */

const TELECOMMUTING_HEADS = {
  BROADBAND_INTERNET: 'BROADBAND_INTERNET',       // 100% tax-exempt if invoice verified
  MOBILE_TELEPHONE: 'MOBILE_TELEPHONE',           // 100% tax-exempt if invoice verified
  ERGONOMIC_EQUIPMENT: 'ERGONOMIC_EQUIPMENT',     // 100% tax-exempt work asset
  FIXED_REMOTE_ALLOWANCE: 'FIXED_REMOTE_ALLOWANCE', // 100% taxable salary earning
};

/**
 * Classifies a telecommuting expense claim into tax-free reimbursement vs taxable perquisite.
 *
 * @param {string} expenseHead - Category from TELECOMMUTING_HEADS
 * @param {number} invoiceAmount - Claimed invoice amount
 * @param {boolean} isGstInvoiceAttached - True if valid merchant bill is attached
 * @param {number} monthlyPolicyCap - Corporate monthly budget limit for the head
 * @returns {{ expenseHead: string, claimedAmount: number, approvedReimbursement: number, taxFreeAmount: number, taxablePerkAmount: number, isApproved: boolean, auditNotes: string }}
 */
function classifyTelecommutingClaim(
  expenseHead = TELECOMMUTING_HEADS.BROADBAND_INTERNET,
  invoiceAmount = 0,
  isGstInvoiceAttached = true,
  monthlyPolicyCap = 2500,
) {
  const amount = Math.max(0, Number(invoiceAmount) || 0);
  const head = String(expenseHead).trim().toUpperCase();
  const cap = Math.max(0, Number(monthlyPolicyCap) || 2500);

  if (head === TELECOMMUTING_HEADS.FIXED_REMOTE_ALLOWANCE) {
    return {
      expenseHead: head,
      claimedAmount: amount,
      approvedReimbursement: amount,
      taxFreeAmount: 0,
      taxablePerkAmount: amount,
      isApproved: true,
      auditNotes: 'Fixed remote work allowance is 100% taxable under Indian Income Tax rules.',
    };
  }

  if (!isGstInvoiceAttached) {
    return {
      expenseHead: head,
      claimedAmount: amount,
      approvedReimbursement: 0,
      taxFreeAmount: 0,
      taxablePerkAmount: 0,
      isApproved: false,
      auditNotes: 'Merchant bill / GST invoice missing. Telecommuting reimbursement rejected.',
    };
  }

  const approvedReimbursement = Math.min(amount, cap);
  const taxFreeAmount = approvedReimbursement;
  const taxablePerkAmount = 0;

  return {
    expenseHead: head,
    claimedAmount: amount,
    approvedReimbursement,
    taxFreeAmount,
    taxablePerkAmount,
    isApproved: true,
    auditNotes: amount > cap
      ? `Reimbursement capped at corporate policy head limit of ₹${cap}. 100% tax-free under Rule 3(7)(ix).`
      : '100% tax-free reimbursement under Rule 3(7)(ix) of Income Tax Rules.',
  };
}

/**
 * Aggregates annual telecommuting claims statement.
 */
function calculateAnnualTelecommutingTaxSplit(claims = []) {
  let totalClaimed = 0;
  let totalApproved = 0;
  let totalTaxFree = 0;
  let totalTaxable = 0;

  const itemizedRecords = [];

  for (const c of claims) {
    const evalResult = classifyTelecommutingClaim(
      c.expenseHead,
      c.amount,
      c.isGstInvoiceAttached !== false,
      c.policyCap || 2500,
    );

    totalClaimed += Number(c.amount) || 0;

    if (evalResult.isApproved) {
      totalApproved += evalResult.approvedReimbursement;
      totalTaxFree += evalResult.taxFreeAmount;
      totalTaxable += evalResult.taxablePerkAmount;
    }

    itemizedRecords.push({
      claimId: c.id || c.claimId || `TEL-${itemizedRecords.length + 1}`,
      ...evalResult,
    });
  }

  return {
    totalClaimsCount: claims.length,
    totalClaimed: Math.round(totalClaimed * 100) / 100,
    totalApproved: Math.round(totalApproved * 100) / 100,
    totalTaxFree: Math.round(totalTaxFree * 100) / 100,
    totalTaxable: Math.round(totalTaxable * 100) / 100,
    itemizedRecords,
  };
}

module.exports = {
  TELECOMMUTING_HEADS,
  classifyTelecommutingClaim,
  calculateAnnualTelecommutingTaxSplit,
};
