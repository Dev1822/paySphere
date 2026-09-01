/**
 * POS Terminal Offline Transaction Store-and-Forward (SAF) Utilities
 */

export interface PosOfflineStoreAndForwardMetrics {
  terminalId: string;
  queuedOfflineTxCount: number;
  totalQueuedAmountUSD: number;
  isFloorLimitExceeded: boolean;
}

/**
 * Calculates store-and-forward (SAF) offline transaction queue and floor limit compliance.
 */
export function calculatePosOfflineStoreAndForward(
  terminalId: string,
  queuedCount: number,
  queuedAmountUSD: number,
  floorLimitCapUSD = 500.0
): PosOfflineStoreAndForwardMetrics {
  const isExceeded = queuedAmountUSD > floorLimitCapUSD;

  return {
    terminalId,
    queuedOfflineTxCount: queuedCount,
    totalQueuedAmountUSD: queuedAmountUSD,
    isFloorLimitExceeded: isExceeded,
  };
}
