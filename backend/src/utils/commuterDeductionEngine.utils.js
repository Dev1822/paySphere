/**
 * @fileoverview Commuter Deduction Engine
 * @description Enforces IRS Section 132(f) limits and reconciles vendor feeds.
 * Issue: #1623
 */

// IRS 2026 Monthly Limits (Mocked for demonstration)
const IRS_LIMITS = {
    Transit: 315,
    Parking: 315,
    Vanpool: 315
};

/**
 * Calculates the actual pre-tax deduction, enforcing IRS statutory maximums.
 * @param {number} electedAmount 
 * @param {string} benefitType 
 * @returns {{ actualDeduction: number, capped: boolean, reason: string }}
 */
function calculatePreTaxDeduction(electedAmount, benefitType) {
    const limit = IRS_LIMITS[benefitType] || 0;

    if (electedAmount > limit) {
        return {
            actualDeduction: limit,
            capped: true,
            reason: `Election capped at IRS monthly maximum of $${limit}.`
        };
    }

    return {
        actualDeduction: electedAmount,
        capped: false,
        reason: 'Within IRS limits.'
    };
}

/**
 * Reconciles the employer's internal election ledger against the vendor invoice feed.
 * Flags discrepancies (e.g., vendor billed for a terminated employee).
 * 
 * @param {Array} internalElections - Array of CommuterElection documents
 * @param {Array} vendorLineItems - Array of { employeeId, amount } from vendor feed
 * @returns {Array} Discrepancy alerts
 */
function reconcileVendorFeed(internalElections, vendorLineItems) {
    const discrepancies = [];
    const internalMap = new Map(internalElections.map(e => [e.employeeId.toString(), e]));

    for (const item of vendorLineItems) {
        const internal = internalMap.get(item.employeeId.toString());

        if (!internal) {
            discrepancies.push({
                employeeId: item.employeeId,
                type: 'Missing Internal Election',
                message: `Vendor billed $${item.amount} but no active internal election found. Possible terminated employee.`
            });
        } else if (Math.abs(internal.electionAmount - item.amount) > 0.01) {
            discrepancies.push({
                employeeId: item.employeeId,
                type: 'Amount Mismatch',
                message: `Internal: $${internal.electionAmount} vs Vendor: $${item.amount}`
            });
        }
    }

    return discrepancies;
}

module.exports = { calculatePreTaxDeduction, reconcileVendorFeed, IRS_LIMITS };
