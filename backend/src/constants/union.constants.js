/**
 * @fileoverview Union & MEPP Constants
 * @description Defines standard codes, fund types, and EDGE formatting rules 
 * for Multi-Employer Pension Plan (MEPP) remittances.
 * Issue: #2009
 */

/**
 * Standard Collective Bargaining Agreement (CBA) Classification Codes
 */
const CBA_CLASSIFICATIONS = {
    JOURNEYMAN: 'J',
    APPRENTICE_1: 'A1',
    APPRENTICE_2: 'A2',
    APPRENTICE_3: 'A3',
    APPRENTICE_4: 'A4',
    FOREMAN: 'F',
    GENERAL_LABORER: 'GL',
    OPERATOR: 'OP'
};

/**
 * Standard Taft-Hartley Trust Fund Types
 */
const FUND_TYPES = {
    PENSION: 'Pension',
    HEALTH_WELFARE: 'Health & Welfare',
    ANNUITY: 'Annuity',
    APPRENTICESHIP: 'Apprenticeship & Training',
    VACATION: 'Vacation',
    SUPPLEMENTAL_UNEMPLOYMENT: 'Supplemental Unemployment'
};

/**
 * EDGE Format Record Types for Electronic Remittance
 */
const EDGE_RECORD_TYPES = {
    HEADER: '01',
    EMPLOYER: '02',
    EMPLOYEE: '03',
    TRAILER: '04'
};

/**
 * Delinquency Thresholds (in days past the 15th of the following month)
 */
const DELINQUENCY_THRESHOLDS = {
    WARNING: 5,
    CRITICAL: 15,
    SEVERE: 30 // Triggers ERISA penalty warnings
};

/**
 * Pads a string to a fixed length for EDGE fixed-width formatting.
 * @param {string} str 
 * @param {number} length 
 * @param {string} [padChar=' '] 
 * @returns {string}
 */
function padEdgeString(str, length, padChar = ' ') {
    const s = String(str || '').toUpperCase().trim();
    return (s + padChar.repeat(length)).substring(0, length);
}

/**
 * Pads a number with leading zeros for EDGE fixed-width formatting.
 * @param {number} num 
 * @param {number} length 
 * @returns {string}
 */
function padEdgeNumber(num, length) {
    const n = Math.round(Math.abs(num || 0) * 100); // Convert to cents
    return String(n).padStart(length, '0');
}

module.exports = {
    CBA_CLASSIFICATIONS,
    FUND_TYPES,
    EDGE_RECORD_TYPES,
    DELINQUENCY_THRESHOLDS,
    padEdgeString,
    padEdgeNumber
};
