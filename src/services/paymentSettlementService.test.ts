/**
 * Real-Time Merchant Payment Gateway Settlement & Transaction Processing Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateMerchantTransactionSettlement,
  calculateMerchantGatewayFeeBreakdown,
  generateMerchantPayoutAuditReport,
  PAYMENT_METHOD_TYPES,
} from './paymentSettlementService';

describe('PaymentSettlementService', () => {
  const sampleTransaction = {
    transactionId: 'TXN-PAY-9012',
    merchantId: 'MERCHANT-8821',
    merchantName: 'Acme Global E-Commerce Inc.',
    grossAmountUSD: 250.00,
    paymentMethod: PAYMENT_METHOD_TYPES.CREDIT_CARD_VISA,
    interchangeFeePercent: 1.8,
    gatewayFixedFeeUSD: 0.30,
    processedAt: '2026-08-30T10:00:00Z',
  };

  it('should evaluate merchant transaction settlement and calculate net payout amount', () => {
    const settlement = evaluateMerchantTransactionSettlement(sampleTransaction);

    expect(settlement).toBeDefined();
    expect(settlement.isSettlementApproved).toBe(true);
    expect(settlement.totalFeeDeductionUSD).toBe(4.80);
    expect(settlement.netPayoutAmountUSD).toBe(245.20);
  });

  it('should calculate detailed gateway fee breakdown including interchanges and tax', () => {
    const breakdown = calculateMerchantGatewayFeeBreakdown(
      sampleTransaction.grossAmountUSD,
      sampleTransaction.interchangeFeePercent,
      sampleTransaction.gatewayFixedFeeUSD
    );

    expect(breakdown).toBeDefined();
    expect(breakdown.interchangeAmountUSD).toBe(4.50);
    expect(breakdown.fixedFeeUSD).toBe(0.30);
    expect(breakdown.totalGatewayFeeUSD).toBe(4.80);
    expect(breakdown.effectiveFeePercentage).toBeCloseTo(1.92, 2);
  });

  it('should generate merchant payout audit report for financial ledger', () => {
    const report = generateMerchantPayoutAuditReport(
      sampleTransaction.merchantId,
      sampleTransaction.merchantName,
      125000.00,
      2400.00
    );

    expect(report).toBeDefined();
    expect(report.merchantId).toBe('MERCHANT-8821');
    expect(report.payoutStatus).toBe('READY_FOR_ACH_WIRE_TRANSFER');
    expect(report.payoutDirectives.length).toBeGreaterThanOrEqual(3);
  });
});
