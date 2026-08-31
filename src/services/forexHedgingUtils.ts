/**
 * Cross-Border Forward Contract FX Hedging Telemetry Utilities
 */

export interface ForexHedgingContractMetrics {
  contractId: string;
  hedgedAmountUSD: number;
  lockedForwardFxRate: number;
  contractMaturityDateISO: string;
  isHedgingProfitable: boolean;
}

/**
 * Calculates forward contract currency hedging returns against live FX spot rate.
 */
export function evaluateForexForwardHedgingContract(
  hedgedUSD: number,
  lockedRate: number,
  currentSpotRate: number
): ForexHedgingContractMetrics {
  const isProfitable = lockedRate >= currentSpotRate;

  return {
    contractId: `FWD-FX-${Math.floor(Math.random() * 9000 + 1000)}`,
    hedgedAmountUSD: hedgedUSD,
    lockedForwardFxRate: lockedRate,
    contractMaturityDateISO: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    isHedgingProfitable: isProfitable,
  };
}
