const {
  computeContractorPayoutWithholding,
  generateWithholdingCertificate,
  aggregateCrossBorderExposure,
  STATUTORY_TAX_RATES,
} = require('../crossBorderContractorEngine.utils');

describe('crossBorderContractorEngine.utils - Cross-Border Contractor & Tax Withholding', () => {
  describe('computeContractorPayoutWithholding', () => {
    it('applies 0% withholding for W-8BEN certified foreign contractors', () => {
      const invoiceAmount = 5000; // USD
      const fxRate = 83.5; // USD to INR
      const result = computeContractorPayoutWithholding(invoiceAmount, 'USD', 'INR', fxRate, 'W8BEN_CERTIFIED');

      expect(result.convertedGrossPayout).toBe(417500); // 5000 * 83.5
      expect(result.effectiveTaxRate).toBe(0);
      expect(result.withholdingTaxAmount).toBe(0);
      expect(result.netSettlementAmount).toBe(417500);
    });

    it('applies 30% statutory withholding for non-resident uncertified contractors', () => {
      const invoiceAmount = 4000; // USD
      const fxRate = 1; // USD to USD
      const result = computeContractorPayoutWithholding(invoiceAmount, 'USD', 'USD', fxRate, 'NON_RESIDENT_UNSPECIFIED');

      expect(result.effectiveTaxRate).toBe(30);
      expect(result.withholdingTaxAmount).toBe(1200); // 30% of 4000
      expect(result.netSettlementAmount).toBe(2800);
    });

    it('applies 20% Section 195 foreign enterprise TDS', () => {
      const invoiceAmount = 10000; // EUR
      const fxRate = 90.0; // EUR to INR
      const result = computeContractorPayoutWithholding(invoiceAmount, 'EUR', 'INR', fxRate, 'FOREIGN_SECTION_195');

      expect(result.convertedGrossPayout).toBe(900000); // 10000 * 90
      expect(result.effectiveTaxRate).toBe(20);
      expect(result.withholdingTaxAmount).toBe(180000); // 20% of 900000
      expect(result.netSettlementAmount).toBe(720000);
    });

    it('applies custom bilateral treaty rate', () => {
      const invoiceAmount = 2000; // GBP
      const fxRate = 1.25; // GBP to USD
      const result = computeContractorPayoutWithholding(invoiceAmount, 'GBP', 'USD', fxRate, 'CUSTOM_TREATY', 15);

      expect(result.convertedGrossPayout).toBe(2500); // 2000 * 1.25
      expect(result.effectiveTaxRate).toBe(15);
      expect(result.withholdingTaxAmount).toBe(375); // 15% of 2500
      expect(result.netSettlementAmount).toBe(2125);
    });
  });

  describe('generateWithholdingCertificate', () => {
    it('creates tamper-evident certificate with sha256 checksum signature', () => {
      const cert = generateWithholdingCertificate('CON-001', 'Hans Mueller', 'DE-987654321', 'W-8BEN', 50000, 0, 2026);

      expect(cert.isDigitallySigned).toBe(true);
      expect(cert.certificateId).toContain('CERT-TAX-2026-CON-001');
      expect(cert.verificationChecksum).toBeDefined();
      expect(cert.verificationChecksum.length).toBe(64); // SHA-256 hex string
    });
  });

  describe('aggregateCrossBorderExposure', () => {
    it('aggregates gross volume and breakdown by currency', () => {
      const payouts = [
        { convertedGrossPayout: 5000, withholdingTaxAmount: 0, netSettlementAmount: 5000, payoutCurrency: 'USD' },
        { convertedGrossPayout: 4000, withholdingTaxAmount: 1200, netSettlementAmount: 2800, payoutCurrency: 'USD' },
        { convertedGrossPayout: 9000, withholdingTaxAmount: 1800, netSettlementAmount: 7200, payoutCurrency: 'EUR' },
      ];

      const agg = aggregateCrossBorderExposure(payouts);

      expect(agg.totalPayoutRecords).toBe(3);
      expect(agg.totalGrossDisbursed).toBe(18000);
      expect(agg.totalTaxWithheld).toBe(3000);
      expect(agg.totalNetSettled).toBe(15000);
      expect(agg.currencyBreakdown.USD).toBe(9000);
      expect(agg.currencyBreakdown.EUR).toBe(9000);
    });
  });
});
