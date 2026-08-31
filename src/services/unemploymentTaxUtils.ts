/**
 * Employer Federal Unemployment Tax Act (FUTA) & State Unemployment (SUTA) Telemetry Utilities
 */

export interface UnemploymentTaxMetrics {
  employerId: string;
  futaTaxUSD: number;
  sutaTaxUSD: number;
  totalEmployerUnemploymentTaxUSD: number;
}

/**
 * Calculates employer FUTA (0.6% net) and SUTA unemployment tax contributions up to wage base cap.
 */
export function calculateEmployerUnemploymentTaxes(
  employerId: string,
  grossSubjectWagesUSD: number,
  sutaStateRatePercent = 2.7
): UnemploymentTaxMetrics {
  const futaBaseCap = Math.min(7000.0, grossSubjectWagesUSD);
  const futa = Math.round(futaBaseCap * 0.006 * 100) / 100;
  const suta = Math.round(grossSubjectWagesUSD * (sutaStateRatePercent / 100.0) * 100) / 100;

  return {
    employerId,
    futaTaxUSD: futa,
    sutaTaxUSD: suta,
    totalEmployerUnemploymentTaxUSD: Math.round((futa + suta) * 100) / 100,
  };
}
