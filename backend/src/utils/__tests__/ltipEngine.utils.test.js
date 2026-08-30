const {
  calculatePerformanceMultiplier,
  evaluateTrancheVesting,
  aggregateLtipPortfolio,
  MIN_KPI_THRESHOLD_PERCENT,
  TARGET_KPI_PERCENT,
  MAX_KPI_PERCENT,
  MAX_PERFORMANCE_MULTIPLIER,
} = require('../ltipEngine.utils');

describe('ltipEngine.utils - Executive LTIP Phantom Stock Engine', () => {
  describe('calculatePerformanceMultiplier', () => {
    it('returns 0x multiplier when KPI is below 80% threshold', () => {
      expect(calculatePerformanceMultiplier(75)).toBe(0);
      expect(calculatePerformanceMultiplier(0)).toBe(0);
    });

    it('scales linearly between 80% (0.5x) and 100% (1.0x)', () => {
      expect(calculatePerformanceMultiplier(80)).toBe(0.5);
      expect(calculatePerformanceMultiplier(90)).toBe(0.75);
      expect(calculatePerformanceMultiplier(100)).toBe(1.0);
    });

    it('scales between 100% (1.0x) and 150% (2.0x cap)', () => {
      expect(calculatePerformanceMultiplier(125)).toBe(1.5);
      expect(calculatePerformanceMultiplier(150)).toBe(2.0);
      expect(calculatePerformanceMultiplier(180)).toBe(2.0); // capped at 2.0x
    });
  });

  describe('evaluateTrancheVesting', () => {
    it('evaluates target achievement at 100% KPI', () => {
      // 1000 units, Grant FMV 100, Vesting FMV 200, 100% KPI -> 1000 * 1.0 * 200 = 200,000
      const result = evaluateTrancheVesting(1000, 100, 200, 100);

      expect(result.multiplier).toBe(1.0);
      expect(result.vestedUnits).toBe(1000);
      expect(result.grossCashPayout).toBe(200000);
      expect(result.taxablePerquisite).toBe(200000);
      expect(result.status).toBe('VESTED_TARGET_OR_ABOVE');
    });

    it('forfeits tranche when KPI achievement is below 80%', () => {
      const result = evaluateTrancheVesting(1000, 100, 200, 60);

      expect(result.multiplier).toBe(0);
      expect(result.vestedUnits).toBe(0);
      expect(result.grossCashPayout).toBe(0);
      expect(result.status).toBe('FORFEITED_BELOW_THRESHOLD');
    });

    it('multiplies units up to 2.0x for superior 150% achievement', () => {
      // 1000 units * 2.0 * 300 FMV = 600,000
      const result = evaluateTrancheVesting(1000, 100, 300, 150);

      expect(result.multiplier).toBe(2.0);
      expect(result.vestedUnits).toBe(2000);
      expect(result.grossCashPayout).toBe(600000);
      expect(result.taxablePerquisite).toBe(600000);
    });
  });

  describe('aggregateLtipPortfolio', () => {
    it('aggregates multiple executive grants into portfolio summary', () => {
      const grants = [
        { targetUnits: 1000, grantFmv: 100, currentVestingFmv: 200, kpiAchievementPercent: 100 }, // 1000 units = 200k
        { targetUnits: 500, grantFmv: 100, currentVestingFmv: 200, kpiAchievementPercent: 70 },   // 0 units = 0k
      ];

      const portfolio = aggregateLtipPortfolio(grants);

      expect(portfolio.totalGrantsCount).toBe(2);
      expect(portfolio.totalGrantedUnits).toBe(1500);
      expect(portfolio.totalVestedUnits).toBe(1000);
      expect(portfolio.totalCashDisbursed).toBe(200000);
    });
  });
});
