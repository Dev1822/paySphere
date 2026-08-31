/**
 * @fileoverview Statutory Overpayment Recovery & Section 7 Wages Protection Engine
 * @description Manages employee overpayment clawbacks with strict enforcement of Section 7
 * Payment of Wages Act 1936 (capping monthly total recoveries at 50% of wages).
 * Issue: #2067
 */

const STATUTORY_MAX_DEDUCTION_RATIO = 0.50; // Max 50% deduction ceiling under Section 7
const COOPERATIVE_MAX_DEDUCTION_RATIO = 0.75; // Max 75% for cooperative payments

/**
 * Computes statutory maximum allowable deduction capacity for a wage period.
 */
function calculateMaxStatutoryDeductionCap(monthlyEarnings = 0, isCooperativeSociety = false) {
  const earnings = Math.max(0, Number(monthlyEarnings) || 0);
  const ratio = isCooperativeSociety ? COOPERATIVE_MAX_DEDUCTION_RATIO : STATUTORY_MAX_DEDUCTION_RATIO;
  const maxAllowableDeduction = Math.round(earnings * ratio * 100) / 100;

  return {
    monthlyEarnings: earnings,
    statutoryCeilingRatio: ratio,
    maxAllowableDeduction,
  };
}

/**
 * Generates statutory compliant installment schedule for an overpayment recovery.
 *
 * @param {number} totalOverpaymentAmount - Total overpayment liability to recover
 * @param {number} monthlyEarnings - Employee monthly earnings baseline
 * @param {number} targetInstallments - Preferred number of installments
 * @param {boolean} isCooperativeSociety - True if cooperative payment rules apply (75% cap)
 * @returns {{ totalOverpayment: number, statutoryMonthlyCap: number, numberOfInstallments: number, monthlyInstallmentAmount: number, isCappedByStatute: boolean, schedule: Array }}
 */
function generateOverpaymentInstallmentSchedule(
  totalOverpaymentAmount = 0,
  monthlyEarnings = 50000,
  targetInstallments = 3,
  isCooperativeSociety = false,
) {
  const overpayment = Math.max(0, Number(totalOverpaymentAmount) || 0);
  const capInfo = calculateMaxStatutoryDeductionCap(monthlyEarnings, isCooperativeSociety);
  const maxMonthlyCap = capInfo.maxAllowableDeduction;

  if (overpayment === 0 || maxMonthlyCap === 0) {
    return {
      totalOverpayment: overpayment,
      statutoryMonthlyCap: maxMonthlyCap,
      numberOfInstallments: 0,
      monthlyInstallmentAmount: 0,
      isCappedByStatute: false,
      schedule: [],
    };
  }

  // Minimum installments required by statutory cap
  const minRequiredInstallments = Math.max(1, Math.ceil(overpayment / maxMonthlyCap));
  const effectiveInstallments = Math.max(minRequiredInstallments, Number(targetInstallments) || 1);

  const rawInstallment = Math.round((overpayment / effectiveInstallments) * 100) / 100;
  const isCappedByStatute = rawInstallment > maxMonthlyCap;
  const monthlyInstallment = isCappedByStatute ? maxMonthlyCap : rawInstallment;

  const schedule = [];
  let balance = overpayment;

  for (let i = 1; i <= effectiveInstallments; i++) {
    const deduction = i === effectiveInstallments ? balance : Math.min(balance, monthlyInstallment);
    balance = Math.max(0, Math.round((balance - deduction) * 100) / 100);

    schedule.push({
      installmentNumber: i,
      deductionAmount: Math.round(deduction * 100) / 100,
      remainingBalance: balance,
    });

    if (balance === 0) break;
  }

  return {
    totalOverpayment: overpayment,
    statutoryMonthlyCap: maxMonthlyCap,
    numberOfInstallments: schedule.length,
    monthlyInstallmentAmount: monthlyInstallment,
    isCappedByStatute,
    schedule,
  };
}

/**
 * Processes a single monthly cycle deduction adhering to statutory Section 7 cap.
 */
function processCycleOverpaymentDeduction(
  currentBalance = 0,
  monthlyEarnings = 50000,
  requestedDeduction = 0,
  isCooperativeSociety = false,
) {
  const balance = Math.max(0, Number(currentBalance) || 0);
  const capInfo = calculateMaxStatutoryDeductionCap(monthlyEarnings, isCooperativeSociety);
  const maxCap = capInfo.maxAllowableDeduction;

  const desired = requestedDeduction > 0 ? Number(requestedDeduction) : balance;
  const allowableDeduction = Math.min(balance, maxCap, desired);
  const newBalance = Math.max(0, Math.round((balance - allowableDeduction) * 100) / 100);

  const isDeductionCapped = desired > maxCap;

  return {
    previousBalance: balance,
    requestedDeduction: desired,
    actualDeducted: Math.round(allowableDeduction * 100) / 100,
    newBalance,
    isDeductionCapped,
    isFullyRecovered: newBalance === 0,
    auditNotes: isDeductionCapped
      ? `Requested deduction ₹${desired} capped at statutory 50% limit of ₹${maxCap}.`
      : `Successfully deducted ₹${allowableDeduction}. Remaining balance: ₹${newBalance}.`,
  };
}

module.exports = {
  STATUTORY_MAX_DEDUCTION_RATIO,
  COOPERATIVE_MAX_DEDUCTION_RATIO,
  calculateMaxStatutoryDeductionCap,
  generateOverpaymentInstallmentSchedule,
  processCycleOverpaymentDeduction,
};
