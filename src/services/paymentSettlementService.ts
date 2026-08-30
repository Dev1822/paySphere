/**
 * Real-Time Merchant Payment Gateway Settlement & Transaction Processing Service
 * Provides telemetry on credit card interchange fees, gateway fixed fee deductions,
 * gross-to-net merchant payouts, ACH/Wire settlement schedules, and PCI-DSS compliance audits.
 */

export const PAYMENT_METHOD_TYPES = {
  CREDIT_CARD_VISA: 'Visa Premium Credit Card',
  CREDIT_CARD_MASTERCARD: 'Mastercard Debit & Credit',
  APPLE_PAY_DIGITAL_WALLET: 'Apple Pay Biometric Token',
  ACH_DIRECT_DEBIT: 'ACH Direct Bank Transfer',
};

export interface MerchantTransactionData {
  transactionId: string;
  merchantId: string;
  merchantName: string;
  grossAmountUSD: number;
  paymentMethod: string;
  interchangeFeePercent: number;
  gatewayFixedFeeUSD: number;
  processedAt: string;
}

export interface TransactionSettlementResult {
  isSettlementApproved: boolean;
  totalFeeDeductionUSD: number;
  netPayoutAmountUSD: number;
  settlementStatus: 'SETTLED_SUCCESS' | 'HELD_FOR_RISK_REVIEW' | 'CHARGEBACK_RESERVE_DEDUCTED';
}

export interface GatewayFeeBreakdown {
  interchangeAmountUSD: number;
  fixedFeeUSD: number;
  totalGatewayFeeUSD: number;
  effectiveFeePercentage: number;
}

export interface MerchantPayoutAuditReport {
  merchantId: string;
  merchantName: string;
  grossVolumeUSD: number;
  totalFeesUSD: number;
  netPayoutUSD: number;
  payoutStatus: 'READY_FOR_ACH_WIRE_TRANSFER' | 'RISK_HOLD_SUSPENDED' | 'DISBURSED_COMPLETED';
  payoutDirectives: string[];
}

/**
 * Evaluates merchant payment transaction settlement and calculates net payout.
 */
export function evaluateMerchantTransactionSettlement(data: MerchantTransactionData): TransactionSettlementResult {
  const interchange = Math.round(data.grossAmountUSD * (data.interchangeFeePercent / 100.0) * 100) / 100;
  const totalFees = Math.round((interchange + data.gatewayFixedFeeUSD) * 100) / 100;
  const net = Math.max(0, Math.round((data.grossAmountUSD - totalFees) * 100) / 100);

  let status: TransactionSettlementResult['settlementStatus'] = 'SETTLED_SUCCESS';
  if (data.grossAmountUSD > 10000.0) {
    status = 'HELD_FOR_RISK_REVIEW';
  }

  return {
    isSettlementApproved: true,
    totalFeeDeductionUSD: totalFees,
    netPayoutAmountUSD: net,
    settlementStatus: status,
  };
}

/**
 * Calculates detailed fee breakdown including interchange rate and fixed fee.
 */
export function calculateMerchantGatewayFeeBreakdown(
  grossUSD: number,
  interchangeRatePercent: number,
  fixedFeeUSD: number
): GatewayFeeBreakdown {
  const interchange = Math.round(grossUSD * (interchangeRatePercent / 100.0) * 100) / 100;
  const total = Math.round((interchange + fixedFeeUSD) * 100) / 100;
  const effectivePct = grossUSD > 0 ? Math.round((total / grossUSD) * 100.0 * 100) / 100 : 0;

  return {
    interchangeAmountUSD: interchange,
    fixedFeeUSD,
    totalGatewayFeeUSD: total,
    effectiveFeePercentage: effectivePct,
  };
}

/**
 * Generates merchant payout audit report for financial ledger batch settlement.
 */
export function generateMerchantPayoutAuditReport(
  merchantId: string,
  merchantName: string,
  grossVolumeUSD: number,
  totalFeesUSD: number
): MerchantPayoutAuditReport {
  const net = Math.max(0, Math.round((grossVolumeUSD - totalFeesUSD) * 100) / 100);
  const directives: string[] = [
    'Verify ACH routing and transit bank account numbers.',
    'Deduct 5% rolling reserve for chargeback mitigation.',
    'Transmit FedWire payment batch payload to clearing house.',
  ];

  let status: MerchantPayoutAuditReport['payoutStatus'] = 'READY_FOR_ACH_WIRE_TRANSFER';
  if (grossVolumeUSD > 500000.0) {
    status = 'RISK_HOLD_SUSPENDED';
    directives.push('🚨 HIGH VOLUME ALERT: Requires Chief Risk Officer sign-off prior to disbursement.');
  }

  return {
    merchantId,
    merchantName,
    grossVolumeUSD,
    totalFeesUSD,
    netPayoutUSD: net,
    payoutStatus: status,
    payoutDirectives: directives,
  };
}
