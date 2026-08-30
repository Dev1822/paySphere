/**
 * @fileoverview Reconciliation Engine Utilities
 * @description Evaluates card transactions against policies, flags missing receipts 
 * past the grace period, calculates payroll clawback amounts, and diffs payroll registers.
 * Issues: #1566, #1761
 */

/**
 * Checks if a transaction has exceeded the receipt upload grace period.
 * @param {Date} transactionDate 
 * @param {number} gracePeriodDays 
 * @param {Date} currentDate 
 * @returns {boolean}
 */
function isReceiptOverdue(transactionDate, gracePeriodDays, currentDate) {
    const dueDate = new Date(transactionDate);
    dueDate.setDate(dueDate.getDate() + gracePeriodDays);
    return currentDate > dueDate;
}

/**
 * Evaluates a transaction against company policy rules.
 * @param {Object} transaction 
 * @param {Array<string>} blockedMCCs - Blocked Merchant Category Codes (e.g., Casinos, Airlines)
 * @param {number} maxSingleTransactionLimit 
 * @returns {Array<string>} Policy flags
 */
function evaluatePolicyViolations(transaction, blockedMCCs, maxSingleTransactionLimit) {
    const flags = [];

    if (blockedMCCs.includes(transaction.merchantCategoryCode)) {
        flags.push('Out of Policy (Blocked MCC)');
    }

    if (transaction.amount > maxSingleTransactionLimit) {
        flags.push('Exceeds Single Transaction Limit');
    }

    // Additional heuristics could be added here (e.g., weekend spend, duplicate amounts)
    return flags;
}

/**
 * Processes a batch of transactions to identify those requiring payroll clawback.
 * A transaction requires clawback if it is marked personal, OR if the receipt is 
 * overdue and it hasn't been approved.
 * 
 * @param {Array} transactions - Array of CardTransaction documents
 * @param {number} gracePeriodDays 
 * @param {Date} currentDate 
 * @returns {{ clawbackItems: Array, totalClawback: number }}
 */
function calculateBatchClawbacks(transactions, gracePeriodDays, currentDate) {
    const clawbackItems = [];
    let totalClawback = 0;

    for (const tx of transactions) {
        let requiresClawback = false;
        let reason = '';

        if (tx.isPersonalSpend) {
            requiresClawback = true;
            reason = 'Marked as personal spend';
        } else if (tx.status === 'Pending Receipt' && isReceiptOverdue(tx.transactionDate, gracePeriodDays, currentDate)) {
            requiresClawback = true;
            reason = 'Receipt overdue past grace period';
            tx.policyFlags.push('Missing Receipt (Overdue)');
        }

        if (requiresClawback && tx.status !== 'Clawed Back' && tx.status !== 'Clawback Initiated') {
            clawbackItems.push({
                transactionId: tx._id,
                employeeId: tx.employeeId,
                amount: tx.amount,
                reason,
                merchant: tx.merchantName
            });
            totalClawback += tx.amount;
        }
    }

    return { clawbackItems, totalClawback: Math.round(totalClawback * 100) / 100 };
}

/**
 * Generates the payroll deduction line items for the clawback.
 * Note: In many jurisdictions, clawing back corporate card spend is a post-tax deduction.
 * 
 * @param {Array} clawbackItems 
 * @returns {Array} Payroll deduction payloads
 */
function generatePayrollDeductions(clawbackItems) {
    // Group by employee
    const employeeDeductions = {};

    for (const item of clawbackItems) {
        const empId = item.employeeId.toString();
        if (!employeeDeductions[empId]) {
            employeeDeductions[empId] = {
                employeeId: item.employeeId,
                totalDeduction: 0,
                lineItems: []
            };
        }

        employeeDeductions[empId].totalDeduction += item.amount;
        employeeDeductions[empId].lineItems.push({
            description: `Corp Card Clawback: ${item.merchant} (${item.reason})`,
            amount: item.amount,
            type: 'PostTaxDeduction'
        });
    }

    return Object.values(employeeDeductions).map(emp => ({
        employeeId: emp.employeeId,
        componentName: 'Corporate Card Clawback',
        amount: Math.round(emp.totalDeduction * 100) / 100,
        type: 'PostTaxDeduction',
        isTaxable: false,
        details: emp.lineItems
    }));
}

/**
 * Compares the current payroll register against the previous snapshot.
 * Identifies missing employees, new additions, and net-pay variances.
 * 
 * @param {Array} currentRegister - Array of { employeeId, netPay, hrisStatus }
 * @param {Array} previousLineItems - Array of { employeeId, netPay } from last snapshot
 * @param {number} varianceThreshold - Percentage threshold to flag variance (e.g., 0.10 for 10%)
 * @returns {Array} Array of exception objects
 */
function diffRegisters(currentRegister, previousLineItems, varianceThreshold) {
    const exceptions = [];
    const prevMap = new Map(previousLineItems.map(item => [item.employeeId.toString(), item]));
    const currMap = new Map(currentRegister.map(item => [item.employeeId.toString(), item]));

    // 1. Check for Missing Employees (in previous, not in current)
    for (const [empId, prevItem] of prevMap.entries()) {
        if (!currMap.has(empId)) {
            exceptions.push({
                employeeId: empId,
                exceptionType: 'Missing Employee',
                previousNetPay: prevItem.netPay,
                currentNetPay: 0,
                varianceAmount: -prevItem.netPay,
                variancePercent: -100,
                description: 'Employee received pay last period but is missing from current register.'
            });
        }
    }

    // 2. Check for New Additions and Variances
    for (const [empId, currItem] of currMap.entries()) {
        const prevItem = prevMap.get(empId);

        // Ghost Employee Guardrail: Flag if employee is in payroll but marked Terminated/Inactive in HRIS
        if (currItem.hrisStatus && ['Terminated', 'Inactive', 'On Leave Unpaid'].includes(currItem.hrisStatus)) {
            exceptions.push({
                employeeId: empId,
                exceptionType: 'Ghost Employee',
                currentNetPay: currItem.netPay,
                hrisStatus: currItem.hrisStatus,
                varianceAmount: currItem.netPay,
                variancePercent: 100,
                description: `GHOST EMPLOYEE ALERT: Paid $${currItem.netPay} but HRIS status is ${currItem.hrisStatus}.`
            });
            continue; // Skip standard variance check for ghosts
        }

        if (!prevItem) {
            // New Addition
            exceptions.push({
                employeeId: empId,
                exceptionType: 'New Addition',
                previousNetPay: 0,
                currentNetPay: currItem.netPay,
                varianceAmount: currItem.netPay,
                variancePercent: 100,
                description: 'New employee added to payroll register.'
            });
        } else {
            // Variance Check
            const varianceAmount = currItem.netPay - prevItem.netPay;
            const variancePercent = prevItem.netPay !== 0 ? Math.abs(varianceAmount / prevItem.netPay) : 1;

            if (Math.abs(variancePercent) >= varianceThreshold) {
                exceptions.push({
                    employeeId: empId,
                    exceptionType: 'Net Pay Variance',
                    previousNetPay: prevItem.netPay,
                    currentNetPay: currItem.netPay,
                    varianceAmount: varianceAmount,
                    variancePercent: Math.round(variancePercent * 10000) / 100, // e.g., 15.50%
                    description: `Net pay changed by ${(variancePercent * 100).toFixed(1)}% ($${varianceAmount.toFixed(2)}).`
                });
            }
        }
    }

    return exceptions;
}

module.exports = {
    isReceiptOverdue,
    evaluatePolicyViolations,
    calculateBatchClawbacks,
    generatePayrollDeductions,
    diffRegisters
};
