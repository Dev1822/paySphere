/**
 * @fileoverview Statutory Retrenchment & Severance Compensation (ID Act 1947) Engine
 * @description Computes statutory retrenchment compensation (15 days average pay per completed year of service
 * under Section 25F Industrial Disputes Act 1947), notice in lieu wages, and Section 10(10B) tax exemptions (₹5L cap).
 * Issue: #2064
 */

const MIN_CONTINUOUS_WORKING_DAYS = 240; // Section 25B statutory 240-day continuous service threshold
const STATUTORY_DAILY_WAGE_DIVISOR = 26; // 26 working days in a month for daily wage calculation
const STATUTORY_DAYS_PER_YEAR = 15;      // 15 days average pay per completed year
const STATUTORY_10_10B_MAX_EXEMPTION = 500000; // ₹5,00,000 Section 10(10B) exemption ceiling

/**
 * Evaluates continuous service eligibility under Section 25B.
 */
function evaluateTenurialEligibility(continuousWorkingDays = MIN_CONTINUOUS_WORKING_DAYS) {
  const days = Math.max(0, Number(continuousWorkingDays) || 0);
  const isEligible = days >= MIN_CONTINUOUS_WORKING_DAYS;

  return {
    continuousWorkingDays: days,
    minimumRequiredDays: MIN_CONTINUOUS_WORKING_DAYS,
    isEligible,
    rejectionReason: isEligible
      ? null
      : `Continuous service is ${days} days (requires minimum ${MIN_CONTINUOUS_WORKING_DAYS} days under Section 25B)`,
  };
}

/**
 * Computes statutory retrenchment severance package and Section 10(10B) tax exemption.
 *
 * @param {number} monthlyBasic - Monthly basic wage
 * @param {number} monthlyDa - Monthly DA
 * @param {number} serviceYears - Completed service years
 * @param {number} serviceMonthsFraction - Additional months (excess > 6 months rounds up to 1 full year)
 * @param {boolean} noticeServed - True if 1-month statutory notice was given; False if notice wages in lieu due
 * @param {number} continuousWorkingDays - Working days in preceding 12 months
 * @returns {{ isEligible: boolean, roundedServiceYears: number, dailyWageRate: number, retrenchmentCompensation: number, noticeInLieuWages: number, grossSeveranceAmount: number, taxExempt10_10B: number, taxableSeverance: number }}
 */
function computeRetrenchmentSeverance(
  monthlyBasic = 0,
  monthlyDa = 0,
  serviceYears = 1,
  serviceMonthsFraction = 0,
  noticeServed = false,
  continuousWorkingDays = MIN_CONTINUOUS_WORKING_DAYS,
) {
  const eligibility = evaluateTenurialEligibility(continuousWorkingDays);

  if (!eligibility.isEligible) {
    return {
      isEligible: false,
      rejectionReason: eligibility.rejectionReason,
      roundedServiceYears: 0,
      dailyWageRate: 0,
      retrenchmentCompensation: 0,
      noticeInLieuWages: 0,
      grossSeveranceAmount: 0,
      taxExempt10_10B: 0,
      taxableSeverance: 0,
    };
  }

  const basic = Math.max(0, Number(monthlyBasic) || 0);
  const da = Math.max(0, Number(monthlyDa) || 0);
  const totalMonthlyWage = basic + da;

  // Rounding: > 6 months counts as 1 full year
  const rawYears = Math.max(0, Number(serviceYears) || 0);
  const rawMonths = Math.max(0, Number(serviceMonthsFraction) || 0);
  const roundedServiceYears = rawMonths > 6 ? rawYears + 1 : Math.max(1, rawYears);

  const dailyWageRate = Math.round((totalMonthlyWage / STATUTORY_DAILY_WAGE_DIVISOR) * 100) / 100;
  const retrenchmentCompensation = Math.round(dailyWageRate * STATUTORY_DAYS_PER_YEAR * roundedServiceYears * 100) / 100;

  // 1 month notice wages in lieu if statutory 1-month notice was not served
  const noticeInLieuWages = noticeServed ? 0 : totalMonthlyWage;

  const grossSeveranceAmount = Math.round((retrenchmentCompensation + noticeInLieuWages) * 100) / 100;

  // Section 10(10B) statutory tax exemption
  const taxExempt10_10B = Math.min(grossSeveranceAmount, STATUTORY_10_10B_MAX_EXEMPTION);
  const taxableSeverance = Math.max(0, Math.round((grossSeveranceAmount - taxExempt10_10B) * 100) / 100);

  return {
    isEligible: true,
    rejectionReason: null,
    totalMonthlyWage,
    roundedServiceYears,
    dailyWageRate,
    retrenchmentCompensation,
    noticeInLieuWages,
    grossSeveranceAmount,
    taxExempt10_10B,
    taxableSeverance,
  };
}

/**
 * Aggregates Form P statutory retrenchment report across organization batch.
 */
function generateFormPRetrenchmentLedger(retrenchmentBatch = []) {
  let totalRetrenched = 0;
  let eligibleCount = 0;
  let totalCompensation = 0;
  let totalNoticeInLieu = 0;
  let totalGrossSeverance = 0;
  let totalTaxExempt = 0;
  let totalTaxable = 0;

  const itemizedList = [];

  for (const emp of retrenchmentBatch) {
    const basic = emp.basic || emp.salaryDetails?.basic || 35000;
    const da = emp.da || emp.salaryDetails?.da || 0;
    const years = emp.serviceYears || 3;
    const months = emp.serviceMonthsFraction || 0;
    const noticeServed = Boolean(emp.noticeServed);
    const days = emp.continuousWorkingDays !== undefined ? emp.continuousWorkingDays : 240;

    const calc = computeRetrenchmentSeverance(basic, da, years, months, noticeServed, days);

    totalRetrenched += 1;
    if (calc.isEligible) {
      eligibleCount += 1;
      totalCompensation += calc.retrenchmentCompensation;
      totalNoticeInLieu += calc.noticeInLieuWages;
      totalGrossSeverance += calc.grossSeveranceAmount;
      totalTaxExempt += calc.taxExempt10_10B;
      totalTaxable += calc.taxableSeverance;
    }

    itemizedList.push({
      employeeId: emp.id || emp.employeeId || `RET-${totalRetrenched}`,
      name: emp.name || emp.fullName || 'Employee',
      ...calc,
    });
  }

  return {
    totalRetrenched,
    eligibleCount,
    totalCompensation: Math.round(totalCompensation * 100) / 100,
    totalNoticeInLieu: Math.round(totalNoticeInLieu * 100) / 100,
    totalGrossSeverance: Math.round(totalGrossSeverance * 100) / 100,
    totalTaxExempt: Math.round(totalTaxExempt * 100) / 100,
    totalTaxable: Math.round(totalTaxable * 100) / 100,
    itemizedList,
  };
}

module.exports = {
  MIN_CONTINUOUS_WORKING_DAYS,
  STATUTORY_DAILY_WAGE_DIVISOR,
  STATUTORY_DAYS_PER_YEAR,
  STATUTORY_10_10B_MAX_EXEMPTION,
  evaluateTenurialEligibility,
  computeRetrenchmentSeverance,
  generateFormPRetrenchmentLedger,
};
