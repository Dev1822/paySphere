/**
 * @fileoverview Reversal & Recovery Engine
 * Issue: #1936
 */

function calculateNetRecovery(originalNet, stateDeductionLimit, currentNetPay) {
    // State laws often limit deductions to a % of disposable earnings or cannot drop below minimum wage
    const maxDeduction = currentNetPay * stateDeductionLimit;
    return Math.min(originalNet, maxDeduction);
}

function evaluateCrossPeriodTax(originalPayDate, currentDate) {
    const orig = new Date(originalPayDate);
    const curr = new Date(currentDate);

    const isCrossQuarter = Math.floor(orig.getMonth() / 3) !== Math.floor(curr.getMonth() / 3) || orig.getFullYear() !== curr.getFullYear();
    const isCrossYear = orig.getFullYear() !== curr.getFullYear();

    return {
        isCrossPeriod: isCrossQuarter || isCrossYear,
        requiresAmendedReturn: isCrossQuarter, // Requires 941-X or state equivalent
        origQuarter: Math.floor(orig.getMonth() / 3) + 1,
        origYear: orig.getFullYear()
    };
}

function generateAmortizationSchedule(totalOwed, paychecksRemaining, stateDeductionLimit, expectedNetPay) {
    const schedule = [];
    let remaining = totalOwed;
    const maxPerCheck = expectedNetPay * stateDeductionLimit;

    for (let i = 0; i < paychecksRemaining; i++) {
        if (remaining <= 0) break;
        const deduction = Math.min(remaining, maxPerCheck);
        schedule.push({ period: i + 1, deductionAmount: deduction, status: 'Pending' });
        remaining -= deduction;
    }

    return schedule;
}

module.exports = { calculateNetRecovery, evaluateCrossPeriodTax, generateAmortizationSchedule };
