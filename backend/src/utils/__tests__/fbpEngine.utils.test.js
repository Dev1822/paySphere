const {
  validateFbpDeclaration,
  processFbpClaim,
  calculateYearEndFbpRollup,
  FBP_STATUTORY_ANNUAL_CAPS,
} = require('../fbpEngine.utils');

describe('fbpEngine.utils - Flexible Benefit Plan Engine', () => {
  describe('validateFbpDeclaration', () => {
    it('validates and accepts allocations within statutory caps and pool ceilings', () => {
      const allocations = {
        TELECOM_BROADBAND: 2500, // <= 3000
        BOOKS_PERIODICALS: 1500, // <= 2000
        MEAL_COUPONS: 2000,      // <= 2200
        FUEL_DRIVER: 3000,       // <= 4000
      };

      const result = validateFbpDeclaration(allocations, 25000);

      expect(result.isValid).toBe(true);
      expect(result.totalMonthlyDeclared).toBe(9000);
      expect(result.annualDeclaredTotal).toBe(108000);
      expect(result.errors.length).toBe(0);
    });

    it('caps components exceeding statutory monthly caps', () => {
      const allocations = {
        TELECOM_BROADBAND: 5000, // Monthly cap is 3000 (36000/12)
      };

      const result = validateFbpDeclaration(allocations, 25000);

      expect(result.isValid).toBe(false);
      expect(result.validatedAllocations.TELECOM_BROADBAND).toBe(3000);
      expect(result.errors.some((e) => e.includes('TELECOM_BROADBAND'))).toBe(true);
    });
  });

  describe('processFbpClaim', () => {
    it('approves claim within allocated balance when receipt is verified', () => {
      const annualAllocated = 36000;
      const claimedSoFar = 10000;
      const claimAmount = 5000;

      const result = processFbpClaim(annualAllocated, claimedSoFar, claimAmount, true);

      expect(result.isApproved).toBe(true);
      expect(result.approvedAmount).toBe(5000);
      expect(result.remainingAnnualBalance).toBe(21000); // 36000 - 15000
      expect(result.taxablePortion).toBe(0);
    });

    it('caps approved claim to available annual balance', () => {
      const annualAllocated = 24000;
      const claimedSoFar = 20000;
      const claimAmount = 8000; // Only 4000 left

      const result = processFbpClaim(annualAllocated, claimedSoFar, claimAmount, true);

      expect(result.isApproved).toBe(true);
      expect(result.approvedAmount).toBe(4000);
      expect(result.remainingAnnualBalance).toBe(0);
    });

    it('flags unverified claim as taxable', () => {
      const result = processFbpClaim(24000, 0, 3000, false);

      expect(result.isApproved).toBe(false);
      expect(result.taxablePortion).toBe(3000);
      expect(result.rejectionReason).toContain('Receipt proof verification failed');
    });
  });

  describe('calculateYearEndFbpRollup', () => {
    it('computes tax-exempt claimed vs unspent taxable salary rollup', () => {
      const annualAllocations = {
        TELECOM_BROADBAND: 36000,
        BOOKS_PERIODICALS: 24000,
        MEAL_COUPONS: 26400,
      };
      const verifiedClaims = {
        TELECOM_BROADBAND: 30000, // 6000 unspent
        BOOKS_PERIODICALS: 24000, // 0 unspent
        MEAL_COUPONS: 20000,      // 6400 unspent
      };

      const rollup = calculateYearEndFbpRollup(annualAllocations, verifiedClaims);

      expect(rollup.totalDeclaredAnnual).toBe(86400);
      expect(rollup.totalTaxExemptClaimed).toBe(74000);
      expect(rollup.totalUnspentTaxableRollup).toBe(12400);
    });
  });
});
