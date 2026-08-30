/**
 * Unit Tests for OFAC Sanction Screening Utilities
 */

import { describe, it, expect } from 'vitest';
import { screenBeneficiaryOfacSanctions } from './ofacSanctionScreeningUtils';

describe('OfacSanctionScreeningUtils', () => {
  it('should flag OFAC sanction match for blocked countries', () => {
    const res = screenBeneficiaryOfacSanctions('Pyongyang Imports Corp', 'NORTH_KOREA');
    expect(res.isSanctionMatchFlagged).toBe(true);
    expect(res.confidenceScorePercent).toBe(99.9);
  });
});
