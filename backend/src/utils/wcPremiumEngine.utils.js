/**
 * @fileoverview WC Premium Engine Utilities
 * @description Calculates WC eligible wages by stripping OT premiums, applies EMR, 
 * and evaluates audit guardrails for misclassifications.
 * Issue: #2061
 */
const { NCCI_CLASS_CODES, OT_EXCLUSION_STATES, EMR_THRESHOLDS } = require('../constants/wc.constants');

/**
 * Strips the overtime premium portion from gross wages if the state allows exclusion.
 * The "premium" is typically the extra 0.5x paid for OT hours.
 * 
 * @param {number} grossWages 
 * @param {number} otHours 
 * @param {number} baseHourlyRate 
 * @param {string} stateCode 
 * @returns {{ eligibleWages: number, excludedOTPremium: number }}
 */
function stripOvertimePremium(grossWages, otHours, baseHourlyRate, stateCode) {
    if (!otHours || otHours <= 0 || !baseHourlyRate) {
        return { eligibleWages: grossWages, excludedOTPremium: 0 };
    }

    const allowsExclusion = OT_EXCLUSION_STATES[stateCode.toUpperCase()] || false;

    if (!allowsExclusion) {
        return { eligibleWages: grossWages, excludedOTPremium: 0 };
    }

    // Calculate the "premium" portion (the extra 0.5x of the base rate)
    const otPremium = Math.round((otHours * baseHourlyRate * 0.5) * 100) / 100;
    const eligibleWages = Math.max(0, Math.round((grossWages - otPremium) * 100) / 100);

    return { eligibleWages, excludedOTPremium: otPremium };
}

/**
 * Calculates the estimated WC premium for a specific payroll line item.
 * Formula: (Eligible Wages / 100) * Base Manual Rate * EMR
 * 
 * @param {number} eligibleWages 
 * @param {number} baseManualRate - Rate per $100 of payroll
 * @param {number} emr - Experience Modification Rate
 * @returns {number} Estimated premium
 */
function calculateEstimatedPremium(eligibleWages, baseManualRate, emr) {
    if (eligibleWages <= 0 || baseManualRate <= 0) return 0;

    const basePremium = (eligibleWages / 100) * baseManualRate;
    const adjustedPremium = basePremium * (emr || 1.0);

    return Math.round(adjustedPremium * 100) / 100;
}

/**
 * Audit Guardrail: Evaluates employee mappings for potential misclassifications.
 * Flags employees mapped to low-risk codes (e.g., 8810 Clerical) who have high 
 * physical hours, or employees missing mappings entirely.
 * 
 * @param {Object} employeeData - { employeeId, primaryNCCI, totalHours, physicalHours }
 * @returns {{ hasFlag: boolean, flagType: string, message: string }}
 */
function auditGuardrail(employeeData) {
    if (!employeeData.primaryNCCI) {
        return {
            hasFlag: true,
            flagType: 'Missing Mapping',
            message: `Employee ${employeeData.employeeId} has no NCCI code assigned. Defaulting to highest risk rate.`
        };
    }

    const ncciInfo = NCCI_CLASS_CODES[employeeData.primaryNCCI];
    if (!ncciInfo) {
        return { hasFlag: false, flagType: 'None', message: '' };
    }

    // Flag if mapped to Clerical (8810) but logged significant physical/field hours
    if (employeeData.primaryNCCI === '8810' && employeeData.physicalHours > 10) {
        return {
            hasFlag: true,
            flagType: 'High Risk Misclassification',
            message: `Employee mapped to Clerical (8810) but logged ${employeeData.physicalHours} physical/field hours. Audit risk.`
        };
    }

    return { hasFlag: false, flagType: 'None', message: '' };
}

/**
 * Evaluates the company's EMR against industry thresholds.
 * @param {number} emr 
 * @returns {{ status: string, multiplierImpact: string }}
 */
function evaluateEMRStatus(emr) {
    if (emr < EMR_THRESHOLDS.EXCELLENT) {
        return { status: 'Excellent', multiplierImpact: 'Significant Premium Discount' };
    }
    if (emr <= EMR_THRESHOLDS.GOOD) {
        return { status: 'Average', multiplierImpact: 'Standard Industry Rate' };
    }
    if (emr <= EMR_THRESHOLDS.POOR) {
        return { status: 'Below Average', multiplierImpact: 'Premium Surcharge Applied' };
    }
    return { status: 'High Risk', multiplierImpact: 'Severe Premium Surcharge' };
}

module.exports = {
    stripOvertimePremium,
    calculateEstimatedPremium,
    auditGuardrail,
    evaluateEMRStatus
};
