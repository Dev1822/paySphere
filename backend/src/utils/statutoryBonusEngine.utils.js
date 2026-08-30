/**
 * @fileoverview Statutory Bonus & Ex-Gratia (Payment of Bonus Act 1965) Engine
 * @description Computes statutory annual bonus (8.33% to 20% on ₹7,000/month statutory wage cap),
 * 30-day tenurial eligibility, ex-gratia distribution, and Form C registers.
 * Issue: #1764
 */

const STATUTORY_BONUS_WAGE_CAP_MONTHLY = 7000; // Section 12 statutory ceiling ₹7,000 / month
const STATUTORY_MIN_BONUS_PERCENT = 8.33;      // Minimum statutory bonus rate
const STATUTORY_MAX_BONUS_PERCENT = 20.0;      // Maximum statutory bonus rate
const STATUTORY_MIN_WORKING_DAYS = 30;         // Minimum working days required in financial year
const STANDARD_ANNUAL_WORKING_DAYS = 300;

/**
 * Evaluates tenurial eligibility for statutory bonus.
 */
function evaluateBonusEligibility(workedDaysInAccountingYear = 0) {
  const days = Math.max(0, Number(workedDaysInAccountingYear) || 0);
  const isEligible = days >= STATUTORY_MIN_WORKING_DAYS;

  return {
    workedDays: days,
    minimumRequiredDays: STATUTORY_MIN_WORKING_DAYS,
    isEligible,
    rejectionReason: isEligible
      ? null
      : `Worked ${days} days in financial year (requires minimum ${STATUTORY_MIN_WORKING_DAYS} days under Section 8)`,
  };
}

/**
 * Computes statutory bonus and ex-gratia allocation for an employee.
 *
 * @param {number} monthlyBasicPay - Monthly basic pay
 * @param {number} monthlyDa - Monthly DA
 * @param {number} bonusRatePercent - Declared statutory bonus rate (8.33% to 20%)
 * @param {number} workedDaysInYear - Total worked days (out of ~300)
 * @param {boolean} isExGratiaEligible - Whether higher earners receive ex-gratia
 * @param {number} exGratiaPercent - Custom ex-gratia rate (e.g. 5%)
 * @returns {{ isEligible: boolean, actualMonthlyWages: number, statutoryWageBaseMonthly: number, proRataFactor: number, statutoryBonusAmount: number, exGratiaAmount: number, totalBonusDisbursement: number }}
 */
function computeStatutoryBonusAndExGratia(
  monthlyBasicPay = 0,
  monthlyDa = 0,
  bonusRatePercent = STATUTORY_MIN_BONUS_PERCENT,
  workedDaysInYear = STANDARD_ANNUAL_WORKING_DAYS,
  isExGratiaEligible = false,
  exGratiaPercent = 0,
) {
  const eligibility = evaluateBonusEligibility(workedDaysInYear);
  if (!eligibility.isEligible) {
    return {
      isEligible: false,
      rejectionReason: eligibility.rejectionReason,
      actualMonthlyWages: monthlyBasicPay + monthlyDa,
      statutoryWageBaseMonthly: 0,
      proRataFactor: 0,
      statutoryBonusAmount: 0,
      exGratiaAmount: 0,
      totalBonusDisbursement: 0,
    };
  }

  const basic = Math.max(0, Number(monthlyBasicPay) || 0);
  const da = Math.max(0, Number(monthlyDa) || 0);
  const actualMonthlyWages = basic + da;

  // Rate capped between 8.33% and 20%
  const rate = Math.max(STATUTORY_MIN_BONUS_PERCENT, Math.min(STATUTORY_MAX_BONUS_PERCENT, Number(bonusRatePercent) || 8.33));

  // Statutory wage base capped at ₹7,000 / month
  const statutoryWageBaseMonthly = Math.min(actualMonthlyWages, STATUTORY_BONUS_WAGE_CAP_MONTHLY);

  const proRataFactor = Math.min(1.0, Math.max(0, (Number(workedDaysInYear) || STANDARD_ANNUAL_WORKING_DAYS) / STANDARD_ANNUAL_WORKING_DAYS));
  const annualizedStatutoryWage = statutoryWageBaseMonthly * 12 * proRataFactor;

  const statutoryBonusAmount = Math.round(((annualizedStatutoryWage * rate) / 100) * 100) / 100;

  let exGratiaAmount = 0;
  if (isExGratiaEligible && exGratiaPercent > 0) {
    // Ex-gratia on wage amount exceeding statutory ₹7,000 cap or discretionary gross wage percentage
    const excessMonthlyWages = Math.max(0, actualMonthlyWages - statutoryWageBaseMonthly);
    const annualizedExcessWage = excessMonthlyWages * 12 * proRataFactor;
    exGratiaAmount = Math.round(((annualizedExcessWage * Number(exGratiaPercent)) / 100) * 100) / 100;
  }

  const totalBonusDisbursement = Math.round((statutoryBonusAmount + exGratiaAmount) * 100) / 100;

  return {
    isEligible: true,
    rejectionReason: null,
    actualMonthlyWages,
    statutoryWageBaseMonthly,
    bonusRatePercent: rate,
    proRataFactor: Math.round(proRataFactor * 100) / 100,
    statutoryBonusAmount,
    exGratiaAmount,
    totalBonusDisbursement,
  };
}

/**
 * Generates statutory Form C bonus register export.
 */
function generateBonusRegisterFormC(employees = [], accountingYear = '2025-26', declaredBonusRate = 8.33) {
  let totalStatutoryBonus = 0;
  let totalExGratia = 0;
  let totalDisbursement = 0;
  const lineItems = [];

  for (const emp of employees) {
    const basic = emp.basic || emp.salaryDetails?.basic || 25000;
    const da = emp.da || emp.salaryDetails?.da || 0;
    const days = emp.workedDays || 300;

    const calc = computeStatutoryBonusAndExGratia(basic, da, declaredBonusRate, days, emp.isExGratiaEligible, emp.exGratiaPercent || 5);

    if (calc.isEligible) {
      totalStatutoryBonus += calc.statutoryBonusAmount;
      totalExGratia += calc.exGratiaAmount;
      totalDisbursement += calc.totalBonusDisbursement;
    }

    lineItems.push({
      employeeId: emp.id || emp._id || emp.employeeId,
      name: emp.name || emp.fullName || 'Employee',
      designation: emp.designation || 'Staff',
      ...calc,
    });
  }

  return {
    accountingYear,
    declaredBonusRate,
    totalEmployees: employees.length,
    eligibleEmployeesCount: lineItems.filter((l) => l.isEligible).length,
    totalStatutoryBonus: Math.round(totalStatutoryBonus * 100) / 100,
    totalExGratia: Math.round(totalExGratia * 100) / 100,
    totalDisbursement: Math.round(totalDisbursement * 100) / 100,
    lineItems,
  };
}

module.exports = {
  STATUTORY_BONUS_WAGE_CAP_MONTHLY,
  STATUTORY_MIN_BONUS_PERCENT,
  STATUTORY_MAX_BONUS_PERCENT,
  STATUTORY_MIN_WORKING_DAYS,
  evaluateBonusEligibility,
  computeStatutoryBonusAndExGratia,
  generateBonusRegisterFormC,
};
