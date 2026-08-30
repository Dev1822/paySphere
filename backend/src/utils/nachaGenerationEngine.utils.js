/**
 * @fileoverview NACHA Generation Engine
 * @description Translates payroll data into strict 94-character fixed-width NACHA format.
 * Calculates batch hash totals and enforces file balancing guardrails.
 * Issue: #1733
 */

/**
 * Pads a string with spaces to a fixed length.
 * @param {string} str 
 * @param {number} len 
 * @param {string} [padChar=' '] 
 * @returns {string}
 */
function padString(str, len, padChar = ' ') {
    const s = String(str || '').toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
    return (s + padChar.repeat(len)).substring(0, len);
}

/**
 * Pads a number with leading zeros to a fixed length.
 * @param {number} num 
 * @param {number} len 
 * @returns {string}
 */
function padNumber(num, len) {
    const n = Math.round(Math.abs(num || 0) * 100); // Convert to cents
    return String(n).padStart(len, '0');
}

/**
 * Generates the NACHA File Header Record (Record Type 1).
 * Always exactly 94 characters.
 */
function generateFileHeader(config, creationDate) {
    const recordType = '1';
    const priorityCode = '01';
    const immediateDest = ' ' + config.immediateDestination; // Space + 9 digits
    const immediateOrig = ' ' + config.immediateOrigin;     // Space + 9 digits
    const fileCreationDate = creationDate.toISOString().slice(2, 4) + creationDate.toISOString().slice(5, 7) + creationDate.toISOString().slice(8, 10); // YYMMDD
    const fileCreationTime = creationDate.toISOString().slice(11, 13) + creationDate.toISOString().slice(14, 16); // HHmm
    const fileIdModifier = 'A';
    const recordSize = '094';
    const blockingFactor = '10';
    const formatCode = '1';
    const destName = padString(config.destinationName, 23);
    const origName = padString(config.originatorName, 23);
    const referenceCode = padString('', 8);

    return recordType + priorityCode + immediateDest + immediateOrig + fileCreationDate + fileCreationTime + fileIdModifier + recordSize + blockingFactor + formatCode + destName + origName + referenceCode;
}

/**
 * Generates the NACHA Batch Header Record (Record Type 5).
 */
function generateBatchHeader(config, effectiveDate, batchNumber) {
    const recordType = '5';
    const serviceClass = '220'; // 220 = Credits only, 200 = Mixed
    const companyName = padString(config.originatorName, 16);
    const discData = padString('', 20);
    const companyId = padString(config.companyIdentification, 10);
    const secCode = config.standardEntryClass;
    const entryDesc = padString(config.companyEntryDescription, 10);
    const descDate = padString('', 6);
    const effDate = effectiveDate.toISOString().slice(2, 4) + effectiveDate.toISOString().slice(5, 7) + effectiveDate.toISOString().slice(8, 10);
    const settleDate = padString('', 3); // Julian date, filled by bank
    const originatorStatus = '1';
    const origDFI = config.immediateOrigin.substring(0, 8);
    const batchId = padNumber(batchNumber, 7);

    return recordType + serviceClass + companyName + discData + companyId + secCode + entryDesc + descDate + effDate + settleDate + originatorStatus + origDFI + batchId;
}

/**
 * Generates the NACHA Entry Detail Record (Record Type 6).
 */
function generateEntryDetail(bankMapping, amountCents, traceNumber, entrySeq) {
    const recordType = '6';
    const transCode = bankMapping.accountType === 'Checking' ? '22' : '32'; // 22=Checking Credit, 32=Savings Credit
    const recvDFI = bankMapping.routingNumber.substring(0, 8);

    // Check digit calculation for routing number (simplified here, assuming valid routing)
    const checkDigit = bankMapping.routingNumber.substring(8, 9);

    const dfiAccount = padString(bankMapping.accountNumber, 17);
    const amount = padNumber(amountCents / 100, 10); // NACHA amount is in cents, 10 digits
    const idNumber = padString('', 15); // Individual ID (e.g., Employee ID)
    const name = padString('', 22); // Individual Name
    const discData = padString('', 2);
    const addendaInd = '0'; // No addenda for basic payroll
    const traceNum = padString(traceNumber, 15);

    return recordType + transCode + recvDFI + checkDigit + dfiAccount + amount + idNumber + name + discData + addendaInd + traceNum;
}

/**
 * Generates the NACHA Batch Control Record (Record Type 8).
 */
function generateBatchControl(batchHeader, entries, totalCredit, batchNumber) {
    const recordType = '8';
    const serviceClass = '220';
    const entryCount = padNumber(entries.length, 6);

    // Entry Hash: Sum of the first 8 digits of the routing numbers of all entries
    let entryHash = 0;
    entries.forEach(e => {
        entryHash += parseInt(e.routingNumber.substring(0, 8), 10);
    });
    const entryHashStr = padNumber(entryHash % 10000000000, 10); // Last 10 digits

    const debitTotal = padNumber(0, 12); // Payroll batches are usually credit only to employees
    const creditTotal = padNumber(totalCredit / 100, 12);
    const companyId = padString(batchHeader.companyIdentification || '', 10);
    const messageAuth = padString('', 19);
    const reserved = padString('', 6);
    const origDFI = batchHeader.immediateOrigin ? batchHeader.immediateOrigin.substring(0, 8) : padString('', 8);
    const batchId = padNumber(batchNumber, 7);

    return recordType + serviceClass + entryCount + entryHashStr + debitTotal + creditTotal + companyId + messageAuth + reserved + origDFI + batchId;
}

/**
 * Generates the NACHA File Control Record (Record Type 9).
 */
function generateFileControl(batches, totalEntries, totalCredit) {
    const recordType = '9';
    const batchCount = padNumber(batches.length, 6);
    const blockCount = padNumber(Math.ceil((batches.length + totalEntries + 2) / 10), 6); // +2 for File Header/Control
    const entryCount = padNumber(totalEntries, 8);

    let entryHash = 0;
    batches.forEach(b => {
        b.entries.forEach(e => {
            entryHash += parseInt(e.routingNumber.substring(0, 8), 10);
        });
    });
    const entryHashStr = padNumber(entryHash % 10000000000, 10);

    const debitTotal = padNumber(0, 12);
    const creditTotal = padNumber(totalCredit / 100, 12);
    const reserved = padString('', 39);

    return recordType + batchCount + blockCount + entryCount + entryHashStr + debitTotal + creditTotal + reserved;
}

/**
 * File Balancing Guardrail: Verifies that the sum of entries matches the batch control totals.
 * @param {number} calculatedTotal 
 * @param {number} controlTotal 
 * @returns {{ isBalanced: boolean, discrepancy: number }}
 */
function validateBalancing(calculatedTotal, controlTotal) {
    const discrepancy = Math.round((calculatedTotal - controlTotal) * 100) / 100;
    return {
        isBalanced: Math.abs(discrepancy) < 0.01,
        discrepancy
    };
}

module.exports = {
    padString, padNumber,
    generateFileHeader, generateBatchHeader, generateEntryDetail,
    generateBatchControl, generateFileControl, validateBalancing
};
