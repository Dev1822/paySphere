/**
 * POS Terminal Dynamic Currency Conversion (DCC) Opt-In Utilities
 */

export interface PosDccConversionMetrics {
  terminalId: string;
  cardholderBaseCurrency: string;
  markupSpreadPercent: number;
  dccExchangeRate: number;
  convertedCardholderAmount: number;
  isDccOptedIn: boolean;
}

/**
 * Calculates POS Dynamic Currency Conversion (DCC) for international cardholders.
 */
export function calculatePosDccConversion(
  terminalId: string,
  amountUSD: number,
  cardholderCurrency: string,
  spotRate: number,
  isOptedIn = true
): PosDccConversionMetrics {
  const markup = 3.5; // 3.5% DCC markup rate
  const dccRate = spotRate * (1 + markup / 100.0);
  const converted = isOptedIn ? Math.round(amountUSD * dccRate * 100) / 100 : Math.round(amountUSD * spotRate * 100) / 100;

  return {
    terminalId,
    cardholderBaseCurrency: cardholderCurrency,
    markupSpreadPercent: markup,
    dccExchangeRate: dccRate,
    convertedCardholderAmount: converted,
    isDccOptedIn: isOptedIn,
  };
}
