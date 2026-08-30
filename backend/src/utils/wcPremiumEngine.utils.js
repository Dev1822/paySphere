/**
 * @fileoverview WC Premium Engine Utilities
 * @description Calculates estimated premiums, applies executive caps, 
 * and generates annual audit variance reports.
 * Issue: #1570
 */

/**
 * Applies the statutory maximum remuneration limit for corporate officers.
 * If the employee is an officer and the code has a cap, the payroll is capped.
 * 
 * @param {number} grossPayroll 
 * @param {boolean} isCorporateOfficer 
 * @param {number} officerMaxRemuneration 
 * @returns {number} Capped payroll amount
 */
function applyExecutiveCap(grossPayroll, isCorporateOfficer, officerMaxRemuneration) {
    if (isCorporateOfficer && officerMaxRemuneration < Infinity) {
        return Math.min(grossPayroll, officerMaxRemuneration);
    }
    return grossPayroll;
}

/**
 * Calculates the estimated WC premium for a specific payroll entry.
 * Formula: (Capped Payroll / 100) * Rate
 * 
 * @param {number} cappedPayroll 
 * @param {number} ratePer100 
 * @returns {number} Estimated premium
 */
function calculatePremium(cappedPayroll, ratePer100) {
    return Math.round((cappedPayroll / 100) * ratePer100 * 100) / 100;
}

/**
 * Generates the annual audit variance report.
 * Compares the sum of estimated premiums paid throughout the year against 
 * the actual calculated premium based on finalized annual payroll.
 * 
 * @param {number} totalEstimatedPaid - Sum of all WCPremiumLedger entries for the year
 * @param {number} totalActualCalculated - Recalculated premium using final audited payroll
 * @param {number} experienceModifier - E-Mod multiplier (e.g., 0.90)
 * @returns {{ varianceAmount: number, varianceType: string, finalLiability: number }}
 */
function generateAuditVariance(totalEstimatedPaid, totalActualCalculated, experienceModifier) {
    // Apply E-Mod to the actual calculated premium
    const finalLiability = Math.round(totalActualCalculated * experienceModifier * 100) / 100;

    // Variance = Final Liability - Estimated Paid
    // If Variance > 0, company owes the insurer more.
    // If Variance < 0, insurer owes the company a refund.
    const varianceAmount = Math.round((finalLiability - totalEstimatedPaid) * 100) / 100;

    let varianceType = 'Balanced';
    if (varianceAmount > 0.01) varianceType = 'Owed to Insurer';
    else if (varianceAmount < -0.01) varianceType = 'Refund Due';

    return {
        varianceAmount: Math.abs(varianceAmount),
        varianceType,
        finalLiability
    };
}

module.exports = { applyExecutiveCap, calculatePremium, generateAuditVariance };
