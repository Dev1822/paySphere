'use strict';

const { calculateSeveranceBreakdown } = require('../services/severanceCalculator.service');

describe('Severance Calculator Service', () => {
  describe('calculateSeveranceBreakdown', () => {
    it('calculates 15-day retrenchment and notice pay accurately', () => {
      const result = calculateSeveranceBreakdown({
        lastDrawnMonthlySalary: 52000,
        tenureYears: 4.5, // 4 completed years
        noticePeriodDays: 30,
        voluntaryExGratia: 20000,
        leaveEncashment: 10000,
        statutoryExemptionCap: 500000,
      });

      // Daily rate = 52000 / 26 = 2000
      expect(result.dailyRate).toBe(2000);
      // Retrenchment = 15 * 2000 * 4 = 120,000
      expect(result.statutoryRetrenchmentAmount).toBe(120000);
      // Notice pay = (52000 / 30) * 30 = 52,000
      expect(result.noticePayAmount).toBe(52000);
      // Gross = 120000 + 52000 + 20000 + 10000 = 202,000
      expect(result.grossSeveranceAmount).toBe(202000);
      // Under 500k cap, taxable portion is 0
      expect(result.taxableSeveranceAmount).toBe(0);
      expect(result.netDisbursementAmount).toBe(202000);
    });

    it('calculates tax and Section 89 relief on large taxable severance packages', () => {
      const result = calculateSeveranceBreakdown({
        lastDrawnMonthlySalary: 104000,
        tenureYears: 10,
        noticePeriodDays: 60,
        voluntaryExGratia: 600000,
        statutoryExemptionCap: 500000,
      });

      // Daily rate = 104000 / 26 = 4000
      // Retrenchment = 15 * 4000 * 10 = 600,000
      // Notice pay = (104000 / 30) * 60 = 208,000
      // Gross = 600,000 + 208,000 + 600,000 = 1,408,000
      expect(result.grossSeveranceAmount).toBe(1408000);
      // Taxable = 1,408,000 - 500,000 = 908,000
      expect(result.taxableSeveranceAmount).toBe(908000);
      // Section 89 relief = 908,000 * 0.10 = 90,800
      expect(result.section89ReliefAmount).toBe(90800);
      expect(result.netDisbursementAmount).toBeGreaterThan(1000000);
    });

    it('rejects invalid salary or tenure arguments', () => {
      expect(() => {
        calculateSeveranceBreakdown({
          lastDrawnMonthlySalary: -5000,
          tenureYears: 2,
        });
      }).toThrow('Salary must be positive and tenure non-negative.');
    });
  });
});