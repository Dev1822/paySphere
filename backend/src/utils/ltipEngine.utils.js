/**
 * @fileoverview Executive Long-Term Incentive Plan (LTIP) Phantom Stock Engine
 * @description Manages cash-settled Performance Stock Units (PSUs), cliff vesting schedules,
 * KPI milestone multipliers (0.0x to 2.0x), and perquisite tax payroll disbursements.
 * Issue: #1960
 */

const MIN_KPI_THRESHOLD_PERCENT = 80;  // Below 80% KPI achievement yields 0x multiplier
const TARGET_KPI_PERCENT = 100;        // 100% KPI achievement yields 1.0x multiplier
const MAX_KPI_PERCENT = 150;           // 150%+ KPI achievement yields 2.0x cap
const MAX_PERFORMANCE_MULTIPLIER = 2.0;

/**
 * Calculates milestone performance multiplier based on KPI target achievement.
 *
 * @param {number} kpiAchievementPercent - Actual achievement percentage (e.g. 110%)
 * @returns {number} Multiplier between 0.0x and 2.0x
 */
function calculatePerformanceMultiplier(kpiAchievementPercent = 100) {
  const achievement = Math.max(0, Number(kpiAchievementPercent) || 0);

  if (achievement < MIN_KPI_THRESHOLD_PERCENT) {
    return 0.0;
  }

  if (achievement <= TARGET_KPI_PERCENT) {
    // Linear scale between 80% (0.5x) and 100% (1.0x)
    const ratio = (achievement - MIN_KPI_THRESHOLD_PERCENT) / (TARGET_KPI_PERCENT - MIN_KPI_THRESHOLD_PERCENT);
    return Math.round((0.5 + ratio * 0.5) * 100) / 100;
  }

  // Linear scale between 100% (1.0x) and 150% (2.0x max cap)
  const excessRatio = Math.min(1.0, (achievement - TARGET_KPI_PERCENT) / (MAX_KPI_PERCENT - TARGET_KPI_PERCENT));
  return Math.round((1.0 + excessRatio * (MAX_PERFORMANCE_MULTIPLIER - 1.0)) * 100) / 100;
}

/**
 * Evaluates vesting tranche payout for phantom units.
 *
 * @param {number} targetUnits - Number of target phantom stock units
 * @param {number} grantFmv - FMV at grant date
 * @param {number} currentVestingFmv - Current FMV at vesting date
 * @param {number} kpiAchievementPercent - KPI milestone achievement percent
 * @returns {{ targetUnits: number, multiplier: number, vestedUnits: number, grantFmv: number, currentVestingFmv: number, grossCashPayout: number, taxablePerquisite: number, status: string }}
 */
function evaluateTrancheVesting(
  targetUnits = 0,
  grantFmv = 100,
  currentVestingFmv = 150,
  kpiAchievementPercent = 100,
) {
  const units = Math.max(0, Number(targetUnits) || 0);
  const gFmv = Math.max(0, Number(grantFmv) || 0);
  const vFmv = Math.max(0, Number(currentVestingFmv) || gFmv);
  const multiplier = calculatePerformanceMultiplier(kpiAchievementPercent);

  const vestedUnits = Math.round(units * multiplier * 100) / 100;
  const grossCashPayout = Math.round(vestedUnits * vFmv * 100) / 100;

  // 100% of cash-settled phantom stock payout is taxable as perquisite
  const taxablePerquisite = grossCashPayout;

  const status = multiplier === 0
    ? 'FORFEITED_BELOW_THRESHOLD'
    : multiplier >= 1.0
      ? 'VESTED_TARGET_OR_ABOVE'
      : 'VESTED_BELOW_TARGET';

  return {
    targetUnits: units,
    kpiAchievementPercent: Number(kpiAchievementPercent),
    multiplier,
    vestedUnits,
    grantFmv: gFmv,
    currentVestingFmv: vFmv,
    grossCashPayout,
    taxablePerquisite,
    status,
  };
}

/**
 * Aggregates portfolio of executive LTIP grants.
 */
function aggregateLtipPortfolio(grants = []) {
  let totalGrantedUnits = 0;
  let totalVestedUnits = 0;
  let totalCashDisbursed = 0;
  let totalTaxablePerquisites = 0;
  const itemizedEvaluations = [];

  for (const g of grants) {
    const evalResult = evaluateTrancheVesting(
      g.targetUnits,
      g.grantFmv,
      g.currentVestingFmv || g.grantFmv,
      g.kpiAchievementPercent || 100,
    );

    totalGrantedUnits += evalResult.targetUnits;
    totalVestedUnits += evalResult.vestedUnits;
    totalCashDisbursed += evalResult.grossCashPayout;
    totalTaxablePerquisites += evalResult.taxablePerquisite;

    itemizedEvaluations.push({
      grantId: g.id || g.grantId || `LTIP-${itemizedEvaluations.length + 1}`,
      grantDate: g.grantDate || '2024-01-01',
      ...evalResult,
    });
  }

  return {
    totalGrantsCount: grants.length,
    totalGrantedUnits,
    totalVestedUnits: Math.round(totalVestedUnits * 100) / 100,
    totalCashDisbursed: Math.round(totalCashDisbursed * 100) / 100,
    totalTaxablePerquisites: Math.round(totalTaxablePerquisites * 100) / 100,
    itemizedEvaluations,
  };
}

module.exports = {
  MIN_KPI_THRESHOLD_PERCENT,
  TARGET_KPI_PERCENT,
  MAX_KPI_PERCENT,
  MAX_PERFORMANCE_MULTIPLIER,
  calculatePerformanceMultiplier,
  evaluateTrancheVesting,
  aggregateLtipPortfolio,
};
