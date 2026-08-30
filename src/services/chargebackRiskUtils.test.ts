/**
 * Unit Tests for Chargeback Risk Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateTransactionChargebackRisk } from './chargebackRiskUtils';

describe('ChargebackRiskUtils', () => {
  it('should flag chargeback risk when AVS or CVV fails verification', () => {
    const res = evaluateTransactionChargebackRisk(500, false, false);
    expect(res.isChargebackFlagged).toBe(true);
    expect(res.fraudRiskScore).toBeGreaterThanOrEqual(80);
    expect(res.reserveDeductionUSD).toBe(50.0);
  });
});
