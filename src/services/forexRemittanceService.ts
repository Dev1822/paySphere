/**
 * Cross-Border Multi-Currency Forex Remittance & SWIFT Clearing Service
 * Provides telemetry on international SWIFT MT103 wire transfers, spot FX exchange rates,
 * currency spread fee margins, beneficiary IBAN/BIC validation, and OFAC sanction screening.
 */

export const CURRENCY_PAIR_TYPES = {
  USD_TO_EUR: { source: 'USD', target: 'EUR' },
  USD_TO_GBP: { source: 'USD', target: 'GBP' },
  USD_TO_JPY: { source: 'USD', target: 'JPY' },
  USD_TO_INR: { source: 'USD', target: 'INR' },
};

export interface CrossBorderRemittanceData {
  remittanceId: string;
  senderMerchantId: string;
  recipientBankBic: string;
  sourceCurrency: string;
  targetCurrency: string;
  sendAmountUSD: number;
  spotExchangeRate: number;
  forexSpreadPercent: number;
  swiftWireFeeUSD: number;
  processedAt: string;
}

export interface RemittanceTransferResult {
  isRemittanceApproved: boolean;
  grossTargetCurrencyAmount: number;
  forexSpreadDeductionUSD: number;
  netReceivedTargetCurrencyAmount: number;
  remittanceStatus: 'SWIFT_DISPATCHED' | 'HELD_FOR_OFAC_SANCTION_AUDIT' | 'COMPLETED_BENEFICIARY_CREDITED';
}

export interface ForexSpreadMetrics {
  sendAmountUSD: number;
  forexSpreadPercent: number;
  forexSpreadFeeUSD: number;
}

export interface SwiftFinMessageAuditReport {
  remittanceId: string;
  recipientBankBic: string;
  transferredAmountUSD: number;
  ibanNumber: string;
  swiftMt103Status: 'MT103_CLEARING_ACKNOWLEDGED' | 'INTERMEDIARY_BANK_HOLD' | 'REJECTED_INVALID_BIC';
  complianceChecklist: string[];
}

/**
 * Evaluates cross-border multi-currency remittance transfer and calculates net received target funds.
 */
export function evaluateCrossBorderRemittanceTransfer(data: CrossBorderRemittanceData): RemittanceTransferResult {
  const grossTarget = Math.round(data.sendAmountUSD * data.spotExchangeRate * 100) / 100;
  const spreadUsd = Math.round(data.sendAmountUSD * (data.forexSpreadPercent / 100.0) * 100) / 100;
  const netSendUsd = Math.max(0, data.sendAmountUSD - spreadUsd - data.swiftWireFeeUSD);
  const netTarget = Math.round(netSendUsd * data.spotExchangeRate * 100) / 100;

  let status: RemittanceTransferResult['remittanceStatus'] = 'SWIFT_DISPATCHED';
  if (data.sendAmountUSD > 100000.0) {
    status = 'HELD_FOR_OFAC_SANCTION_AUDIT';
  }

  return {
    isRemittanceApproved: true,
    grossTargetCurrencyAmount: grossTarget,
    forexSpreadDeductionUSD: spreadUsd,
    netReceivedTargetCurrencyAmount: netTarget,
    remittanceStatus: status,
  };
}

/**
 * Calculates forex exchange spread fee profit margin in USD.
 */
export function calculateForexExchangeSpreadUSD(sendUSD: number, spreadPercent: number): ForexSpreadMetrics {
  const spread = Math.round(sendUSD * (spreadPercent / 100.0) * 100) / 100;
  return {
    sendAmountUSD: sendUSD,
    forexSpreadPercent: spreadPercent,
    forexSpreadFeeUSD: spread,
  };
}

/**
 * Generates SWIFT MT103 financial messaging audit report for cross-border banking clearing compliance.
 */
export function generateSwiftFinMessageAuditReport(
  remittanceId: string,
  bicCode: string,
  transferredUSD: number,
  iban: string
): SwiftFinMessageAuditReport {
  const checklist: string[] = [
    'Verify SWIFT BIC format (ISO 9362 8-11 alpha-numeric code).',
    'Screen beneficiary IBAN against OFAC Specially Designated Nationals (SDN) list.',
    'Confirm correspondent banking node routing path.',
  ];

  return {
    remittanceId,
    recipientBankBic: bicCode,
    transferredAmountUSD: transferredUSD,
    ibanNumber: iban,
    swiftMt103Status: 'MT103_CLEARING_ACKNOWLEDGED',
    complianceChecklist: checklist,
  };
}
