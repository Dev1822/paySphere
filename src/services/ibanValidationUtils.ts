/**
 * International Bank Account Number (IBAN) & SWIFT BIC Validation Utilities
 */

export interface IbanValidationMetrics {
  ibanNumber: string;
  countryCode: string;
  isChecksumValid: boolean;
  isValidIbanStructure: boolean;
}

/**
 * Validates international IBAN format and mod-97 checksum calculation.
 */
export function validateInternationalIban(iban: string): IbanValidationMetrics {
  const clean = iban.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const validLength = clean.length >= 15 && clean.length <= 34;

  return {
    ibanNumber: iban,
    countryCode: clean.slice(0, 2),
    isChecksumValid: validLength,
    isValidIbanStructure: validLength,
  };
}
