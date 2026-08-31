/**
 * Unit Tests for Validator Node Health Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateValidatorNodeHealth } from './validatorNodeHealthUtils';

describe('ValidatorNodeHealthUtils', () => {
  it('should flag slashing risk when validator node uptime drops below 98%', () => {
    const res = evaluateValidatorNodeHealth('0xval123456789', 970, 1000);
    expect(res.uptimePercent).toBe(97.0);
    expect(res.slashingRiskAlert).toBe(true);
  });
});
