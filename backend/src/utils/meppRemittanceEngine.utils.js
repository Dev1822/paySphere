/**
 * @fileoverview MEPP Remittance Engine
 * @description Calculates fringe contributions based on CBA matrices and 
 * generates EDGE-compliant fixed-width remittance files.
 * Issue: #2009
 */
const { EDGE_RECORD_TYPES, padEdgeString, padEdgeNumber, DELINQUENCY_THRESHOLDS } = require('../constants/union.constants');

/**
 * Calculates the exact fringe contributions for an employee based on hours worked and CBA rates.
 * 
 * @param {number} hoursWorked 
 * @param {Object} cbaRates - The specific rate object for the employee's classification
 * @returns {Object} Calculated contributions per fund type
 */
function calculateFringeContributions(hoursWorked, cbaRates) {
    if (!cbaRates || hoursWorked <= 0) {
        return { pension: 0, healthWelfare: 0, annuity: 0, apprenticeship: 0, vacation: 0, total: 0 };
    }

    const pension = Math.round(hoursWorked * (cbaRates.pensionRate || 0) * 100) / 100;
    const healthWelfare = Math.round(hoursWorked * (cbaRates.healthWelfareRate || 0) * 100) / 100;
    const annuity = Math.round(hoursWorked * (cbaRates.annuityRate || 0) * 100) / 100;
    const apprenticeship = Math.round(hoursWorked * (cbaRates.apprenticeshipRate || 0) * 100) / 100;
    const vacation = Math.round(hoursWorked * (cbaRates.vacationRate || 0) * 100) / 100;

    const total = Math.round((pension + healthWelfare + annuity + apprenticeship + vacation) * 100) / 100;

    return { pension, healthWelfare, annuity, apprenticeship, vacation, total };
}

/**
 * Generates the EDGE Header Record (Type 01).
 * @param {Object} employerData 
 * @param {string} processingDate 
 * @returns {string} 80-character fixed-width string
 */
function generateEdgeHeader(employerData, processingDate) {
    const recordType = EDGE_RECORD_TYPES.HEADER;
    const fileFormat = 'EDGE';
    const ein = padEdgeString(employerData.ein.replace(/-/g, ''), 9);
    const name = padEdgeString(employerData.name, 30);
    const dateStr = padEdgeString(processingDate, 8); // YYYYMMDD
    const filler = padEdgeString('', 32);

    return (recordType + fileFormat + ein + name + dateStr + filler).substring(0, 80);
}

/**
 * Generates the EDGE Employee Record (Type 03).
 * @param {Object} employee 
 * @param {Object} contributions 
 * @param {string} cbaCode 
 * @returns {string} 80-character fixed-width string
 */
function generateEdgeEmployee(employee, contributions, cbaCode) {
    const recordType = EDGE_RECORD_TYPES.EMPLOYEE;
    const ssn = padEdgeString(employee.ssn.replace(/-/g, ''), 9);
    const lastName = padEdgeString(employee.lastName, 20);
    const firstName = padEdgeString(employee.firstName, 15);
    const hours = padEdgeNumber(employee.hoursWorked, 5); // Usually whole hours, padded
    const cba = padEdgeString(cbaCode, 4);
    const totalContrib = padEdgeNumber(contributions.total, 10); // In cents
    const filler = padEdgeString('', 17);

    return (recordType + ssn + lastName + firstName + hours + cba + totalContrib + filler).substring(0, 80);
}

/**
 * Generates the EDGE Trailer Record (Type 04).
 * @param {number} recordCount 
 * @param {number} totalAmount 
 * @returns {string} 80-character fixed-width string
 */
function generateEdgeTrailer(recordCount, totalAmount) {
    const recordType = EDGE_RECORD_TYPES.TRAILER;
    const count = padEdgeNumber(recordCount, 6);
    const total = padEdgeNumber(totalAmount, 12);
    const filler = padEdgeString('', 61);

    return (recordType + count + total + filler).substring(0, 80);
}

/**
 * Delinquency Guardrail: Evaluates if a remittance batch is past due.
 * @param {Date} dueDate 
 * @param {Date} currentDate 
 * @param {string} currentStatus 
 * @returns {{ isDelinquent: boolean, severity: string, daysOverdue: number }}
 */
function checkDelinquency(dueDate, currentDate, currentStatus) {
    if (currentStatus === 'Submitted') {
        return { isDelinquent: false, severity: 'None', daysOverdue: 0 };
    }

    const due = new Date(dueDate);
    const now = new Date(currentDate);
    const diffTime = now.getTime() - due.getTime();
    const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) {
        return { isDelinquent: false, severity: 'None', daysOverdue: 0 };
    }

    let severity = 'Warning';
    if (daysOverdue >= DELINQUENCY_THRESHOLDS.SEVERE) {
        severity = 'Severe';
    } else if (daysOverdue >= DELINQUENCY_THRESHOLDS.CRITICAL) {
        severity = 'Critical';
    }

    return { isDelinquent: true, severity, daysOverdue };
}

module.exports = {
    calculateFringeContributions,
    generateEdgeHeader,
    generateEdgeEmployee,
    generateEdgeTrailer,
    checkDelinquency
};
