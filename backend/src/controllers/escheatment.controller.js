/**
 * @fileoverview Escheatment Controller
 * @description Manages uncashed checks, dormancy audits, due diligence, and NAUPA generation.
 * Issue: #2013
 */
const mongoose = require('mongoose');
const { UncashedPayrollCheck, DueDiligenceLog, EscheatmentBatch } = require('../models/escheatment.model');
const Employee = require('../models/employee.model'); // Assuming exists
const {
    checkStopPaymentGuardrail, evaluateDueDiligence,
    generateNAUPAHeader, generateNAUPAPropertyRecord, generateNAUPATrailer
} = require('../utils/escheatmentEngine.utils');
const { calculateDormancy } = require('../constants/escheatment.constants');
const logger = require('../utils/logger');

exports.ingestUncashedCheck = async (req, res, next) => {
    try {
        const { employeeId, checkNumber, issueDate, amount, propertyType } = req.body;

        const employee = await Employee.findById(employeeId);
        if (!employee) return res.status(404).json({ message: 'Employee not found.' });

        const state = employee.state || 'CA'; // Default to CA if missing
        const dormancy = calculateDormancy(issueDate, state);

        const check = await UncashedPayrollCheck.create({
            tenantId: req.tenantId, employeeId, checkNumber, issueDate: new Date(issueDate),
            amount, propertyType: propertyType || 'MS05',
            lastKnownState: state, lastKnownAddress: employee.address || 'Unknown',
            lastKnownZip: employee.zip || '00000', dormancyDate: dormancy.dormancyDate
        });

        res.status(201).json({ message: 'Uncashed check ingested', check, dormancy });
    } catch (error) { next(error); }
};

exports.runDormancyAudit = async (req, res, next) => {
    try {
        const outstandingChecks = await UncashedPayrollCheck.find({
            tenantId: req.tenantId, status: { $in: ['Outstanding', 'Due Diligence Sent'] }
        }).populate('employeeId');

        let stopPayments = 0;
        let dueDiligenceLetters = 0;
        let dormantChecks = 0;

        for (const check of outstandingChecks) {
            const dormancy = calculateDormancy(check.issueDate, check.lastKnownState);
            check.isDormant = dormancy.isDormant;

            // Stop-Payment Guardrail
            const stopCheck = checkStopPaymentGuardrail(dormancy.daysRemaining);
            if (stopCheck.requiresStopPayment && !check.stopPaymentRequested) {
                check.stopPaymentRequested = true;
                check.status = 'Stop Payment Issued';
                stopPayments++;
                logger.warn(`[Escheatment] Stop-Payment Guardrail: Check #${check.checkNumber} requires stop payment.`);
            }

            // Due Diligence Evaluation
            const letterSent = await DueDiligenceLog.findOne({ checkId: check._id });
            const ddEval = evaluateDueDiligence(dormancy.daysRemaining, check.lastKnownState, !!letterSent);

            if (ddEval.requiresLetter) {
                await DueDiligenceLog.create({
                    tenantId: req.tenantId, checkId: check._id, letterSentDate: new Date()
                });
                check.status = 'Due Diligence Sent';
                dueDiligenceLetters++;
            }

            if (dormancy.isDormant) {
                dormantChecks++;
            }

            await check.save();
        }

        res.status(200).json({
            message: 'Dormancy audit complete',
            stopPayments, dueDiligenceLetters, dormantChecks
        });
    } catch (error) { next(error); }
};

exports.generateNAUPAFile = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { stateCode, reportingYear } = req.body;

        const dormantChecks = await UncashedPayrollCheck.find({
            tenantId: req.tenantId, lastKnownState: stateCode.toUpperCase(),
            isDormant: true, status: { $nin: ['Escheated to State', 'Cashed', 'Voided'] }
        }).populate('employeeId').session(session);

        if (dormantChecks.length === 0) {
            throw new Error(`No dormant checks found for ${stateCode} in ${reportingYear}.`);
        }

        // Mock Company Data for NAUPA Header
        const companyData = {
            name: 'PaySphere Global Inc', ein: '12-3456789',
            address: '100 Corporate Blvd', city: 'New York', state: 'NY', zip: '10001',
            contactName: 'Jane Doe', contactPhone: '555-019-8372'
        };

        let naupaContent = generateNAUPAHeader(companyData, reportingYear) + '\n';
        let totalAmount = 0;

        for (const check of dormantChecks) {
            naupaContent += generateNAUPAPropertyRecord(check, check.employeeId) + '\n';
            totalAmount += check.amount;

            check.status = 'Escheated to State';
            await check.save({ session });
        }

        naupaContent += generateNAUPATrailer(dormantChecks.length, totalAmount) + '\n';

        const fileName = `NAUPA_${stateCode}_${reportingYear}_${companyData.ein}.txt`;

        const batch = await EscheatmentBatch.findOneAndUpdate(
            { tenantId: req.tenantId, stateCode: stateCode.toUpperCase(), reportingYear },
            {
                totalChecks: dormantChecks.length, totalAmount, naupaFileContent, naupaFileName: fileName,
                status: 'Draft', generatedBy: req.userId
            },
            { upsert: true, new: true, session }
        );

        await session.commitTransaction();
        logger.info(`[Escheatment] Generated NAUPA file for ${stateCode} with ${dormantChecks.length} records.`);
        res.status(201).json({ message: 'NAUPA file generated', batch });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const checks = await UncashedPayrollCheck.find({ tenantId: req.tenantId })
            .populate('employeeId', 'fullName').sort({ issueDate: 1 });

        const batches = await EscheatmentBatch.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(10);

        // Enrich checks with dormancy data
        const enrichedChecks = checks.map(c => {
            const dormancy = calculateDormancy(c.issueDate, c.lastKnownState);
            const stopCheck = checkStopPaymentGuardrail(dormancy.daysRemaining);
            return { ...c.toObject(), dormancy, stopPaymentGuardrail: stopCheck };
        });

        res.status(200).json({ checks: enrichedChecks, batches });
    } catch (error) { next(error); }
};
