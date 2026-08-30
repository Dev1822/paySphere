/**
 * Unit Tests for POS DCC Conversion Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculatePosDccConversion } from './posDccConversionUtils';

describe('PosDccConversionUtils', () => {
  it('should calculate POS DCC conversion with 3.5% markup when cardholder opts in', () => {
    const res = calculatePosDccConversion('TERM-POS-01', 100, 'EUR', 0.92, true);
    expect(res.terminalId).toBe('TERM-POS-01');
    expect(res.isDccOptedIn).toBe(true);
    expect(res.convertedCardholderAmount).toBeCloseTo(95.22, 1);
  });
});
