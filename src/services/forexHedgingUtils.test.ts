/**
 * Unit Tests for Forex Hedging Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateForexForwardHedgingContract } from './forexHedgingUtils';

describe('ForexHedgingUtils', () => {
  it('should evaluate FX forward contract profitability against current spot exchange rate', () => {
    const res = evaluateForexForwardHedgingContract(100000, 0.95, 0.92);
    expect(res.contractId).toContain('FWD-FX-');
    expect(res.isHedgingProfitable).toBe(true);
  });
});
