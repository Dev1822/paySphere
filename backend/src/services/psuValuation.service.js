/**
 * PSU Valuation Service - Issue #1598
 *
 * Computes Relative Total Shareholder Return (TSR), percentile rankings across peer companies,
 * and interpolates dynamic vesting multiplier curves (0% threshold to 200% maximum stretch).
 */
'use strict';

const logger = require('../utils/logger');

/**
 * Calculates stock return percentage (TSR):
 * TSR = ((finalPrice - baselinePrice) / baselinePrice) * 100
 */
function calculateTsr(baselinePrice, finalPrice) {
  if (!baselinePrice || baselinePrice <= 0) return 0;
  return Math.round((((finalPrice - baselinePrice) / baselinePrice) * 100) * 100) / 100;
}

/**
 * Evaluates percentile rank of company TSR among peer group and applies multiplier scale:
 * - < 25th percentile: 0.0x (0% payout)
 * - 25th percentile (Threshold): 0.5x (50% payout)
 * - 50th percentile (Median Target): 1.0x (100% payout)
 * - >= 75th percentile (Stretch Maximum): 2.0x (200% payout)
 */
function evaluateRelativeTsrVesting({ baselineCompanyPrice, finalCompanyPrice, peers, targetShares }) {
  if (!baselineCompanyPrice || !finalCompanyPrice || !targetShares) {
    throw new Error('Baseline price, final price, and target shares are required.');
  }

  const companyTsr = calculateTsr(baselineCompanyPrice, finalCompanyPrice);

  const evaluatedPeers = peers.map((p) => {
    const tsr = p.finalPrice !== undefined ? calculateTsr(p.baselinePrice, p.finalPrice) : (p.tsrPercent || 0);
    return { ...p, tsrPercent: tsr };
  });

  const allTsrs = evaluatedPeers.map((p) => p.tsrPercent);
  allTsrs.push(companyTsr);
  allTsrs.sort((a, b) => a - b);

  // Percentile Rank = (Count of scores below + 0.5 * equal) / Total * 100
  const countBelow = allTsrs.filter((t) => t < companyTsr).length;
  const countEqual = allTsrs.filter((t) => t === companyTsr).length;
  const percentileRank = Math.round(((countBelow + 0.5 * countEqual) / allTsrs.length) * 100 * 100) / 100;

  let vestingMultiplier = 0.0;
  if (percentileRank < 25) {
    vestingMultiplier = 0.0;
  } else if (percentileRank <= 50) {
    // Linear interpolation between 25th (0.5x) and 50th (1.0x)
    vestingMultiplier = 0.5 + ((percentileRank - 25) / 25) * 0.5;
  } else if (percentileRank <= 75) {
    // Linear interpolation between 50th (1.0x) and 75th (2.0x)
    vestingMultiplier = 1.0 + ((percentileRank - 50) / 25) * 1.0;
  } else {
    vestingMultiplier = 2.0; // Capped at 200%
  }

  vestingMultiplier = Math.round(vestingMultiplier * 1000) / 1000;
  const finalSharesVested = Math.floor(targetShares * vestingMultiplier);

  return {
    companyTsrPercent: companyTsr,
    evaluatedPeers,
    calculatedPercentileRank: percentileRank,
    vestingMultiplier,
    finalSharesVested,
  };
}

module.exports = {
  calculateTsr,
  evaluateRelativeTsrVesting,
};