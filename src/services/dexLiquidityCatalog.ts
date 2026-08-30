/**
 * Decentralized Exchange (DEX) Automated Market Maker (AMM) Liquidity Pool Catalog
 */

export const DEX_LIQUIDITY_POOLS_CATALOG = [
  { poolId: 'POOL-ETH-USDC', dexName: 'Uniswap V3', totalValueLockedUSD: 450000000, feeTierPercent: 0.05 },
  { poolId: 'POOL-SOL-USDC', dexName: 'Raydium Protocol', totalValueLockedUSD: 120000000, feeTierPercent: 0.25 },
  { poolId: 'POOL-WBTC-ETH', dexName: 'Curve Finance', totalValueLockedUSD: 850000000, feeTierPercent: 0.04 },
];

/**
 * Calculates estimated LP fee reward earnings from DEX liquidity pool provision.
 */
export function calculateLpFeeRewardUSD(providedLiquidityUSD: number, poolId: string): number {
  const match = DEX_LIQUIDITY_POOLS_CATALOG.find(p => p.poolId === poolId);
  const feePct = match ? match.feeTierPercent : 0.05;
  return Math.round(providedLiquidityUSD * (feePct / 100.0) * 100) / 100;
}
