'use strict';

const { calculateFbtMetrics } = require('../services/fbtCalculator.service');

describe('FBT Calculator Service', () => {
  describe('calculateFbtMetrics', () => {
    it('calculates Type 1 gross-up and FBT liability accurately', () => {
      const result = calculateFbtMetrics({
        rawBenefitValue: 10000,
        employeeContribution: 2000,
        grossUpFactorType: 'type_1_gst_credited',
        fbtRatePercent: 47,
      });

      // Net taxable = 10,000 - 2,000 = 8,000
      expect(result.netTaxableBenefitValue).toBe(8000);
      // Grossed up = 8000 * 2.0802 = 16,641.60
      expect(result.grossedUpTaxableValue).toBe(16641.6);
      // FBT liability = 16641.6 * 0.47 = 7,821.55
      expect(result.employerFbtLiability).toBe(7821.55);
    });

    it('calculates Type 2 gross-up for GST-free benefits', () => {
      const result = calculateFbtMetrics({
        rawBenefitValue: 5000,
        employeeContribution: 0,
        grossUpFactorType: 'type_2_gst_free',
        fbtRatePercent: 47,
      });

      // Net taxable = 5000
      expect(result.netTaxableBenefitValue).toBe(5000);
      // Grossed up = 5000 * 1.8868 = 9,434
      expect(result.grossedUpTaxableValue).toBe(9434);
      // FBT liability = 9434 * 0.47 = 4,433.98
      expect(result.employerFbtLiability).toBe(4433.98);
    });

    it('throws error for negative raw benefit values', () => {
      expect(() => {
        calculateFbtMetrics({ rawBenefitValue: -100 });
      }).toThrow('Raw benefit value must be non-negative.');
    });
  });
});