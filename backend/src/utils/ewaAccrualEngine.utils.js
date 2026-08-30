/**
 * @fileoverview EWA Accrual Engine Utilities
 * @description Calculates real-time available net pay, enforces company caps, 
 * and generates payroll reconciliation offsets.
 * Issue: #1569
 */

/**
 * Calculates the real-time "Available Net Pay" an employee can withdraw.
 * Formula: (Cumulative Net Accrued - Total Funded Withdrawals) * Max Accrual Percentage
 * 
 * @param {number} cumulativeNetAccrued - Total net wages accrued in the current pay period
 * @param {number} totalFundedWithdrawals - Sum of all funded EWA requests in the current period
 * @param {number} maxAccrualPercentage - Company-defined cap (e.g., 0.50 for 50%)
 * @returns {number} Available balance for withdrawal
 */
function calculateAvailableBalance(cumulativeNetAccrued, totalFundedWithdrawals, maxAccrualPercentage) {
    const cappedAccrual = cumulativeNetAccrued * maxAccrualPercentage;
    const available = cappedAccrual - totalFundedWithdrawals;

    return Math.max(0, Math.round(available * 100) / 100);
}

/**
 * Calculates the daily net accrual after applying the estimated tax holdback.
 * @param {number} grossDailyEarnings 
 * @param {number} estimatedTaxHoldbackRate 
 * @returns {{ netDailyAccrual: number, estimatedTaxHoldback: number }}
 */
function calculateDailyAccrual(grossDailyEarnings, estimatedTaxHoldbackRate) {
    const estimatedTaxHoldback = Math.round(grossDailyEarnings * estimatedTaxHoldbackRate * 100) / 100;
    const netDailyAccrual = Math.round((grossDailyEarnings - estimatedTaxHoldback) * 100) / 100;

    return { netDailyAccrual, estimatedTaxHoldback };
}

/**
 * Validates a withdrawal request against available balance and period limits.
 * @param {number} requestedAmount 
 * @param {number} availableBalance 
 * @param {number} currentWithdrawalCount 
 * @param {number} maxWithdrawalsPerPeriod 
 * @param {number} transactionFee 
 * @returns {{ isValid: boolean, reason: string, totalDeduction: number }}
 */
function validateWithdrawalRequest(
    requestedAmount,
    availableBalance,
    currentWithdrawalCount,
    maxWithdrawalsPerPeriod,
    transactionFee
) {
    if (currentWithdrawalCount >= maxWithdrawalsPerPeriod) {
        return { isValid: false, reason: 'Maximum withdrawals for this pay period reached.', totalDeduction: 0 };
    }

    const totalDeduction = Math.round((requestedAmount + transactionFee) * 100) / 100;

    // The requested amount (excluding fee) must not exceed available balance
    if (requestedAmount > availableBalance) {
        return { isValid: false, reason: 'Requested amount exceeds available EWA balance.', totalDeduction: 0 };
    }

    return { isValid: true, reason: 'Valid', totalDeduction };
}

/**
 * Generates the negative deduction line items required for the official payroll run
 * to recover EWA advances and transaction fees.
 * 
 * @param {Array} fundedWithdrawals - Array of WithdrawalRequest documents
 * @returns {{ totalAdvances: number, totalFees: number, totalOffset: number, lineItems: Array }}
 */
function generatePayrollOffsets(fundedWithdrawals) {
    let totalAdvances = 0;
    let totalFees = 0;
    const lineItems = [];

    for (const w of fundedWithdrawals) {
        totalAdvances += w.requestedAmount;
        totalFees += w.transactionFee;

        lineItems.push({
            withdrawalId: w._id,
            description: `EWA Advance Recovery (${new Date(w.fundedAt).toLocaleDateString()})`,
            advanceAmount: w.requestedAmount,
            feeAmount: w.transactionFee
        });
    }

    const totalOffset = Math.round((totalAdvances + totalFees) * 100) / 100;

    return {
        totalAdvances: Math.round(totalAdvances * 100) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        totalOffset,
        lineItems
    };
}

module.exports = {
    calculateAvailableBalance,
    calculateDailyAccrual,
    validateWithdrawalRequest,
    generatePayrollOffsets
};
