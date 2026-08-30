/**
 * Employee Wage Garnishment & Child Support Order Telemetry Utilities
 */

export interface WageGarnishmentMetrics {
  employeeId: string;
  grossPayUSD: number;
  garnishmentOrderAmountUSD: number;
  maximumAllowableDeductionUSD: number;
  actualGarnishmentDeductionUSD: number;
}

/**
 * Calculates mandatory wage garnishment deduction respecting Title III federal limits (max 25-50% disposable pay).
 */
export function calculateWageGarnishmentDeduction(
  employeeId: string,
  disposablePayUSD: number,
  garnishmentCourtOrderUSD: number,
  isChildSupportOrder = false
): WageGarnishmentMetrics {
  const maxCapPercent = isChildSupportOrder ? 0.50 : 0.25;
  const maxCap = Math.round(disposablePayUSD * maxCapPercent * 100) / 100;
  const actual = Math.min(garnishmentCourtOrderUSD, maxCap);

  return {
    employeeId,
    grossPayUSD: disposablePayUSD,
    garnishmentOrderAmountUSD: garnishmentCourtOrderUSD,
    maximumAllowableDeductionUSD: maxCap,
    actualGarnishmentDeductionUSD: actual,
  };
}
