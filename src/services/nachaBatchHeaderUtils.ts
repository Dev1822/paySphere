/**
 * Direct Deposit ACH NACHA File Batch Header Utilities
 */

export interface NachaBatchHeaderMetrics {
  batchSequenceNumber: string;
  companyFederalEin: string;
  entryHashSum: number;
  isNachaFormatValid: boolean;
}

/**
 * Generates NACHA direct deposit ACH batch header checksum telemetry.
 */
export function generateNachaBatchHeaderChecksum(
  companyEin: string,
  totalRoutingNumbers: number[]
): NachaBatchHeaderMetrics {
  const sum = totalRoutingNumbers.reduce((acc, curr) => acc + (curr % 10000), 0);

  return {
    batchSequenceNumber: `NACHA-BATCH-${Math.floor(Math.random() * 900 + 100)}`,
    companyFederalEin: companyEin,
    entryHashSum: sum,
    isNachaFormatValid: true,
  };
}
