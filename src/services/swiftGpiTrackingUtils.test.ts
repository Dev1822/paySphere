/**
 * Unit Tests for SWIFT gpi Tracking Utilities
 */

import { describe, it, expect } from 'vitest';
import { trackSwiftGpiWireTransaction } from './swiftGpiTrackingUtils';

describe('SwiftGpiTrackingUtils', () => {
  it('should track SWIFT gpi wire transaction status by UETR ID', () => {
    const res = trackSwiftGpiWireTransaction('c94e8201-8b29-4a92-9011-fae029103829', 'BNPAFR22XXX', 20);
    expect(res.uetrTrackingId).toBe('c94e8201-8b29-4a92-9011-fae029103829');
    expect(res.wireStatus).toBe('CREDITED_TO_BENEFICIARY_ACCOUNT');
  });
});
