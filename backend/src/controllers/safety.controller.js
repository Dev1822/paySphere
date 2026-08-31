/**
 * @fileoverview Safety Controller
 * @description Manages workplace incidents, OSHA classifications, and 300A summaries.
 * Issue: #1625
 */
const { WorkplaceIncident, DARTLedger } = require('../models/workplaceSafety.model');
const Employee = require('../models/employee.model');
const {
    evaluateRecordability, evaluateDARTStatus, checkImmediateReporting, generate300ASummary
} = require('../utils/oshaLogEngine.utils');
const logger = require('../utils/logger');

exports.logIncident = async (req, res, next) => {
    try {
        const {
            employeeId, incidentDate, description, location, isWorkRelated,
            severity, daysAway, daysRestricted, daysTransferred
        } = req.body;

        const isRecordable = evaluateRecordability(isWorkRelated, severity);
        const isDART = evaluateDARTStatus(isRecordable, daysAway, daysRestricted, daysTransferred);
        const reportingCheck = checkImmediateReporting(severity, new Date(incidentDate), new Date());

        const incident = await WorkplaceIncident.create({
            employeeId,
            incidentDate: new Date(incidentDate),
            description,
            location,
            isWorkRelated,
            severity,
            isRecordable,
            isDART,
            daysAway,
            daysRestricted,
            daysTransferred,
            requiresImmediateReporting: reportingCheck.requiresReporting
        });

        if (reportingCheck.isOverdue) {
            logger.error(`[OSHA] OVERDUE: Incident ${incident._id} missed the ${reportingCheck.deadlineHours}-hour reporting deadline!`);
        }

        res.status(201).json({ message: 'Incident logged', incident, reportingCheck });
    } catch (error) { next(error); }
};

exports.updateIncidentStatus = async (req, res, next) => {
    try {
        const { incidentId, status, reportedToOSHA } = req.body;
        const incident = await WorkplaceIncident.findById(incidentId);
        if (!incident) return res.status(404).json({ message: 'Incident not found' });

        incident.status = status;
        if (reportedToOSHA) {
            incident.reportedToOSHA = true;
            incident.reportedAt = new Date();
        }

        await incident.save();
        res.status(200).json({ message: 'Incident updated', incident });
    } catch (error) { next(error); }
};

exports.generate300A = async (req, res, next) => {
    try {
        const { year, totalHoursWorked } = req.body;

        const incidents = await WorkplaceIncident.find({
            incidentDate: {
                $gte: new Date(`${year}-01-01`),
                $lte: new Date(`${year}-12-31`)
            }
        });

        const summary = generate300ASummary(incidents, totalHoursWorked);

        // Upsert the annual ledger
        const ledger = await DARTLedger.findOneAndUpdate(
            {
                year
            },
            { ...summary },
            { upsert: true, new: true }
        );

        logger.info(`[OSHA] Generated 300A summary for ${year}. DART Rate: ${summary.dartRate}`);
        res.status(200).json({ message: 'OSHA 300A summary generated', ledger });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const currentYear = new Date().getFullYear();

        const recentIncidents = await WorkplaceIncident.find({})
            .populate('employeeId', 'fullName department')
            .sort({ incidentDate: -1 }).limit(50);

        const ledger = await DARTLedger.findOne({
            year: currentYear
        });

        // Calculate overdue alerts
        const overdueAlerts = recentIncidents.filter(inc => {
            if (!inc.requiresImmediateReporting || inc.reportedToOSHA) return false;
            const check = checkImmediateReporting(inc.severity, inc.incidentDate, new Date());
            return check.isOverdue;
        });

        res.status(200).json({ recentIncidents, ledger, overdueAlerts });
    } catch (error) { next(error); }
};
