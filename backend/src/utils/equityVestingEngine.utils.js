/**
 * @fileoverview Equity Vesting & ASC 718 Engine
 * @description Calculates sell-to-cover liquidations, checks blackout periods, 
 * and generates ASC 718 monthly amortization schedules.
 * Issue: #2010
 */
const { SUPPLEMENTAL_TAX_RATES, daysBetween } = require('../constants/equity.constants');

/**
 * Calculates the exact number of shares to liquidate for sell-to-cover tax withholding.
 * 
 * @param {number} sharesVested 
 * @param {number} fmv - Fair Market Value per share on vesting date
 * @param {number} ytdWages - Employee's YTD wages to determine high-earner bracket
 * @returns {{ grossProceeds: number, taxWithholdingAmount: number, sharesLiquidated: number, netSharesDelivered: number }}
 */
function calculateSellToCover(sharesVested, fmv, ytdWages) {
    const grossProceeds = Math.round(sharesVested * fmv * 100) / 100;

    // Determine federal supplemental rate (22% standard, 37% over $1M)
    let federalRate = SUPPLEMENTAL_TAX_RATES.FEDERAL_STANDARD;
    if (ytdWages + grossProceeds > 1000000) {
        federalRate = SUPPLEMENTAL_TAX_RATES.FEDERAL_HIGH_EARNER;
    }

    // Calculate FICA (Simplified: assume under SS wage base for this calculation)
    const ficaRate = SUPPLEMENTAL_TAX_RATES.FICA_SS + SUPPLEMENTAL_TAX_RATES.FICA_MEDICARE;

    const totalTaxRate = federalRate + ficaRate;
    const taxWithholdingAmount = Math.round(grossProceeds * totalTaxRate * 100) / 100;

    // Calculate shares needed to cover the tax amount
    const sharesLiquidated = Math.ceil(taxWithholdingAmount / fmv); // Round up to whole share
    const netSharesDelivered = sharesVested - sharesLiquidated;

    return {
        grossProceeds,
        taxWithholdingAmount,
        sharesLiquidated: Math.min(sharesLiquidated, sharesVested), // Cannot liquidate more than vested
        netSharesDelivered: Math.max(0, netSharesDelivered)
    };
}

/**
 * Blackout Period Guardrail: Checks if a vesting date falls within an active blackout window.
 * @param {Date} vestingDate 
 * @param {Array} blackoutPeriods - Array of BlackoutPeriod documents
 * @returns {{ isBlocked: boolean, reason: string }}
 */
function checkBlackoutPeriod(vestingDate, blackoutPeriods) {
    const vDate = new Date(vestingDate);

    for (const bp of blackoutPeriods) {
        if (!bp.isActive) continue;
        const start = new Date(bp.startDate);
        const end = new Date(bp.endDate);

        if (vDate >= start && vDate <= end) {
            return {
                isBlocked: true,
                reason: `Blocked by ${bp.blackoutType} blackout (${start.toLocaleDateString()} to ${end.toLocaleDateString()}).`
            };
        }
    }

    return { isBlocked: false, reason: 'Clear to execute.' };
}

/**
 * Calculates the ASC 718 monthly amortization for a grant.
 * Straight-line amortization over the requisite service period.
 * 
 * @param {number} totalGrantValue - Grant Date Fair Value * Total Shares
 * @param {number} totalVestingMonths 
 * @param {number} monthsElapsed 
 * @returns {{ monthlyAmortization: number, ytdAmortization: number, remainingValue: number }}
 */
function calculateASC718Amortization(totalGrantValue, totalVestingMonths, monthsElapsed) {
    if (totalVestingMonths <= 0) return { monthlyAmortization: 0, ytdAmortization: totalGrantValue, remainingValue: 0 };

    const monthlyAmortization = Math.round((totalGrantValue / totalVestingMonths) * 100) / 100;
    const ytdAmortization = Math.round(Math.min(monthsElapsed, totalVestingMonths) * monthlyAmortization * 100) / 100;
    const remainingValue = Math.max(0, totalGrantValue - ytdAmortization);

    return { monthlyAmortization, ytdAmortization, remainingValue };
}

/**
 * Generates the ASC 718 journal entry payload for the GL.
 * @param {number} amount 
 * @param {string} glAccountCode 
 * @param {string} description 
 * @returns {Array} Journal entry lines
 */
function generateASC718JournalEntry(amount, glAccountCode, description) {
    return [
        { account: '6500-Stock-Based-Comp-Expense', debit: amount, credit: 0, desc: description },
        { account: '2500-APIC-Stock-Comp', debit: 0, credit: amount, desc: description } // Additional Paid-In Capital
    ];
}

module.exports = {
    calculateSellToCover,
    checkBlackoutPeriod,
    calculateASC718Amortization,
    generateASC718JournalEntry
};
