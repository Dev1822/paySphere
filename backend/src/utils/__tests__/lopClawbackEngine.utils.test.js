const {
  computeRetroactiveLopDelta,
  generateClawbackInstallmentPlan,
  buildLopAdjustmentJournalEntry,
  STATUTORY_MAX_DEDUCTION_PERCENT,
} = require('../lopClawbackEngine.utils');

describe('lopClawbackEngine.utils - Loss of Pay & Retroactive Arrear Engine', () => {
  describe('computeRetroactiveLopDelta', () => {
    it('computes daily wage rate and negative clawback delta for unpaid absence', () => {
      const gross = 60000;
      const cycleDays = 30; // Daily rate = 2000
      const lopDays = 3;
      const result = computeRetroactiveLopDelta(gross, cycleDays, lopDays, 0);

      expect(result.dailyRate).toBe(2000);
      expect(result.clawbackAmount).toBe(6000);
      expect(result.arrearPayout).toBe(0);
      expect(result.netDelta).toBe(-6000);
      expect(result.adjustmentType).toBe('CLAWBACK');
    });

    it('computes positive arrear payout when unpaid leave is approved as paid', () => {
      const gross = 90000;
      const cycleDays = 30; // Daily rate = 3000
      const result = computeRetroactiveLopDelta(gross, cycleDays, 0, 2);

      expect(result.dailyRate).toBe(3000);
      expect(result.clawbackAmount).toBe(0);
      expect(result.arrearPayout).toBe(6000);
      expect(result.netDelta).toBe(6000);
      expect(result.adjustmentType).toBe('ARREAR');
    });

    it('calculates net delta when both clawback and arrear days exist', () => {
      const gross = 60000;
      const cycleDays = 30;
      const result = computeRetroactiveLopDelta(gross, cycleDays, 4, 1); // 4 days LOP, 1 day paid arrear

      expect(result.clawbackAmount).toBe(8000);
      expect(result.arrearPayout).toBe(2000);
      expect(result.netDelta).toBe(-6000);
      expect(result.adjustmentType).toBe('CLAWBACK');
    });
  });

  describe('generateClawbackInstallmentPlan', () => {
    it('creates multi-month installment schedule within statutory 50% deduction floor', () => {
      const gross = 50000; // 50% max deduction = 25000
      const clawbackTotal = 15000;
      const plan = generateClawbackInstallmentPlan(clawbackTotal, gross, 3, STATUTORY_MAX_DEDUCTION_PERCENT);

      expect(plan.isStatutoryCompliant).toBe(true);
      expect(plan.maxMonthlyDeductionFloor).toBe(25000);
      expect(plan.installmentCount).toBe(3);
      expect(plan.schedule.length).toBe(3);
      expect(plan.schedule[0].deductionAmount).toBe(5000);
      expect(plan.schedule[0].isWithinStatutoryLimit).toBe(true);
      expect(plan.schedule[2].remainingBalance).toBe(0);
    });

    it('automatically increases installments if preferred schedule would violate 50% salary floor', () => {
      const gross = 20000; // 50% max deduction = 10000
      const clawbackTotal = 30000; // Exceeds 10000/month
      const plan = generateClawbackInstallmentPlan(clawbackTotal, gross, 1, STATUTORY_MAX_DEDUCTION_PERCENT);

      // Must require at least ceil(30000 / 10000) = 3 installments
      expect(plan.minimumMonthsRequired).toBe(3);
      expect(plan.installmentCount).toBe(3);
      expect(plan.schedule.every((s) => s.deductionAmount <= 10000)).toBe(true);
    });
  });

  describe('buildLopAdjustmentJournalEntry', () => {
    it('generates balanced corrective journal entry with appropriate account codes', () => {
      const journal = buildLopAdjustmentJournalEntry('2026-08', -6000, 6000, 0);

      expect(journal.isBalanced).toBe(true);
      expect(journal.entries[0].accountCode).toBe('RECV-1040');
      expect(journal.entries[0].debit).toBe(6000);
      expect(journal.entries[1].accountCode).toBe('EXP-5010');
      expect(journal.entries[1].credit).toBe(6000);
    });
  });
});
