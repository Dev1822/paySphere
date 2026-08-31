const {
  evaluateSabbaticalMilestoneAccrual,
  calculateSabbaticalLeaveDisbursement,
  calculateExitSabbaticalEncashment,
  SABBATICAL_MILESTONES,
} = require('../sabbaticalEngine.utils');

describe('sabbaticalEngine.utils - Corporate Milestone Sabbatical Engine', () => {
  describe('evaluateSabbaticalMilestoneAccrual', () => {
    it('credits 30 days for 5-year tenure milestone', () => {
      const result = evaluateSabbaticalMilestoneAccrual(5);
      expect(result.isEligible).toBe(true);
      expect(result.accruedDays).toBe(30);
      expect(result.milestoneTier).toBe('SILVER_FIVE_YEAR_TIER');
    });

    it('credits 60 days for 10-year tenure milestone', () => {
      const result = evaluateSabbaticalMilestoneAccrual(10);
      expect(result.isEligible).toBe(true);
      expect(result.accruedDays).toBe(60);
      expect(result.milestoneTier).toBe('PLATINUM_DECADE_TIER');
    });

    it('returns 0 days for tenure under 5 years', () => {
      const result = evaluateSabbaticalMilestoneAccrual(3);
      expect(result.isEligible).toBe(false);
      expect(result.accruedDays).toBe(0);
    });
  });

  describe('calculateSabbaticalLeaveDisbursement', () => {
    it('approves leave request and calculates daily basic wage disbursement', () => {
      // Basic = 60,000 -> Daily = 60000 / 30 = 2000
      // 30 days requested, 30 days balance -> Total = 60,000, Remaining = 0
      const result = calculateSabbaticalLeaveDisbursement(60000, 30, 30);

      expect(result.isApproved).toBe(true);
      expect(result.dailyWageBasis).toBe(2000);
      expect(result.totalDisbursementAmount).toBe(60000);
      expect(result.remainingBalance).toBe(0);
    });

    it('rejects leave request when requested days exceed available balance', () => {
      const result = calculateSabbaticalLeaveDisbursement(60000, 45, 30);

      expect(result.isApproved).toBe(false);
      expect(result.totalDisbursementAmount).toBe(0);
      expect(result.remainingBalance).toBe(30);
    });
  });

  describe('calculateExitSabbaticalEncashment', () => {
    it('computes exit encashment for unavailed sabbatical days', () => {
      // Basic = 90,000 -> Daily = 3000
      // Unavailed = 45 days -> Encashment = 45 * 3000 = 135,000
      const result = calculateExitSabbaticalEncashment(90000, 45);

      expect(result.dailyWageBasis).toBe(3000);
      expect(result.encashmentAmount).toBe(135000);
    });
  });
});
