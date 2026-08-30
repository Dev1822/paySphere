/**
 * Expat COLA Calculator Service - Issue #1814
 *
 * Implements standard international mobility spendable income equations,
 * destination price index multipliers, housing excess differentials, and hardship allowances.
 */
'use strict';

const logger = require('../utils/logger');

/**
 * Calculates expatriate allowances breakdown:
 * - Spendable Income = Base Salary * (Spendable % / 100)
 * - COLA Supplement = Spendable Income * max(0, (Price Index Ratio - 100) / 100)
 * - Housing Differential = max(0, Host Housing Norm - Home Housing Norm)
 * - Hardship Allowance = Base Salary * (Hardship % / 100)
 * - Total Expat Monthly Allowance = COLA + Housing Differential + Hardship
 */
function calculateExpatAllowances({
  baseMonthlySalary,
  priceIndexRatio = 100,
  spendableIncomePercent = 40,
  hostHousingNormMonthly = 0,
  homeHousingNormMonthly = 0,
  hardshipAllowancePercent = 0,
}) {
  if (baseMonthlySalary <= 0) {
    throw new Error('Base monthly salary must be strictly positive.');
  }

  const spendableIncome = Math.round((baseMonthlySalary * (spendableIncomePercent / 100)) * 100) / 100;
  const indexDifferentialFactor = Math.max(0, (priceIndexRatio - 100) / 100);
  const colaMonthlySupplement = Math.round((spendableIncome * indexDifferentialFactor) * 100) / 100;

  const housingDifferentialMonthly = Math.max(0, Math.round((hostHousingNormMonthly - homeHousingNormMonthly) * 100) / 100);
  const hardshipMonthlyAllowance = Math.round((baseMonthlySalary * (hardshipAllowancePercent / 100)) * 100) / 100;

  const totalMonthlyAllowance = Math.round(
    (colaMonthlySupplement + housingDifferentialMonthly + hardshipMonthlyAllowance) * 100
  ) / 100;

  const grossMonthlyExpatPackage = Math.round((baseMonthlySalary + totalMonthlyAllowance) * 100) / 100;

  return {
    baseMonthlySalary,
    spendableIncome,
    priceIndexRatio,
    colaMonthlySupplement,
    housingDifferentialMonthly,
    hardshipMonthlyAllowance,
    totalMonthlyAllowance,
    grossMonthlyExpatPackage,
  };
}

module.exports = {
  calculateExpatAllowances,
};