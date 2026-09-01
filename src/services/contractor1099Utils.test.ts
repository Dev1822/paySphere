/**
 * Unit Tests for Contractor 1099 Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateContractor1099Tax } from './contractor1099Utils';

describe('Contractor1099Utils', () => {
  it('should apply 24% backup withholding when contractor TIN is unverified', () => {
    const res = evaluateContractor1099Tax('CON-5021', 5000, false);
    expect(res.isTaxWithholdingExempt).toBe(false);
    expect(res.backupWithholdingUSD).toBe(1200.00);
  });
});
