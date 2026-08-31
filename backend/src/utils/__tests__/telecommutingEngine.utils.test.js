const {
  classifyTelecommutingClaim,
  calculateAnnualTelecommutingTaxSplit,
  TELECOMMUTING_HEADS,
} = require('../telecommutingEngine.utils');

describe('telecommutingEngine.utils - Corporate Broadband & Telecommuting Engine', () => {
  describe('classifyTelecommutingClaim', () => {
    it('classifies verified broadband bill as 100% tax-free reimbursement', () => {
      const result = classifyTelecommutingClaim(
        TELECOMMUTING_HEADS.BROADBAND_INTERNET,
        1500,
        true,
        2500,
      );

      expect(result.isApproved).toBe(true);
      expect(result.approvedReimbursement).toBe(1500);
      expect(result.taxFreeAmount).toBe(1500);
      expect(result.taxablePerkAmount).toBe(0);
      expect(result.auditNotes).toContain('Rule 3(7)(ix)');
    });

    it('caps verified reimbursement at corporate policy limit', () => {
      const result = classifyTelecommutingClaim(
        TELECOMMUTING_HEADS.BROADBAND_INTERNET,
        3500,
        true,
        2500,
      );

      expect(result.isApproved).toBe(true);
      expect(result.approvedReimbursement).toBe(2500);
      expect(result.taxFreeAmount).toBe(2500);
      expect(result.taxablePerkAmount).toBe(0);
    });

    it('classifies fixed unreceipted remote allowance as 100% taxable', () => {
      const result = classifyTelecommutingClaim(
        TELECOMMUTING_HEADS.FIXED_REMOTE_ALLOWANCE,
        5000,
        false,
        5000,
      );

      expect(result.isApproved).toBe(true);
      expect(result.approvedReimbursement).toBe(5000);
      expect(result.taxFreeAmount).toBe(0);
      expect(result.taxablePerkAmount).toBe(5000);
    });

    it('rejects broadband claim when GST merchant bill is missing', () => {
      const result = classifyTelecommutingClaim(
        TELECOMMUTING_HEADS.BROADBAND_INTERNET,
        1500,
        false,
        2500,
      );

      expect(result.isApproved).toBe(false);
      expect(result.approvedReimbursement).toBe(0);
      expect(result.taxFreeAmount).toBe(0);
    });
  });

  describe('calculateAnnualTelecommutingTaxSplit', () => {
    it('aggregates annual statement with tax-free and taxable splits', () => {
      const claims = [
        { expenseHead: TELECOMMUTING_HEADS.BROADBAND_INTERNET, amount: 2000, isGstInvoiceAttached: true },
        { expenseHead: TELECOMMUTING_HEADS.MOBILE_TELEPHONE, amount: 1000, isGstInvoiceAttached: true },
        { expenseHead: TELECOMMUTING_HEADS.FIXED_REMOTE_ALLOWANCE, amount: 3000 },
      ];

      const split = calculateAnnualTelecommutingTaxSplit(claims);

      expect(split.totalClaimsCount).toBe(3);
      expect(split.totalClaimed).toBe(6000);
      expect(split.totalApproved).toBe(6000);
      expect(split.totalTaxFree).toBe(3000); // 2000 + 1000
      expect(split.totalTaxable).toBe(3000); // 3000
    });
  });
});
