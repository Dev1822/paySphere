const {
  MONTHLY_SALARY_MAX,
  OVERTIME_RATE_MAX,
  DAILY_RATE_MAX,
  MAX_SAFE_PAYROLL,
} = require('./validators');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateNetSalary(employee, user, adjustments = {}) {
  let {
    leaveDays = 0,
    overtimeHours = 0,
    bonus = 0,
    deductions = 0,
    customDeductions = [],
    daysInMonth = 30,
    weeklyOffs = 0,
    holidaysCount = 0,
    calculationRule = null,
  } = adjustments || {};

  const rules = calculationRule?.rules || {};
  const leaveRules = rules.leave || {};
  const overtimeRules = rules.overtime || {};
  const deductionRules = rules.deductions || {};
  const bonusRules = rules.bonus || {};
  const salaryRules = rules.salary || {};
  const rules = calculationRule?.rules || {};
  const leaveRules = rules.leave || {};
  const overtimeRules = rules.overtime || {};
  const deductionRules = rules.deductions || {};
  const bonusRules = rules.bonus || {};
  const salaryRules = rules.salary || {};
  const maxLeaveDays =
    Number.isFinite(Number(leaveRules.maxDays)) &&
    Number(leaveRules.maxDays) > 0
      ? Number(leaveRules.maxDays)
      : 31;

    const maxLeaveDays =
    Number.isFinite(Number(leaveRules.maxDays)) &&
    Number(leaveRules.maxDays) > 0
      ? Number(leaveRules.maxDays)
      : 31;

  leaveDays =
    typeof leaveDays === 'number' &&
    !isNaN(leaveDays) &&
    Number.isFinite(leaveDays) &&
    leaveDays >= 0
      ? Math.min(leaveDays, maxLeaveDays)
      : 0;  overtimeHours =
    typeof overtimeHours === 'number' &&
    !isNaN(overtimeHours) &&
    Number.isFinite(overtimeHours) &&
    overtimeHours >= 0
      ? overtimeHours
      : 0;
  const bonusMultiplier =
    Number.isFinite(Number(bonusRules.multiplier)) &&
    Number(bonusRules.multiplier) >= 0
      ? Number(bonusRules.multiplier)
      : 1;

  const deductionMultiplier =
    Number.isFinite(Number(deductionRules.multiplier)) &&
    Number(deductionRules.multiplier) >= 0
      ? Number(deductionRules.multiplier)
      : 1;

  bonus =
    typeof bonus === 'number' &&
    !isNaN(bonus) &&
    Number.isFinite(bonus) &&
    bonus >= 0
      ? clamp(
          bonus * bonusMultiplier,
          0,
          MONTHLY_SALARY_MAX,
        )
      : 0;

  deductions =
    typeof deductions === 'number' &&
    !isNaN(deductions) &&
    Number.isFinite(deductions) &&
    deductions >= 0
      ? clamp(
          deductions * deductionMultiplier,
          0,
          MONTHLY_SALARY_MAX,
        )
      : 0;
  deductions =
    typeof deductions === 'number' &&
    !isNaN(deductions) &&
    Number.isFinite(deductions) &&
    deductions >= 0
      ? clamp(
          deductions *
            (Number.isFinite(Number(deductionRules.multiplier))
              ? Number(deductionRules.multiplier)
              : 1),
          0,
          MONTHLY_SALARY_MAX,
        )
      : 0;
  const rawSalary = employee ? Number(employee.monthlySalary) : 0;
  const baseSalary =
    !isNaN(rawSalary) && Number.isFinite(rawSalary) && rawSalary >= 0
      ? clamp(rawSalary, 0, MONTHLY_SALARY_MAX)
      : 0;


  const configuredDivisor =
    Number.isFinite(Number(salaryRules.dailyRateDivisor)) &&
    Number(salaryRules.dailyRateDivisor) > 0
      ? Number(salaryRules.dailyRateDivisor)
      : Number.isFinite(Number(leaveRules.dailyRateDivisor)) &&
          Number(leaveRules.dailyRateDivisor) > 0
        ? Number(leaveRules.dailyRateDivisor)
        : null;

  const userDailyRate = user ? Number(user.defaultDailyRate) : 0;

  const configuredDivisor =
    Number.isFinite(Number(salaryRules.dailyRateDivisor)) &&
    Number(salaryRules.dailyRateDivisor) > 0
      ? Number(salaryRules.dailyRateDivisor)
      : Number.isFinite(Number(leaveRules.dailyRateDivisor)) &&
          Number(leaveRules.dailyRateDivisor) > 0
        ? Number(leaveRules.dailyRateDivisor)
        : null;

  const workingDays = Math.max(
    1,
    daysInMonth - weeklyOffs - holidaysCount,
  );

  const dailyRate =
    !isNaN(userDailyRate) &&
    Number.isFinite(userDailyRate) &&
    userDailyRate > 0
      ? clamp(userDailyRate, 0, DAILY_RATE_MAX)
      : baseSalary / (configuredDivisor || workingDays);  const leaveDeduction = Math.round(
    Math.min(dailyRate * leaveDays, MAX_SAFE_PAYROLL),
  );

  const empOvertime = employee ? Number(employee.overtimeRate) : 0;
  const userOvertime = user ? Number(user.defaultOvertimeRate) : 0;
  const configuredOvertimeMultiplier =
    Number.isFinite(Number(overtimeRules.rateMultiplier)) &&
    Number(overtimeRules.rateMultiplier) >= 0
      ? Number(overtimeRules.rateMultiplier)
      : 1;

  const overtimeMultiplier =
    Number.isFinite(Number(overtimeRules.rateMultiplier)) &&
    Number(overtimeRules.rateMultiplier) >= 0
      ? Number(overtimeRules.rateMultiplier)
      : 1;

  const overtimeRate =
    !isNaN(empOvertime) && Number.isFinite(empOvertime) && empOvertime > 0
      ? clamp(
          empOvertime * overtimeMultiplier,
          0,
          OVERTIME_RATE_MAX,
        )
      : !isNaN(userOvertime) &&
          Number.isFinite(userOvertime) &&
          userOvertime > 0
        ? clamp(
            userOvertime * overtimeMultiplier,
            0,
            OVERTIME_RATE_MAX,
          )
        : 0;
  const overtimePay = Math.round(
    Math.min(overtimeRate * overtimeHours, MAX_SAFE_PAYROLL),
  );
  const customDedsTotal = Array.isArray(customDeductions)
    ? customDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
    : 0;

  let netSalary =
    baseSalary -
    leaveDeduction +
    overtimePay +
    bonus -
    deductions -
    customDedsTotal;
  if (
    isNaN(netSalary) ||
    !Number.isFinite(netSalary) ||
    netSalary > MAX_SAFE_PAYROLL
  ) {
    netSalary = 0;
  }
  netSalary = Math.max(0, netSalary);

  return {
    baseSalary,
    leaveDeduction,
    overtimeRate,
    overtimePay,
    netSalary,
  };
}

module.exports = { calculateNetSalary };
