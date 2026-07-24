const { MONTHLY_SALARY_MAX, OVERTIME_RATE_MAX, DAILY_RATE_MAX, MAX_SAFE_PAYROLL } = require("./validators");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateNetSalary(employee, user, adjustments = {}) {
  let { leaveDays = 0, overtimeHours = 0, bonus = 0, deductions = 0 } = adjustments || {};

  leaveDays = typeof leaveDays === "number" && !isNaN(leaveDays) && Number.isFinite(leaveDays) && leaveDays >= 0 ? Math.min(leaveDays, 31) : 0;
  overtimeHours = typeof overtimeHours === "number" && !isNaN(overtimeHours) && Number.isFinite(overtimeHours) && overtimeHours >= 0 ? overtimeHours : 0;
  bonus = typeof bonus === "number" && !isNaN(bonus) && Number.isFinite(bonus) && bonus >= 0 ? clamp(bonus, 0, MONTHLY_SALARY_MAX) : 0;
  deductions = typeof deductions === "number" && !isNaN(deductions) && Number.isFinite(deductions) && deductions >= 0 ? clamp(deductions, 0, MONTHLY_SALARY_MAX) : 0;

  const rawSalary = employee ? Number(employee.monthlySalary) : 0;
  const baseSalary = !isNaN(rawSalary) && Number.isFinite(rawSalary) && rawSalary >= 0 ? clamp(rawSalary, 0, MONTHLY_SALARY_MAX) : 0;

  const userDailyRate = user ? Number(user.defaultDailyRate) : 0;
  const dailyRate = (!isNaN(userDailyRate) && Number.isFinite(userDailyRate) && userDailyRate > 0)
    ? clamp(userDailyRate, 0, DAILY_RATE_MAX)
    : (baseSalary / 30);

  const leaveDeduction = Math.round(Math.min(dailyRate * leaveDays, MAX_SAFE_PAYROLL));

  const empOvertime = employee ? Number(employee.overtimeRate) : 0;
  const userOvertime = user ? Number(user.defaultOvertimeRate) : 0;
  const overtimeRate = (!isNaN(empOvertime) && Number.isFinite(empOvertime) && empOvertime > 0)
    ? clamp(empOvertime, 0, OVERTIME_RATE_MAX)
    : ((!isNaN(userOvertime) && Number.isFinite(userOvertime) && userOvertime > 0) ? clamp(userOvertime, 0, OVERTIME_RATE_MAX) : 0);

  const overtimePay = Math.round(Math.min(overtimeRate * overtimeHours, MAX_SAFE_PAYROLL));

  let netSalary = baseSalary - leaveDeduction + overtimePay + bonus - deductions;
  if (isNaN(netSalary) || !Number.isFinite(netSalary) || netSalary > MAX_SAFE_PAYROLL) {
    netSalary = 0;
  }
  netSalary = Math.max(0, netSalary);

  return {
    baseSalary,
    leaveDeduction,
    overtimeRate,
    overtimePay,
    netSalary
  };
}

module.exports = { calculateNetSalary };
