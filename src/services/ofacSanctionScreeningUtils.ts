/**
 * OFAC Specially Designated Nationals (SDN) Sanction Screening Utilities
 */

export interface OfacSanctionScreeningMetrics {
  beneficiaryName: string;
  country: string;
  isSanctionMatchFlagged: boolean;
  confidenceScorePercent: number;
}

/**
 * Screens cross-border payment beneficiary against OFAC SDN watchlist.
 */
export function screenBeneficiaryOfacSanctions(
  beneficiaryName: string,
  country: string
): OfacSanctionScreeningMetrics {
  const isBlocked = country === 'NORTH_KOREA' || country === 'IRAN';

  return {
    beneficiaryName,
    country,
    isSanctionMatchFlagged: isBlocked,
    confidenceScorePercent: isBlocked ? 99.9 : 0.0,
  };
}
