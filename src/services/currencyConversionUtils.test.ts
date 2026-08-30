/**
 * Unit Tests for Currency Conversion Utilities
 */

import { describe, it, expect } from 'vitest';
import { convertForeignCurrencyToUsd } from './currencyConversionUtils';

describe('CurrencyConversionUtils', () => {
  it('should convert EUR to USD applying 1.5% FX spread fee', () => {
    const res = convertForeignCurrencyToUsd(100, 'EUR', 1.08, 1.5);
    expect(res.convertedAmountUSD).toBeCloseTo(106.38, 1);
    expect(res.fxSpreadFeeUSD).toBe(1.62);
  });
});
