/**
 * @fileoverview COBRA Billing & ERISA Compliance Engine
 * @description Calculates premiums, evaluates election windows, and enforces 
 * ERISA deadline guardrails for continuation coverage.
 * Issue: #1759
 */

/**
 * Calculates the monthly COBRA premium including the administrative fee.
 * Standard fee is 2%. Disability extension allows up to 50% (150% total premium).
 * 
 * @param {number} basePremium - Total cost of coverage (Employer + Employee share)
 * @param {boolean} isDisabilityExtension 
 * @returns {{ adminFeeRate: number, adminFeeAmount: number, totalMonthlyPremium: number }}
 */
function calculatePremium(basePremium, isDisabilityExtension) {
    const adminFeeRate = isDisabilityExtension ? 0.50 : 0.02;
    const adminFeeAmount = Math.round(basePremium * adminFeeRate * 100) / 100;
    const totalMonthlyPremium = Math.round((basePremium + adminFeeAmount) * 100) / 100;

    return { adminFeeRate, adminFeeAmount, totalMonthlyPremium };
}

/**
 * Evaluates if the election was made within the statutory 60-day window.
 * The window starts from the date of the qualifying event OR the date the notice was sent, whichever is later.
 * 
 * @param {Date} eventDate 
 * @param {Date} noticeSentDate 
 * @param {Date} electionDate 
 * @returns {{ isTimely: boolean, daysRemaining: number }}
 */
function evaluateElectionWindow(eventDate, noticeSentDate, electionDate) {
    const startDate = noticeSentDate && new Date(noticeSentDate) > new Date(eventDate)
        ? new Date(noticeSentDate)
        : new Date(eventDate);

    const deadline = new Date(startDate);
    deadline.setDate(deadline.getDate() + 60);

    const election = new Date(electionDate);
    const diffTime = deadline.getTime() - election.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
        isTimely: election <= deadline,
        daysRemaining: Math.max(0, daysRemaining)
    };
}

/**
 * Evaluates the payment grace period.
 * Initial payment has a 45-day grace period from election date.
 * Subsequent monthly payments have a 30-day grace period from the due date.
 * 
 * @param {Date} dueDate 
 * @param {Date} paymentDate 
 * @param {boolean} isFirstPayment 
 * @returns {{ isWithinGracePeriod: boolean, daysRemaining: number }}
 */
function evaluateGracePeriod(dueDate, paymentDate, isFirstPayment) {
    const graceDays = isFirstPayment ? 45 : 30;
    const graceEndDate = new Date(dueDate);
    graceEndDate.setDate(graceEndDate.getDate() + graceDays);

    const payment = new Date(paymentDate);
    const diffTime = graceEndDate.getTime() - payment.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
        isWithinGracePeriod: payment <= graceEndDate,
        daysRemaining: Math.max(0, daysRemaining)
    };
}

/**
 * ERISA Deadline Guardrail: Checks if the election notice was sent within 14 days of the qualifying event.
 * (Note: Plan administrators technically have 44 days total, but 14 days is the standard employer-to-plan admin window).
 * 
 * @param {Date} eventDate 
 * @param {Date} noticeSentDate 
 * @returns {{ isCompliant: boolean, daysOverdue: number }}
 */
function checkERISADeadline(eventDate, noticeSentDate) {
    if (!noticeSentDate) {
        const daysSinceEvent = Math.floor((new Date() - new Date(eventDate)) / (1000 * 60 * 60 * 24));
        return {
            isCompliant: daysSinceEvent <= 14,
            daysOverdue: daysSinceEvent > 14 ? daysSinceEvent - 14 : 0,
            status: daysSinceEvent > 14 ? 'OVERDUE' : 'Pending'
        };
    }

    const deadline = new Date(eventDate);
    deadline.setDate(deadline.getDate() + 14);

    const sent = new Date(noticeSentDate);
    const isCompliant = sent <= deadline;

    const diffTime = sent.getTime() - deadline.getTime();
    const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
        isCompliant,
        daysOverdue: isCompliant ? 0 : daysOverdue,
        status: isCompliant ? 'Compliant' : 'Late'
    };
}

module.exports = { calculatePremium, evaluateElectionWindow, evaluateGracePeriod, checkERISADeadline };
