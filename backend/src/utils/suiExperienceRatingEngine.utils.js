/**
 * @fileoverview SUI Experience Rating Engine
 * @description Calculates SUI tax liabilities, enforces wage base caps, evaluates 
 * rate expirations, and calculates voluntary contribution ROI.
 * Issue: #2012
 */
const { STATE_WAGE_BASES, VOLUNTARY_CONTRIBUTION_STATES } = require('../constants/sui.constants');

/**
 * Calculates the SUI tax withholding for a specific pay period, respecting the state wage base.
 * 
 * @param {number} grossPay - Current period gross pay
 * @param {number} ytdTaxableWages - Year-to-date taxable wages prior to this period
 * @param {number} stateWageBase - The state's annual taxable wage limit
 * @param {number} suiRate - The employer's assigned experience rate
 * @returns {{ taxableWage: number, suiTax: number, newYtdTaxable: number, hitWageCap: boolean }}
 */
function calculateSUIWithholding(grossPay, ytdTaxableWages, stateWageBase, suiRate) {
    const remainingCap = Math.max(0, stateWageBase - ytdTaxableWages);

    // Only tax the portion of gross pay that falls under the remaining cap
    const taxableWage = Math.min(grossPay, remainingCap);
    const hitWageCap = (ytdTaxableWages + taxableWage) >= stateWageBase;

    const suiTax = Math.round(taxableWage * suiRate * 100) / 100;
    const newYtdTaxable = ytdTaxableWages + taxableWage;

    return {
        taxableWage: Math.round(taxableWage * 100) / 100,
        suiTax,
        newYtdTaxable: Math.round(newYtdTaxable * 100) / 100,
        hitWageCap
    };
}

/**
 * Rate Expiration Guardrail: Checks if the annual SUI rate notice has been applied 
 * before the Q1 payroll run to prevent under/over-withholding.
 * 
 * @param {number} currentMonth - Current month (1-12)
 * @param {Object} rateSchedule - SUIRateSchedule document
 * @returns {{ isExpired: boolean, isApplied: boolean, alertMessage: string }}
 */
function checkRateExpiration(currentMonth, rateSchedule) {
    if (!rateSchedule) {
        if (currentMonth >= 1) {
            return {
                isExpired: false,
                isApplied: false,
                alertMessage: 'CRITICAL: Annual SUI rate notice not uploaded. Payroll may be using default/new employer rate.'
            };
        }
        return { isExpired: false, isApplied: false, alertMessage: 'No rate schedule found.' };
    }

    const isApplied = rateSchedule.isAppliedToPayroll;

    if (currentMonth >= 1 && !isApplied) {
        return {
            isExpired: false,
            isApplied: false,
            alertMessage: `WARNING: ${rateSchedule.stateCode} ${rateSchedule.taxYear} rate (${(rateSchedule.assignedRate * 100).toFixed(2)}%) has not been applied to payroll.`
        };
    }

    return { isExpired: false, isApplied: true, alertMessage: 'Rate applied successfully.' };
}

/**
 * Calculates the financial ROI of making a voluntary contribution to buy down the SUI rate.
 * 
 * @param {number} currentRate - Current assigned SUI rate
 * @param {number} targetRate - Desired lower SUI rate
 * @param {number} projectedTaxablePayroll - Estimated total taxable wages for the year
 * @param {string} stateCode - State code to lookup contribution rules
 * @returns {{ requiredContribution: number, processingFee: number, netSavings: number, roiPercentage: number, isAllowed: boolean }}
 */
function calculateVoluntaryContributionROI(currentRate, targetRate, projectedTaxablePayroll, stateCode) {
    const stateRules = VOLUNTARY_CONTRIBUTION_STATES[stateCode];

    if (!stateRules || !stateRules.allowed) {
        return {
            requiredContribution: 0,
            processingFee: 0,
            netSavings: 0,
            roiPercentage: 0,
            isAllowed: false,
            message: `${stateCode} does not allow voluntary SUI contributions.`
        };
    }

    const currentLiability = Math.round(projectedTaxablePayroll * currentRate * 100) / 100;
    const targetLiability = Math.round(projectedTaxablePayroll * targetRate * 100) / 100;

    const grossSavings = currentLiability - targetLiability;
    const processingFee = stateRules.processingFee || 0;

    // The required contribution is typically the difference in tax liability plus any fees, 
    // but states calculate this based on trust fund balances. For this engine, we assume 
    // the required contribution equals the gross savings minus a small buffer.
    // In reality, the state provides the exact buy-down amount. We mock it as 95% of savings.
    const requiredContribution = Math.round((grossSavings * 0.95) * 100) / 100;

    const totalCost = requiredContribution + processingFee;
    const netSavings = Math.round((grossSavings - totalCost) * 100) / 100;

    let roiPercentage = 0;
    if (totalCost > 0) {
        roiPercentage = Math.round((netSavings / totalCost) * 10000) / 100; // e.g., 15.50%
    }

    return {
        requiredContribution,
        processingFee,
        netSavings,
        roiPercentage,
        isAllowed: true,
        currentLiability,
        targetLiability,
        message: netSavings > 0 ? 'Contribution recommended.' : 'Contribution not cost-effective.'
    };
}

module.exports = {
    calculateSUIWithholding,
    checkRateExpiration,
    calculateVoluntaryContributionROI
};
