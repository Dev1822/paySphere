/**
 * @fileoverview Giving & Matching Engine Utilities
 * @description Evaluates payroll deductions against pledge schedules, tracks YTD 
 * contributions, and enforces campaign cap guardrails.
 * Issue: #2011
 */

/**
 * Calculates the deduction amount for the current payroll period based on pledge frequency.
 * 
 * @param {number} pledgeAmount 
 * @param {string} frequency 
 * @param {number} paychecksPerYear - e.g., 26 for bi-weekly, 24 for semi-monthly
 * @returns {number} Deduction amount for the current period
 */
function calculatePeriodDeduction(pledgeAmount, frequency, paychecksPerYear) {
    switch (frequency) {
        case 'One-Time':
            return pledgeAmount; // Deduct full amount once
        case 'Per Paycheck':
            return pledgeAmount; // pledgeAmount is already per paycheck
        case 'Monthly':
            // Convert monthly pledge to per-paycheck amount
            return Math.round((pledgeAmount * 12) / paychecksPerYear * 100) / 100;
        case 'Bi-Weekly':
            // Convert bi-weekly pledge to per-paycheck amount (if payroll is semi-monthly)
            return Math.round((pledgeAmount * 26) / paychecksPerYear * 100) / 100;
        default:
            return 0;
    }
}

/**
 * Campaign Cap Guardrail: Evaluates if the employee's pledge total or the corporate 
 * matching limit has been reached, halting further deductions or matches.
 * 
 * @param {Object} pledge - EmployeePledge document
 * @param {Object} campaign - GivingCampaign document
 * @param {number} currentDeduction - Calculated deduction for this period
 * @returns {{ finalDeduction: number, finalMatch: number, haltDeductions: boolean, haltMatching: boolean, newStatus: string }}
 */
function evaluateCampaignCaps(pledge, campaign, currentDeduction, multiplier) {
    let finalDeduction = currentDeduction;
    let finalMatch = 0;
    let haltDeductions = false;
    let haltMatching = false;
    let newStatus = pledge.status;

    // 1. Check Employee Pledge Cap (Total Pledged Annual)
    const remainingPledge = Math.max(0, pledge.totalPledgedAnnual - pledge.ytdDeducted);
    if (remainingPledge <= 0) {
        haltDeductions = true;
        finalDeduction = 0;
        newStatus = 'Completed';
    } else if (currentDeduction > remainingPledge) {
        finalDeduction = remainingPledge; // Deduct only what's left to fulfill the pledge
        haltDeductions = true; // Next period will be halted
        newStatus = 'Completed';
    }

    // 2. Check Corporate Match Cap
    if (!haltDeductions && campaign.matchingRule !== 'No Corporate Match') {
        const remainingMatchCap = Math.max(0, campaign.matchCapPerEmployee - pledge.ytdMatched);
        const calculatedMatch = Math.round(finalDeduction * multiplier * 100) / 100;

        if (remainingMatchCap <= 0) {
            haltMatching = true;
            finalMatch = 0;
        } else if (calculatedMatch > remainingMatchCap) {
            finalMatch = remainingMatchCap;
            haltMatching = true; // Match cap reached, but deductions continue
        } else {
            finalMatch = calculatedMatch;
        }
    }

    return { finalDeduction, finalMatch, haltDeductions, haltMatching, newStatus };
}

/**
 * Generates a summary report for corporate matching disbursements.
 * @param {Array} ledgerEntries - Array of CorporateMatchLedger documents
 * @returns {Object} Aggregated disbursement data by charity
 */
function generateDisbursementReport(ledgerEntries) {
    const disbursements = {};

    for (const entry of ledgerEntries) {
        // Assuming charityId is populated or available in the entry context
        const charityId = entry.charityId || 'Unknown';

        if (!disbursements[charityId]) {
            disbursements[charityId] = {
                totalEmployeeDonations: 0,
                totalCorporateMatch: 0,
                employeeCount: new Set()
            };
        }

        disbursements[charityId].totalEmployeeDonations += entry.employeeDonation;
        disbursements[charityId].totalCorporateMatch += entry.corporateMatch;
        disbursements[charityId].employeeCount.add(entry.employeeId.toString());
    }

    // Convert Sets to counts
    for (const charity in disbursements) {
        disbursements[charity].employeeCount = disbursements[charity].employeeCount.size;
        disbursements[charity].totalEmployeeDonations = Math.round(disbursements[charity].totalEmployeeDonations * 100) / 100;
        disbursements[charity].totalCorporateMatch = Math.round(disbursements[charity].totalCorporateMatch * 100) / 100;
    }

    return disbursements;
}

module.exports = {
    calculatePeriodDeduction,
    evaluateCampaignCaps,
    generateDisbursementReport
};
