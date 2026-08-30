const {
  evaluateBonusEligibility,
  computeStatutoryBonusAndExGratia,
  generateBonusRegisterFormC,
  STATUTORY_BONUS_WAGE_CAP_MONTHLY,
  STATUTORY_MIN_BONUS_PERCENT,
  STATUTORY_MAX_BONUS_PERCENT,
} = require('../statutoryBonusEngine.utils');

describe('statutoryBonusEngine.utils - Payment of Bonus Act 1965 Engine', () => {
  describe('evaluateBonusEligibility', () => {
    it('approves employee with >= 30 working days', () => {
      const result = evaluateBonusEligibility(45);
      expect(result.isEligible).toBe(true);
      expect(result.rejectionReason).toBeNull();
    });

    it('rejects employee with < 30 working days', () => {
      const result = evaluateBonusEligibility(15);
      expect(result.isEligible).toBe(false);
      expect(result.rejectionReason).toContain('requires minimum 30 days');
    });
  });

  describe('computeStatutoryBonusAndExGratia', () => {
    it('caps statutory bonus computation at ₹7,000/month wage ceiling at 8.33%', () => {
      // Basic = 30,000 (exceeds ₹7,000 cap). Statutory wage base = ₹7,000
      // Annual statutory wage = 7000 * 12 = 84,000
      // Statutory bonus = 8.33% of 84,000 = 6,997.20
      const result = computeStatutoryBonusAndExGratia(30000, 0, 8.33, 300, false);

      expect(result.isEligible).toBe(true);
      expect(result.statutoryWageBaseMonthly).toBe(7000);
      expect(result.statutoryBonusAmount).toBe(6997.2);
      expect(result.exGratiaAmount).toBe(0);
      expect(result.totalBonusDisbursement).toBe(6997.2);
    });

    it('computes 20% max statutory bonus on wages below ceiling', () => {
      // Basic = 6,000 (below ₹7,000 cap). Annual = 6000 * 12 = 72,000
      // Bonus at 20% = 14,400
      const result = computeStatutoryBonusAndExGratia(6000, 0, 20.0, 300, false);

      expect(result.statutoryWageBaseMonthly).toBe(6000);
      expect(result.statutoryBonusAmount).toBe(14400);
      expect(result.totalBonusDisbursement).toBe(14400);
    });

    it('calculates pro-rata bonus and ex-gratia on wage surplus above ₹7,000', () => {
      // Basic = 20,000. Worked 150 days (50% year).
      // Statutory: 7000 * 12 * 0.5 = 42,000 * 8.33% = 3498.60
      // Excess wage: 13,000 * 12 * 0.5 = 78,000 * 5% ex-gratia = 3900.00
      const result = computeStatutoryBonusAndExGratia(20000, 0, 8.33, 150, true, 5);

      expect(result.proRataFactor).toBe(0.5);
      expect(result.statutoryBonusAmount).toBe(3498.6);
      expect(result.exGratiaAmount).toBe(3900);
      expect(result.totalBonusDisbursement).toBe(7398.6);
    });
  });

  describe('generateBonusRegisterFormC', () => {
    it('aggregates organization Form C register line items', () => {
      const staff = [
        { basic: 30000, workedDays: 300, isExGratiaEligible: true, exGratiaPercent: 5 },
        { basic: 6000, workedDays: 300 },
        { basic: 10000, workedDays: 20 }, // Ineligible (< 30 days)
      ];

      const report = generateBonusRegisterFormC(staff, '2025-26', 8.33);

      expect(report.totalEmployees).toBe(3);
      expect(report.eligibleEmployeesCount).toBe(2);
      expect(report.totalStatutoryBonus).toBeGreaterThan(0);
      expect(report.lineItems[2].isEligible).toBe(false);
    });
  });
});
