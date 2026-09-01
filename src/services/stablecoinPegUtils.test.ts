/**
 * Unit Tests for Stablecoin Peg Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateStablecoinPegStatus } from './stablecoinPegUtils';

describe('StablecoinPegUtils', () => {
  it('should trigger de-peg alert when price drops below 0.99 USD', () => {
    const res = evaluateStablecoinPegStatus('USDT', 0.985);
    expect(res.isDePegAlertTriggered).toBe(true);
    expect(res.pegDeviationPercent).toBe(1.5);
  });
});
