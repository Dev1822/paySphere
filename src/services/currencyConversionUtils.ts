/**
 * Cross-Border Foreign Exchange (FX) Currency Conversion Utilities
 */

export interface CurrencyConversionMetrics {
  originalAmount: number;
  originalCurrency: string;
  convertedAmountUSD: number;
  fxSpreadFeeUSD: number;
}

/**
 * Converts foreign transaction currency to USD using real-time FX exchange rate and spread fee.
 */
export function convertForeignCurrencyToUsd(
  amount: number,
  currencyCode: string,
  exchangeRateToUsd: number,
  fxSpreadPercent = 1.5
): CurrencyConversionMetrics {
  const baseUsd = amount * exchangeRateToUsd;
  const spread = Math.round(baseUsd * (fxSpreadPercent / 100.0) * 100) / 100;
  const finalUsd = Math.round((baseUsd - spread) * 100) / 100;

  return {
    originalAmount: amount,
    originalCurrency: currencyCode,
    convertedAmountUSD: finalUsd,
    fxSpreadFeeUSD: spread,
  };
}
