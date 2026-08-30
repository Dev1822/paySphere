/**
 * Unit Tests for IBAN Validation Utilities
 */

import { describe, it, expect } from 'vitest';
import { validateInternationalIban } from './ibanValidationUtils';

describe('IbanValidationUtils', () => {
  it('should validate German IBAN structure and country code correctly', () => {
    const res = validateInternationalIban('DE89370400440532013000');
    expect(res.countryCode).toBe('DE');
    expect(res.isValidIbanStructure).toBe(true);
  });
});
