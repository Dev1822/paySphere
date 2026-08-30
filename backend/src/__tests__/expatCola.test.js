'use strict';

const { calculateExpatAllowances } = require('../services/expatColaCalculator.service');

describe('Expat COLA Calculator Service', () => {
  describe('calculateExpatAllowances', () => {
    it('calculates COLA, housing differential, and hardship allowances accurately', () => {
      const result = calculateExpatAllowances({
        baseMonthlySalary: 10000,
        priceIndexRatio: 125, // 25% higher cost of living
        spendableIncomePercent: 40, // 4,000 spendable
        hostHousingNormMonthly: 3500,
        homeHousingNormMonthly: 2000, // 1,500 housing diff
        hardshipAllowancePercent: 10, // 1,000 hardship
      });

      // Spendable = 10,000 * 0.40 = 4,000
      expect(result.spendableIncome).toBe(4000);
      // COLA = 4,000 * (125 - 100) / 100 = 1,000
      expect(result.colaMonthlySupplement).toBe(1000);
      // Housing = 3,500 - 2,000 = 1,500
      expect(result.housingDifferentialMonthly).toBe(1500);
      // Hardship = 10,000 * 0.10 = 1,000
      expect(result.hardshipMonthlyAllowance).toBe(1000);
      // Total allowance = 1,000 + 1,500 + 1,000 = 3,500
      expect(result.totalMonthlyAllowance).toBe(3500);
      // Gross package = 10,000 + 3,500 = 13,500
      expect(result.grossMonthlyExpatPackage).toBe(13500);
    });

    it('returns zero COLA supplement when host location index is below or equal to 100', () => {
      const result = calculateExpatAllowances({
        baseMonthlySalary: 8000,
        priceIndexRatio: 90, // cheaper location
        spendableIncomePercent: 40,
        hostHousingNormMonthly: 1200,
        homeHousingNormMonthly: 1500, // no housing excess
      });

      expect(result.colaMonthlySupplement).toBe(0);
      expect(result.housingDifferentialMonthly).toBe(0);
      expect(result.totalMonthlyAllowance).toBe(0);
      expect(result.grossMonthlyExpatPackage).toBe(8000);
    });

    it('throws error for non-positive base salaries', () => {
      expect(() => {
        calculateExpatAllowances({ baseMonthlySalary: 0 });
      }).toThrow('Base monthly salary must be strictly positive.');
    });
  });
});