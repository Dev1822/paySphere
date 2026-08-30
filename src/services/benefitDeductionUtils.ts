/**
 * Employee Pre-Tax 401(k) Retirement & HSA Benefit Deductions Utilities
 */

export interface BenefitDeductionsMetrics {
  contribution401kUSD: number;
  employerMatching401kUSD: number;
  hsaHealthDeductionUSD: number;
  totalPreTaxDeductionsUSD: number;
}

/**
 * Calculates pre-tax 401(k) retirement contributions and employer match.
 */
export function calculatePreTaxRetirementDeductions(
  grossPayUSD: number,
  employeeContributionPercent = 6.0,
  employerMatchPercent = 3.0
): BenefitDeductionsMetrics {
  const emp401k = Math.round(grossPayUSD * (employeeContributionPercent / 100.0) * 100) / 100;
  const match401k = Math.round(grossPayUSD * (employerMatchPercent / 100.0) * 100) / 100;
  const hsa = 150.00;

  return {
    contribution401kUSD: emp401k,
    employerMatching401kUSD: match401k,
    hsaHealthDeductionUSD: hsa,
    totalPreTaxDeductionsUSD: Math.round((emp401k + hsa) * 100) / 100,
  };
}
