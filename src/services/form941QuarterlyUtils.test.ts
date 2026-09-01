/**
 * Unit Tests for Form 941 Quarterly Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateForm941QuarterlyDeposit } from './form941QuarterlyUtils';

describe('Form941QuarterlyUtils', () => {
  it('should calculate IRS Form 941 quarterly federal tax deposit requirement', () => {
    const res = calculateForm941QuarterlyDeposit('2026-Q3', 100000, 22000);
    expect(res.quarterIdentifier).toBe('2026-Q3');
    expect(res.totalFederalTaxDepositsRequiredUSD).toBe(37300.00); // 22000 + 15300
    expect(res.isQuarterlyFilingCompliant).toBe(true);
  });
});
