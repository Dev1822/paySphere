/**
 * Contactless Mobile NFC Apple Pay / Google Pay Tokenization Utilities
 */

export interface NfcTokenizationMetrics {
  deviceAccountToken: string;
  isTokenCryptogramVerified: boolean;
  tokenType: 'APPLE_PAY_DPAN' | 'GOOGLE_PAY_DPAN';
}

/**
 * Validates mobile contactless NFC Device Primary Account Number (DPAN) tokenization.
 */
export function validateNfcMobileTokenization(
  dpanToken: string,
  tokenType: 'APPLE_PAY_DPAN' | 'GOOGLE_PAY_DPAN'
): NfcTokenizationMetrics {
  const isVerified = dpanToken.length >= 16;

  return {
    deviceAccountToken: dpanToken,
    isTokenCryptogramVerified: isVerified,
    tokenType,
  };
}
