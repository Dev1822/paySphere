/**
 * Unit Tests for Benefit Deduction Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculatePreTaxRetirementDeductions } from './benefitDeductionUtils';

describe('BenefitDeductionUtils', () => {
  it('should calculate 401(k) employee contribution and employer match', () => {
    const res = calculatePreTaxRetirementDeductions(10000, 6.0, 3.0);
    expect(res.contribution401kUSD).toBe(600.00);
    expect(res.employerMatching401kUSD).toBe(300.00);
    expect(res.totalPreTaxDeductionsUSD).toBe(750.00);
  });
});
