/**
 * Calculates net salary based on base pay, leave days, overtime hours, bonus, and deductions.
 * 
 * @param {Object} employee - The employee document/object containing monthlySalary and optional overtimeRate
 * @param {Object} user - The user (employer) settings containing defaultDailyRate and defaultOvertimeRate
 * @param {Object} adjustments - Monthly adjustments
 * @param {number} [adjustments.leaveDays=0]
 * @param {number} [adjustments.overtimeHours=0]
 * @param {number} [adjustments.bonus=0]
 * @param {number} [adjustments.deductions=0]
 */
function calculateNetSalary(employee, user, adjustments = {}) {
  let { leaveDays = 0, overtimeHours = 0, bonus = 0, deductions = 0 } = adjustments || {};

  // Sanitize numeric inputs (ensure finite non-negative numbers)
  leaveDays = typeof leaveDays === "number" && !isNaN(leaveDays) && Number.isFinite(leaveDays) && leaveDays >= 0 ? leaveDays : 0;
  overtimeHours = typeof overtimeHours === "number" && !isNaN(overtimeHours) && Number.isFinite(overtimeHours) && overtimeHours >= 0 ? overtimeHours : 0;
  bonus = typeof bonus === "number" && !isNaN(bonus) && Number.isFinite(bonus) && bonus >= 0 ? bonus : 0;
  deductions = typeof deductions === "number" && !isNaN(deductions) && Number.isFinite(deductions) && deductions >= 0 ? deductions : 0;

  const rawSalary = employee ? Number(employee.monthlySalary) : 0;
  const baseSalary = !isNaN(rawSalary) && Number.isFinite(rawSalary) && rawSalary >= 0 ? rawSalary : 0;

  // 1. Calculate Daily Rate & Leave Deduction
  const userDailyRate = user ? Number(user.defaultDailyRate) : 0;
  const dailyRate = (!isNaN(userDailyRate) && Number.isFinite(userDailyRate) && userDailyRate > 0)
    ? userDailyRate
    : (baseSalary / 30);

  const leaveDeduction = Math.round(dailyRate * leaveDays);

  // 2. Determine Overtime Rate & Pay
  const empOvertime = employee ? Number(employee.overtimeRate) : 0;
  const userOvertime = user ? Number(user.defaultOvertimeRate) : 0;
  const overtimeRate = (!isNaN(empOvertime) && Number.isFinite(empOvertime) && empOvertime > 0)
    ? empOvertime
    : ((!isNaN(userOvertime) && Number.isFinite(userOvertime) && userOvertime > 0) ? userOvertime : 0);

  const overtimePay = Math.round(overtimeRate * overtimeHours);

  // 3. Compute Net Salary
  const netSalary = baseSalary - leaveDeduction + overtimePay + bonus - deductions;

  return {
    baseSalary,
    leaveDeduction,
    overtimeRate,
    overtimePay,
    netSalary
  };
}

module.exports = { calculateNetSalary };
