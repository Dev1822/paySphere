/**
 * SWIFT gpi (Global Payments Innovation) Real-Time Wire Tracking Utilities
 */

export interface SwiftGpiTrackingMetrics {
  uetrTrackingId: string;
  currentIntermediaryBankBic: string;
  transitTimeElapsedMinutes: number;
  wireStatus: 'IN_TRANSIT_INTERMEDIARY' | 'CREDITED_TO_BENEFICIARY_ACCOUNT';
}

/**
 * Tracks SWIFT gpi real-time wire status using Unique End-to-End Transaction Reference (UETR).
 */
export function trackSwiftGpiWireTransaction(
  uetr: string,
  currentBic: string,
  elapsedMinutes: number
): SwiftGpiTrackingMetrics {
  const isCredited = elapsedMinutes >= 15;

  return {
    uetrTrackingId: uetr,
    currentIntermediaryBankBic: currentBic,
    transitTimeElapsedMinutes: elapsedMinutes,
    wireStatus: isCredited ? 'CREDITED_TO_BENEFICIARY_ACCOUNT' : 'IN_TRANSIT_INTERMEDIARY',
  };
}
