/**
 * Point-of-Sale (POS) Terminal EMV Chip & Contactless NFC Telemetry Service
 * Provides real-time telemetry on in-person card payments, EMV ARQC cryptogram validation,
 * NFC Apple Pay / Google Pay contactless tap processing, POS terminal batch reconciliation, and PCI-P2PE hardware encryption audits.
 */

export const POS_ENTRY_MODES = {
  EMV_CHIP_DIP: 'EMV Contact Chip Reader',
  CONTACTLESS_NFC_TAP: 'Contactless NFC Mobile Tap',
  MAGNETIC_STRIPE_SWIPE: 'Legacy Magnetic Stripe Fallback',
  MANUAL_KEY_ENTERED: 'Manual Keyed (CNP Fallback)',
};

export interface PosTransactionData {
  transactionId: string;
  terminalId: string;
  merchantStoreId: string;
  transactionAmountUSD: number;
  entryMode: string;
  emvCryptogram: string;
  isPinVerified: boolean;
  processedAt: string;
}

export interface PosTransactionResult {
  isTransactionApproved: boolean;
  authorizationCode: string;
  interchangeFeeUSD: number;
  terminalStatus: 'TRANSACTION_APPROVED_SUCCESS' | 'FALLBACK_SWIPE_WARNING' | 'DECLINED_INVALID_PIN';
}

export interface PosBatchTotals {
  terminalId: string;
  transactionCount: number;
  totalBatchAmountUSD: number;
  averageTicketSizeUSD: number;
}

export interface PosEmvSecurityAuditReport {
  terminalId: string;
  firmwareVersion: string;
  isEmvL2Certified: boolean;
  pciP2peComplianceStatus: 'PCI_P2PE_HARDWARE_ENCRYPTED' | 'UNENCRYPTED_HARDWARE_ALERT';
  securityDirectives: string[];
}

/**
 * Evaluates POS terminal transaction with EMV cryptogram and PIN verification.
 */
export function evaluatePosTerminalTransaction(data: PosTransactionData): PosTransactionResult {
  const isCryptogramValid = data.emvCryptogram.length >= 10;
  const authCode = `AUTH-${Math.floor(Math.random() * 900000 + 100000)}`;
  const interchange = Math.round(data.transactionAmountUSD * 0.015 * 100) / 100;

  let status: PosTransactionResult['terminalStatus'] = 'TRANSACTION_APPROVED_SUCCESS';
  if (data.entryMode === POS_ENTRY_MODES.MAGNETIC_STRIPE_SWIPE) {
    status = 'FALLBACK_SWIPE_WARNING';
  } else if (!data.isPinVerified && data.transactionAmountUSD > 200.0) {
    status = 'DECLINED_INVALID_PIN';
  }

  return {
    isTransactionApproved: isCryptogramValid && status !== 'DECLINED_INVALID_PIN',
    authorizationCode: authCode,
    interchangeFeeUSD: interchange,
    terminalStatus: status,
  };
}

/**
 * Calculates POS terminal daily batch settlement totals and average ticket size.
 */
export function calculatePosTerminalDailyBatchTotals(
  terminalId: string,
  txCount: number,
  totalAmountUSD: number
): PosBatchTotals {
  const avg = txCount > 0 ? Math.round((totalAmountUSD / txCount) * 100) / 100 : 0;
  return {
    terminalId,
    transactionCount: txCount,
    totalBatchAmountUSD: totalAmountUSD,
    averageTicketSizeUSD: avg,
  };
}

/**
 * Generates POS terminal EMV Level 2/3 and PCI Point-to-Point Encryption (P2PE) security audit report.
 */
export function generatePosEmvChipSecurityAuditReport(
  terminalId: string,
  firmwareVer: string,
  hasHardwareTpm: boolean
): PosEmvSecurityAuditReport {
  const directives: string[] = [
    'Verify DUKPT (Derived Unique Key Per Transaction) key rotation schedule.',
    'Confirm Tamper-Responsive Mesh enclosure integrity.',
    'Perform Level 3 EMV terminal brand certification test suites.',
  ];

  return {
    terminalId,
    firmwareVersion: firmwareVer,
    isEmvL2Certified: hasHardwareTpm,
    pciP2peComplianceStatus: hasHardwareTpm ? 'PCI_P2PE_HARDWARE_ENCRYPTED' : 'UNENCRYPTED_HARDWARE_ALERT',
    securityDirectives: directives,
  };
}
