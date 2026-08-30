/**
 * @fileoverview Form 1099 & FIRE Format Engine
 * @description Evaluates 1099 thresholds, applies backup withholding, and generates 
 * fixed-width IRS FIRE format records.
 * Issue: #1871
 */

const FILING_THRESHOLD = 600;
const BACKUP_WITHHOLDING_RATE = 0.24; // 24%

/**
 * Evaluates if a contractor requires a 1099 form based on YTD payments.
 * @param {number} ytdNECPayments 
 * @param {number} ytdMISCPayments 
 * @returns {{ requiresNEC: boolean, requiresMISC: boolean }}
 */
function evaluate1099Thresholds(ytdNECPayments, ytdMISCPayments) {
    return {
        requiresNEC: ytdNECPayments >= FILING_THRESHOLD,
        requiresMISC: ytdMISCPayments >= FILING_THRESHOLD
    };
}

/**
 * Backup Withholding Guardrail: Calculates the 24% withholding for future payments
 * if the contractor has an unresolved TIN mismatch (B-Notice).
 * 
 * @param {number} grossPayment 
 * @param {string} tinMatchStatus 
 * @returns {{ withholdingAmount: number, netPayment: number, isWithheld: boolean }}
 */
function calculateBackupWithholding(grossPayment, tinMatchStatus) {
    if (tinMatchStatus === 'Mismatch' || tinMatchStatus === 'B-Notice Sent') {
        const withholdingAmount = Math.round(grossPayment * BACKUP_WITHHOLDING_RATE * 100) / 100;
        return {
            withholdingAmount,
            netPayment: Math.round((grossPayment - withholdingAmount) * 100) / 100,
            isWithheld: true
        };
    }

    return { withholdingAmount: 0, netPayment: grossPayment, isWithheld: false };
}

/**
 * Pads a string with blanks to a fixed length for FIRE format.
 */
function padString(str, len) {
    const s = String(str || '').toUpperCase();
    return (s + ' '.repeat(len)).substring(0, len);
}

/**
 * Pads a number with leading zeros for FIRE format.
 * FIRE format requires amounts in cents, 12 digits.
 */
function padAmount(amount, len = 12) {
    const cents = Math.round(Math.abs(amount || 0) * 100);
    return String(cents).padStart(len, '0');
}

/**
 * Generates the FIRE Format Payer Record (Type A).
 */
function generatePayerRecord(taxYear, payerTIN, payerName, payerAddress) {
    const recordType = 'A';
    const yearStr = String(taxYear);
    const priorYearIndicator = ' ';
    const tin = padString(payerTIN.replace(/-/g, ''), 9);
    const nameControl = padString(payerName.substring(0, 4), 4);
    const lastFilingIndicator = '0'; // 0 = First time filing
    const combinedFedState = ' ';
    const blank1 = padString('', 5);
    const name = padString(payerName, 40);
    const address = padString(payerAddress, 40);
    const city = padString('', 40);
    const state = padString('', 2);
    const zip = padString('', 9);
    const blank2 = padString('', 100); // Remaining to fill out standard length

    return recordType + yearStr + priorYearIndicator + tin + nameControl + lastFilingIndicator +
        combinedFedState + blank1 + name + address + city + state + zip + blank2;
}

/**
 * Generates the FIRE Format Payee Record (Type B) for 1099-NEC.
 */
function generatePayeeNECRecord(contractor, ytdNEC, ytdWithholding) {
    const recordType = 'B';
    const yearStr = String(new Date().getFullYear()); // Mock
    const correctedReturnIndicator = ' ';
    const payeeTIN = padString(contractor.tin.replace(/-/g, ''), 9);
    const accountNumber = padString(contractor.id.toString(), 20);
    const payerOfficeCode = ' ';
    const blank1 = padString('', 10);

    // Payment Amounts (12 digits each, in cents)
    const box1 = padAmount(ytdNEC); // Box 1: Nonemployee Compensation
    const box2 = padAmount(0);
    const box3 = padAmount(0);
    const box4 = padAmount(ytdWithholding); // Box 4: Federal Income Tax Withheld
    const box5 = padAmount(0);
    const box6 = padAmount(0);

    // Remaining boxes and state data
    const remainingBoxes = padString('', 12 * 10); // Boxes 7-16
    const name = padString(contractor.legalName, 40);
    const address = padString(contractor.address || '', 40);
    const blank2 = padString('', 100); // Remaining padding

    return recordType + yearStr + correctedReturnIndicator + payeeTIN + accountNumber +
        payerOfficeCode + blank1 + box1 + box2 + box3 + box4 + box5 + box6 +
        remainingBoxes + name + address + blank2;
}

module.exports = {
    evaluate1099Thresholds, calculateBackupWithholding,
    generatePayerRecord, generatePayeeNECRecord
};
