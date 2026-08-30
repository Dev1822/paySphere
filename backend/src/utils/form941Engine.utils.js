/**
 * @fileoverview Form 941 & Deposit Engine
 * Issue: #1869
 */

const MONTHLY_DEPOSITOR_THRESHOLD = 50000;
const NEXT_DAY_DEPOSIT_THRESHOLD = 100000;

/**
 * Determines the depositor type based on the 4-quarter lookback period.
 * @param {number} lookbackTotalLiability 
 * @returns {{ depositorType: string, reason: string }}
 */
function determineDepositorType(lookbackTotalLiability) {
    if (lookbackTotalLiability <= MONTHLY_DEPOSITOR_THRESHOLD) {
        return { depositorType: 'Monthly', reason: `Lookback total ($${lookbackTotalLiability}) is <= $50,000.` };
    }
    return { depositorType: 'Semi-Weekly', reason: `Lookback total ($${lookbackTotalLiability}) exceeds $50,000.` };
}

/**
 * Calculates the deposit due date based on depositor type and liability date.
 * Monthly: 15th of the following month.
 * Semi-Weekly: Wed/Fri/Sat -> Wed. Sun/Tue -> Fri.
 * 
 * @param {Date} liabilityDate 
 * @param {string} depositorType 
 * @returns {Date}
 */
function calculateDepositDueDate(liabilityDate, depositorType) {
    const date = new Date(liabilityDate);

    if (depositorType === 'Monthly') {
        // 15th of the following month
        date.setMonth(date.getMonth() + 1);
        date.setDate(15);
        return date;
    }

    // Semi-Weekly rules
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

    if (dayOfWeek === 3 || dayOfWeek === 4 || dayOfWeek === 5) {
        // Wed, Thu, Fri -> Next Wednesday
        const daysToAdd = dayOfWeek === 3 ? 7 : (dayOfWeek === 4 ? 6 : 5);
        date.setDate(date.getDate() + daysToAdd);
    } else {
        // Sat, Sun, Mon, Tue -> Next Friday
        const daysToAdd = dayOfWeek === 6 ? 6 : (dayOfWeek === 0 ? 5 : (dayOfWeek === 1 ? 4 : 3));
        date.setDate(date.getDate() + daysToAdd);
    }

    return date;
}

/**
 * Deposit Due Date Guardrail: Checks for $100,000 next-day deposit rule.
 * If accumulated liability reaches $100k on any single day, it must be deposited by the next banking day.
 * 
 * @param {number} singleDayAccumulatedLiability 
 * @returns {{ requiresNextDayDeposit: boolean, message: string }}
 */
function checkNextDayDepositRule(singleDayAccumulatedLiability) {
    if (singleDayAccumulatedLiability >= NEXT_DAY_DEPOSIT_THRESHOLD) {
        return {
            requiresNextDayDeposit: true,
            message: `$100,000 Rule Triggered: Accumulated liability of $${singleDayAccumulatedLiability} must be deposited by the next banking day.`
        };
    }
    return { requiresNextDayDeposit: false, message: 'Under $100k threshold.' };
}

module.exports = { determineDepositorType, calculateDepositDueDate, checkNextDayDepositRule };
