const {
  evaluateTenurialEligibility,
  computeRetrenchmentSeverance,
  generateFormPRetrenchmentLedger,
  MIN_CONTINUOUS_WORKING_DAYS,
  STATUTORY_10_10B_MAX_EXEMPTION,
} = require('../severanceEngine.utils');

describe('severanceEngine.utils - Statutory Retrenchment Severance Engine', () => {
  describe('evaluateTenurialEligibility', () => {
    it('approves employee with >= 240 continuous working days', () => {
      const result = evaluateTenurialEligibility(250);
      expect(result.isEligible).toBe(true);
      expect(result.rejectionReason).toBeNull();
    });

    it('rejects employee with < 240 continuous working days', () => {
      const result = evaluateTenurialEligibility(180);
      expect(result.isEligible).toBe(false);
      expect(result.rejectionReason).toContain('requires minimum 240 days');
    });
  });

  describe('computeRetrenchmentSeverance', () => {
    it('computes 15 days pay per year and rounds fractional months > 6 up', () => {
      // Basic = 52,000, DA = 0 -> Daily wage = 52000 / 26 = 2000
      // 4 years + 8 months (> 6 mo) -> Rounds to 5 completed years
      // Retrenchment comp = 15 * 2000 * 5 = 150,000
      // Notice not served -> Notice in lieu = 52,000
      // Gross = 202,000. 100% exempt under ₹5L Section 10(10B) cap.
      const result = computeRetrenchmentSeverance(52000, 0, 4, 8, false, 240);

      expect(result.isEligible).toBe(true);
      expect(result.roundedServiceYears).toBe(5);
      expect(result.dailyWageRate).toBe(2000);
      expect(result.retrenchmentCompensation).toBe(150000);
      expect(result.noticeInLieuWages).toBe(52000);
      expect(result.grossSeveranceAmount).toBe(202000);
      expect(result.taxExempt10_10B).toBe(202000);
      expect(result.taxableSeverance).toBe(0);
    });

    it('computes taxable severance when exceeding ₹5,00,000 Section 10(10B) cap', () => {
      // Basic = 1,04,000 -> Daily = 4000
      // 10 years -> Retrenchment = 15 * 4000 * 10 = 600,000
      // Notice served -> Notice in lieu = 0
      // Gross = 600,000. Exempt = 500,000. Taxable = 100,000
      const result = computeRetrenchmentSeverance(104000, 0, 10, 0, true, 240);

      expect(result.retrenchmentCompensation).toBe(600000);
      expect(result.grossSeveranceAmount).toBe(600000);
      expect(result.taxExempt10_10B).toBe(500000);
      expect(result.taxableSeverance).toBe(100000);
    });

    it('returns zero package for ineligible employee', () => {
      const result = computeRetrenchmentSeverance(52000, 0, 1, 0, false, 150);
      expect(result.isEligible).toBe(false);
      expect(result.grossSeveranceAmount).toBe(0);
    });
  });

  describe('generateFormPRetrenchmentLedger', () => {
    it('aggregates Form P retrenchment report across organization restructuring batch', () => {
      const staff = [
        { basic: 52000, serviceYears: 3, serviceMonthsFraction: 7, noticeServed: false }, // 4 years
        { basic: 30000, continuousWorkingDays: 100 }, // Ineligible
      ];

      const ledger = generateFormPRetrenchmentLedger(staff);

      expect(ledger.totalRetrenched).toBe(2);
      expect(ledger.eligibleCount).toBe(1);
      expect(ledger.totalGrossSeverance).toBeGreaterThan(0);
      expect(ledger.itemizedList[1].isEligible).toBe(false);
    });
  });
});
