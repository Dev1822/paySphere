const {
  evaluateWellnessClaim,
  calculateAnnualWellnessTaxSplit,
  STATUTORY_80D_PREVENTIVE_ANNUAL_CAP,
  WELLNESS_CATEGORIES,
} = require('../wellnessWalletEngine.utils');

describe('wellnessWalletEngine.utils - Corporate Wellness Wallet & 80D Engine', () => {
  describe('evaluateWellnessClaim', () => {
    it('exempts preventive health checkup within statutory ₹5,000 Section 80D cap', () => {
      const result = evaluateWellnessClaim(WELLNESS_CATEGORIES.PREVENTIVE_HEALTH_CHECKUP, 4000, 0, true);

      expect(result.isApproved).toBe(true);
      expect(result.taxExempt80DAmount).toBe(4000);
      expect(result.taxablePerkAmount).toBe(0);
    });

    it('splits preventive health checkup exceeding remaining ₹5,000 cap into exempt vs taxable perk', () => {
      // YTD already used 3,500. Remaining cap = 1,500. Claimed 3,000.
      // Exempt = 1,500. Taxable perk = 1,500.
      const result = evaluateWellnessClaim(WELLNESS_CATEGORIES.PREVENTIVE_HEALTH_CHECKUP, 3000, 3500, true);

      expect(result.isApproved).toBe(true);
      expect(result.taxExempt80DAmount).toBe(1500);
      expect(result.taxablePerkAmount).toBe(1500);
    });

    it('approves gym/fitness membership as taxable perquisite reimbursement', () => {
      const result = evaluateWellnessClaim(WELLNESS_CATEGORIES.GYM_FITNESS_MEMBERSHIP, 12000, 0, true);

      expect(result.isApproved).toBe(true);
      expect(result.taxExempt80DAmount).toBe(0);
      expect(result.taxablePerkAmount).toBe(12000);
    });

    it('rejects claim when invoice receipt is unverified', () => {
      const result = evaluateWellnessClaim(WELLNESS_CATEGORIES.GYM_FITNESS_MEMBERSHIP, 5000, 0, false);

      expect(result.isApproved).toBe(false);
      expect(result.taxExempt80DAmount).toBe(0);
      expect(result.taxablePerkAmount).toBe(0);
    });
  });

  describe('calculateAnnualWellnessTaxSplit', () => {
    it('aggregates annual wellness claims and remaining 80D quota', () => {
      const claims = [
        { category: WELLNESS_CATEGORIES.PREVENTIVE_HEALTH_CHECKUP, amount: 3000, isReceiptVerified: true },
        { category: WELLNESS_CATEGORIES.PREVENTIVE_HEALTH_CHECKUP, amount: 3000, isReceiptVerified: true }, // 2000 exempt, 1000 perk
        { category: WELLNESS_CATEGORIES.GYM_FITNESS_MEMBERSHIP, amount: 6000, isReceiptVerified: true },     // 6000 perk
      ];

      const split = calculateAnnualWellnessTaxSplit(claims);

      expect(split.totalClaimsCount).toBe(3);
      expect(split.totalClaimed).toBe(12000);
      expect(split.totalExempt80D).toBe(5000); // capped at 5000
      expect(split.totalTaxablePerks).toBe(7000); // 1000 + 6000
      expect(split.remaining80DQuota).toBe(0);
    });
  });
});
