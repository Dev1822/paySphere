'use strict';

const {
  calculateDeferralMetrics,
  compoundQuarterlyGrowth,
} = require('../services/deferredCompensation.service');

describe('Deferred Compensation Service', () => {
  describe('calculateDeferralMetrics', () => {
    it('calculates principal deferred and FICA taxes at deferral accurately', () => {
      const result = calculateDeferralMetrics({
        grossAmount: 100000,
        deferralPercentage: 20,
        benchmarkRatePercent: 6.0,
      });

      // 20% of 100,000 = 20,000
      expect(result.principalDeferred).toBe(20000);
      expect(result.netTakeHomeReduced).toBe(20000);
      // FICA tax = 20,000 * 0.0765 = 1,530
      expect(result.ficaTaxDueAtDeferral).toBe(1530);
      expect(result.benchmarkRatePercent).toBe(6.0);
    });

    it('rejects invalid deferral percentages above 80%', () => {
      expect(() => {
        calculateDeferralMetrics({
          grossAmount: 50000,
          deferralPercentage: 90,
        });
      }).toThrow('Gross amount must be positive and deferral percentage between 1% and 80%.');
    });
  });

  describe('compoundQuarterlyGrowth', () => {
    it('compounds quarterly phantom growth correctly', () => {
      const result = compoundQuarterlyGrowth(100000, 8.0);

      // Quarterly rate = 8.0 / 4 = 2.0%
      expect(result.quarterlyRate).toBe(2.0);
      // Interest = 100,000 * 0.02 = 2,000
      expect(result.interestEarned).toBe(2000);
      expect(result.updatedBalance).toBe(102000);
    });

    it('throws error for negative balances', () => {
      expect(() => {
        compoundQuarterlyGrowth(-500);
      }).toThrow('Balance cannot be negative.');
    });
  });
});