const {
  classifyRelocationExpense,
  calculateRelocationPackageTaxSplit,
  STATUTORY_MAX_TAX_EXEMPT_STAY_DAYS,
  RELOCATION_CATEGORIES,
} = require('../relocationEngine.utils');

describe('relocationEngine.utils - Employee Relocation & Section 10(14) Tax Engine', () => {
  describe('classifyRelocationExpense', () => {
    it('exempts 100% of goods packing and transport when GST invoice is verified', () => {
      const result = classifyRelocationExpense(RELOCATION_CATEGORIES.GOODS_PACKING_TRANSIT, 45000, 0, true);

      expect(result.isFullyExempt).toBe(true);
      expect(result.taxExemptAmount).toBe(45000);
      expect(result.taxablePerkAmount).toBe(0);
    });

    it('exempts temporary stay within statutory 15-day limit', () => {
      const result = classifyRelocationExpense(RELOCATION_CATEGORIES.TEMPORARY_ACCOMMODATION, 30000, 10, true);

      expect(result.isFullyExempt).toBe(true);
      expect(result.taxExemptAmount).toBe(30000);
      expect(result.taxablePerkAmount).toBe(0);
    });

    it('splits temporary stay exceeding 15 days into exempt vs taxable perquisite', () => {
      // 20 days stay for ₹60,000. 15 days exempt = 45,000. 5 days taxable = 15,000
      const result = classifyRelocationExpense(RELOCATION_CATEGORIES.TEMPORARY_ACCOMMODATION, 60000, 20, true);

      expect(result.isFullyExempt).toBe(false);
      expect(result.taxExemptAmount).toBe(45000);
      expect(result.taxablePerkAmount).toBe(15000);
    });

    it('treats brokerage and settling-in as taxable perquisite', () => {
      const result = classifyRelocationExpense(RELOCATION_CATEGORIES.BROKERAGE_SETTLING_IN, 25000, 0, true);

      expect(result.isFullyExempt).toBe(false);
      expect(result.taxExemptAmount).toBe(0);
      expect(result.taxablePerkAmount).toBe(25000);
    });

    it('treats unverified GST claims as fully taxable', () => {
      const result = classifyRelocationExpense(RELOCATION_CATEGORIES.GOODS_PACKING_TRANSIT, 20000, 0, false);

      expect(result.taxExemptAmount).toBe(0);
      expect(result.taxablePerkAmount).toBe(20000);
      expect(result.auditNotes).toContain('GST proof unverified');
    });
  });

  describe('calculateRelocationPackageTaxSplit', () => {
    it('aggregates total package tax exemptions and taxable perk additions', () => {
      const claims = [
        { category: RELOCATION_CATEGORIES.GOODS_PACKING_TRANSIT, amount: 40000, isGstInvoiceVerified: true },
        { category: RELOCATION_CATEGORIES.TEMPORARY_ACCOMMODATION, amount: 40000, stayDurationDays: 20, isGstInvoiceVerified: true }, // 30k exempt, 10k tax
        { category: RELOCATION_CATEGORIES.BROKERAGE_SETTLING_IN, amount: 15000, isGstInvoiceVerified: true }, // 15k tax
      ];

      const split = calculateRelocationPackageTaxSplit(claims);

      expect(split.totalClaimsCount).toBe(3);
      expect(split.totalDisbursed).toBe(95000);
      expect(split.totalTaxExempt).toBe(70000); // 40k + 30k
      expect(split.totalTaxablePerks).toBe(25000); // 10k + 15k
    });
  });
});
