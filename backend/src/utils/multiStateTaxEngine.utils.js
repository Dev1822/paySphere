/**
 * @fileoverview Multi-State Tax Engine Utilities
 * @description Evaluates reciprocity agreements, non-resident thresholds, and local taxes.
 * Issue: #1731
 */

/**
 * Checks if a reciprocity agreement exists between the resident and work state,
 * and if the employee has the required exemption form on file.
 * 
 * @param {Object} agreement - ReciprocityAgreement document (or null)
 * @param {boolean} hasExemptionOnFile 
 * @returns {{ applyReciprocity: boolean, reason: string }}
 */
function checkReciprocityGuardrail(agreement, hasExemptionOnFile) {
    if (!agreement) {
        return { applyReciprocity: false, reason: 'No reciprocity agreement between these states.' };
    }

    if (agreement.requiresExemptionForm && !hasExemptionOnFile) {
        return {
            applyReciprocity: false,
            reason: `Reciprocity requires ${agreement.exemptionFormName || 'exemption form'} on file.`
        };
    }

    return { applyReciprocity: true, reason: 'Reciprocity applied. Suppressing work-state withholding.' };
}

/**
 * Evaluates non-resident tax liability based on the "183-day rule" or convenience of employer rules.
 * @param {number} daysWorkedInState 
 * @param {number} thresholdDays - e.g., 183
 * @param {boolean} convenienceOfEmployerRule - Some states tax non-residents if they work remotely for a state-based company
 * @returns {{ isLiable: boolean, reason: string }}
 */
function evaluateNonResidentThreshold(daysWorkedInState, thresholdDays, convenienceOfEmployerRule) {
    if (convenienceOfEmployerRule) {
        return { isLiable: true, reason: 'Convenience of Employer rule applies. Full non-resident liability.' };
    }

    if (daysWorkedInState >= thresholdDays) {
        return { isLiable: true, reason: `Exceeded ${thresholdDays}-day non-resident threshold.` };
    }

    return { isLiable: false, reason: `Below ${thresholdDays}-day threshold. No non-resident liability.` };
}

/**
 * Calculates local city/jurisdiction tax based on residency status.
 * @param {number} grossPay 
 * @param {Object} jurisdiction - LocalTaxJurisdiction document
 * @param {boolean} isResident 
 * @returns {number} Local tax amount
 */
function calculateLocalTax(grossPay, jurisdiction, isResident) {
    if (!jurisdiction) return 0;

    const rate = isResident ? jurisdiction.residentTaxRate : jurisdiction.nonResidentTaxRate;
    return Math.round(grossPay * rate * 100) / 100;
}

module.exports = { checkReciprocityGuardrail, evaluateNonResidentThreshold, calculateLocalTax };
