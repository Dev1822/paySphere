/**
 * Unit Tests for Forex Volatility Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateForexPairVolatilityVaR } from './forexVolatilityUtils';

describe('ForexVolatilityUtils', () => {
  it('should calculate 95% confidence Value at Risk (VaR) for volatile FX pair exposure', () => {
    const res = calculateForexPairVolatilityVaR('USD/TRY', 100000, 3.2);
    expect(res.currencyPair).toBe('USD/TRY');
    expect(res.isHighVolatilityAlert).toBe(true);
    expect(res.valueAtRiskUsd).toBe(5280.00);
  });
});
