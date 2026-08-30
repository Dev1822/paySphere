/**
 * @fileoverview PII Masking & Data Erasure Engine
 * @description Dynamically masks sensitive fields based on RBAC and safely anonymizes 
 * PII while preserving IRS-mandated financial aggregations.
 * Issue: #1870
 */

/**
 * Masks a Social Security Number.
 * @param {string} ssn 
 * @param {string} pattern - 'Full', 'Partial', 'None'
 * @returns {string}
 */
function maskSSN(ssn, pattern) {
    if (!ssn) return '';
    if (pattern === 'None') return ssn;
    if (pattern === 'Full') return '***-**-****';
    // Partial: Show last 4
    const clean = ssn.replace(/\D/g, '');
    return `***-**-${clean.slice(-4)}`;
}

/**
 * Masks a Bank Account Number.
 * @param {string} accountNumber 
 * @param {string} pattern 
 * @returns {string}
 */
function maskBankAccount(accountNumber, pattern) {
    if (!accountNumber) return '';
    if (pattern === 'None') return accountNumber;
    if (pattern === 'Full') return '************';
    // Partial: Show last 4
    return `****${accountNumber.slice(-4)}`;
}

/**
 * Masks a physical address.
 * @param {string} address 
 * @param {string} pattern 
 * @returns {string}
 */
function maskAddress(address, pattern) {
    if (!address) return '';
    if (pattern === 'None') return address;
    if (pattern === 'Full') return '[REDACTED]';
    // Partial: Hide street number, keep city/state/zip
    const parts = address.split(',');
    if (parts.length > 1) {
        return `[Hidden],${parts.slice(1).join(',')}`;
    }
    return '[Hidden]';
}

/**
 * Applies dynamic masking to a data object based on configured rules and user roles.
 * 
 * @param {Object} data - The payroll or employee data object
 * @param {Array} rules - Array of PIIMaskingRule documents
 * @param {Array} userRoles - Array of the requesting user's roles
 * @returns {{ maskedData: Object, accessedFields: Array, wasMasked: boolean }}
 */
function applyDynamicMasking(data, rules, userRoles) {
    const maskedData = { ...data };
    const accessedFields = [];
    let wasMasked = false;

    const fieldMap = {
        ssn: maskSSN,
        bankAccountNumber: maskBankAccount,
        homeAddress: maskAddress
    };

    for (const rule of rules) {
        if (!rule.isActive) continue;
        if (maskedData[rule.fieldName] === undefined) continue;

        accessedFields.push(rule.fieldName);

        // Check if user has bypass role
        const hasBypass = userRoles.some(role => rule.bypassRoles.includes(role));

        if (hasBypass) {
            // User sees unmasked data
            continue;
        }

        // Apply masking
        if (fieldMap[rule.fieldName]) {
            maskedData[rule.fieldName] = fieldMap[rule.fieldName](maskedData[rule.fieldName], rule.maskPattern);
            wasMasked = true;
        }
    }

    return { maskedData, accessedFields, wasMasked };
}

/**
 * Data Erasure Guardrail: Safely anonymizes PII while preserving financial data.
 * IRS mandates retaining payroll/tax records for 7 years, so we cannot delete the ledger, 
 * but we must scrub the PII to comply with GDPR/CCPA.
 * 
 * @param {Object} employeeRecord - The employee document
 * @returns {Object} Anonymized employee payload
 */
function executeSafeErasure(employeeRecord) {
    const anonymized = { ...employeeRecord };

    // Scrub PII
    anonymized.firstName = 'REDACTED';
    anonymized.lastName = 'REDACTED';
    anonymized.ssn = '000-00-0000';
    anonymized.homeAddress = '[ERASED PER GDPR]';
    anonymized.personalEmail = '[ERASED PER GDPR]';
    anonymized.phone = '[ERASED]';

    // Scrub Banking Info
    if (anonymized.bankAccounts) {
        anonymized.bankAccounts = [];
    }

    // Preserve Financial/Tax Aggregations (Required for IRS 7-year retention)
    // anonymized.ytdGrossWages = preserved
    // anonymized.taxWithholdings = preserved
    // anonymized.hireDate = preserved (needed for tenure audits)
    anonymized.terminationDate = new Date();
    anonymized.status = 'Erased (Legal Hold)';

    return anonymized;
}

module.exports = {
    maskSSN, maskBankAccount, maskAddress,
    applyDynamicMasking, executeSafeErasure
};
