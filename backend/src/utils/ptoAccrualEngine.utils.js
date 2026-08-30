/**
 * @fileoverview PTO Accrual Engine Utilities
 * @description Calculates accruals based on tenure, enforces state caps, 
 * and calculates mandatory termination payouts.
 * Issue: #1730
 */

/**
 * Determines the annual accrual rate based on the employee's tenure and policy tiers.
 * @param {number} tenureYears 
 * @param {Array} tiers 
 * @returns {number} Annual accrual in hours
 */
function getAnnualAccrualRate(tenureYears, tiers) {
    const sortedTiers = [...tiers].sort((a, b) => b.minTenureYears - a.minTenureYears);
    for (const tier of sortedTiers) {
        if (tenureYears >= tier.minTenureYears) {
            return tier.annualAccrualHours;
        }
    }
    return 0;
}

/**
 * Calculates the per-paycheck accrual amount.
 * @param {number} annualHours 
 * @param {number} paychecksPerYear 
 * @returns {number}
 */
function calculatePerPaycheckAccrual(annualHours, paychecksPerYear) {
    if (paychecksPerYear <= 0) return 0;
    return Math.round((annualHours / paychecksPerYear) * 1000) / 1000; // 3 decimal places for hours
}

/**
 * Enforces the state-mandated accrual cap.
 * If the new balance exceeds the cap, accrual is halted (or capped).
 * 
 * @param {number} currentBalance 
 * @param {number} proposedAccrual 
 * @param {number} annualAccrualRate 
 * @param {Object} stateRule - PTOComplianceRule document
 * @returns {{ actualAccrual: number, capped: boolean, reason: string }}
 */
function enforceAccrualCap(currentBalance, proposedAccrual, annualAccrualRate, stateRule) {
    if (!stateRule || !stateRule.allowsAccrualCap) {
        // State prohibits caps (e.g., California) - accrue indefinitely
        return { actualAccrual: proposedAccrual, capped: false, reason: 'No cap applied (State prohibits caps).' };
    }

    const maxCap = annualAccrualRate * (stateRule.maxAccrualCapMultiplier || 1.5);
    const projectedBalance = currentBalance + proposedAccrual;

    if (projectedBalance > maxCap) {
        const allowedAccrual = Math.max(0, maxCap - currentBalance);
        return {
            actualAccrual: Math.round(allowedAccrual * 1000) / 1000,
            capped: true,
            reason: `Accrual halted. Balance (${currentBalance}h) at or near state cap (${maxCap}h).`
        };
    }

    return { actualAccrual: proposedAccrual, capped: false, reason: 'Within cap limits.' };
}

/**
 * Calculates the mandatory PTO payout upon employee termination.
 * Evaluates the employee's work state against compliance rules.
 * 
 * @param {number} currentBalance 
 * @param {number} hourlyRate 
 * @param {Object} stateRule 
 * @returns {{ requiresPayout: boolean, payoutHours: number, payoutAmount: number, taxTreatment: string }}
 */
function calculateTerminationPayout(currentBalance, hourlyRate, stateRule) {
    if (!stateRule || !stateRule.mandatesTerminationPayout) {
        return {
            requiresPayout: false,
            payoutHours: 0,
            payoutAmount: 0,
            taxTreatment: 'None',
            reason: 'State does not mandate PTO payout upon termination.'
        };
    }

    if (currentBalance <= 0) {
        return { requiresPayout: false, payoutHours: 0, payoutAmount: 0, taxTreatment: 'None' };
    }

    const payoutAmount = Math.round((currentBalance * hourlyRate) * 100) / 100;

    return {
        requiresPayout: true,
        payoutHours: currentBalance,
        payoutAmount,
        taxTreatment: stateRule.payoutTaxTreatment || 'Supplemental',
        reason: 'State mandates PTO payout. Injected into final F&F payroll.'
    };
}

module.exports = {
    getAnnualAccrualRate,
    calculatePerPaycheckAccrual,
    enforceAccrualCap,
    calculateTerminationPayout
};
