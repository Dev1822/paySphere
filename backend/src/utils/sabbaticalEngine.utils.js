/**
 * @fileoverview Corporate Milestone Sabbatical & Long-Service Leave (LSL) Engine
 * @description Manages tenurial milestone accruals (30 days at 5 yrs, 45 at 7 yrs, 60 at 10 yrs),
 * pro-rata basic wage disbursements during leave, and exit encashments.
 * Issue: #2066
 */

const SABBATICAL_MILESTONES = [
  { minimumTenureYears: 10, accruedSabbaticalDays: 60, tierName: 'PLATINUM_DECADE_TIER' },
  { minimumTenureYears: 7, accruedSabbaticalDays: 45, tierName: 'GOLD_SEVEN_YEAR_TIER' },
  { minimumTenureYears: 5, accruedSabbaticalDays: 30, tierName: 'SILVER_FIVE_YEAR_TIER' },
];

const STANDARD_MONTH_DAYS = 30;

/**
 * Evaluates employee tenure and determines accrued milestone sabbatical days.
 *
 * @param {number} tenureYears - Years of continuous service
 * @returns {{ tenureYears: number, isEligible: boolean, accruedDays: number, milestoneTier: string }}
 */
function evaluateSabbaticalMilestoneAccrual(tenureYears = 0) {
  const years = Math.max(0, Number(tenureYears) || 0);

  for (const m of SABBATICAL_MILESTONES) {
    if (years >= m.minimumTenureYears) {
      return {
        tenureYears: years,
        isEligible: true,
        accruedDays: m.accruedSabbaticalDays,
        milestoneTier: m.tierName,
      };
    }
  }

  return {
    tenureYears: years,
    isEligible: false,
    accruedDays: 0,
    milestoneTier: 'BELOW_MILESTONE_THRESHOLD',
  };
}

/**
 * Computes basic wage disbursement for an approved sabbatical leave request.
 *
 * @param {number} monthlyBasic - Monthly basic salary
 * @param {number} daysRequested - Sabbatical days requested
 * @param {number} availableSabbaticalDays - Current sabbatical leave balance
 * @returns {{ daysRequested: number, daysApproved: number, dailyWageBasis: number, totalDisbursementAmount: number, remainingBalance: number, isApproved: boolean, auditNotes: string }}
 */
function calculateSabbaticalLeaveDisbursement(
  monthlyBasic = 0,
  daysRequested = 30,
  availableSabbaticalDays = 30,
) {
  const basic = Math.max(0, Number(monthlyBasic) || 0);
  const requested = Math.max(1, Number(daysRequested) || 1);
  const balance = Math.max(0, Number(availableSabbaticalDays) || 0);

  if (balance < requested) {
    return {
      daysRequested: requested,
      daysApproved: 0,
      dailyWageBasis: 0,
      totalDisbursementAmount: 0,
      remainingBalance: balance,
      isApproved: false,
      auditNotes: `Insufficient sabbatical leave balance (${balance} available, ${requested} requested).`,
    };
  }

  const dailyWageBasis = Math.round((basic / STANDARD_MONTH_DAYS) * 100) / 100;
  const totalDisbursementAmount = Math.round(dailyWageBasis * requested * 100) / 100;
  const remainingBalance = balance - requested;

  return {
    daysRequested: requested,
    daysApproved: requested,
    dailyWageBasis,
    totalDisbursementAmount,
    remainingBalance,
    isApproved: true,
    auditNotes: `Approved ${requested} days paid sabbatical leave.`,
  };
}

/**
 * Computes exit encashment for unavailed long-service leave / sabbatical balance.
 */
function calculateExitSabbaticalEncashment(monthlyBasic = 0, unavailedSabbaticalDays = 0) {
  const basic = Math.max(0, Number(monthlyBasic) || 0);
  const days = Math.max(0, Number(unavailedSabbaticalDays) || 0);

  const dailyWageBasis = Math.round((basic / STANDARD_MONTH_DAYS) * 100) / 100;
  const encashmentAmount = Math.round(dailyWageBasis * days * 100) / 100;

  return {
    monthlyBasic: basic,
    unavailedDays: days,
    dailyWageBasis,
    encashmentAmount,
  };
}

module.exports = {
  SABBATICAL_MILESTONES,
  STANDARD_MONTH_DAYS,
  evaluateSabbaticalMilestoneAccrual,
  calculateSabbaticalLeaveDisbursement,
  calculateExitSabbaticalEncashment,
};
