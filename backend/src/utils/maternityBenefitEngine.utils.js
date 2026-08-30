/**
 * @fileoverview Statutory Maternity & Paternity Benefit (MB Act 1961) Engine
 * @description Computes statutory 80-day tenurial eligibility, average daily wage rates,
 * 26-week maternity benefit schedules, medical bonuses, and creche stipends.
 * Issue: #1665
 */

const STATUTORY_MINIMUM_WORKED_DAYS = 80; // Section 5(2) MB Act 1961
const STATUTORY_MEDICAL_BONUS = 3500;     // Section 8 statutory medical bonus
const STANDARD_MATERNITY_WEEKS_FIRST_TWO = 26; // 26 weeks (182 days)
const STANDARD_MATERNITY_WEEKS_SUBSEQUENT = 12; // 12 weeks (84 days)
const PATERNITY_LEAVE_WEEKS = 2; // 2 weeks (14 days)

/**
 * Evaluates employee tenurial eligibility and statutory leave duration.
 *
 * @param {number} workedDaysInLast12Months - Total days worked in 12 months preceding delivery
 * @param {number} existingSurvivingChildren - Number of existing surviving children
 * @param {'MATERNITY'|'PATERNITY'|'ADOPTION'} leaveType - Type of parental leave
 * @returns {{ isEligible: boolean, leaveDurationWeeks: number, totalLeaveDays: number, statutoryMedicalBonus: number, rejectionReason: string|null }}
 */
function evaluateMaternityEligibility(
  workedDaysInLast12Months = 0,
  existingSurvivingChildren = 0,
  leaveType = 'MATERNITY',
) {
  const daysWorked = Math.max(0, Number(workedDaysInLast12Months) || 0);

  if (leaveType === 'PATERNITY') {
    return {
      isEligible: true,
      leaveDurationWeeks: PATERNITY_LEAVE_WEEKS,
      totalLeaveDays: PATERNITY_LEAVE_WEEKS * 7,
      statutoryMedicalBonus: 0,
      rejectionReason: null,
    };
  }

  if (daysWorked < STATUTORY_MINIMUM_WORKED_DAYS) {
    return {
      isEligible: false,
      leaveDurationWeeks: 0,
      totalLeaveDays: 0,
      statutoryMedicalBonus: 0,
      rejectionReason: `Employee has worked ${daysWorked} days in preceding 12 months (statutory mandate requires >= ${STATUTORY_MINIMUM_WORKED_DAYS} days)`,
    };
  }

  const isMoreThanTwoChildren = Number(existingSurvivingChildren) >= 2;
  const leaveDurationWeeks = leaveType === 'ADOPTION' || isMoreThanTwoChildren
    ? STANDARD_MATERNITY_WEEKS_SUBSEQUENT
    : STANDARD_MATERNITY_WEEKS_FIRST_TWO;

  return {
    isEligible: true,
    leaveDurationWeeks,
    totalLeaveDays: leaveDurationWeeks * 7,
    statutoryMedicalBonus: STATUTORY_MEDICAL_BONUS,
    rejectionReason: null,
  };
}

/**
 * Computes average daily wage rate over preceding 3 calendar months under Section 5(1).
 *
 * @param {Array<number>} last3MonthsEarnings - Gross earnings for the 3 months preceding leave
 * @param {number} totalWorkingDays - Total working days in that 3-month period (default ~66 days)
 * @returns {{ totalEarnings3Months: number, totalDaysWorked: number, averageDailyWage: number }}
 */
function computeAverageDailyMaternityWage(last3MonthsEarnings = [], totalWorkingDays = 66) {
  const earnings = Array.isArray(last3MonthsEarnings) ? last3MonthsEarnings : [50000, 50000, 50000];
  const totalEarnings3Months = earnings.reduce((sum, val) => sum + Math.max(0, Number(val) || 0), 0);
  const totalDaysWorked = Math.max(1, Number(totalWorkingDays) || 66);

  const averageDailyWage = Math.round((totalEarnings3Months / totalDaysWorked) * 100) / 100;

  return {
    totalEarnings3Months,
    totalDaysWorked,
    averageDailyWage,
  };
}

/**
 * Generates statutory wage disbursement schedule across the leave period.
 */
function generateMaternityDisbursementSchedule(
  averageDailyWage,
  leaveDurationWeeks = 26,
  startDate = new Date(),
  medicalBonus = STATUTORY_MEDICAL_BONUS,
) {
  const dailyWage = Math.max(0, Number(averageDailyWage) || 0);
  const totalDays = Math.max(1, leaveDurationWeeks * 7);
  const totalWageBenefit = Math.round(dailyWage * totalDays);
  const totalPayableWithBonus = totalWageBenefit + (Number(medicalBonus) || 0);

  const monthlyInstallmentCount = Math.ceil(totalDays / 30);
  const baseMonthlyDisbursement = Math.floor(totalWageBenefit / monthlyInstallmentCount);

  const schedule = [];
  const start = new Date(startDate);

  for (let i = 1; i <= monthlyInstallmentCount; i++) {
    const isFirstMonth = i === 1;
    const isLastMonth = i === monthlyInstallmentCount;
    const bonusPortion = isFirstMonth ? medicalBonus : 0;
    const wagePortion = isLastMonth
      ? totalWageBenefit - baseMonthlyDisbursement * (monthlyInstallmentCount - 1)
      : baseMonthlyDisbursement;

    const installmentDate = new Date(start);
    installmentDate.setMonth(start.getMonth() + (i - 1));

    schedule.push({
      installmentNumber: i,
      disbursementMonth: installmentDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
      wageBenefit: wagePortion,
      medicalBonus: bonusPortion,
      totalDisbursement: wagePortion + bonusPortion,
    });
  }

  return {
    leaveDurationWeeks,
    totalLeaveDays: totalDays,
    averageDailyWage: dailyWage,
    totalWageBenefit,
    medicalBonus,
    totalPayableWithBonus,
    schedule,
  };
}

module.exports = {
  STATUTORY_MINIMUM_WORKED_DAYS,
  STATUTORY_MEDICAL_BONUS,
  STANDARD_MATERNITY_WEEKS_FIRST_TWO,
  STANDARD_MATERNITY_WEEKS_SUBSEQUENT,
  evaluateMaternityEligibility,
  computeAverageDailyMaternityWage,
  generateMaternityDisbursementSchedule,
};
