/**
 * Real-Time Foreign Exchange (FX) Volatility & Value at Risk (VaR) Telemetry Utilities
 */

export interface ForexVolatilityMetrics {
  currencyPair: string;
  volatilityIndexPercent: number;
  valueAtRiskUsd: number;
  isHighVolatilityAlert: boolean;
}

/**
 * Calculates foreign exchange pair volatility and Value at Risk (VaR) telemetry.
 */
export function calculateForexPairVolatilityVaR(
  pair: string,
  exposureUSD: number,
  volatilityPct: number
): ForexVolatilityMetrics {
  const varAmount = Math.round(exposureUSD * (volatilityPct / 100.0) * 1.65 * 100) / 100; // 95% Confidence VaR
  const alert = volatilityPct >= 2.5;

  return {
    currencyPair: pair,
    volatilityIndexPercent: volatilityPct,
    valueAtRiskUsd: varAmount,
    isHighVolatilityAlert: alert,
  };
}
