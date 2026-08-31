/**
 * @fileoverview SUI Tax Constants
 * @description Defines standard state wage bases, rate tiers, and voluntary 
 * contribution rules for State Unemployment Insurance (SUI) calculations.
 * Issue: #2012
 */

/**
 * Standard State SUI Wage Bases (2026 Mock Data)
 */
const STATE_WAGE_BASES = {
    CA: 7000,
    NY: 12500,
    WA: 68500,
    TX: 9000,
    FL: 7000,
    IL: 13271,
    PA: 10000,
    OH: 9000,
    NJ: 42300,
    MA: 15000
};

/**
 * SUI Rate Tiers (Mock Schedule)
 */
const SUI_RATE_TIERS = {
    NEW_EMPLOYER: 'New Employer Rate',
    LOWEST: 'Lowest Experience Rate',
    LOW: 'Low Experience Rate',
    MEDIUM: 'Medium Experience Rate',
    HIGH: 'High Experience Rate',
    MAXIMUM: 'Maximum Penalty Rate'
};

/**
 * Voluntary Contribution Rules by State
 * Determines if a state allows buying down the SUI rate via trust fund contributions.
 */
const VOLUNTARY_CONTRIBUTION_STATES = {
    CA: { allowed: true, minContribution: 25, processingFee: 0 },
    NY: { allowed: true, minContribution: 50, processingFee: 15 },
    WA: { allowed: true, minContribution: 10, processingFee: 0 },
    TX: { allowed: true, minContribution: 100, processingFee: 0 },
    FL: { allowed: false },
    IL: { allowed: true, minContribution: 50, processingFee: 10 },
    PA: { allowed: false },
    OH: { allowed: true, minContribution: 25, processingFee: 0 },
    NJ: { allowed: false },
    MA: { allowed: true, minContribution: 50, processingFee: 0 }
};

/**
 * Calculates the days remaining until a specific date.
 * @param {Date} targetDate 
 * @returns {number}
 */
function daysUntil(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
    STATE_WAGE_BASES,
    SUI_RATE_TIERS,
    VOLUNTARY_CONTRIBUTION_STATES,
    daysUntil
};
