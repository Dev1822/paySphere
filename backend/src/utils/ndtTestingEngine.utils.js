/**
 * @fileoverview Non-Discrimination Testing (NDT) Engine
 * @description Calculates ADP/ACP ratios, evaluates safe harbor, and calculates true-ups.
 * Issue: #1867
 */

/**
 * Calculates the Actual Deferral Percentage (ADP) for a group.
 * @param {Array} groupLedgers - Array of EmployeeDeferralLedger for HCEs or NHCEs
 * @returns {number} Average deferral percentage
 */
function calculateADP(groupLedgers) {
    if (!groupLedgers || groupLedgers.length === 0) return 0;

    const totalPercentage = groupLedgers.reduce((sum, ledger) => {
        const rate = ledger.grossCompensation > 0
            ? (ledger.employeeDeferralAmount / ledger.grossCompensation) * 100
            : 0;
        return sum + rate;
    }, 0);

    return Math.round((totalPercentage / groupLedgers.length) * 100) / 100;
}

/**
 * Evaluates if the ADP test passes based on IRS rules.
 * Rule 1: HCE ADP <= 2 * NHCE ADP
 * Rule 2: HCE ADP <= NHCE ADP + 2% (if NHCE ADP is between 2% and 8%)
 * 
 * @param {number} hceADP 
 * @param {number} nhceADP 
 * @returns {{ passed: boolean, reason: string }}
 */
function evaluateADPTest(hceADP, nhceADP) {
    if (nhceADP === 0) {
        return { passed: hceADP <= 2, reason: 'NHCE ADP is 0. HCE ADP must be <= 2%.' };
    }

    const rule1Pass = hceADP <= (nhceADP * 2);
    const rule2Pass = nhceADP >= 2 && nhceADP <= 8 && hceADP <= (nhceADP + 2);
    const rule3Pass = nhceADP > 8 && hceADP <= (nhceADP * 1.25);

    if (rule1Pass || rule2Pass || rule3Pass) {
        return { passed: true, reason: 'ADP test passed.' };
    }

    return { passed: false, reason: `ADP test failed. HCE: ${hceADP}%, NHCE: ${nhceADP}%. Corrective action required.` };
}

/**
 * Calculates the required year-end True-Up for an employee.
 * @param {number} grossCompensation 
 * @param {number} employeeDeferralRate 
 * @param {number} ytdMatchPaid - Match already paid per paycheck
 * @param {Object} config - RetirementPlanConfig
 * @returns {{ trueUpAmount: number, totalMatch: number }}
 */
function calculateTrueUp(grossCompensation, employeeDeferralRate, ytdMatchPaid, config) {
    if (!config.requiresTrueUp || config.matchFormula === 'None') {
        return { trueUpAmount: 0, totalMatch: ytdMatchPaid };
    }

    const maxMatchableComp = grossCompensation * config.matchLimitPercentage;
    let requiredTotalMatch = 0;

    if (config.matchFormula === 'DollarForDollar') {
        requiredTotalMatch = maxMatchableComp;
    } else if (config.matchFormula === 'FiftyCentsOnDollar') {
        requiredTotalMatch = maxMatchableComp * 0.5;
    }

    requiredTotalMatch = Math.min(requiredTotalMatch, config.maxMatchAmount || Infinity);
    const trueUpAmount = Math.max(0, requiredTotalMatch - ytdMatchPaid);

    return {
        trueUpAmount: Math.round(trueUpAmount * 100) / 100,
        totalMatch: Math.round((ytdMatchPaid + trueUpAmount) * 100) / 100
    };
}

module.exports = { calculateADP, evaluateADPTest, calculateTrueUp };
