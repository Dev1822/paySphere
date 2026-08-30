'use strict';

const { calculateTsr, evaluateRelativeTsrVesting } = require('../services/psuValuation.service');

describe('PSU Valuation Service', () => {
  describe('calculateTsr', () => {
    it('calculates TSR percentage correctly', () => {
      expect(calculateTsr(100, 150)).toBe(50);
      expect(calculateTsr(200, 150)).toBe(-25);
      expect(calculateTsr(0, 100)).toBe(0);
    });
  });

  describe('evaluateRelativeTsrVesting', () => {
    it('awards 200% multiplier (2.0x) for top quartile performance', () => {
      const peers = [
        { ticker: 'PEER_A', baselinePrice: 100, finalPrice: 110 }, // 10%
        { ticker: 'PEER_B', baselinePrice: 100, finalPrice: 120 }, // 20%
        { ticker: 'PEER_C', baselinePrice: 100, finalPrice: 130 }, // 30%
      ];

      const result = evaluateRelativeTsrVesting({
        baselineCompanyPrice: 100,
        finalCompanyPrice: 160, // 60% -> Top performer
        peers,
        targetShares: 1000,
      });

      expect(result.companyTsrPercent).toBe(60);
      expect(result.calculatedPercentileRank).toBeGreaterThanOrEqual(75);
      expect(result.vestingMultiplier).toBe(2.0);
      expect(result.finalSharesVested).toBe(2000);
    });

    it('awards 0% multiplier (0.0x) when under threshold quartile', () => {
      const peers = [
        { ticker: 'PEER_A', baselinePrice: 100, finalPrice: 130 }, // 30%
        { ticker: 'PEER_B', baselinePrice: 100, finalPrice: 140 }, // 40%
        { ticker: 'PEER_C', baselinePrice: 100, finalPrice: 150 }, // 50%
      ];

      const result = evaluateRelativeTsrVesting({
        baselineCompanyPrice: 100,
        finalCompanyPrice: 105, // 5% -> Bottom performer
        peers,
        targetShares: 1000,
      });

      expect(result.companyTsrPercent).toBe(5);
      expect(result.calculatedPercentileRank).toBeLessThan(25);
      expect(result.vestingMultiplier).toBe(0);
      expect(result.finalSharesVested).toBe(0);
    });
  });
});