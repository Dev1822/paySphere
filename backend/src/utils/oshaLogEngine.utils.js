/**
 * @fileoverview OSHA Log Engine Utilities
 * @description Evaluates incident recordability, calculates DART rates, 
 * and flags immediate federal reporting requirements.
 * Issue: #1625
 */

/**
 * Evaluates if an incident is OSHA recordable.
 * Generally, incidents requiring medical treatment beyond first aid, or resulting in 
 * days away/restricted work, are recordable.
 * 
 * @param {boolean} isWorkRelated 
 * @param {string} severity 
 * @returns {boolean}
 */
function evaluateRecordability(isWorkRelated, severity) {
    if (!isWorkRelated) return false;

    const nonRecordableSeverities = ['First Aid Only', 'Near Miss'];
    return !nonRecordableSeverities.includes(severity);
}

/**
 * Determines if an incident is a DART (Days Away, Restricted, or Transferred) case.
 * @param {boolean} isRecordable 
 * @param {number} daysAway 
 * @param {number} daysRestricted 
 * @param {number} daysTransferred 
 * @returns {boolean}
 */
function evaluateDARTStatus(isRecordable, daysAway, daysRestricted, daysTransferred) {
    if (!isRecordable) return false;
    return (daysAway > 0 || daysRestricted > 0 || daysTransferred > 0);
}

/**
 * Checks if an incident requires immediate federal reporting to OSHA.
 * - Fatalities must be reported within 8 hours.
 * - Amputations, loss of an eye, or in-patient hospitalizations must be reported within 24 hours.
 * 
 * @param {string} severity 
 * @param {Date} incidentDate 
 * @param {Date} currentDate 
 * @returns {{ requiresReporting: boolean, deadlineHours: number, isOverdue: boolean }}
 */
function checkImmediateReporting(severity, incidentDate, currentDate) {
    let deadlineHours = 0;
    let requiresReporting = false;

    if (severity === 'Fatality') {
        requiresReporting = true;
        deadlineHours = 8;
    } else if (['Amputation/Loss of Eye', 'In-Patient Hospitalization'].includes(severity)) {
        requiresReporting = true;
        deadlineHours = 24;
    }

    let isOverdue = false;
    if (requiresReporting) {
        const hoursSinceIncident = (new Date(currentDate) - new Date(incidentDate)) / (1000 * 60 * 60);
        if (hoursSinceIncident > deadlineHours) {
            isOverdue = true;
        }
    }

    return { requiresReporting, deadlineHours, isOverdue };
}

/**
 * Calculates the DART Rate per 100 Full-Time Employees.
 * Formula: (Total DART Cases / Total Hours Worked by all employees) * 200,000
 * 
 * @param {number} totalDARTCases 
 * @param {number} totalHoursWorked 
 * @returns {number} DART Rate
 */
function calculateDARTRate(totalDARTCases, totalHoursWorked) {
    if (totalHoursWorked <= 0) return 0;
    const rate = (totalDARTCases / totalHoursWorked) * 200000;
    return Math.round(rate * 10) / 10;
}

/**
 * Generates the aggregated data required for the annual OSHA 300A Summary form.
 * @param {Array} incidents - Array of WorkplaceIncident documents for the year
 * @param {number} totalHoursWorked - Total hours worked by all employees in the year
 * @returns {Object} 300A summary data
 */
function generate300ASummary(incidents, totalHoursWorked) {
    let totalRecordable = 0;
    let totalDART = 0;
    let totalDaysAway = 0;
    let totalDaysRestricted = 0;

    for (const inc of incidents) {
        if (inc.isRecordable) {
            totalRecordable++;
            totalDaysAway += inc.daysAway;
            totalDaysRestricted += inc.daysRestricted;

            if (inc.isDART) totalDART++;
        }
    }

    const dartRate = calculateDARTRate(totalDART, totalHoursWorked);

    return {
        totalRecordableCases: totalRecordable,
        totalDARTCases: totalDART,
        totalDaysAway,
        totalDaysRestricted,
        totalHoursWorked,
        dartRate
    };
}

module.exports = {
    evaluateRecordability,
    evaluateDARTStatus,
    checkImmediateReporting,
    calculateDARTRate,
    generate300ASummary
};
