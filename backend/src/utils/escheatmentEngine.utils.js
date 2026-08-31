/**
 * @fileoverview Escheatment & NAUPA Engine Utilities
 * @description Calculates dormancy periods, triggers due diligence workflows, 
 * and formats NAUPA standard electronic files for state submission.
 * Issue: #2013
 */
const { DUE_DILIGENCE_THRESHOLDS, NAUPA_PROPERTY_TYPES } = require('../constants/escheatment.constants');

/**
 * Stop-Payment Guardrail: Evaluates if a check is approaching the stale-date threshold 
 * to prevent bank cashing after the liability has been legally transferred to the state.
 * Typically, stop payments are issued 30 days before the escheatment report date.
 * 
 * @param {number} daysRemainingUntilDormancy 
 * @returns {{ requiresStopPayment: boolean, reason: string }}
 */
function checkStopPaymentGuardrail(daysRemainingUntilDormancy) {
    if (daysRemainingUntilDormancy <= 30 && daysRemainingUntilDormancy > 0) {
        return {
            requiresStopPayment: true,
            reason: `Check is ${daysRemainingUntilDormancy} days from dormancy. Stop payment required before state remittance.`
        };
    }
    return { requiresStopPayment: false, reason: 'No stop payment required yet.' };
}

/**
 * Determines if a due diligence letter must be sent based on state thresholds.
 * @param {number} daysRemainingUntilDormancy 
 * @param {string} stateCode 
 * @param {boolean} letterAlreadySent 
 * @returns {{ requiresLetter: boolean, daysUntilDeadline: number }}
 */
function evaluateDueDiligence(daysRemainingUntilDormancy, stateCode, letterAlreadySent) {
    if (letterAlreadySent) {
        return { requiresLetter: false, daysUntilDeadline: 0 };
    }

    const threshold = DUE_DILIGENCE_THRESHOLDS[stateCode] || DUE_DILIGENCE_THRESHOLDS.DEFAULT;

    // Letters must typically be sent between 60 and 120 days before the report date
    if (daysRemainingUntilDormancy <= (threshold + 60) && daysRemainingUntilDormancy > threshold) {
        return { requiresLetter: true, daysUntilDeadline: daysRemainingUntilDormancy - threshold };
    }

    return { requiresLetter: false, daysUntilDeadline: 0 };
}

/**
 * Pads a string to a fixed length for NAUPA fixed-width formatting.
 * @param {string} str 
 * @param {number} length 
 * @returns {string}
 */
function padNAUPAString(str, length) {
    const s = String(str || '').toUpperCase().trim();
    return (s + ' '.repeat(length)).substring(0, length);
}

/**
 * Pads a number with leading zeros for NAUPA fixed-width formatting.
 * Amounts are typically in cents, 12 digits.
 * @param {number} num 
 * @param {number} length 
 * @returns {string}
 */
function padNAUPANumber(num, length) {
    const n = Math.round(Math.abs(num || 0) * 100); // Convert to cents
    return String(n).padStart(length, '0');
}

/**
 * Generates the NAUPA Header Record.
 * @param {Object} companyData 
 * @param {string} reportYear 
 * @returns {string}
 */
function generateNAUPAHeader(companyData, reportYear) {
    const recordType = 'FS'; // File Header
    const companyName = padNAUPAString(companyData.name, 40);
    const ein = padNAUPAString(companyData.ein.replace(/-/g, ''), 9);
    const address = padNAUPAString(companyData.address, 40);
    const city = padNAUPAString(companyData.city, 20);
    const state = padNAUPAString(companyData.state, 2);
    const zip = padNAUPAString(companyData.zip, 5);
    const holderName = padNAUPAString(companyData.contactName, 40);
    const holderPhone = padNAUPAString(companyData.contactPhone.replace(/\D/g, ''), 10);
    const yearStr = padNAUPAString(reportYear, 4);
    const filler = padNAUPAString('', 100); // Remaining padding to standard length

    return (recordType + companyName + ein + address + city + state + zip + holderName + holderPhone + yearStr + filler).substring(0, 250);
}

/**
 * Generates the NAUPA Property Record (Detail).
 * @param {Object} check - UncashedPayrollCheck document
 * @param {Object} employee - Employee document
 * @returns {string}
 */
function generateNAUPAPropertyRecord(check, employee) {
    const recordType = 'PR'; // Property Record
    const propertyType = padNAUPAString(check.propertyType || NAUPA_PROPERTY_TYPES.WAGES, 4);
    const amount = padNAUPANumber(check.amount, 12);

    const ownerName = padNAUPAString(`${employee.lastName}, ${employee.firstName}`, 40);
    const ownerSSN = padNAUPAString(employee.ssn ? employee.ssn.replace(/-/g, '') : '', 9);
    const address = padNAUPAString(check.lastKnownAddress, 40);
    const city = padNAUPAString(employee.city || '', 20);
    const state = padNAUPAString(check.lastKnownState, 2);
    const zip = padNAUPAString(check.lastKnownZip, 5);

    const issueDate = padNAUPAString(check.issueDate.toISOString().slice(0, 10).replace(/-/g, ''), 8);
    const checkNumber = padNAUPAString(check.checkNumber, 20);
    const filler = padNAUPAString('', 90);

    return (recordType + propertyType + amount + ownerName + ownerSSN + address + city + state + zip + issueDate + checkNumber + filler).substring(0, 250);
}

/**
 * Generates the NAUPA Trailer Record.
 * @param {number} recordCount 
 * @param {number} totalAmount 
 * @returns {string}
 */
function generateNAUPATrailer(recordCount, totalAmount) {
    const recordType = 'TR'; // Trailer
    const count = padNAUPANumber(recordCount, 8); // Number of property records
    const total = padNAUPANumber(totalAmount, 12);
    const filler = padNAUPAString('', 228);

    return (recordType + count + total + filler).substring(0, 250);
}

module.exports = {
    checkStopPaymentGuardrail,
    evaluateDueDiligence,
    generateNAUPAHeader,
    generateNAUPAPropertyRecord,
    generateNAUPATrailer
};
