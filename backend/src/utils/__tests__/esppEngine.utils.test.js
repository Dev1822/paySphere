const {
  computeMonthlyEsppDeduction,
  computeEsppPurchasePrice,
  executeShareAllocation,
  STATUTORY_MAX_DISCOUNT_PERCENT,
  STATUTORY_MAX_CONTRIBUTION_PERCENT,
} = require('../esppEngine.utils');

describe('esppEngine.utils - Employee Stock Purchase Plan (ESPP) Engine', () => {
  describe('computeMonthlyEsppDeduction', () => {
    it('computes deduction within statutory 15% contribution limit', () => {
      const gross = 100000;
      const result = computeMonthlyEsppDeduction(gross, 10);

      expect(result.contributionPercent).toBe(10);
      expect(result.monthlyDeduction).toBe(10000);
      expect(result.annualProjectedDeduction).toBe(120000);
    });

    it('caps elected percentage at statutory 15% ceiling', () => {
      const gross = 80000;
      const result = computeMonthlyEsppDeduction(gross, 25); // Exceeds 15%

      expect(result.contributionPercent).toBe(STATUTORY_MAX_CONTRIBUTION_PERCENT);
      expect(result.monthlyDeduction).toBe(12000); // 15% of 80000
    });
  });

  describe('computeEsppPurchasePrice', () => {
    it('applies 15% discount to Grant Date FMV when stock appreciates', () => {
      const grantFmv = 100;
      const purchaseFmv = 150;
      const result = computeEsppPurchasePrice(grantFmv, purchaseFmv, 15);

      expect(result.benchmarkFmv).toBe(100); // Lower of 100 vs 150
      expect(result.purchasePrice).toBe(85); // 100 * 0.85
      expect(result.perShareDiscount).toBe(65); // 150 - 85
    });

    it('applies 15% discount to Purchase Date FMV when stock depreciates', () => {
      const grantFmv = 120;
      const purchaseFmv = 80;
      const result = computeEsppPurchasePrice(grantFmv, purchaseFmv, 15);

      expect(result.benchmarkFmv).toBe(80); // Lower of 120 vs 80
      expect(result.purchasePrice).toBe(68); // 80 * 0.85
      expect(result.perShareDiscount).toBe(12); // 80 - 68
    });
  });

  describe('executeShareAllocation', () => {
    it('allocates whole shares, calculates perquisite tax, and carries over residual cash', () => {
      const accumulatedFunds = 1000; // $1,000
      const carryover = 50; // $50 -> $1050 total
      const grantFmv = 100;
      const purchaseFmv = 120; // Price = 85

      const result = executeShareAllocation(accumulatedFunds, carryover, grantFmv, purchaseFmv, 15);

      expect(result.totalAvailableFunds).toBe(1050);
      expect(result.purchasePrice).toBe(85);
      // 1050 / 85 = 12.35 -> 12 whole shares
      expect(result.sharesAllocated).toBe(12);
      expect(result.totalPurchaseCost).toBe(1020); // 12 * 85
      expect(result.residualCashCarryover).toBe(30); // 1050 - 1020
      // Perquisite tax value = 12 * (120 - 85) = 12 * 35 = 420
      expect(result.perquisiteTaxableValue).toBe(420);
    });
  });
});
