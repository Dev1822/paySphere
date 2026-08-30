/**
 * @fileoverview Employee Notice Period Shortfall Recovery & Employer Buyout Engine
 * @description Computes daily wage shortfall recoveries for unserved notice days,
 * handles management waivers, employer notice buyout reimbursements, and FnF integration.
 * Issue: #1959
 */

const STANDARD_MONTH_DAYS = 30;

/**
 * Computes notice period shortfall recovery amount.
 *
 * @param {number} monthlyBasic - Monthly basic pay
 * @param {number} monthlyDa - Monthly DA
 * @param {number} contractualNoticeDays - Total contractual notice days (e.g. 30, 60, 90)
 * @param {number} servedNoticeDays - Days actually served
 * @param {number} waivedDays - Management-approved waiver days
 * @returns {{ dailyWageRate: number, contractualDays: number, servedDays: number, unservedDays: number, waivedDays: number, netPayableShortfallDays: number, grossRecoveryAmount: number, waiverDeductionAmount: number, netShortfallRecovery: number }}
 */
function computeNoticeShortfallRecovery(
  monthlyBasic = 0,
  monthlyDa = 0,
  contractualNoticeDays = 30,
  servedNoticeDays = 0,
  waivedDays = 0,
) {
  const basic = Math.max(0, Number(monthlyBasic) || 0);
  const da = Math.max(0, Number(monthlyDa) || 0);
  const contractual = Math.max(0, Number(contractualNoticeDays) || 30);
  const served = Math.max(0, Math.min(contractual, Number(servedNoticeDays) || 0));

  const unservedDays = Math.max(0, contractual - served);
  const safeWaived = Math.max(0, Math.min(unservedDays, Number(waivedDays) || 0));
  const netPayableShortfallDays = unservedDays - safeWaived;

  const totalMonthlyWage = basic + da;
  const dailyWageRate = Math.round((totalMonthlyWage / STANDARD_MONTH_DAYS) * 100) / 100;

  const grossRecoveryAmount = Math.round(dailyWageRate * unservedDays * 100) / 100;
  const waiverDeductionAmount = Math.round(dailyWageRate * safeWaived * 100) / 100;
  const netShortfallRecovery = Math.round(dailyWageRate * netPayableShortfallDays * 100) / 100;

  return {
    monthlyWageBasis: totalMonthlyWage,
    dailyWageRate,
    contractualDays: contractual,
    servedDays: served,
    unservedDays,
    waivedDays: safeWaived,
    netPayableShortfallDays,
    grossRecoveryAmount,
    waiverDeductionAmount,
    netShortfallRecovery,
  };
}

/**
 * Evaluates candidate notice buyout reimbursement from previous employer.
 */
function processEmployerBuyoutReimbursement(
  buyoutAmountClaimed = 0,
  proofVerified = true,
  isTaxablePerk = true,
) {
  const amount = Math.max(0, Number(buyoutAmountClaimed) || 0);

  if (!proofVerified) {
    return {
      claimedAmount: amount,
      reimbursableAmount: 0,
      taxablePerquisite: 0,
      isApproved: false,
      status: 'REJECTED_UNVERIFIED_PROOF',
      auditNotes: 'Notice buyout invoice / FnF receipt from prior employer is unverified.',
    };
  }

  const reimbursableAmount = amount;
  const taxablePerquisite = isTaxablePerk ? amount : 0;

  return {
    claimedAmount: amount,
    reimbursableAmount,
    taxablePerquisite,
    isApproved: true,
    status: 'APPROVED_FOR_DISBURSEMENT',
    auditNotes: isTaxablePerk
      ? 'Buyout reimbursement approved as taxable salary perquisite under Income Tax rules.'
      : 'Buyout reimbursement approved as non-taxable corporate transfer.',
  };
}

/**
 * Aggregates notice shortfall recoveries across an offboarding batch.
 */
function generateNoticeSettlementLedger(offboardingRecords = []) {
  let totalContractualDays = 0;
  let totalShortfallDays = 0;
  let totalWaivedDays = 0;
  let totalRecoveryDeductions = 0;
  const itemizedRecords = [];

  for (const record of offboardingRecords) {
    const basic = record.basic || record.salaryDetails?.basic || 40000;
    const da = record.da || record.salaryDetails?.da || 0;
    const contractual = record.contractualDays || 60;
    const served = record.servedDays || 0;
    const waived = record.waivedDays || 0;

    const calc = computeNoticeShortfallRecovery(basic, da, contractual, served, waived);

    totalContractualDays += calc.contractualDays;
    totalShortfallDays += calc.netPayableShortfallDays;
    totalWaivedDays += calc.waivedDays;
    totalRecoveryDeductions += calc.netShortfallRecovery;

    itemizedRecords.push({
      employeeId: record.id || record.employeeId || `OFF-${itemizedRecords.length + 1}`,
      name: record.name || record.fullName || 'Employee',
      ...calc,
    });
  }

  return {
    totalEmployees: offboardingRecords.length,
    totalContractualDays,
    totalShortfallDays,
    totalWaivedDays,
    totalRecoveryDeductions: Math.round(totalRecoveryDeductions * 100) / 100,
    itemizedRecords,
  };
}

module.exports = {
  STANDARD_MONTH_DAYS,
  computeNoticeShortfallRecovery,
  processEmployerBuyoutReimbursement,
  generateNoticeSettlementLedger,
};
