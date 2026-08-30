/**
 * Unit Tests for POS Offline SAF Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculatePosOfflineStoreAndForward } from './posOfflineSafUtils';

describe('PosOfflineSafUtils', () => {
  it('should flag floor limit exceeded alert when queued offline transaction amount > $500', () => {
    const res = calculatePosOfflineStoreAndForward('TERM-502', 8, 650.00);
    expect(res.terminalId).toBe('TERM-502');
    expect(res.isFloorLimitExceeded).toBe(true);
  });
});
