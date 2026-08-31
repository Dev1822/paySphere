/**
 * @fileoverview Equity Compensation Constants
 * @description Defines grant types, vesting schedules, and tax brackets for 
 * RSU/PSU sell-to-cover calculations and ASC 718 expense amortization.
 * Issue: #2010
 */

/**
 * Standard Equity Grant Types
 */
const GRANT_TYPES = {
    RSU: 'Restricted Stock Unit',
    PSU: 'Performance Stock Unit',
    ISO: 'Incentive Stock Option',
    NSO: 'Non-Qualified Stock Option',
    ESPP: 'Employee Stock Purchase Plan'
};

/**
 * Standard Vesting Schedule Types
 */
const VESTING_SCHEDULES = {
    STANDARD_4_YEAR: 'Standard 4-Year (1-year cliff, monthly thereafter)',
    BACK_WEIGHTED_4_YEAR: 'Back-Weighted 4-Year (5/15/40/40)',
    IMMEDIATE: 'Immediate (100% upfront)',
    CUSTOM: 'Custom Schedule'
};

/**
 * Federal Supplemental Tax Brackets for Sell-to-Cover (2026 Mock Rates)
 */
const SUPPLEMENTAL_TAX_RATES = {
    FEDERAL_STANDARD: 0.22, // Up to $1M
    FEDERAL_HIGH_EARNER: 0.37, // Over $1M
    FICA_SS: 0.062, // Up to wage base
    FICA_MEDICARE: 0.0145,
    ADDITIONAL_MEDICARE: 0.009 // Over $200k
};

/**
 * SEC Blackout Period Types
 */
const BLACKOUT_TYPES = {
    QUARTERLY_EARNINGS: 'Quarterly Earnings',
    M_AND_A: 'Mergers & Acquisitions',
    MATERIAL_NONPUBLIC_INFO: 'Material Non-Public Information (MNPI)'
};

/**
 * Calculates the number of days between two dates.
 * @param {Date} start 
 * @param {Date} end 
 * @returns {number}
 */
function daysBetween(start, end) {
    const diffTime = Math.abs(new Date(end) - new Date(start));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
    GRANT_TYPES,
    VESTING_SCHEDULES,
    SUPPLEMENTAL_TAX_RATES,
    BLACKOUT_TYPES,
    daysBetween
};
