/**
 * @fileoverview Loss of Pay (LOP) Retroactive Salary Clawback & Arrear Engine
 * @description Computes daily wage deltas for late-marked unpaid leaves or retroactive
 * paid leave approvals, with Payment of Wages Act statutory 50% deduction floor safeguards.
 * Issue: #1647
 */

const STATUTORY_MAX_DEDUCTION_PERCENT = 50; // Section 7/8 Payment of Wages Act (max 50% total salary deductions)

/**
 * Computes the retroactive LOP clawback and arrear payout deltas.
 *
 * @param {number} monthlyGrossSalary - Employee's monthly gross wage
 * @param {number} totalDaysInCycle - Total days in the payroll cycle (e.g. 28, 30, 31, or 26 statutory days)
 * @param {number} unapprovedLopDays - Retroactively discovered unpaid leave days (to be clawed back)
 * @param {number} retroactivePaidLeaveDays - Unpaid leaves subsequently approved as paid leaves (to be credited)
 * @returns {{ dailyRate: number, clawbackAmount: number, arrearPayout: number, netDelta: number, adjustmentType: 'CLAWBACK'|'ARREAR'|'BALANCED' }}
 */
function computeRetroactiveLopDelta(
  monthlyGrossSalary,
  totalDaysInCycle = 30,
  unapprovedLopDays = 0,
  retroactivePaidLeaveDays = 0,
) {
  const gross = Math.max(0, Number(monthlyGrossSalary) || 0);
  const cycleDays = Math.max(1, Number(totalDaysInCycle) || 30);
  const lopDays = Math.max(0, Number(unapprovedLopDays) || 0);
  const paidDays = Math.max(0, Number(retroactivePaidLeaveDays) || 0);

  const dailyRate = Math.round((gross / cycleDays) * 100) / 100;
  const clawbackAmount = Math.round(lopDays * dailyRate);
  const arrearPayout = Math.round(paidDays * dailyRate);
  const netDelta = arrearPayout - clawbackAmount;

  let adjustmentType = 'BALANCED';
  if (netDelta < 0) {
    adjustmentType = 'CLAWBACK';
  } else if (netDelta > 0) {
    adjustmentType = 'ARREAR';
  }

  return {
    dailyRate,
    cycleDays,
    unapprovedLopDays: lopDays,
    retroactivePaidLeaveDays: paidDays,
    clawbackAmount,
    arrearPayout,
    netDelta,
    adjustmentType,
  };
}

/**
 * Creates a compliant multi-month installment schedule ensuring deductions
 * never violate statutory minimum take-home salary caps.
 *
 * @param {number} totalClawbackAmount - Total amount to recover
 * @param {number} monthlyGrossSalary - Employee monthly gross salary
 * @param {number} preferredInstallments - Desired number of monthly installments
 * @param {number} statutoryMaxDeductionPercent - Max % of gross that can be deducted (default 50%)
 * @returns {{ totalClawback: number, maxMonthlyDeductionFloor: number, minimumMonthsRequired: number, installmentCount: number, schedule: Array<object>, isStatutoryCompliant: boolean }}
 */
function generateClawbackInstallmentPlan(
  totalClawbackAmount,
  monthlyGrossSalary,
  preferredInstallments = 1,
  statutoryMaxDeductionPercent = STATUTORY_MAX_DEDUCTION_PERCENT,
) {
  const totalClawback = Math.max(0, Number(totalClawbackAmount) || 0);
  const gross = Math.max(0, Number(monthlyGrossSalary) || 0);
  const maxDeductionFloor = Math.round((gross * statutoryMaxDeductionPercent) / 100);

  if (totalClawback === 0 || maxDeductionFloor === 0) {
    return {
      totalClawback: 0,
      maxMonthlyDeductionFloor: maxDeductionFloor,
      minimumMonthsRequired: 0,
      installmentCount: 0,
      schedule: [],
      isStatutoryCompliant: true,
    };
  }

  const minimumMonthsRequired = Math.ceil(totalClawback / maxDeductionFloor);
  const installmentCount = Math.max(minimumMonthsRequired, Math.max(1, Number(preferredInstallments) || 1));

  const monthlyBaseAmount = Math.floor(totalClawback / installmentCount);
  let remainder = totalClawback % installmentCount;
  let remainingPrincipal = totalClawback;

  const schedule = [];
  const startMonth = new Date().getMonth() + 1;
  const startYear = new Date().getFullYear();

  for (let i = 1; i <= installmentCount; i++) {
    let currentDeduction = monthlyBaseAmount;
    if (remainder > 0) {
      currentDeduction += 1;
      remainder -= 1;
    }

    remainingPrincipal -= currentDeduction;

    const monthNum = ((startMonth + i - 2) % 12) + 1;
    const yearOffset = Math.floor((startMonth + i - 2) / 12);

    schedule.push({
      installmentNumber: i,
      periodMonth: monthNum,
      periodYear: startYear + yearOffset,
      deductionAmount: currentDeduction,
      remainingBalance: Math.max(0, remainingPrincipal),
      isWithinStatutoryLimit: currentDeduction <= maxDeductionFloor,
    });
  }

  return {
    totalClawback,
    maxMonthlyDeductionFloor: maxDeductionFloor,
    minimumMonthsRequired,
    installmentCount,
    schedule,
    isStatutoryCompliant: true,
  };
}

/**
 * Builds double-entry accounting corrective journal entry for retroactive LOP adjustment.
 */
function buildLopAdjustmentJournalEntry(period, netDelta, clawbackTotal, arrearTotal) {
  const safeClawback = Math.max(0, Number(clawbackTotal) || 0);
  const safeArrear = Math.max(0, Number(arrearTotal) || 0);

  const entries = [];

  if (safeClawback > 0) {
    entries.push(
      {
        accountCode: 'RECV-1040',
        accountName: 'Employee Salary Advance & Clawback Receivable',
        debit: safeClawback,
        credit: 0,
      },
      {
        accountCode: 'EXP-5010',
        accountName: 'Salaries & Wages Expense (Retroactive LOP Recovery)',
        debit: 0,
        credit: safeClawback,
      },
    );
  }

  if (safeArrear > 0) {
    entries.push(
      {
        accountCode: 'EXP-5010',
        accountName: 'Salaries & Wages Expense (Retroactive Leave Arrears)',
        debit: safeArrear,
        credit: 0,
      },
      {
        accountCode: 'PAY-2010',
        accountName: 'Salaries & Arrears Payable',
        debit: 0,
        credit: safeArrear,
      },
    );
  }

  return {
    journalId: `JV-LOP-${period}-${Date.now().toString(36).toUpperCase()}`,
    period,
    netAdjustmentDelta: netDelta,
    entries,
    isBalanced: true,
  };
}

module.exports = {
  STATUTORY_MAX_DEDUCTION_PERCENT,
  computeRetroactiveLopDelta,
  generateClawbackInstallmentPlan,
  buildLopAdjustmentJournalEntry,
};
