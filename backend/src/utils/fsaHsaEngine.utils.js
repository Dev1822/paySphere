/**
 * @fileoverview FSA & HSA Engine Utilities
 * @description Calculates per-paycheck deductions, enforces IRS limits, 
 * handles catch-up contributions, and evaluates plan-year transitions.
 * Issue: #1758
 */

/**
 * Calculates the per-paycheck pre-tax deduction.
 * Supports both "Front-loaded" (full amount available day 1 for FSA) and 
 * "Prorated" (standard for HSA) deduction schedules.
 * 
 * @param {number} annualElection 
 * @param {number} paychecksPerYear 
 * @param {string} schedule - 'FrontLoaded' or 'Prorated'
 * @returns {number}
 */
function calculatePerPaycheckDeduction(annualElection, paychecksPerYear, schedule) {
    if (paychecksPerYear <= 0) return 0;

    // Even for front-loaded FSA (where funds are available immediately), 
    // the payroll *deduction* is still spread evenly across paychecks.
    return Math.round((annualElection / paychecksPerYear) * 100) / 100;
}

/**
 * Enforces IRS annual maximums and catch-up contributions.
 * 
 * @param {number} electedAmount 
 * @param {number} catchUpAmount 
 * @param {string} accountType - 'FSA' or 'HSA'
 * @param {Object} planConfig - PlanYearConfiguration document
 * @param {string} coverageType - 'Self' or 'Family' (HSA only)
 * @returns {{ isValid: boolean, maxAllowed: number, reason: string }}
 */
function validateLimits(electedAmount, catchUpAmount, accountType, planConfig, coverageType) {
    let maxAllowed = 0;

    if (accountType === 'FSA') {
        maxAllowed = planConfig.fsaAnnualLimit;
    } else if (accountType === 'HSA') {
        maxAllowed = coverageType === 'Family' ? planConfig.hsaAnnualLimitFamily : planConfig.hsaAnnualLimitSelf;
        if (catchUpAmount > 0) {
            maxAllowed += planConfig.hsaCatchUpLimit;
        }
    }

    const totalElected = electedAmount + catchUpAmount;

    if (totalElected > maxAllowed) {
        return {
            isValid: false,
            maxAllowed,
            reason: `Total election ($${totalElected}) exceeds IRS limit ($${maxAllowed}) for ${accountType}.`
        };
    }

    return { isValid: true, maxAllowed, reason: 'Within IRS limits.' };
}

/**
 * Evaluates the Plan Year Transition Guardrail for FSA funds.
 * Determines what happens to unused funds at the end of the plan year.
 * 
 * @param {number} currentBalance - Unused funds at year-end
 * @param {Object} planConfig - PlanYearConfiguration document
 * @returns {{ action: string, amountToCarryover: number, amountForfeited: number }}
 */
function evaluatePlanYearTransition(currentBalance, planConfig) {
    if (currentBalance <= 0) {
        return { action: 'None', amountToCarryover: 0, amountForfeited: 0 };
    }

    if (planConfig.fsaTransitionRule === 'Forfeit') {
        return {
            action: 'Use-It-Or-Lose-It',
            amountToCarryover: 0,
            amountForfeited: currentBalance,
            reason: 'All unused FSA funds forfeited per plan document.'
        };
    }

    if (planConfig.fsaTransitionRule === 'GracePeriod') {
        // Funds remain available for claims incurred during the grace period (e.g., first 75 days of new year)
        return {
            action: 'GracePeriod',
            amountToCarryover: currentBalance, // Technically stays in the old year bucket but extends timeline
            amountForfeited: 0,
            reason: `Funds available for claims until day ${planConfig.fsaGracePeriodDays} of the new plan year.`
        };
    }

    if (planConfig.fsaTransitionRule === 'Carryover') {
        const carryover = Math.min(currentBalance, planConfig.fsaCarryoverLimit);
        const forfeited = currentBalance - carryover;

        return {
            action: 'Carryover',
            amountToCarryover: carryover,
            amountForfeited: forfeited,
            reason: `Max carryover limit is $${planConfig.fsaCarryoverLimit}. $${forfeited} forfeited.`
        };
    }

    return { action: 'Unknown', amountToCarryover: 0, amountForfeited: currentBalance };
}

module.exports = { calculatePerPaycheckDeduction, validateLimits, evaluatePlanYearTransition };
