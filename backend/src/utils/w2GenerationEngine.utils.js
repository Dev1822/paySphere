/**
 * @fileoverview W-2 Generation & EFW2 Magnetic Media Engine
 * @description Aggregates payroll data into IRS W-2 boxes and formats the
 * strict 512-byte fixed-width EFW2 records for SSA submission.
 * Issue: #1757
 */

// IRS Annual Wage Bases (Mocked for 2026)
const SS_WAGE_BASE_2026 = 168600;
const SS_TAX_RATE = 0.062;
const MEDICARE_TAX_RATE = 0.0145;
const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
const ADDITIONAL_MEDICARE_RATE = 0.009;

/**
 * Calculates the core W-2 boxes based on YTD payroll accumulators.
 *
 * @param {Object} ytdData - Aggregated YTD payroll data for the employee
 * @returns {Object} Populated W-2 box data
 */
function calculateW2Boxes(ytdData) {
  const grossWages = ytdData.grossWages || 0;
  const preTaxDeductions = ytdData.preTaxDeductions || 0; // e.g., 401k, Health Insurance
  const federalTaxWithheld = ytdData.federalTaxWithheld || 0;
  const ssTaxWithheld = ytdData.ssTaxWithheld || 0;
  const medicareTaxWithheld = ytdData.medicareTaxWithheld || 0;

  // Box 1: Gross Wages minus Pre-Tax Deductions
  const box1_Wages = Math.max(0, grossWages - preTaxDeductions);

  // Box 3: Social Security Wages (Capped at annual wage base)
  const box3_SSWages = Math.min(grossWages, SS_WAGE_BASE_2026);

  // Box 5: Medicare Wages (No cap)
  const box5_MedicareWages = grossWages;

  // Discrepancy Check
  let hasDiscrepancy = false;
  let discrepancyNotes = '';

  // Common valid discrepancy: Box 1 is lower than Box 3 due to 401k contributions
  if (box1_Wages < box3_SSWages && preTaxDeductions > 0) {
    discrepancyNotes = 'Box 1 < Box 3 due to pre-tax retirement contributions.';
  } else if (box1_Wages > box3_SSWages) {
    hasDiscrepancy = true;
    discrepancyNotes =
      'WARNING: Box 1 exceeds Social Security wage base without valid pre-tax offsets.';
  }

  return {
    box1_Wages: Math.round(box1_Wages * 100) / 100,
    box2_FederalTax: Math.round(federalTaxWithheld * 100) / 100,
    box3_SSWages: Math.round(box3_SSWages * 100) / 100,
    box4_SSTax: Math.round(ssTaxWithheld * 100) / 100,
    box5_MedicareWages: Math.round(box5_MedicareWages * 100) / 100,
    box6_MedicareTax: Math.round(medicareTaxWithheld * 100) / 100,
    hasDiscrepancy,
    discrepancyNotes,
  };
}

/**
 * Pads a string with spaces to a fixed length for EFW2 formatting.
 */
