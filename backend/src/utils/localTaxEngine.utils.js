/**
 * @fileoverview Local Tax Engine Utilities
 * @description Evaluates residency vs work-location matrices, applies commuter credits, 
 * calculates local withholdings, and flags jurisdiction conflicts.
 * Issue: #2062
 */

/**
 * Calculates the local tax withholding for a specific jurisdiction, respecting wage bases.
 * 
 * @param {number} grossPay 
 * @param {number} ytdTaxableWages 
 * @param {Object} jurisdiction - LocalTaxJurisdiction document
 * @param {boolean} isResident 
 * @returns {{ taxableWage: number, taxWithheld: number, newYtd: number, hitCap: boolean }}
 */
function calculateLocalWithholding(grossPay, ytdTaxableWages, jurisdiction, isResident) {
    const rate = isResident ? jurisdiction.residentRate : jurisdiction.nonResidentRate;
    const wageBase = jurisdiction.annualWageBase || Infinity;

    const remainingCap = Math.max(0, wageBase - ytdTaxableWages);
    const taxableWage = Math.min(grossPay, remainingCap);
    const hitCap = (ytdTaxableWages + taxableWage) >= wageBase && wageBase !== Infinity;

    const taxWithheld = Math.round(taxableWage * rate * 100) / 100;
    const newYtd = ytdTaxableWages + taxableWage;

    return {
        taxableWage: Math.round(taxableWage * 100) / 100,
        taxWithheld,
        newYtd: Math.round(newYtd * 100) / 100,
        hitCap
    };
}

/**
 * Applies Commuter Tax Credit logic (e.g., PA Act 32).
 * If the employee works in City A (1.5%) and lives in City B (2.0%), 
 * they pay 1.5% to City A, and owe the 0.5% difference to City B.
 * If the employer withholds for both, the credit is applied.
 * 
 * @param {number} workCityTaxWithheld 
 * @param {number} homeCityTaxRate 
 * @param {number} taxableWage 
 * @param {Object} commuterRule - CommuterTaxRule document
 * @returns {{ homeCityLiability: number, commuterCreditApplied: number, netHomeCityTax: number }}
 */
function applyCommuterCredit(workCityTaxWithheld, homeCityTaxRate, taxableWage, commuterRule) {
    const grossHomeLiability = Math.round(taxableWage * homeCityTaxRate * 100) / 100;

    let creditAllowed = 0;
    if (commuterRule && commuterRule.creditType !== 'NO_CREDIT') {
        // Credit cannot exceed the actual tax paid to the work city, nor the home city liability
        creditAllowed = Math.min(workCityTaxWithheld, grossHomeLiability);

        if (commuterRule.creditType === 'PARTIAL_CREDIT') {
            creditAllowed = Math.round(creditAllowed * commuterRule.maxCreditPercentage * 100) / 100;
        }
    }

    const netHomeCityTax = Math.max(0, Math.round((grossHomeLiability - creditAllowed) * 100) / 100);

    return {
        homeCityLiability: grossHomeLiability,
        commuterCreditApplied: creditAllowed,
        netHomeCityTax
    };
}

/**
 * Jurisdiction Conflict Guardrail: Flags employees whose home and work locations 
 * trigger conflicting tax claims or missing certificates.
 * 
 * @param {Object} employeeCert - EmployeeTaxCertificate document
 * @param {Object} homeJurisdiction 
 * @param {Object} workJurisdiction 
 * @returns {{ hasConflict: boolean, conflictType: string, message: string }}
 */
function jurisdictionConflictGuardrail(employeeCert, homeJurisdiction, workJurisdiction) {
    if (!employeeCert) {
        return {
            hasConflict: true,
            conflictType: 'Missing Certificate',
            message: 'Employee has no local tax certificate on file. Defaulting to highest applicable rates.'
        };
    }

    if (employeeCert.exemptionStatus === 'Pending Review') {
        return {
            hasConflict: true,
            conflictType: 'Pending Review',
            message: 'Employee residency declaration is under review by Tax Admin.'
        };
    }

    // Check for double taxation risk without reciprocity
    if (homeJurisdiction && workJurisdiction &&
        homeJurisdiction.jurisdictionCode !== workJurisdiction.jurisdictionCode &&
        homeJurisdiction.reciprocityFramework === 'NONE' &&
        workJurisdiction.reciprocityFramework === 'NONE') {
        return {
            hasConflict: true,
            conflictType: 'Double Taxation Risk',
            message: `No reciprocity between ${homeJurisdiction.jurisdictionName} and ${workJurisdiction.jurisdictionName}. Employee may face double taxation.`
        };
    }

    return { hasConflict: false, conflictType: 'None', message: 'No conflicts detected.' };
}

module.exports = {
    calculateLocalWithholding,
    applyCommuterCredit,
    jurisdictionConflictGuardrail
};
