/**
 * Unit Tests for DEX Liquidity Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateLpFeeRewardUSD, DEX_LIQUIDITY_POOLS_CATALOG } from './dexLiquidityCatalog';

describe('DexLiquidityCatalog', () => {
  it('should calculate estimated LP fee reward correctly', () => {
    const reward = calculateLpFeeRewardUSD(100000, 'POOL-ETH-USDC');
    expect(reward).toBe(50.0);
  });

  it('should contain catalog of DEX automated market maker liquidity pools', () => {
    expect(DEX_LIQUIDITY_POOLS_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
