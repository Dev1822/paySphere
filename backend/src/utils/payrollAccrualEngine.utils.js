/**
 * @fileoverview Payroll Accrual Engine
 * Issue: #1938
 */

function calculateDailyCutoff(daysWorked, dailyWageRate) {
    return Math.round(daysWorked * dailyWageRate * 100) / 100;
}

function valuePTOLiability(hoursBalance, hourlyRate, includeBurden, burdenPercentage) {
    const baseValue = hoursBalance * hourlyRate;
    const burdenValue = includeBurden ? baseValue * burdenPercentage : 0;
    return Math.round((baseValue + burdenValue) * 100) / 100;
}

function generateVarianceTrueUp(currentLiability, previousLiability) {
    const variance = currentLiability - previousLiability;
    return {
        varianceAmount: Math.round(variance * 100) / 100,
        requiresDebit: variance < 0, // Liability decreased, debit the liability account
        requiresCredit: variance > 0 // Liability increased, credit the liability account
    };
}

function generateASC710JournalEntries(cutoffWages, ptoLiability, variance) {
    const entries = [];

    // Cutoff Wages Accrual
    if (cutoffWages > 0) {
        entries.push({ account: '6000-Wages Expense', debit: cutoffWages, credit: 0, desc: 'Month-end cutoff wages' });
        entries.push({ account: '2100-Accrued Wages Payable', debit: 0, credit: cutoffWages, desc: 'Month-end cutoff wages' });
    }

    // PTO Liability True-Up
    if (variance.varianceAmount !== 0) {
        if (variance.requiresCredit) {
            entries.push({ account: '6100-PTO Expense', debit: variance.varianceAmount, credit: 0, desc: 'PTO liability increase' });
            entries.push({ account: '2200-Accrued PTO Payable', debit: 0, credit: variance.varianceAmount, desc: 'PTO liability increase' });
        } else {
            entries.push({ account: '2200-Accrued PTO Payable', debit: Math.abs(variance.varianceAmount), credit: 0, desc: 'PTO liability decrease' });
            entries.push({ account: '6100-PTO Expense', debit: 0, credit: Math.abs(variance.varianceAmount), desc: 'PTO liability decrease' });
        }
    }

    return entries;
}

module.exports = { calculateDailyCutoff, valuePTOLiability, generateVarianceTrueUp, generateASC710JournalEntries };
