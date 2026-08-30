/**
 * @fileoverview Tip Allocation Engine Utilities
 * @description Calculates weighted tip-outs, enforces FLSA guardrails, 
 * and applies minimum wage make-whole top-ups.
 * Issue: #1567
 */

/**
 * Enforces FLSA guardrails by filtering out ineligible employees from the tip pool.
 * @param {Array} employees - Array of employee objects
 * @param {Object} poolConfig - TipPoolConfiguration document
 * @returns {Array} Eligible employees
 */
function filterEligibleEmployees(employees, poolConfig) {
    return employees.filter(emp => {
        // Strict FLSA: Managers and Supervisors cannot participate in tip pools
        const isManager = emp.role && (
            emp.role.toLowerCase().includes('manager') ||
            emp.role.toLowerCase().includes('supervisor') ||
            emp.role.toLowerCase().includes('owner')
        );

        if (isManager && !poolConfig.allowManagers) return false;
        if (emp.isOwner && !poolConfig.allowOwners) return false;

        return true;
    });
}

/**
 * Calculates the weighted tip share for an employee based on hours worked and job weight.
 * @param {number} totalPoolTips - Net tips available for the pool
 * @param {number} employeeHours 
 * @param {number} employeeWeight - e.g., 100 for 100%, 50 for 50%
 * @param {number} totalWeightedHours - Sum of (hours * weight) for all eligible employees
 * @returns {number} Raw tip share
 */
function calculateWeightedShare(totalPoolTips, employeeHours, employeeWeight, totalWeightedHours) {
    if (totalWeightedHours <= 0) return 0;

    const employeeWeightedHours = employeeHours * (employeeWeight / 100);
    const shareRatio = employeeWeightedHours / totalWeightedHours;

    return Math.round(totalPoolTips * shareRatio * 100) / 100;
}

/**
 * Applies the "Minimum Wage Make-Whole" top-up.
 * If (Cash Wage + Tips) / Hours < Statutory Minimum Wage, the employer must pay the difference.
 * 
 * @param {number} cashWageHourly - Employee's base cash wage (e.g., $2.13 for tipped minimum)
 * @param {number} tipsEarned 
 * @param {number} hoursWorked 
 * @param {number} statutoryMinimumWage - e.g., $7.25 or state minimum
 * @returns {{ totalEarnings: number, makeWholeTopUp: number, isCompliant: boolean }}
 */
function calculateMakeWholeTopUp(cashWageHourly, tipsEarned, hoursWorked, statutoryMinimumWage) {
    if (hoursWorked <= 0) return { totalEarnings: 0, makeWholeTopUp: 0, isCompliant: true };

    const totalEarnings = (cashWageHourly * hoursWorked) + tipsEarned;
    const effectiveHourlyRate = totalEarnings / hoursWorked;

    if (effectiveHourlyRate < statutoryMinimumWage) {
        const requiredTotal = statutoryMinimumWage * hoursWorked;
        const makeWholeTopUp = Math.round((requiredTotal - totalEarnings) * 100) / 100;
        return { totalEarnings: requiredTotal, makeWholeTopUp, isCompliant: false };
    }

    return { totalEarnings, makeWholeTopUp: 0, isCompliant: true };
}

module.exports = { filterEligibleEmployees, calculateWeightedShare, calculateMakeWholeTopUp };
