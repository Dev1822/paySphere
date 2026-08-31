/**
 * Unit Tests for NACHA Batch Header Utilities
 */

import { describe, it, expect } from 'vitest';
import { generateNachaBatchHeaderChecksum } from './nachaBatchHeaderUtils';

describe('NachaBatchHeaderUtils', () => {
  it('should generate NACHA direct deposit ACH batch header checksum', () => {
    const res = generateNachaBatchHeaderChecksum('12-3456789', [121000358, 021000021]);
    expect(res.batchSequenceNumber).toContain('NACHA-BATCH-');
    expect(res.companyFederalEin).toBe('12-3456789');
    expect(res.isNachaFormatValid).toBe(true);
  });
});
