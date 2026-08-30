/**
 * Payment Gateway Chargeback & Fraud Prevention Telemetry Utilities
 */

export interface ChargebackRiskMetrics {
  isChargebackFlagged: boolean;
  fraudRiskScore: number;
  reserveDeductionUSD: number;
}

/**
 * Evaluates transaction chargeback fraud risk score.
 */
export function evaluateTransactionChargebackRisk(
  transactionAmountUSD: number,
  cardAVSMatch: boolean,
  cvvMatch: boolean
): ChargebackRiskMetrics {
  let score = 10;
  if (!cardAVSMatch) score += 35;
  if (!cvvMatch) score += 45;

  const reserve = score >= 50 ? Math.round(transactionAmountUSD * 0.10 * 100) / 100 : 0;

  return {
    isChargebackFlagged: score >= 50,
    fraudRiskScore: score,
    reserveDeductionUSD: reserve,
  };
}
