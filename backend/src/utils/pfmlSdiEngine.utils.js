/**
 * @fileoverview PFML & SDI Engine Utilities
 * @description Calculates state disability withholdings, enforces annual wage caps, 
 * and evaluates job-protection expiration guardrails.
 * Issue: #1760
 */

/**
 * Calculates the employee withholding and employer liability for a pay period,
 * respecting the state's annual taxable wage cap.
 * 
 * @param {number} grossPay - Current period gross pay
 * @param {number} ytdTaxableWages - Year-to-date taxable wages prior to this period
 * @param {number} annualWageCap - State-mandated annual taxable wage limit
 * @param {number} employeeRate - Employee withholding rate
 * @param {number} employerRate - Employer liability rate
 * @returns {{ taxableWage: number, employeeWithholding: number, employerLiability: number, ytdWages: number, hitWageCap: boolean }}
 */
function calculateWithholding(grossPay, ytdTaxableWages, annualWageCap, employeeRate, employerRate) {
    const remainingCap = Math.max(0, annualWageCap - ytdTaxableWages);

    // Only tax the portion of gross pay that falls under the remaining cap
    const taxableWage = Math.min(grossPay, remainingCap);
    const hitWageCap = (ytdTaxableWages + taxableWage) >= annualWageCap;

    const employeeWithholding = Math.round(taxableWage * employeeRate * 100) / 100;
    const employerLiability = Math.round(taxableWage * employerRate * 100) / 100;

    const newYtdWages = ytdTaxableWages + taxableWage;

    return {
        taxableWage: Math.round(taxableWage * 100) / 100,
        employeeWithholding,
        employerLiability,
        ytdWages: Math.round(newYtdWages * 100) / 100,
        hitWageCap
    };
}

/**
 * Job Protection Guardrail: Evaluates if an employee's protected leave is approaching expiration.
 * Alerts HR if the protection expires within the next 14 days to prevent unlawful termination.
 * 
 * @param {Date} protectionEndDate 
 * @param {Date} currentDate 
 * @returns {{ status: string, daysRemaining: number, requiresAlert: boolean }}
 */
function evaluateJobProtection(protectionEndDate, currentDate) {
    const end = new Date(protectionEndDate);
    const now = new Date(currentDate);

    const diffTime = end.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
        return { status: 'Expired', daysRemaining: 0, requiresAlert: false };
    }

    if (daysRemaining <= 14) {
        return { status: 'Expiring Soon', daysRemaining, requiresAlert: true };
    }

    return { status: 'Active', daysRemaining, requiresAlert: false };
}

module.exports = { calculateWithholding, evaluateJobProtection };
