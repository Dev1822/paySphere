const {
  computeNoticeShortfallRecovery,
  processEmployerBuyoutReimbursement,
  generateNoticeSettlementLedger,
  STANDARD_MONTH_DAYS,
} = require('../noticeBuyoutEngine.utils');

describe('noticeBuyoutEngine.utils - Notice Period Shortfall & Buyout Engine', () => {
  describe('computeNoticeShortfallRecovery', () => {
    it('computes recovery for unserved notice days without waiver', () => {
      // Basic = 60,000, DA = 0 -> daily = 60000 / 30 = 2000
      // Contractual = 60 days, Served = 20 days -> Unserved = 40 days
      // Recovery = 40 * 2000 = 80,000
      const result = computeNoticeShortfallRecovery(60000, 0, 60, 20, 0);

      expect(result.dailyWageRate).toBe(2000);
      expect(result.unservedDays).toBe(40);
      expect(result.waivedDays).toBe(0);
      expect(result.netPayableShortfallDays).toBe(40);
      expect(result.grossRecoveryAmount).toBe(80000);
      expect(result.netShortfallRecovery).toBe(80000);
    });

    it('applies partial management waiver deduction', () => {
      // Unserved = 40 days, Waived = 15 days -> Net payable = 25 days
      // Recovery = 25 * 2000 = 50,000
      const result = computeNoticeShortfallRecovery(60000, 0, 60, 20, 15);

      expect(result.unservedDays).toBe(40);
      expect(result.waivedDays).toBe(15);
      expect(result.netPayableShortfallDays).toBe(25);
      expect(result.grossRecoveryAmount).toBe(80000);
      expect(result.waiverDeductionAmount).toBe(30000);
      expect(result.netShortfallRecovery).toBe(50000);
    });

    it('handles full notice served with 0 recovery', () => {
      const result = computeNoticeShortfallRecovery(60000, 0, 60, 60, 0);

      expect(result.unservedDays).toBe(0);
      expect(result.netShortfallRecovery).toBe(0);
    });
  });

  describe('processEmployerBuyoutReimbursement', () => {
    it('approves buyout reimbursement as taxable salary perquisite', () => {
      const result = processEmployerBuyoutReimbursement(120000, true, true);

      expect(result.isApproved).toBe(true);
      expect(result.reimbursableAmount).toBe(120000);
      expect(result.taxablePerquisite).toBe(120000);
    });

    it('rejects unverified buyout claims', () => {
      const result = processEmployerBuyoutReimbursement(120000, false, true);

      expect(result.isApproved).toBe(false);
      expect(result.reimbursableAmount).toBe(0);
      expect(result.status).toBe('REJECTED_UNVERIFIED_PROOF');
    });
  });

  describe('generateNoticeSettlementLedger', () => {
    it('aggregates total offboarding notice deductions', () => {
      const offboardees = [
        { basic: 60000, contractualDays: 60, servedDays: 30, waivedDays: 0 }, // 30 days * 2000 = 60,000
        { basic: 90000, contractualDays: 90, servedDays: 90, waivedDays: 0 }, // 0
      ];

      const ledger = generateNoticeSettlementLedger(offboardees);

      expect(ledger.totalEmployees).toBe(2);
      expect(ledger.totalRecoveryDeductions).toBe(60000);
      expect(ledger.itemizedRecords[0].netShortfallRecovery).toBe(60000);
      expect(ledger.itemizedRecords[1].netShortfallRecovery).toBe(0);
    });
  });
});
