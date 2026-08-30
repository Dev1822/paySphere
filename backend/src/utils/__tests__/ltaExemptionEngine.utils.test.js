const {
  getCurrentLtaBlockYear,
  evaluateLtaJourneyEligibility,
  calculateLtaClaimExemption,
  calculateLtaTaxSummary,
  MAX_JOURNEYS_PER_BLOCK,
} = require('../ltaExemptionEngine.utils');

describe('ltaExemptionEngine.utils - Leave Travel Concession (LTA) Engine', () => {
  describe('getCurrentLtaBlockYear', () => {
    it('identifies 2026-2029 block and detects 1st year of block', () => {
      const result = getCurrentLtaBlockYear(2026);

      expect(result.blockStartYear).toBe(2026);
      expect(result.blockEndYear).toBe(2029);
      expect(result.blockLabel).toBe('2026-2029');
      expect(result.isFirstYearOfBlock).toBe(true);
    });

    it('identifies non-first year of block', () => {
      const result = getCurrentLtaBlockYear(2028);
      expect(result.isFirstYearOfBlock).toBe(false);
    });
  });

  describe('evaluateLtaJourneyEligibility', () => {
    it('allows claims when within 2-journey block limit', () => {
      const result = evaluateLtaJourneyEligibility(1, false, 2026);

      expect(result.isEligible).toBe(true);
      expect(result.remainingBlockJourneys).toBe(1);
      expect(result.rejectionReason).toBeNull();
    });

    it('rejects claim when 2 journeys already claimed in block', () => {
      const result = evaluateLtaJourneyEligibility(2, false, 2026);

      expect(result.isEligible).toBe(false);
      expect(result.remainingBlockJourneys).toBe(0);
      expect(result.rejectionReason).toContain('Maximum statutory limit of 2 journeys');
    });

    it('allows carryover journey in 1st year of block', () => {
      const result = evaluateLtaJourneyEligibility(0, true, 2026); // 2026 is 1st year of 2026-2029

      expect(result.isEligible).toBe(true);
      expect(result.isUsingCarryover).toBe(true);
      expect(result.remainingBlockJourneys).toBe(3); // 2 + 1 carryover
    });
  });

  describe('calculateLtaClaimExemption', () => {
    it('exempts full domestic airfare when within benchmark', () => {
      const result = calculateLtaClaimExemption(18000, 20000, true, true);

      expect(result.isApproved).toBe(true);
      expect(result.exemptAmount).toBe(18000);
      expect(result.taxableExcessAmount).toBe(0);
    });

    it('caps exemption to shortest-route economy/rail benchmark and taxes excess', () => {
      // Claimed 35,000 (e.g. Business class), Benchmark economy is 20,000
      const result = calculateLtaClaimExemption(35000, 20000, true, true);

      expect(result.isApproved).toBe(true);
      expect(result.exemptAmount).toBe(20000);
      expect(result.taxableExcessAmount).toBe(15000);
    });

    it('rejects international foreign travel claims', () => {
      const result = calculateLtaClaimExemption(50000, 50000, false, true);

      expect(result.isApproved).toBe(false);
      expect(result.exemptAmount).toBe(0);
      expect(result.taxableExcessAmount).toBe(50000);
    });
  });

  describe('calculateLtaTaxSummary', () => {
    it('aggregates annual tax-exempt vs unspent taxable LTA', () => {
      const claims = [
        { isApproved: true, exemptAmount: 25000 },
      ];

      const summary = calculateLtaTaxSummary(60000, claims);

      expect(summary.allocatedLtaAnnual).toBe(60000);
      expect(summary.totalExemptClaimed).toBe(25000);
      expect(summary.unspentTaxableLta).toBe(35000); // 60,000 - 25,000
    });
  });
});
