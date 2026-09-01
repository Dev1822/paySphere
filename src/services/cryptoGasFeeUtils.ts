/**
 * Blockchain Network Gas Fee Estimation & Priority Tip Telemetry Utilities
 */

export interface GasFeeEstimationMetrics {
  networkName: string;
  baseFeeGwei: number;
  priorityTipGwei: number;
  estimatedTransactionFeeUSD: number;
}

/**
 * Calculates blockchain network transaction gas fees in Gwei and USD.
 */
export function estimateBlockchainGasFee(
  networkName: string,
  ethPriceUsd: number,
  gasUnitsUsed = 21000
): GasFeeEstimationMetrics {
  const baseGwei = networkName === 'Ethereum Mainnet' ? 25 : 5;
  const tipGwei = 2;
  const totalGwei = baseGwei + tipGwei;

  const totalEth = (totalGwei * gasUnitsUsed) / 1e9;
  const feeUsd = Math.round(totalEth * ethPriceUsd * 100) / 100;

  return {
    networkName,
    baseFeeGwei: baseGwei,
    priorityTipGwei: tipGwei,
    estimatedTransactionFeeUSD: feeUsd,
  };
}
