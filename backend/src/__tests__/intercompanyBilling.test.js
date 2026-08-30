'use strict';

const { calculateTransferPricingBilling } = require('../services/intercompanyBilling.service');

describe('Intercompany Billing Service', () => {
  describe('calculateTransferPricingBilling', () => {
    it('calculates direct cost subtotal, markup amount, and total billed correctly', () => {
      const result = calculateTransferPricingBilling({
        rawDirectLaborCost: 100000,
        rawAllocatedBenefitsCost: 20000,
        transferPricingMarkupPercent: 7.5,
      });

      // Direct cost = 100,000 + 20,000 = 120,000
      expect(result.subtotalDirectCost).toBe(120000);
      // Markup = 120,000 * 0.075 = 9,000
      expect(result.transferPricingMarkupAmount).toBe(9000);
      // Total billed = 120,000 + 9,000 = 129,000
      expect(result.totalBilledAmount).toBe(129000);
    });

    it('rejects invalid markup percentages over 30%', () => {
      expect(() => {
        calculateTransferPricingBilling({
          rawDirectLaborCost: 50000,
          transferPricingMarkupPercent: 45,
        });
      }).toThrow('Transfer pricing markup must be between 0% and 30%.');
    });

    it('throws error for negative labor costs', () => {
      expect(() => {
        calculateTransferPricingBilling({
          rawDirectLaborCost: -1000,
        });
      }).toThrow('Labor and benefits costs must be non-negative.');
    });
  });
});