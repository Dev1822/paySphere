/**
 * @fileoverview House Rent Allowance (HRA) Section 10(13A) Exemption Engine
 * @description Computes statutory 3-clause HRA tax exemptions, Metro (50%) vs Non-Metro (40%) rules,
 * and enforces ₹1,00,000 annual landlord PAN verification gates.
 * Issue: #1763
 */

const METRO_CITIES = ['MUMBAI', 'DELHI', 'KOLKATA', 'CHENNAI'];
const ANNUAL_RENT_PAN_THRESHOLD = 100000; // ₹1,00,000 / year mandatory Landlord PAN rule
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/**
 * Validates Landlord PAN compliance when annual rent exceeds ₹1 Lakh.
 */
function validateLandlordPanCompliance(annualRentPaid = 0, landlordPan = '') {
  const rent = Math.max(0, Number(annualRentPaid) || 0);
  const safePan = String(landlordPan || '').trim().toUpperCase();

  if (rent > ANNUAL_RENT_PAN_THRESHOLD) {
    if (!safePan) {
      return {
        isCompliant: false,
        requiresPan: true,
        message: 'Landlord PAN is mandatory as annual rent exceeds ₹1,00,000',
      };
    }

    if (!PAN_REGEX.test(safePan)) {
      return {
        isCompliant: false,
        requiresPan: true,
        message: 'Invalid Landlord PAN format (must match 10-character alphanumeric pattern)',
      };
    }
  }

  return {
    isCompliant: true,
    requiresPan: rent > ANNUAL_RENT_PAN_THRESHOLD,
    message: 'Landlord PAN compliance verified',
  };
}

/**
 * Computes statutory HRA exemption under Section 10(13A) and Rule 2A.
 *
 * @param {number} basicPay - Monthly basic pay
 * @param {number} dearnessAllowance - Monthly DA
 * @param {number} actualHraReceived - Actual HRA component in salary
 * @param {number} rentPaid - Actual house rent paid
 * @param {boolean|string} isMetro - True/False or City name
 * @param {string} landlordPan - Landlord PAN string
 * @returns {{ salaryForHra: number, clause1ActualHra: number, clause2RentMinus10Percent: number, clause3CityPercentSalary: number, metroRateApplied: number, exemptHra: number, taxableHra: number, panCompliance: object }}
 */
function computeHraExemption(
  basicPay = 0,
  dearnessAllowance = 0,
  actualHraReceived = 0,
  rentPaid = 0,
  isMetro = false,
  landlordPan = null,
) {
  const safeBasic = Math.max(0, Number(basicPay) || 0);
  const safeDa = Math.max(0, Number(dearnessAllowance) || 0);
  const safeHra = Math.max(0, Number(actualHraReceived) || 0);
  const safeRent = Math.max(0, Number(rentPaid) || 0);

  const salaryForHra = safeBasic + safeDa;

  // Determine if metro city (50%) or non-metro (40%)
  let isMetroCity = false;
  if (typeof isMetro === 'string') {
    isMetroCity = METRO_CITIES.includes(isMetro.trim().toUpperCase());
  } else {
    isMetroCity = Boolean(isMetro);
  }

  const metroRateApplied = isMetroCity ? 50 : 40;

  // Clause 1: Actual HRA received
  const clause1 = safeHra;

  // Clause 2: Rent paid - 10% of salary
  const clause2 = Math.max(0, Math.round((safeRent - 0.10 * salaryForHra) * 100) / 100);

  // Clause 3: 50% (Metro) or 40% (Non-Metro) of salary
  const clause3 = Math.round(((salaryForHra * metroRateApplied) / 100) * 100) / 100;

  // Minimum of the three clauses
  let exemptHra = Math.min(clause1, clause2, clause3);

  // Check PAN compliance for annualized rent
  const annualizedRent = safeRent * 12;
  const panCompliance = validateLandlordPanCompliance(annualizedRent, landlordPan);

  if (!panCompliance.isCompliant) {
    // If PAN is non-compliant when required, exemption cannot be granted under tax rules
    exemptHra = 0;
  }

  const taxableHra = Math.max(0, Math.round((safeHra - exemptHra) * 100) / 100);

  return {
    salaryForHra,
    actualHraReceived: safeHra,
    rentPaid: safeRent,
    isMetroCity,
    metroRateApplied,
    clause1ActualHra: clause1,
    clause2RentMinus10Percent: clause2,
    clause3CityPercentSalary: clause3,
    exemptHra,
    taxableHra,
    panCompliance,
  };
}

/**
 * Computes annual schedule across tenancy periods.
 */
function calculateAnnualHraTaxSchedule(monthlyPeriods = []) {
  let annualActualHra = 0;
  let annualRentPaid = 0;
  let annualExemptHra = 0;
  let annualTaxableHra = 0;

  const periodsBreakdown = [];

  for (const p of monthlyPeriods) {
    const calc = computeHraExemption(
      p.basicPay,
      p.dearnessAllowance,
      p.actualHraReceived,
      p.rentPaid,
      p.isMetro,
      p.landlordPan,
    );

    annualActualHra += calc.actualHraReceived;
    annualRentPaid += calc.rentPaid;
    annualExemptHra += calc.exemptHra;
    annualTaxableHra += calc.taxableHra;

    periodsBreakdown.push({
      month: p.month || 'Month',
      ...calc,
    });
  }

  return {
    periodCount: monthlyPeriods.length,
    annualActualHra: Math.round(annualActualHra * 100) / 100,
    annualRentPaid: Math.round(annualRentPaid * 100) / 100,
    annualExemptHra: Math.round(annualExemptHra * 100) / 100,
    annualTaxableHra: Math.round(annualTaxableHra * 100) / 100,
    periodsBreakdown,
  };
}

module.exports = {
  METRO_CITIES,
  ANNUAL_RENT_PAN_THRESHOLD,
  validateLandlordPanCompliance,
  computeHraExemption,
  calculateAnnualHraTaxSchedule,
};
