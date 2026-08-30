/**
 * @fileoverview Dual-Component Overtime (OT) Multiplier & Statutory Rest-Day Engine
 * @description Computes statutory overtime wage rates (1.5x / 2.0x under Section 59 Factories Act / FLSA),
 * 2.5x rest-day / holiday premiums, and 1:1 Compensatory Off (C-OFF) credits.
 * Issue: #1762
 */

const STANDARD_DAILY_HOURS = 8;
const STATUTORY_DOUBLE_OT_DAILY_THRESHOLD = 9;
const STATUTORY_WEEKLY_HOURS_CEILING = 48;
const RATE_MULTIPLIER_STANDARD_OT = 1.5;
const RATE_MULTIPLIER_DOUBLE_OT = 2.0;
const RATE_MULTIPLIER_HOLIDAY_REST_DAY = 2.5;

/**
 * Computes standard ordinary hourly wage rate from monthly basic and DA.
 *
 * @param {number} basicPay - Monthly basic pay
 * @param {number} dearnessAllowance - Monthly DA
 * @param {number} workingDaysInMonth - Monthly working days (default 26 days)
 * @param {number} dailyHours - Standard daily hours (default 8)
 * @returns {number} Hourly ordinary wage rate
 */
function computeHourlyOrdinaryWage(
  basicPay = 0,
  dearnessAllowance = 0,
  workingDaysInMonth = 26,
  dailyHours = STANDARD_DAILY_HOURS,
) {
  const safeBasic = Math.max(0, Number(basicPay) || 0);
  const safeDa = Math.max(0, Number(dearnessAllowance) || 0);
  const days = Math.max(1, Number(workingDaysInMonth) || 26);
  const hours = Math.max(1, Number(dailyHours) || 8);

  const totalMonthlyWages = safeBasic + safeDa;
  const totalStandardHours = days * hours;

  return Math.round((totalMonthlyWages / totalStandardHours) * 100) / 100;
}

/**
 * Calculates overtime wages across standard OT, statutory double OT, and holiday rest-day premiums.
 *
 * @param {number} hourlyRate - Ordinary hourly wage rate
 * @param {number} standardOtHours - Hours between 8h and 9h (1.5x)
 * @param {number} doubleOtHours - Hours > 9h or weekly > 48h (2.0x)
 * @param {number} holidayShiftHours - Hours worked on weekly rest days or declared holidays
 * @param {boolean} optForHolidayWage - True for 2.5x cash payout; False for 1:1 C-OFF credit
 * @returns {{ standardOtPay: number, doubleOtPay: number, holidayPay: number, totalOtEarnings: number, coffEarnedDays: number }}
 */
function calculateOvertimePay(
  hourlyRate = 0,
  standardOtHours = 0,
  doubleOtHours = 0,
  holidayShiftHours = 0,
  optForHolidayWage = true,
) {
  const rate = Math.max(0, Number(hourlyRate) || 0);
  const stdHours = Math.max(0, Number(standardOtHours) || 0);
  const dblHours = Math.max(0, Number(doubleOtHours) || 0);
  const holHours = Math.max(0, Number(holidayShiftHours) || 0);

  const standardOtPay = Math.round(stdHours * rate * RATE_MULTIPLIER_STANDARD_OT * 100) / 100;
  const doubleOtPay = Math.round(dblHours * rate * RATE_MULTIPLIER_DOUBLE_OT * 100) / 100;

  let holidayPay = 0;
  let coffEarnedDays = 0;

  if (holHours > 0) {
    if (optForHolidayWage) {
      holidayPay = Math.round(holHours * rate * RATE_MULTIPLIER_HOLIDAY_REST_DAY * 100) / 100;
    } else {
      // 1:1 Compensatory off credit: 8 hours = 1 day (fractional for partial shifts)
      coffEarnedDays = Math.round((holHours / STANDARD_DAILY_HOURS) * 10) / 10;
    }
  }

  const totalOtEarnings = Math.round((standardOtPay + doubleOtPay + holidayPay) * 100) / 100;

  return {
    hourlyRate: rate,
    standardOtHours: stdHours,
    doubleOtHours: dblHours,
    holidayShiftHours: holHours,
    standardOtPay,
    doubleOtPay,
    holidayPay,
    totalOtEarnings,
    coffEarnedDays,
  };
}

/**
 * Aggregates daily punch logs into monthly overtime totals.
 */
function aggregateMonthlyOvertime(shiftPunches = [], hourlyRate = 0) {
  let totalStandardHours = 0;
  let totalDoubleHours = 0;
  let totalHolidayHours = 0;
  let totalCoffCredited = 0;
  let totalEarnings = 0;

  for (const shift of shiftPunches) {
    const hours = Number(shift.workedHours) || 0;
    const isHoliday = Boolean(shift.isHolidayOrRestDay);
    const takeCash = shift.optForHolidayWage !== false;

    if (isHoliday) {
      const calc = calculateOvertimePay(hourlyRate, 0, 0, hours, takeCash);
      totalHolidayHours += hours;
      totalEarnings += calc.holidayPay;
      totalCoffCredited += calc.coffEarnedDays;
    } else if (hours > STANDARD_DAILY_HOURS) {
      const extraHours = hours - STANDARD_DAILY_HOURS;
      let std = 0;
      let dbl = 0;

      if (hours > STATUTORY_DOUBLE_OT_DAILY_THRESHOLD) {
        std = STATUTORY_DOUBLE_OT_DAILY_THRESHOLD - STANDARD_DAILY_HOURS; // 1 hr at 1.5x
        dbl = hours - STATUTORY_DOUBLE_OT_DAILY_THRESHOLD;                 // remainder at 2.0x
      } else {
        std = extraHours;
      }

      const calc = calculateOvertimePay(hourlyRate, std, dbl, 0, true);
      totalStandardHours += std;
      totalDoubleHours += dbl;
      totalEarnings += calc.totalOtEarnings;
    }
  }

  return {
    hourlyRate,
    totalShifts: shiftPunches.length,
    totalStandardHours: Math.round(totalStandardHours * 10) / 10,
    totalDoubleHours: Math.round(totalDoubleHours * 10) / 10,
    totalHolidayHours: Math.round(totalHolidayHours * 10) / 10,
    totalCoffCredited,
    totalGrossOtEarnings: Math.round(totalEarnings * 100) / 100,
  };
}

module.exports = {
  STANDARD_DAILY_HOURS,
  STATUTORY_DOUBLE_OT_DAILY_THRESHOLD,
  RATE_MULTIPLIER_STANDARD_OT,
  RATE_MULTIPLIER_DOUBLE_OT,
  RATE_MULTIPLIER_HOLIDAY_REST_DAY,
  computeHourlyOrdinaryWage,
  calculateOvertimePay,
  aggregateMonthlyOvertime,
};
