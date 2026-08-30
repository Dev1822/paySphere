/**
 * Cross-Border Multi-Currency Forex Remittance & SWIFT Clearing Service Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCrossBorderRemittanceTransfer,
  calculateForexExchangeSpreadUSD,
  generateSwiftFinMessageAuditReport,
  CURRENCY_PAIR_TYPES,
} from './forexRemittanceService';

describe('ForexRemittanceService', () => {
  const sampleRemittance = {
    remittanceId: 'REM-SWIFT-901',
    senderMerchantId: 'MERCHANT-8821',
    recipientBankBic: 'DEUTDEFFXXX',
    sourceCurrency: CURRENCY_PAIR_TYPES.USD_TO_EUR.source,
    targetCurrency: CURRENCY_PAIR_TYPES.USD_TO_EUR.target,
    sendAmountUSD: 50000.00,
    spotExchangeRate: 0.92,
    forexSpreadPercent: 0.8,
    swiftWireFeeUSD: 35.00,
    processedAt: '2026-08-30T10:00:00Z',
  };

  it('should evaluate cross-border remittance transfer and calculate net received target currency amount', () => {
    const remittance = evaluateCrossBorderRemittanceTransfer(sampleRemittance);

    expect(remittance).toBeDefined();
    expect(remittance.isRemittanceApproved).toBe(true);
    expect(remittance.grossTargetCurrencyAmount).toBe(46000.00);
    expect(remittance.netReceivedTargetCurrencyAmount).toBeLessThan(46000.00);
  });

  it('should calculate forex exchange spread profit in USD', () => {
    const spread = calculateForexExchangeSpreadUSD(sampleRemittance.sendAmountUSD, sampleRemittance.forexSpreadPercent);

    expect(spread).toBeDefined();
    expect(spread.forexSpreadFeeUSD).toBe(400.00);
  });

  it('should generate SWIFT MT103 financial messaging audit report for clearing compliance', () => {
    const report = generateSwiftFinMessageAuditReport(
      sampleRemittance.remittanceId,
      sampleRemittance.recipientBankBic,
      sampleRemittance.sendAmountUSD,
      'US7654321098'
    );

    expect(report).toBeDefined();
    expect(report.remittanceId).toBe('REM-SWIFT-901');
    expect(report.swiftMt103Status).toBe('MT103_CLEARING_ACKNOWLEDGED');
    expect(report.complianceChecklist.length).toBeGreaterThanOrEqual(3);
  });
});
