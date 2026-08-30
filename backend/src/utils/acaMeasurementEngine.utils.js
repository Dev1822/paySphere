/**
 * @fileoverview ACA Measurement & Affordability Engine
 * @description Calculates rolling 12-month averages for variable-hour employees, 
 * determines full-time status, and applies Affordability Safe Harbors.
 * Issue: #1624
 */

/**
 * Calculates the rolling average hours per week over a 12-month look-back period.
 * @param {Array<number>} monthlyHours - Array of 12 integers representing hours per month
 * @returns {number} Average hours per week
 */
function calculateRollingAverage(monthlyHours) {
    if (!monthlyHours || monthlyHours.length === 0) return 0;

    const totalHours = monthlyHours.reduce((sum, h) => sum + h, 0);
    // Standard ACA calculation: Total hours / 12 months / 4.33 weeks per month
    // Or simply Total Hours / 52 weeks
    const averageWeeklyHours = totalHours / 52;

    return Math.round(averageWeeklyHours * 100) / 100;
}

/**
 * Determines if an employee meets the ACA full-time threshold (30 hrs/week or 130 hrs/month).
 * @param {number} monthlyHours 
 * @param {number} averageWeeklyHours 
 * @returns {boolean}
 */
function determineFullTimeStatus(monthlyHours, averageWeeklyHours) {
    return monthlyHours >= 130 || averageWeeklyHours >= 30;
}

/**
 * Evaluates coverage affordability using the Federal Poverty Line (FPL) Safe Harbor.
 * For 2026, the affordability threshold is approximately 8.39% (mocked as 0.0839).
 * 
 * @param {number} employeeContribution - Monthly premium for lowest-cost self-only coverage
 * @param {number} federalPovertyLevel - Annual FPL for a single individual (e.g., $15,060)
 * @returns {{ isAffordable: boolean, reason: string }}
 */
function checkFPLSafeHarbor(employeeContribution, federalPovertyLevel) {
    const affordabilityThreshold = 0.0839; // 8.39% for 2026
    const monthlyFPL = federalPovertyLevel / 12;
    const maxAllowedContribution = monthlyFPL * affordabilityThreshold;

    if (employeeContribution <= maxAllowedContribution) {
        return { isAffordable: true, reason: 'Meets FPL Safe Harbor' };
    }

    return { isAffordable: false, reason: `Exceeds FPL Safe Harbor max of $${maxAllowedContribution.toFixed(2)}` };
}

/**
 * Evaluates coverage affordability using the Rate of Pay Safe Harbor.
 * Max contribution = (Hourly Rate * 130 hours) * affordabilityThreshold
 * 
 * @param {number} employeeContribution 
 * @param {number} hourlyRate 
 * @returns {{ isAffordable: boolean, reason: string }}
 */
function checkRateOfPaySafeHarbor(employeeContribution, hourlyRate) {
    const affordabilityThreshold = 0.0839;
    const monthlyBasePay = hourlyRate * 130;
    const maxAllowedContribution = monthlyBasePay * affordabilityThreshold;

    if (employeeContribution <= maxAllowedContribution) {
        return { isAffordable: true, reason: 'Meets Rate of Pay Safe Harbor' };
    }

    return { isAffordable: false, reason: `Exceeds Rate of Pay Safe Harbor max of $${maxAllowedContribution.toFixed(2)}` };
}

/**
 * Generates the IRS Line 14 and Line 16 codes based on monthly eligibility data.
 * @param {Object} ledgerData - { isFullTime, isOfferedCoverage, isAffordable }
 * @returns {{ line14Code: string, line16Code: string }}
 */
function generateIRSCodes(ledgerData) {
    let line14Code = '1H'; // No offer of coverage
    let line16Code = '2A'; // Not employed / Not full-time

    if (ledgerData.isFullTime) {
        if (ledgerData.isOfferedCoverage) {
            line14Code = '1E'; // Offered minimum essential coverage providing minimum value
            line16Code = ledgerData.isAffordable ? '2E' : '2C'; // 2E = Affordable, 2C = Enrolled/Not Affordable
        } else {
            line14Code = '1H';
            line16Code = '2B'; // Full-time employee but no coverage offered
        }
    }

    return { line14Code, line16Code };
}

module.exports = {
    calculateRollingAverage,
    determineFullTimeStatus,
    checkFPLSafeHarbor,
    checkRateOfPaySafeHarbor,
    generateIRSCodes
};
