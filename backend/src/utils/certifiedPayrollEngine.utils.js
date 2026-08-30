/**
 * @fileoverview Certified Payroll Engine Utilities
 * @description Calculates hourly fringe credits, evaluates prevailing wage compliance,
 * and formats WH-347 certified payroll data.
 * Issue: #1732
 */

/**
 * Converts a monthly employer-paid benefit into an hourly fringe credit.
 * Formula: Monthly Contribution / Expected Monthly Hours
 * 
 * @param {number} monthlyContribution 
 * @param {number} expectedMonthlyHours 
 * @returns {number} Hourly fringe credit
 */
function calculateHourlyFringeCredit(monthlyContribution, expectedMonthlyHours) {
    if (expectedMonthlyHours <= 0) return 0;
    return Math.round((monthlyContribution / expectedMonthlyHours) * 100) / 100;
}

/**
 * Evaluates an employee's weekly pay against the prevailing wage mandate.
 * Compares (Base Paid + Fringe Credit) against the mandated Total Package Rate.
 * 
 * @param {number} actualBaseRate - The hourly base rate actually paid
 * @param {number} actualFringeCredit - The hourly fringe credit from benefits
 * @param {number} mandatedBaseRate - Prevailing wage base requirement
 * @param {number} mandatedFringeRate - Prevailing wage fringe requirement
 * @returns {{ isCompliant: boolean, baseShortfall: number, fringeShortfall: number, totalUnderpayment: number }}
 */
function evaluatePrevailingWageCompliance(actualBaseRate, actualFringeCredit, mandatedBaseRate, mandatedFringeRate) {
    let baseShortfall = 0;
    let fringeShortfall = 0;

    // Base rate must meet or exceed mandated base rate
    if (actualBaseRate < mandatedBaseRate) {
        baseShortfall = Math.round((mandatedBaseRate - actualBaseRate) * 100) / 100;
    }

    // Total package (Base + Fringe) must meet or exceed Total Package Rate
    // If base is overpaid, it can sometimes offset fringe shortfall depending on jurisdiction, 
    // but strict Davis-Bacon requires base to be met first.
    const actualTotal = actualBaseRate + actualFringeCredit;
    const mandatedTotal = mandatedBaseRate + mandatedFringeRate;

    if (actualTotal < mandatedTotal && baseShortfall === 0) {
        // Shortfall is purely in the fringe portion
        fringeShortfall = Math.round((mandatedTotal - actualTotal) * 100) / 100;
    }

    const isCompliant = baseShortfall === 0 && fringeShortfall === 0;
    const totalUnderpayment = baseShortfall + fringeShortfall;

    return { isCompliant, baseShortfall, fringeShortfall, totalUnderpayment };
}

/**
 * Generates a mock WH-347 (Certified Payroll) text representation.
 * In production, this would generate the exact government PDF or XML schema.
 * 
 * @param {Object} reportData - Aggregated report data
 * @param {Array} employeeRecords - Array of employee weekly records
 * @returns {string} Formatted text report
 */
function generateWH347Report(reportData, employeeRecords) {
    let report = '';

    // Header Section
    report += '====================================================================================================\n';
    report += '                              CERTIFIED PAYROLL REPORT (WH-347)\n';
    report += '====================================================================================================\n';
    report += `Contractor: ${reportData.contractorName}\n`;
    report += `Project: ${reportData.projectName} | Contract No: ${reportData.contractNumber}\n`;
    report += `Week Ending: ${new Date(reportData.weekEndingDate).toLocaleDateString()}\n`;
    report += `Payroll Number: ${reportData.payrollSequence}\n`;
    report += '----------------------------------------------------------------------------------------------------\n';

    // Column Headers
    report += 'Name & Craft Classification       | Hours | Base Rate | Fringe | Gross Pay | Deductions | Net Pay\n';
    report += '----------------------------------------------------------------------------------------------------\n';

    // Employee Records
    for (const emp of employeeRecords) {
        const nameCraft = `${emp.employeeName} (${emp.craftName})`.padEnd(35);
        const hours = String(emp.hoursWorked.toFixed(2)).padStart(6);
        const baseRate = `$${emp.baseRate.toFixed(2)}`.padStart(10);
        const fringe = `$${emp.fringeCredit.toFixed(2)}`.padStart(7);
        const gross = `$${emp.grossPay.toFixed(2)}`.padStart(10);
        const deductions = `$${emp.deductions.toFixed(2)}`.padStart(11);
        const net = `$${emp.netPay.toFixed(2)}`.padStart(8);

        report += `${nameCraft}|${hours} |${baseRate} |${fringe} |${gross} |${deductions} |${net}\n`;
    }

    report += '----------------------------------------------------------------------------------------------------\n';
    report += `Total Hours: ${reportData.totalHoursWorked} | Total Gross: $${reportData.totalGrossWages.toFixed(2)}\n`;
    report += `Compliance Status: ${reportData.underpaymentsDetected > 0 ? 'NON-COMPLIANT' : 'COMPLIANT'}\n`;
    report += '====================================================================================================\n';
    report += 'I hereby certify that the above payroll is true and correct.\n';
    report += `Signed: ___________________________ Date: ${new Date().toLocaleDateString()}\n`;

    return report;
}

module.exports = { calculateHourlyFringeCredit, evaluatePrevailingWageCompliance, generateWH347Report };
