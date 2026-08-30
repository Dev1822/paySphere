/**
 * Merchant Rolling Reserve Hold & Release Audit Utilities
 */

export interface ReserveHoldReleaseMetrics {
  merchantId: string;
  totalReserveHeldUSD: number;
  eligibleReleaseAmountUSD: number;
  isEligibleForRelease: boolean;
}

/**
 * Calculates rolling reserve hold and eligible 180-day release amount.
 */
export function calculateMerchantReserveHoldRelease(
  merchantId: string,
  totalHeldUSD: number,
  daysHeld: number
): ReserveHoldReleaseMetrics {
  const eligible = daysHeld >= 180;
  const release = eligible ? totalHeldUSD : 0;

  return {
    merchantId,
    totalReserveHeldUSD: totalHeldUSD,
    eligibleReleaseAmountUSD: release,
    isEligibleForRelease: eligible,
  };
}
