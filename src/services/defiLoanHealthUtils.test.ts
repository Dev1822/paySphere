/**
 * Unit Tests for DeFi Loan Health Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateDefiLoanHealthFactor } from './defiLoanHealthUtils';

describe('DefiLoanHealthUtils', () => {
  it('should calculate health factor and flag liquidation warning when health factor <= 1.1', () => {
    const res = calculateDefiLoanHealthFactor(1250, 1000, 80.0);
    expect(res.collateralRatioPercent).toBe(125.0);
    expect(res.healthFactor).toBe(1.0);
    expect(res.isLiquidationWarningTriggered).toBe(true);
  });
});
