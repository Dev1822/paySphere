/**
 * Decentralized Finance (DeFi) Over-Collateralized Loan Telemetry Utilities
 */

export interface DefiLoanHealthMetrics {
  loanId: string;
  collateralRatioPercent: number;
  healthFactor: number;
  isLiquidationWarningTriggered: boolean;
}

/**
 * Calculates DeFi over-collateralized loan health factor and liquidation risk.
 */
export function calculateDefiLoanHealthFactor(
  collateralUsd: number,
  borrowedUsd: number,
  liquidationThresholdPercent = 80.0
): DefiLoanHealthMetrics {
  const ratio = borrowedUsd > 0 ? Math.round((collateralUsd / borrowedUsd) * 100.0 * 10) / 10 : 0;
  const health = borrowedUsd > 0 ? Math.round((collateralUsd * (liquidationThresholdPercent / 100.0) / borrowedUsd) * 100) / 100 : 999;
  const warning = health <= 1.1;

  return {
    loanId: `DEFI-LOAN-${Math.floor(Math.random() * 8000 + 1000)}`,
    collateralRatioPercent: ratio,
    healthFactor: health,
    isLiquidationWarningTriggered: warning,
  };
}
