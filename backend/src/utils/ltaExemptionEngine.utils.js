/**
 * @fileoverview Leave Travel Concession (LTC/LTA) Section 10(5) & Rule 2B Engine
 * @description Manages 4-year calendar block tracking (2 journeys/block + 1-year carryover),
 * shortest-route statutory economy airfare/rail caps, and taxable unspent rollups.
 * Issue: #1766
 */

const STATUTORY_BLOCK_YEARS = [
  { startYear: 2018, endYear: 2021 },
  { startYear: 2022, endYear: 2025 },
  { startYear: 2026, endYear: 2029 },
  { startYear: 2030, endYear: 2033 },
];

const MAX_JOURNEYS_PER_BLOCK = 2;

/**
 * Resolves current statutory 4-year block from a calendar year.
 */
function getCurrentLtaBlockYear(year = new Date().getFullYear()) {
  const currentYear = Number(year) || new Date().getFullYear();
  const matchingBlock = STATUTORY_BLOCK_YEARS.find(
    (b) => currentYear >= b.startYear && currentYear <= b.endYear,
  ) || {
    startYear: Math.floor(currentYear / 4) * 4,
    endYear: Math.floor(currentYear / 4) * 4 + 3,
  };

  const isFirstYearOfBlock = currentYear === matchingBlock.startYear;

  return {
    currentYear,
    blockStartYear: matchingBlock.startYear,
    blockEndYear: matchingBlock.endYear,
    blockLabel: `${matchingBlock.startYear}-${matchingBlock.endYear}`,
    isFirstYearOfBlock,
  };
}

/**
 * Evaluates whether an employee is eligible to claim an LTA exemption in the current year.
 *
 * @param {number} claimsInCurrentBlock - Number of LTA claims already made in this block (0, 1, 2)
 * @param {boolean} hasCarryoverFromPrevBlock - Whether a journey from prior block is eligible for carryover
 * @param {number} currentYear - Current calendar year
 * @returns {{ isEligible: boolean, remainingBlockJourneys: number, isUsingCarryover: boolean, rejectionReason: string|null }}
 */
function evaluateLtaJourneyEligibility(
  claimsInCurrentBlock = 0,
  hasCarryoverFromPrevBlock = false,
  currentYear = new Date().getFullYear(),
) {
  const blockInfo = getCurrentLtaBlockYear(currentYear);
  const used = Math.max(0, Number(claimsInCurrentBlock) || 0);

  // Carryover can only be utilized in the 1st year of the block
  let isUsingCarryover = false;
  if (hasCarryoverFromPrevBlock && blockInfo.isFirstYearOfBlock && used === 0) {
    isUsingCarryover = true;
  }

  const effectiveMaxJourneys = isUsingCarryover ? MAX_JOURNEYS_PER_BLOCK + 1 : MAX_JOURNEYS_PER_BLOCK;
  const remainingBlockJourneys = Math.max(0, effectiveMaxJourneys - used);

  if (remainingBlockJourneys <= 0) {
    return {
      isEligible: false,
      remainingBlockJourneys: 0,
      isUsingCarryover: false,
      rejectionReason: `Maximum statutory limit of ${MAX_JOURNEYS_PER_BLOCK} journeys in block ${blockInfo.blockLabel} already reached.`,
    };
  }

  return {
    isEligible: true,
    remainingBlockJourneys,
    isUsingCarryover,
    rejectionReason: null,
  };
}

/**
 * Calculates statutory tax exemption on an LTA journey claim.
 *
 * @param {number} actualTicketFare - Actual air/rail ticket fare paid for domestic travel
 * @param {number} statutoryBenchmarkFare - Economy air / 1st AC rail benchmark via shortest route
 * @param {boolean} isDomesticTravel - Must be within India (foreign travel is ineligible)
 * @param {boolean} isProofVerified - Boarding passes & tickets verified
 * @returns {{ actualTicketFare: number, statutoryBenchmarkFare: number, exemptAmount: number, taxableExcessAmount: number, isApproved: boolean, auditNotes: string }}
 */
function calculateLtaClaimExemption(
  actualTicketFare = 0,
  statutoryBenchmarkFare = 0,
  isDomesticTravel = true,
  isProofVerified = true,
) {
  const actualFare = Math.max(0, Number(actualTicketFare) || 0);
  const benchmarkFare = Math.max(0, Number(statutoryBenchmarkFare) || actualFare);

  if (!isDomesticTravel) {
    return {
      actualTicketFare: actualFare,
      statutoryBenchmarkFare: benchmarkFare,
      exemptAmount: 0,
      taxableExcessAmount: actualFare,
      isApproved: false,
      auditNotes: 'Section 10(5) restricts LTA exemption strictly to domestic travel within India.',
    };
  }

  if (!isProofVerified) {
    return {
      actualTicketFare: actualFare,
      statutoryBenchmarkFare: benchmarkFare,
      exemptAmount: 0,
      taxableExcessAmount: actualFare,
      isApproved: false,
      auditNotes: 'Proof of travel (tickets/boarding passes) unverified. Amount is fully taxable.',
    };
  }

  const exemptAmount = Math.min(actualFare, benchmarkFare);
  const taxableExcessAmount = Math.max(0, Math.round((actualFare - exemptAmount) * 100) / 100);

  return {
    actualTicketFare: actualFare,
    statutoryBenchmarkFare: benchmarkFare,
    exemptAmount,
    taxableExcessAmount,
    isApproved: true,
    auditNotes: taxableExcessAmount > 0
      ? 'Exemption capped at shortest-route economy/rail benchmark.'
      : 'Full ticket fare exempt under Section 10(5).',
  };
}

/**
 * Computes annual employee LTA tax rollup converting unspent LTA into taxable salary.
 */
function calculateLtaTaxSummary(allocatedLtaAnnual = 50000, claims = []) {
  const annualAllocation = Math.max(0, Number(allocatedLtaAnnual) || 0);
  let totalExemptClaimed = 0;

  for (const c of claims) {
    if (c.isApproved) {
      totalExemptClaimed += Number(c.exemptAmount) || 0;
    }
  }

  const effectiveExempt = Math.min(annualAllocation, totalExemptClaimed);
  const unspentTaxableLta = Math.max(0, annualAllocation - effectiveExempt);

  return {
    allocatedLtaAnnual: annualAllocation,
    totalExemptClaimed: effectiveExempt,
    unspentTaxableLta,
    claimsCount: claims.length,
  };
}

module.exports = {
  STATUTORY_BLOCK_YEARS,
  MAX_JOURNEYS_PER_BLOCK,
  getCurrentLtaBlockYear,
  evaluateLtaJourneyEligibility,
  calculateLtaClaimExemption,
  calculateLtaTaxSummary,
};
