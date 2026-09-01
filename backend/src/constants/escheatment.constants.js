/**
 * @fileoverview Escheatment & NAUPA Constants
 * @description Defines state dormancy periods, NAUPA property types, and 
 * due diligence rules for unclaimed property compliance.
 * Issue: #2013
 */

/**
 * State Statutory Dormancy Periods (in years) for Payroll/Wages
 */
const STATE_DORMANCY_PERIODS = {
    CA: 3, // California: 3 years
    NY: 3, // New York: 3 years
    TX: 1, // Texas: 1 year for wages
    FL: 1, // Florida: 1 year
    IL: 5, // Illinois: 5 years
    PA: 3, // Pennsylvania: 3 years
    OH: 3, // Ohio: 3 years
    NJ: 3, // New Jersey: 3 years
    MA: 3, // Massachusetts: 3 years
    WA: 3  // Washington: 3 years
};

/**
 * NAUPA Standard Property Type Codes for Payroll
 */
const NAUPA_PROPERTY_TYPES = {
    WAGES: 'MS05', // Wages, Payroll, Salary
    COMMISSIONS: 'MS06', // Commissions
    BONUSES: 'MS07', // Bonuses
    REIMBURSEMENTS: 'MS10' // Expense Reimbursements
};

/**
 * Check Statuses
 */
const CHECK_STATUSES = {
    OUTSTANDING: 'Outstanding',
    CASHED: 'Cashed',
    VOIDED: 'Voided',
    DUE_DILIGENCE_SENT: 'Due Diligence Sent',
    ESCHEATED: 'Escheated to State',
    STOP_PAYMENT: 'Stop Payment Issued'
};

/**
 * Due Diligence Thresholds (in days before escheatment)
 */
const DUE_DILIGENCE_THRESHOLDS = {
    CA: 60, // Must send letter between 60 and 120 days before report
    NY: 90,
    TX: 60,
    DEFAULT: 60
};

/**
 * Calculates the days remaining until the statutory dormancy period expires.
 * @param {Date} issueDate 
 * @param {string} stateCode 
 * @returns {{ daysRemaining: number, isDormant: boolean, yearsDormancy: number }}
 */
function calculateDormancy(issueDate, stateCode) {
    const yearsDormancy = STATE_DORMANCY_PERIODS[stateCode.toUpperCase()] || 3; // Default 3 years
    const issue = new Date(issueDate);
    const dormancyDate = new Date(issue.getFullYear() + yearsDormancy, issue.getMonth(), issue.getDate());

    const now = new Date();
    const diffTime = dormancyDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
        daysRemaining,
        isDormant: daysRemaining <= 0,
        yearsDormancy,
        dormancyDate
    };
}

module.exports = {
    STATE_DORMANCY_PERIODS,
    NAUPA_PROPERTY_TYPES,
    CHECK_STATUSES,
    DUE_DILIGENCE_THRESHOLDS,
    calculateDormancy
};
