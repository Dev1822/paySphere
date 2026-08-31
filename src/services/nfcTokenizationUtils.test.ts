/**
 * Unit Tests for NFC Tokenization Utilities
 */

import { describe, it, expect } from 'vitest';
import { validateNfcMobileTokenization } from './nfcTokenizationUtils';

describe('NfcTokenizationUtils', () => {
  it('should validate Apple Pay DPAN mobile token cryptogram', () => {
    const res = validateNfcMobileTokenization('4111222233334444555', 'APPLE_PAY_DPAN');
    expect(res.isTokenCryptogramVerified).toBe(true);
    expect(res.tokenType).toBe('APPLE_PAY_DPAN');
  });
});
