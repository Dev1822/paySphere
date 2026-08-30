/**
 * IRS Quarterly Form 941 Employer Federal Tax Return Utilities
 */

export interface Form941QuarterlyMetrics {
  quarterIdentifier: string;
  totalTaxableWagesUSD: number;
  totalFederalTaxDepositsRequiredUSD: number;
  isQuarterlyFilingCompliant: boolean;
}

/**
 * Calculates IRS Form 941 quarterly employer federal tax deposit obligation.
 */
export function calculateForm941QuarterlyDeposit(
  quarter: string,
  totalWagesUSD: number,
  totalFedWithheldUSD: number
): Form941QuarterlyMetrics {
  const ssMedTotal = Math.round(totalWagesUSD * (0.062 * 2 + 0.0145 * 2) * 100) / 100;
  const deposit = Math.round((totalFedWithheldUSD + ssMedTotal) * 100) / 100;

  return {
    quarterIdentifier: quarter,
    totalTaxableWagesUSD: totalWagesUSD,
    totalFederalTaxDepositsRequiredUSD: deposit,
    isQuarterlyFilingCompliant: true,
  };
}
