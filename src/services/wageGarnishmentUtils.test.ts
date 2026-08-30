/**
 * Unit Tests for Wage Garnishment Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateWageGarnishmentDeduction } from './wageGarnishmentUtils';

describe('WageGarnishmentUtils', () => {
  it('should cap wage garnishment deduction at 25% of disposable pay for standard court orders', () => {
    const res = calculateWageGarnishmentDeduction('EMP-1002', 4000, 1500, false);
    expect(res.maximumAllowableDeductionUSD).toBe(1000.00);
    expect(res.actualGarnishmentDeductionUSD).toBe(1000.00);
  });
});
