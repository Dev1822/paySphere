/**
 * Unit Tests for Treasury Rebalance Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateTreasuryLiquidityRebalance } from './treasuryRebalanceUtils';

describe('TreasuryRebalanceMetrics', () => {
  it('should trigger treasury liquidity rebalance when balance drops below target threshold', () => {
    const res = calculateTreasuryLiquidityRebalance('TREASURY-EUR-01', 'EUR', 450000, 1000000);
    expect(res.treasuryAccountId).toBe('TREASURY-EUR-01');
    expect(res.isRebalanceTriggered).toBe(true);
    expect(res.rebalanceRequiredAmount).toBe(550000);
  });
});
