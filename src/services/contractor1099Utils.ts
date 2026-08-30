/**
 * Independent Contractor 1099-NEC Miscellaneous Tax Telemetry Utilities
 */

export interface Contractor1099Metrics {
  contractorId: string;
  grossPayoutUSD: number;
  isTaxWithholdingExempt: boolean;
  backupWithholdingUSD: number;
}

/**
 * Calculates 1099-NEC contractor gross payout and backup withholding if TIN is unverified.
 */
export function evaluateContractor1099Tax(
  contractorId: string,
  grossUSD: number,
  isTinVerified: boolean
): Contractor1099Metrics {
  const backupTax = !isTinVerified ? Math.round(grossUSD * 0.24 * 100) / 100 : 0;

  return {
    contractorId,
    grossPayoutUSD: grossUSD,
    isTaxWithholdingExempt: isTinVerified,
    backupWithholdingUSD: backupTax,
  };
}
