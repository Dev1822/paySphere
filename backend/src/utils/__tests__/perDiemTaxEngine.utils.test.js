const {
  computeItineraryDurationDays,
  calculatePerDiemEntitlementAndTax,
  aggregatePerDiemYtdTax,
  DOMESTIC_PER_DIEM_CAPS_INR,
  INTERNATIONAL_PER_DIEM_CAPS_USD,
} = require('../perDiemTaxEngine.utils');

describe('perDiemTaxEngine.utils - Multi-Currency Per Diem & Section 10(14) Engine', () => {
  describe('computeItineraryDurationDays', () => {
    it('computes exact days and handles partial travel day fractions', () => {
      // 36 hours -> 1 full day (24h) + 12h remainder (> 6h -> 0.5 day) = 1.5 days
      const start = '2026-09-01T08:00:00Z';
      const end = '2026-09-02T20:00:00Z';
      const result = computeItineraryDurationDays(start, end);

      expect(result.totalHours).toBe(36);
      expect(result.billableDays).toBe(1.5);
    });

    it('returns 0 for invalid or reverse timestamps', () => {
      const result = computeItineraryDurationDays('2026-09-02', '2026-09-01');
      expect(result.billableDays).toBe(0);
    });
  });

  describe('calculatePerDiemEntitlementAndTax', () => {
    it('calculates domestic tax-exempt allowance and taxable excess', () => {
      // TIER_1_METRO cap is 3000/day. Company gives 4000/day for 2 days.
      // Total = 8000, Exempt = 6000, Taxable Excess = 2000
      const result = calculatePerDiemEntitlementAndTax('DOMESTIC', 'TIER_1_METRO', 2, 4000);

      expect(result.totalDisbursed).toBe(8000);
      expect(result.statutoryExemptCeiling).toBe(6000);
      expect(result.taxExemptAmount).toBe(6000);
      expect(result.taxableExcessAmount).toBe(2000);
      expect(result.taxableExcessInr).toBe(2000);
    });

    it('calculates international USD allowance with INR conversion', () => {
      // US cap is $100/day. Company gives $150/day for 3 days ($450 total).
      // Exempt = $300, Taxable Excess = $150. In INR (at 83.5): 150 * 83.5 = 12525
      const result = calculatePerDiemEntitlementAndTax('INTERNATIONAL', 'US', 3, 150, 83.5);

      expect(result.currency).toBe('USD');
      expect(result.totalDisbursed).toBe(450);
      expect(result.taxExemptAmount).toBe(300);
      expect(result.taxableExcessAmount).toBe(150);
      expect(result.taxableExcessInr).toBe(12525);
    });
  });

  describe('aggregatePerDiemYtdTax', () => {
    it('aggregates total INR tax-exempt vs taxable travel allowances', () => {
      const disbursements = [
        { destinationType: 'DOMESTIC', totalDisbursed: 6000, taxExemptAmount: 6000, taxableExcessInr: 0 },
        { destinationType: 'DOMESTIC', totalDisbursed: 8000, taxExemptAmount: 6000, taxableExcessInr: 2000 },
      ];

      const agg = aggregatePerDiemYtdTax(disbursements);

      expect(agg.totalTrips).toBe(2);
      expect(agg.totalDisbursedInr).toBe(14000);
      expect(agg.totalTaxExemptInr).toBe(12000);
      expect(agg.totalTaxableExcessInr).toBe(2000);
    });
  });
});
