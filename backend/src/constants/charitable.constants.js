/**
 * @fileoverview Charitable Giving Constants
 * @description Defines campaign statuses, matching rules, and deduction frequencies 
 * for the Employee Charitable Giving & Corporate Matching Engine.
 * Issue: #2011
 */

/**
 * Standard Campaign Statuses
 */
const CAMPAIGN_STATUSES = {
    DRAFT: 'Draft',
    ACTIVE: 'Active',
    CLOSED: 'Closed',
    ARCHIVED: 'Archived'
};

/**
 * Corporate Matching Rules
 */
const MATCHING_RULES = {
    DOLLAR_FOR_DOLLAR: 'Dollar for Dollar (1:1)',
    TWO_TO_ONE: 'Two to One (2:1)',
    FIFTY_CENTS_ON_DOLLAR: 'Fifty Cents on Dollar (0.5:1)',
    NONE: 'No Corporate Match'
};

/**
 * Deduction Frequencies
 */
const DEDUCTION_FREQUENCIES = {
    ONE_TIME: 'One-Time',
    PER_PAYCHECK: 'Per Paycheck',
    MONTHLY: 'Monthly',
    BI_WEEKLY: 'Bi-Weekly'
};

/**
 * Pledge Statuses
 */
const PLEDGE_STATUSES = {
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    CAPPED: 'Capped (Limit Reached)'
};

/**
 * Standard Charitable Categories
 */
const CHARITY_CATEGORIES = [
    'Education',
    'Health & Human Services',
    'Environment & Animals',
    'Arts & Culture',
    'Community Development',
    'Disaster Relief',
    'Veterans & Military Families'
];

/**
 * Calculates the corporate match amount based on the matching rule and campaign caps.
 * @param {number} employeeDonation 
 * @param {string} matchingRule 
 * @param {number} ytdEmployeeDonations 
 * @param {number} campaignMatchCap 
 * @returns {{ matchAmount: number, hitCap: boolean }}
 */
function calculateCorporateMatch(employeeDonation, matchingRule, ytdEmployeeDonations, campaignMatchCap) {
    let multiplier = 0;

    switch (matchingRule) {
        case MATCHING_RULES.DOLLAR_FOR_DOLLAR: multiplier = 1; break;
        case MATCHING_RULES.TWO_TO_ONE: multiplier = 2; break;
        case MATCHING_RULES.FIFTY_CENTS_ON_DOLLAR: multiplier = 0.5; break;
        case MATCHING_RULES.NONE: multiplier = 0; break;
        default: multiplier = 0;
    }

    let calculatedMatch = Math.round(employeeDonation * multiplier * 100) / 100;
    let hitCap = false;

    // Enforce Campaign Cap Guardrail
    if (campaignMatchCap > 0) {
        const remainingCap = Math.max(0, campaignMatchCap - ytdEmployeeDonations);
        if (calculatedMatch > remainingCap) {
            calculatedMatch = remainingCap;
            hitCap = true;
        }
    }

    return { matchAmount: calculatedMatch, hitCap };
}

module.exports = {
    CAMPAIGN_STATUSES,
    MATCHING_RULES,
    DEDUCTION_FREQUENCIES,
    PLEDGE_STATUSES,
    CHARITY_CATEGORIES,
    calculateCorporateMatch
};
