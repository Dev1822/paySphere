/**
 * Unit Tests for POS Gratuity Tip Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculatePosGratuityTipAllocation } from './posGratuityTipUtils';

describe('PosGratuityTipUtils', () => {
  it('should calculate 18% restaurant gratuity tip allocation correctly', () => {
    const res = calculatePosGratuityTipAllocation('SERVER-102', 150.00, 18.0);
    expect(res.serverEmployeeId).toBe('SERVER-102');
    expect(res.calculatedTipAmountUSD).toBe(27.00);
    expect(res.netPayoutWithTipUSD).toBe(177.00);
  });
});
