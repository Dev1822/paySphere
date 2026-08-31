/**
 * Stablecoin Liquidity Reserve & De-Peg Threshold Utilities
 */

export interface StablecoinPegMetrics {
  coinSymbol: string;
  currentPegPriceUSD: number;
  pegDeviationPercent: number;
  isDePegAlertTriggered: boolean;
}

/**
 * Monitors stablecoin peg accuracy against 1.00 USD target.
 */
export function evaluateStablecoinPegStatus(coinSymbol: string, currentPriceUsd: number): StablecoinPegMetrics {
  const diff = Math.abs(1.00 - currentPriceUsd);
  const devPct = Math.round(diff * 100.0 * 100) / 100;
  const alert = devPct >= 1.0; // 1% deviation triggers de-peg risk alert

  return {
    coinSymbol,
    currentPegPriceUSD: currentPriceUsd,
    pegDeviationPercent: devPct,
    isDePegAlertTriggered: alert,
  };
}
