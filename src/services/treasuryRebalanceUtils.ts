/**
 * Cross-Border Payment Multi-Currency Treasury Liquidity Rebalancing Utilities
 */

export interface TreasuryRebalanceMetrics {
  treasuryAccountId: string;
  currencyCode: string;
  currentBalance: number;
  targetThresholdBalance: number;
  rebalanceRequiredAmount: number;
  isRebalanceTriggered: boolean;
}

/**
 * Calculates multi-currency treasury liquidity rebalancing requirements.
 */
export function calculateTreasuryLiquidityRebalance(
  accountId: string,
  currencyCode: string,
  currentBalance: number,
  targetBalance: number
): TreasuryRebalanceMetrics {
  const diff = targetBalance - currentBalance;
  const rebalance = diff > 0 ? diff : 0;

  return {
    treasuryAccountId: accountId,
    currencyCode,
    currentBalance,
    targetThresholdBalance: targetBalance,
    rebalanceRequiredAmount: rebalance,
    isRebalanceTriggered: rebalance > 0,
  };
}
