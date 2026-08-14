'use strict';

const {
  calculateSLM,
  calculateWDV,
  calculateMonthlyDepreciation,
  calculateDepreciationSchedule,
  calculateDisposalGainLoss,
} = require('../depreciationCalculator');

describe('Fixed Asset Depreciation Engine', () => {
  describe('calculateSLM', () => {
    it('calculates monthly straight-line depreciation correctly', () => {
      // Purchase: 100,000, Salvage: 10,000, Useful life: 5 years (60 months)
      // Depreciable base = 90,000 / 60 = 1,500
      const monthly = calculateSLM(100000, 10000, 5);
      expect(monthly).toBe(1500);
    });
  });

  describe('calculateWDV', () => {
    it('calculates monthly written down value depreciation', () => {
      const monthly = calculateWDV(80000, 100000, 10000, 5);
      expect(monthly).toBeGreaterThan(0);
      expect(typeof monthly).toBe('number');
    });
  });

  describe('calculateDepreciationSchedule', () => {
    it('generates multi-year SLM depreciation schedule up to useful life', () => {
      const asset = { purchasePrice: 50000 };
      const category = {
        depreciationMethod: 'SLM',
        usefulLifeYears: 5,
        salvageValuePercentage: 10, // salvage = 5,000
      };

      const schedule = calculateDepreciationSchedule(asset, category);
      expect(schedule).toHaveLength(5);
      expect(schedule[0].openingBookValue).toBe(50000);
      expect(schedule[0].depreciationExpense).toBe(9000);
      expect(schedule[0].closingBookValue).toBe(41000);
      expect(schedule[4].closingBookValue).toBe(5000);
    });
  });

  describe('calculateDisposalGainLoss', () => {
    it('calculates gain when scrap proceeds exceed book value', () => {
      const result = calculateDisposalGainLoss(10000, 15000, 1000);
      expect(result.netProceeds).toBe(14000);
      expect(result.gainOrLoss).toBe(4000);
      expect(result.isGain).toBe(true);
    });

    it('calculates loss when scrap proceeds are below book value', () => {
      const result = calculateDisposalGainLoss(20000, 12000, 0);
      expect(result.netProceeds).toBe(12000);
      expect(result.gainOrLoss).toBe(-8000);
      expect(result.isGain).toBe(false);
    });
  });
});