function padString(str, len) {
  const s = String(str || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .trim();
  return (s + ' '.repeat(len)).substring(0, len);
}

/**
 * Pads a number with leading zeros (or spaces for blanks) for EFW2 formatting.
 * EFW2 requires amounts in cents, right-justified with leading zeros.
 */
function padAmount(amount, len) {
  const cents = Math.round(Math.abs(amount || 0) * 100);
  return String(cents).padStart(len, '0');
}

/**
 * Generates the EFW2 RE (Employer) Record.
 * Always exactly 512 characters.
 */
function generateERRecord(employerData, taxYear) {
  const recordType = 'RE';
  const taxYearStr = String(taxYear);
  const kind = 'O'; // Original
  const ein = padString(employerData.ein.replace(/-/g, ''), 9);
  const controlNumber = padString(employerData.controlNumber || '0000', 4);
  const establishmentNumber = padString('', 4);
  const employerName = padString(employerData.name, 51);
  const addressLine1 = padString(employerData.address1, 22);
  const addressLine2 = padString(employerData.address2 || '', 22);
  const city = padString(employerData.city, 22);
  const state = padString(employerData.state, 2);
  const zip = padString(employerData.zip, 5);
  const zipExt = padString(employerData.zipExt || '', 4);
  const blank1 = padString('', 10);
  const contactName = padString(employerData.contactName, 27);
  const contactPhone = padString(
    employerData.contactPhone.replace(/\D/g, ''),
    15,
  );
  const contactEmail = padString(employerData.contactEmail || '', 50);
  const blank2 = padString('', 96);

  const record =
    recordType +
    taxYearStr +
    kind +
    ein +
    controlNumber +
    establishmentNumber +
    employerName +
    addressLine1 +
    addressLine2 +
    city +
    state +
    zip +
    zipExt +
    blank1 +
    contactName +
    contactPhone +
    contactEmail +
    blank2;

  return record.padEnd(512, ' ').substring(0, 512);
}

/**
 * Generates the EFW2 RW (Employee) Record.
 */
function generateRWRecord(employee, w2Data, taxYear) {
  const recordType = 'RW';
  const ssn = padString(employee.ssn.replace(/-/g, ''), 9);
  const empEIN = padString('', 15); // Employee EIN (usually blank)
  const firstName = padString(employee.firstName, 15);
  const middleInitial = padString(employee.middleInitial || '', 1);
  const lastName = padString(employee.lastName, 20);
  const suffix = padString('', 4);
  const address1 = padString(employee.address1, 22);
  const address2 = padString(employee.address2 || '', 22);
  const city = padString(employee.city, 22);
  const state = padString(employee.state, 2);
  const zip = padString(employee.zip, 5);
  const zipExt = padString(employee.zipExt || '', 4);
  const blank1 = padString('', 1);
  const statEmp = '0'; // Not a statutory employee
  const blank2 = padString('', 1);
  const retirementPlan = employee.has401k ? '1' : '0';
  const thirdPartySickPay = '0';
  const blank3 = padString('', 71);

  // Wages (12 digits each)
  const w1 = padAmount(w2Data.box1_Wages, 12);
  const w2 = padAmount(w2Data.box2_FederalTax, 12);
  const w3 = padAmount(w2Data.box3_SSWages, 12);
  const w4 = padAmount(w2Data.box4_SSTax, 12);
  const w5 = padAmount(w2Data.box5_MedicareWages, 12);
  const w6 = padAmount(w2Data.box6_MedicareTax, 12);
  const w7 = padAmount(w2Data.box7_SSTips, 12);
  const w8 = padAmount(w2Data.box8_AllocatedTips, 12);
  const w9 = padAmount(0, 12); // Advance EIC (deprecated)
  const w10 = padAmount(w2Data.box10_DependentCare, 12);
  const w11 = padAmount(w2Data.box11_NonqualifiedPlans, 12);
  const blank4 = padString('', 12);
  const w12a_Code = padString(w2Data.box12a_Code || '', 2);
  const w12a_Amount = padAmount(w2Data.box12a_Amount, 12);

  // Remaining boxes and padding to reach 512 chars
  const blank5 = padString('', 100);

  const record =
    recordType +
    ssn +
    empEIN +
    firstName +
    middleInitial +
    lastName +
    suffix +
    address1 +
    address2 +
    city +
    state +
    zip +
    zipExt +
    blank1 +
    statEmp +
    blank2 +
    retirementPlan +
    thirdPartySickPay +
    blank3 +
    w1 +
    w2 +
    w3 +
    w4 +
    w5 +
    w6 +
    w7 +
    w8 +
    w9 +
    w10 +
    w11 +
    blank4 +
    w12a_Code +
    w12a_Amount +
    blank5;

  return record.padEnd(512, ' ').substring(0, 512);
}

/**
 * Generates the EFW2 RO (Employer Total) Record.
 */
function generateRORecord(totals, employeeCount) {
  const recordType = 'RO';
  const blank1 = padString('', 41);
  const empCount = padAmount(employeeCount, 7);
  const w1 = padAmount(totals.box1, 18);
  const w2 = padAmount(totals.box2, 18);
  const w3 = padAmount(totals.box3, 18);
  const w4 = padAmount(totals.box4, 18);
  const w5 = padAmount(totals.box5, 18);
  const w6 = padAmount(totals.box6, 18);
  const w7 = padAmount(totals.box7, 18);
  const w8 = padAmount(totals.box8, 18);
  const w9 = padAmount(0, 18);
  const w10 = padAmount(totals.box10, 18);
  const w11 = padAmount(totals.box11, 18);
  const blank2 = padString('', 162);

  const record =
    recordType +
    blank1 +
    empCount +
    w1 +
    w2 +
    w3 +
    w4 +
    w5 +
    w6 +
    w7 +
    w8 +
    w9 +
    w10 +
    w11 +
    blank2;
  return record.padEnd(512, ' ').substring(0, 512);
}

/**
 * Generates the EFW2 RT (Total Record) for the entire file.
 */
function generateRTRecord(roTotals, roRecordCount) {
  const recordType = 'RT';
  const blank1 = padString('', 41);
  const count = padAmount(roRecordCount, 7);
  const w1 = padAmount(roTotals.box1, 18);
  const w2 = padAmount(roTotals.box2, 18);
  const w3 = padAmount(roTotals.box3, 18);
  const w4 = padAmount(roTotals.box4, 18);
  const w5 = padAmount(roTotals.box5, 18);
  const w6 = padAmount(roTotals.box6, 18);
  const w7 = padAmount(roTotals.box7, 18);
  const w8 = padAmount(roTotals.box8, 18);
  const w9 = padAmount(0, 18);
  const w10 = padAmount(roTotals.box10, 18);
  const w11 = padAmount(roTotals.box11, 18);
  const blank2 = padString('', 162);

  const record =
    recordType +
    blank1 +
    count +
    w1 +
    w2 +
    w3 +
    w4 +
    w5 +
    w6 +
    w7 +
    w8 +
    w9 +
    w10 +
    w11 +
    blank2;
  return record.padEnd(512, ' ').substring(0, 512);
}

module.exports = {
  calculateW2Boxes,
  generateERRecord,
  generateRWRecord,
  generateRORecord,
  generateRTRecord,
};
