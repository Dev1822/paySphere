/**
 * @fileoverview Multi-Currency Per Diem & Section 10(14) Tax Exemption Engine
 * @description Computes domestic and international travel per diem allowances,
 * statutory tax-exempt ceilings, and taxable excess perquisite splits.
 * Issue: #1668
 */

const DOMESTIC_PER_DIEM_CAPS_INR = {
  TIER_1_METRO: 3000,
  TIER_2_URBAN: 2000,
  TIER_3_OTHER: 1200,
};

const INTERNATIONAL_PER_DIEM_CAPS_USD = {
  US: 100,
  UK: 110,
  EU: 95,
  SG: 85,
  DEFAULT_INTL: 75,
};

/**
 * Computes itinerary duration in statutory billing days from start and end timestamps.
 *
 * @param {string|Date} startDateTime - Departure timestamp
 * @param {string|Date} endDateTime - Return arrival timestamp
 * @returns {{ totalHours: number, billableDays: number }}
 */
function computeItineraryDurationDays(startDateTime, endDateTime) {
  const start = new Date(startDateTime).getTime();
  const end = new Date(endDateTime).getTime();

  if (isNaN(start) || isNaN(end) || end <= start) {
    return { totalHours: 0, billableDays: 0 };
  }

  const totalHours = Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10;
  const wholeDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  let fractionalDays = 0;
  if (remainingHours > 12) {
    fractionalDays = 1.0;
  } else if (remainingHours >= 6) {
    fractionalDays = 0.5;
  }

  const billableDays = wholeDays + fractionalDays;

  return {
    totalHours,
    billableDays: billableDays > 0 ? billableDays : 0.5,
  };
}

/**
 * Calculates per diem payout and statutory tax-exempt / taxable split.
 *
 * @param {'DOMESTIC'|'INTERNATIONAL'} destinationType - Domestic or International
 * @param {string} locationCode - City tier (TIER_1_METRO, etc.) or Country (US, UK, EU, SG)
 * @param {number} billableDays - Duration in days
 * @param {number} disbursedDailyRate - Daily allowance rate granted by company
 * @param {number} fxRateToInr - FX rate if international (e.g. 83.5 for USD)
 * @returns {{ destinationType: string, locationCode: string, statutoryDailyCap: number, disbursedDailyRate: number, totalDisbursed: number, statutoryExemptCeiling: number, taxExemptAmount: number, taxableExcessAmount: number, currency: string }}
 */
function calculatePerDiemEntitlementAndTax(
  destinationType = 'DOMESTIC',
  locationCode = 'TIER_1_METRO',
  billableDays = 1,
  disbursedDailyRate = 3500,
  fxRateToInr = 83.5,
) {
  const days = Math.max(0.5, Number(billableDays) || 1);
  const disbursedRate = Math.max(0, Number(disbursedDailyRate) || 0);

  let statutoryDailyCap = 0;
  let currency = 'INR';

  if (destinationType === 'INTERNATIONAL') {
    currency = 'USD';
    const countryCapUSD = INTERNATIONAL_PER_DIEM_CAPS_USD[locationCode.toUpperCase()] || INTERNATIONAL_PER_DIEM_CAPS_USD.DEFAULT_INTL;
    statutoryDailyCap = countryCapUSD;
  } else {
    statutoryDailyCap = DOMESTIC_PER_DIEM_CAPS_INR[locationCode.toUpperCase()] || DOMESTIC_PER_DIEM_CAPS_INR.TIER_2_URBAN;
  }

  const totalDisbursed = Math.round(days * disbursedRate * 100) / 100;
  const statutoryExemptCeiling = Math.round(days * statutoryDailyCap * 100) / 100;

  const taxExemptAmount = Math.min(totalDisbursed, statutoryExemptCeiling);
  const taxableExcessAmount = Math.max(0, Math.round((totalDisbursed - taxExemptAmount) * 100) / 100);

  const taxableExcessInr = destinationType === 'INTERNATIONAL'
    ? Math.round(taxableExcessAmount * fxRateToInr * 100) / 100
    : taxableExcessAmount;

  return {
    destinationType,
    locationCode,
    currency,
    billableDays: days,
    statutoryDailyCap,
    disbursedDailyRate: disbursedRate,
    totalDisbursed,
    statutoryExemptCeiling,
    taxExemptAmount,
    taxableExcessAmount,
    taxableExcessInr,
  };
}

/**
 * Aggregates cumulative YTD travel allowances and taxable splits.
 */
function aggregatePerDiemYtdTax(disbursements = []) {
  let totalDisbursedInr = 0;
  let totalTaxExemptInr = 0;
  let totalTaxableExcessInr = 0;

  for (const d of disbursements) {
    const isIntl = d.destinationType === 'INTERNATIONAL';
    const fx = isIntl ? (Number(d.fxRateToInr) || 83.5) : 1;

    const disbursed = (Number(d.totalDisbursed) || 0) * fx;
    const exempt = (Number(d.taxExemptAmount) || 0) * fx;
    const excess = Number(d.taxableExcessInr) || (disbursed - exempt);

    totalDisbursedInr += disbursed;
    totalTaxExemptInr += exempt;
    totalTaxableExcessInr += excess;
  }

  return {
    totalTrips: disbursements.length,
    totalDisbursedInr: Math.round(totalDisbursedInr * 100) / 100,
    totalTaxExemptInr: Math.round(totalTaxExemptInr * 100) / 100,
    totalTaxableExcessInr: Math.round(totalTaxableExcessInr * 100) / 100,
  };
}

module.exports = {
  DOMESTIC_PER_DIEM_CAPS_INR,
  INTERNATIONAL_PER_DIEM_CAPS_USD,
  computeItineraryDurationDays,
  calculatePerDiemEntitlementAndTax,
  aggregatePerDiemYtdTax,
};
