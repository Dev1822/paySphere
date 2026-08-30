/**
 * Unit Tests for Reserve Hold Release Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateMerchantReserveHoldRelease } from './reserveHoldReleaseUtils';

describe('ReserveHoldReleaseUtils', () => {
  it('should approve 180-day rolling reserve release for merchant', () => {
    const res = calculateMerchantReserveHoldRelease('MERCHANT-501', 12500, 185);
    expect(res.merchantId).toBe('MERCHANT-501');
    expect(res.isEligibleForRelease).toBe(true);
    expect(res.eligibleReleaseAmountUSD).toBe(12500);
  });
});
