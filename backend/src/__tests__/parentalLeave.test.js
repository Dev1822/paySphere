'use strict';

const {
  calculateParentalLeaveTopUp,
  calculateReconciliationAdjustment,
} = require('../services/parentalLeaveCalculator.service');

describe('Parental Leave Calculator Service', () => {
  describe('calculateParentalLeaveTopUp', () => {
    it('calculates pro-rated pay, statutory offsets, and employer top-up accurately', () => {
      const result = calculateParentalLeaveTopUp({
        regularMonthlySalary: 4400,
        workingDaysOnLeave: 10,
        statutoryDailyInsuranceRate: 80, // State pays $80/day
      });

      // Daily salary = 4400 / 22 = 200
      expect(result.dailyBaseSalary).toBe(200);
      // Pro-rated normal pay = 200 * 10 = 2,000
      expect(result.proRatedNormalSalary).toBe(2000);
      // State benefit = 80 * 10 = 800
      expect(result.totalStatutoryBenefitEstimated).toBe(800);
      // Employer top-up = 2000 - 800 = 1,200
      expect(result.employerTopUpAmount).toBe(1200);
    });

    it('returns zero employer top-up when statutory benefits exceed regular wages', () => {
      const result = calculateParentalLeaveTopUp({
        regularMonthlySalary: 2200,
        workingDaysOnLeave: 5,
        statutoryDailyInsuranceRate: 150, // State pays $150/day (higher than $100/day daily rate)
      });

      expect(result.proRatedNormalSalary).toBe(500);
      expect(result.totalStatutoryBenefitEstimated).toBe(750);
      expect(result.employerTopUpAmount).toBe(0);
    });

    it('throws error for non-positive salary or days', () => {
      expect(() => {
        calculateParentalLeaveTopUp({
          regularMonthlySalary: -1000,
          workingDaysOnLeave: 5,
        });
      }).toThrow('Monthly salary and working days on leave must be strictly positive.');
    });
  });

  describe('calculateReconciliationAdjustment', () => {
    it('calculates positive adjustment when state benefit is less than estimated', () => {
      const adjustment = calculateReconciliationAdjustment(800, 600);
      // Employer owes extra $200
      expect(adjustment).toBe(200);
    });

    it('calculates negative clawback adjustment when state benefit is more than estimated', () => {
      const adjustment = calculateReconciliationAdjustment(800, 950);
      // Employee received $150 excess, clawback
      expect(adjustment).toBe(-150);
    });
  });
});