'use strict';

const { calculatePurchaseMetrics } = require('../services/esppCalculator.service');

describe('ESPP Calculator Service', () => {
  describe('calculatePurchaseMetrics', () => {
    it('applies lookback correctly when grant price is lower than purchase price', () => {
      const result = calculatePurchaseMetrics({
        grantPrice: 100,
        purchaseDatePrice: 150,
        accumulatedFunds: 1000,
        discountPercent: 15,
      });

      // Lookback price should be 100, 15% discount -> 85
      expect(result.lookbackPrice).toBe(100);
      expect(result.finalPurchasePrice).toBe(85);
      // 1000 / 85 = 11.76 -> 11 shares
      expect(result.sharesPurchased).toBe(11);
      expect(result.totalSpent).toBe(935);
      expect(result.residualRefund).toBe(65);
      // Perquisite = (150 - 85) * 11 = 65 * 11 = 715
      expect(result.taxablePerquisiteValue).toBe(715);
    });

    it('applies lookback correctly when purchase price is lower than grant price', () => {
      const result = calculatePurchaseMetrics({
        grantPrice: 120,
        purchaseDatePrice: 80,
        accumulatedFunds: 800,
        discountPercent: 15,
      });

      // Lookback price should be 80, 15% discount -> 68
      expect(result.lookbackPrice).toBe(80);
      expect(result.finalPurchasePrice).toBe(68);
      // 800 / 68 = 11.76 -> 11 shares
      expect(result.sharesPurchased).toBe(11);
      expect(result.totalSpent).toBe(748);
      expect(result.residualRefund).toBe(52);
      // Perquisite = (80 - 68) * 11 = 12 * 11 = 132
      expect(result.taxablePerquisiteValue).toBe(132);
    });

    it('throws error for non-positive prices', () => {
      expect(() => {
        calculatePurchaseMetrics({
          grantPrice: 0,
          purchaseDatePrice: 100,
          accumulatedFunds: 500,
        });
      }).toThrow('Stock prices must be strictly positive.');
    });
  });
});