/**
 * @fileoverview I-9 Compliance Engine
 * @description Scans authorization documents for expiration windows and 
 * enforces Section 2 guardrails for payroll activation.
 * Issue: #1621
 */

/**
 * Evaluates an authorization document's expiration date and returns the alert window.
 * @param {Date} expirationDate 
 * @param {Date} currentDate 
 * @returns {{ status: string, daysUntilExpiration: number, requiresReverification: boolean }}
 */
function evaluateExpirationWindow(expirationDate, currentDate) {
    const diffTime = new Date(expirationDate) - new Date(currentDate);
    const daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = 'Valid';
    let requiresReverification = false;

    if (daysUntilExpiration <= 0) {
        status = 'Expired';
        requiresReverification = true;
    } else if (daysUntilExpiration <= 30) {
        status = 'Expiring Soon';
        requiresReverification = true;
    } else if (daysUntilExpiration <= 90) {
        status = 'Expiring Soon'; // 90-day warning window
    }

    return { status, daysUntilExpiration, requiresReverification };
}

/**
 * Section 2 Guardrail: Determines if an employee can be activated for payroll.
 * Federal law requires Section 2 (physical document verification) within 3 days of hire.
 * 
 * @param {Object} i9Record - The I9Record document
 * @returns {{ isCleared: boolean, reason: string }}
 */
function validatePayrollClearance(i9Record) {
    if (!i9Record) {
        return { isCleared: false, reason: 'I-9 record not initiated.' };
    }

    if (!i9Record.section1Completed) {
        return { isCleared: false, reason: 'Section 1 not completed by employee.' };
    }

    if (!i9Record.section2Completed) {
        return { isCleared: false, reason: 'Section 2 physical verification pending. Payroll blocked.' };
    }

    return { isCleared: true, reason: 'Cleared for active payroll.' };
}

module.exports = { evaluateExpirationWindow, validatePayrollClearance };
