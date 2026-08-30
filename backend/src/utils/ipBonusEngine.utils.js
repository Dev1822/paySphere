/**
 * @fileoverview IP Bonus Engine
 * @description Calculates inventor splits and generates payroll injection payloads.
 * Issue: #1622
 */

/**
 * Validates that the sum of all inventor splits equals exactly 100%.
 * @param {Array} inventors - Array of { employeeId, splitPercentage }
 * @returns {{ isValid: boolean, reason: string }}
 */
function validateInventorSplits(inventors) {
    if (!inventors || inventors.length === 0) {
        return { isValid: false, reason: 'At least one inventor is required.' };
    }

    const totalSplit = inventors.reduce((sum, inv) => sum + Number(inv.splitPercentage), 0);

    if (Math.abs(totalSplit - 100) > 0.01) {
        return { isValid: false, reason: `Inventor splits must sum to 100%. Current sum: ${totalSplit}%` };
    }

    return { isValid: true, reason: 'Valid' };
}

/**
 * Calculates the individual bonus amount for each inventor based on the milestone pool.
 * @param {number} totalBonusPool 
 * @param {Array} inventors - Array of { employeeId, splitPercentage }
 * @returns {Array<{ employeeId: string, amount: number }>}
 */
function calculateSplitPayouts(totalBonusPool, inventors) {
    return inventors.map(inv => ({
        employeeId: inv.employeeId,
        amount: Math.round((totalBonusPool * (inv.splitPercentage / 100)) * 100) / 100
    }));
}

/**
 * Generates the payroll line items for IP bonuses.
 * @param {Array} payouts - Array of calculated split payouts
 * @param {string} milestoneStage 
 * @returns {Array} Payroll injection payloads
 */
function generatePayrollInjections(payouts, milestoneStage) {
    return payouts.map(p => ({
        employeeId: p.employeeId,
        componentName: `IP Bonus: ${milestoneStage}`,
        amount: p.amount,
        type: 'Earning',
        isTaxable: true, // IP bonuses are standard taxable income
        description: `Patent milestone bonus for ${milestoneStage}`
    }));
}

module.exports = { validateInventorSplits, calculateSplitPayouts, generatePayrollInjections };
