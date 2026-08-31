/**
 * @fileoverview Eligibility Controller
 * @description Manages I-9 records, document expirations, and E-Verify cases.
 * Issue: #1621
 */
const { I9Record, EmploymentAuthorization } = require('../models/employmentEligibility.model');
const Employee = require('../models/employee.model');
const { evaluateExpirationWindow, validatePayrollClearance } = require('../utils/i9ComplianceEngine.utils');
const logger = require('../utils/logger');

exports.initiateI9 = async (req, res, next) => {
    try {
        const { employeeId } = req.body;
        const record = await I9Record.findOneAndUpdate(
            {
                employeeId
            },
            { $setOnInsert: {
                employeeId
            } },
            { upsert: true, new: true }
        );
        res.status(201).json({ message: 'I-9 initiated', record });
    } catch (error) { next(error); }
};

exports.completeSection1 = async (req, res, next) => {
    try {
        const { employeeId } = req.body;
        const record = await I9Record.findOne({
            employeeId
        });
        if (!record) return res.status(404).json({ message: 'I-9 record not found' });

        record.section1Completed = true;
        record.section1Date = new Date();
        await record.save();

        res.status(200).json({ message: 'Section 1 completed', record });
    } catch (error) { next(error); }
};

exports.verifySection2 = async (req, res, next) => {
    try {
        const { employeeId } = req.body;
        const record = await I9Record.findOne({
            employeeId
        });
        if (!record) return res.status(404).json({ message: 'I-9 record not found' });

        record.section2Completed = true;
        record.section2Date = new Date();
        record.section2VerifiedBy = req.userId;

        // Apply Guardrail
        const clearance = validatePayrollClearance(record);
        record.isClearedForPayroll = clearance.isCleared;
        await record.save();

        // Update main employee record if cleared
        if (clearance.isCleared) {
            await Employee.findByIdAndUpdate(employeeId, { onboardingStatus: 'Active' });
        }

        res.status(200).json({ message: 'Section 2 verified', record, clearance });
    } catch (error) { next(error); }
};

exports.addAuthorizationDocument = async (req, res, next) => {
    try {
        const { employeeId, documentType, documentNumber, expirationDate } = req.body;

        const auth = await EmploymentAuthorization.create({
            employeeId,
            documentType,
            documentNumber,
            expirationDate
        });

        res.status(201).json({ message: 'Authorization document added', auth });
    } catch (error) { next(error); }
};

exports.runDailyComplianceScan = async (req, res, next) => {
    try {
        const today = new Date();
        const authorizations = await EmploymentAuthorization.find({
            reverificationStatus: { $in: ['Valid', 'Expiring Soon'] }
        });

        let alertsTriggered = 0;

        for (const auth of authorizations) {
            const evaluation = evaluateExpirationWindow(auth.expirationDate, today);

            if (evaluation.status !== auth.reverificationStatus) {
                auth.reverificationStatus = evaluation.status;
                if (evaluation.requiresReverification && !auth.alertTriggered) {
                    auth.alertTriggered = true;
                    alertsTriggered++;
                    logger.warn(`[I9] Reverification required for Employee ${auth.employeeId} (${auth.documentType})`);
                }
                await auth.save();
            }
        }

        res.status(200).json({ message: 'Daily compliance scan complete', alertsTriggered });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const pendingSection2 = await I9Record.find({
            section2Completed: false
        })
            .populate('employeeId', 'fullName department');

        const expiringDocs = await EmploymentAuthorization.find({
            reverificationStatus: { $in: ['Expiring Soon', 'Expired'] }
        }).populate('employeeId', 'fullName');

        res.status(200).json({ pendingSection2, expiringDocs });
    } catch (error) { next(error); }
};
