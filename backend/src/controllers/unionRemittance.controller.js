/**
 * @fileoverview Union Remittance Controller
 * @description Manages CBA configurations, fringe calculations, and EDGE file generation.
 * Issue: #2009
 */
const mongoose = require('mongoose');
const { UnionContract, FringeBenefitFund, RemittanceBatch } = require('../models/unionRemittance.model');
const Employee = require('../models/employee.model'); // Assuming exists
const {
    calculateFringeContributions,
    generateEdgeHeader,
    generateEdgeEmployee,
    generateEdgeTrailer,
    checkDelinquency
} = require('../utils/meppRemittanceEngine.utils');
const logger = require('../utils/logger');

exports.saveContract = async (req, res, next) => {
    try {
        const { cbaCode, unionName, localNumber, effectiveFrom, remittanceDueDay, fringeRates } = req.body;

        const contract = await UnionContract.findOneAndUpdate(
            { tenantId: req.tenantId, cbaCode: cbaCode.toUpperCase() },
            {
                tenantId: req.tenantId, cbaCode: cbaCode.toUpperCase(), unionName, localNumber,
                effectiveFrom: new Date(effectiveFrom), remittanceDueDay, fringeRates
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Union contract saved', contract });
    } catch (error) { next(error); }
};

exports.processMonthlyRemittance = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { cbaCode, periodMonth, periodYear, employeeHours } = req.body;
        // employeeHours: [{ employeeId, ssn, firstName, lastName, hoursWorked, classification }]

        const contract = await UnionContract.findOne({ tenantId: req.tenantId, cbaCode: cbaCode.toUpperCase() }).session(session);
        if (!contract) throw new Error('CBA not found.');

        // Calculate due date (e.g., 15th of the following month)
        const dueDate = new Date(periodYear, periodMonth, contract.remittanceDueDay); // month is 0-indexed, so periodMonth (1-12) acts as next month

        let totalHours = 0;
        let totalContributions = 0;
        let edgeContent = '';

        // Mock Employer Data for EDGE Header
        const employerData = { ein: '12-3456789', name: 'PaySphere Construction Inc' };
        const processingDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        edgeContent += generateEdgeHeader(employerData, processingDate) + '\n';

        for (const emp of employeeHours) {
            const cbaRates = contract.fringeRates.find(r => r.classification === emp.classification);
            if (!cbaRates) continue;

            const contribs = calculateFringeContributions(emp.hoursWorked, cbaRates);
            totalHours += emp.hoursWorked;
            totalContributions += contribs.total;

            edgeContent += generateEdgeEmployee(emp, contribs, contract.cbaCode) + '\n';
        }

        edgeContent += generateEdgeTrailer(employeeHours.length, totalContributions) + '\n';

        const batch = await RemittanceBatch.findOneAndUpdate(
            { tenantId: req.tenantId, cbaCode: contract.cbaCode, periodMonth, periodYear },
            {
                totalHoursWorked: totalHours, totalFringeContributions: totalContributions,
                edgeFileContent: edgeContent, edgeFileName: `EDGE_${contract.cbaCode}_${periodYear}${String(periodMonth).padStart(2, '0')}.txt`,
                dueDate, status: 'Generated', generatedBy: req.userId
            },
            { upsert: true, new: true, session }
        );

        await session.commitTransaction();
        logger.info(`[MEPP] Generated EDGE file for ${contract.cbaCode} (${periodMonth}/${periodYear})`);
        res.status(201).json({ message: 'Remittance batch generated', batch });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.runDelinquencyAudit = async (req, res, next) => {
    try {
        const openBatches = await RemittanceBatch.find({
            tenantId: req.tenantId,
            status: { $in: ['Draft', 'Generated'] }
        });

        let alerts = 0;
        for (const batch of openBatches) {
            const check = checkDelinquency(batch.dueDate, new Date(), batch.status);
            if (check.isDelinquent) {
                batch.status = 'Delinquent';
                await batch.save();
                alerts++;
                logger.error(`[MEPP] Delinquency Alert: ${batch.cbaCode} for ${batch.periodMonth}/${batch.periodYear} is ${check.daysOverdue} days overdue. Severity: ${check.severity}`);
            }
        }

        res.status(200).json({ message: 'Delinquency audit complete', alertsTriggered: alerts });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const contracts = await UnionContract.find({ tenantId: req.tenantId, isActive: true }).sort({ cbaCode: 1 });
        const batches = await RemittanceBatch.find({ tenantId: req.tenantId }).sort({ periodYear: -1, periodMonth: -1 }).limit(20);

        // Enrich batches with delinquency status
        const enrichedBatches = batches.map(b => {
            const check = checkDelinquency(b.dueDate, new Date(), b.status);
            return { ...b.toObject(), delinquency: check };
        });

        res.status(200).json({ contracts, batches: enrichedBatches });
    } catch (error) { next(error); }
};
