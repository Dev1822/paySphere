/**
 * Unit Tests for Unemployment Tax Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateEmployerUnemploymentTaxes } from './unemploymentTaxUtils';

describe('UnemploymentTaxUtils', () => {
  it('should calculate FUTA tax capped at $7,000 wage base and state SUTA tax', () => {
    const res = calculateEmployerUnemploymentTaxes('EMP-HQ-01', 10000, 2.7);
    expect(res.futaTaxUSD).toBe(42.00); // 7000 * 0.006
    expect(res.sutaTaxUSD).toBe(270.00);
    expect(res.totalEmployerUnemploymentTaxUSD).toBe(312.00);
  });
});
