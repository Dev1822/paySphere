/**
 * @fileoverview Reconciliation Controller
 * @description Manages payroll register snapshots, variance diffs, and pre-audit sign-offs.
 * Issue: #1761
 */
const mongoose = require('mongoose');
const { PayrollRegisterSnapshot, ReconciliationBatch, VarianceException } = require('../models/payrollReconciliation.model');
const Employee = require('../models/employee.model');
const { diffRegisters } = require('../utils/reconciliationEngine.utils');
const logger = require('../utils/logger');

exports.createSnapshot = async (req, res, next) => {
    try {
        const { payrollRunId, periodMonth, periodYear, lineItems } = req.body;

        const aggregateGross = lineItems.reduce((sum, i) => sum + (i.grossPay || 0), 0);
        const aggregateNet = lineItems.reduce((sum, i) => sum + (i.netPay || 0), 0);

        const snapshot = await PayrollRegisterSnapshot.create({
            payrollRunId,
            periodMonth,
            periodYear,
            lineItems,
            aggregateGross,
            aggregateNet,
            totalEmployees: lineItems.length
        });

        res.status(201).json({ message: 'Payroll register snapshot created', snapshot });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Snapshot for this run already exists.' });
        next(error);
    }
};

/**
 * POST /api/reconciliation/run-diff
 * Compares a pending payroll register against the last finalized snapshot.
 * Expects: { currentRunId, periodMonth, periodYear, currentRegister: [{ employeeId, netPay }] }
 */
exports.runReconciliationDiff = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { currentRunId, periodMonth, periodYear, currentRegister, varianceThreshold } = req.body;
        const threshold = varianceThreshold || 0.10; // Default 10%

        // Fetch the most recent finalized snapshot
        const lastSnapshot = await PayrollRegisterSnapshot.findOne({})
            .sort({ createdAt: -1 }).session(session);

        const previousLineItems = lastSnapshot ? lastSnapshot.lineItems : [];

        // Enrich current register with HRIS status for Ghost Employee Guardrail
        const empIds = currentRegister.map(r => r.employeeId);
        const employees = await Employee.find({
            _id: { $in: empIds }
        }).select('_id status');
        const empMap = new Map(employees.map(e => [e._id.toString(), e.status || 'Active']));

        const enrichedRegister = currentRegister.map(r => ({
            ...r,
            hrisStatus: empMap.get(r.employeeId.toString()) || 'Unknown'
        }));

        const exceptions = diffRegisters(enrichedRegister, previousLineItems, threshold);

        const batch = await ReconciliationBatch.create([{
            currentRunId,
            previousSnapshotId: lastSnapshot?._id,
            periodMonth,
            periodYear,
            totalExceptions: exceptions.length
        }], { session });

        if (exceptions.length > 0) {
            const exceptionDocs = exceptions.map(ex => ({
                batchId: batch[0]._id,
                employeeId: ex.employeeId,
                exceptionType: ex.exceptionType,
                previousNetPay: ex.previousNetPay || 0,
                currentNetPay: ex.currentNetPay || 0,
                varianceAmount: ex.varianceAmount || 0,
                variancePercent: ex.variancePercent || 0,
                hrisStatus: ex.hrisStatus || ''
            }));
            await VarianceException.insertMany(exceptionDocs, { session });
        }

        await session.commitTransaction();
        logger.info(`[Reconciliation] Diff complete. ${exceptions.length} exceptions found.`);
        res.status(201).json({ message: 'Reconciliation diff generated', batch, exceptionCount: exceptions.length });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.resolveException = async (req, res, next) => {
    try {
        const { exceptionId, resolutionNotes } = req.body;
        const exception = await VarianceException.findById(exceptionId);
        if (!exception) return res.status(404).json({ message: 'Exception not found' });

        exception.isResolved = true;
        exception.resolutionNotes = resolutionNotes;
        exception.resolvedBy = req.userId;
        await exception.save();

        // Update batch resolved count
        await ReconciliationBatch.findByIdAndUpdate(exception.batchId, { $inc: { resolvedExceptions: 1 } });

        res.status(200).json({ message: 'Exception resolved', exception });
    } catch (error) { next(error); }
};

exports.signOffBatch = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const batch = await ReconciliationBatch.findById(batchId);
        if (!batch) return res.status(404).json({ message: 'Batch not found' });

        if (batch.resolvedExceptions < batch.totalExceptions) {
            return res.status(400).json({ message: 'Cannot sign off: Unresolved exceptions remain.' });
        }

        batch.status = 'Approved';
        batch.signedOffBy = req.userId;
        batch.signedOffAt = new Date();
        await batch.save();

        res.status(200).json({ message: 'Payroll batch approved and signed off.', batch });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const batches = await ReconciliationBatch.find({})
            .sort({ createdAt: -1 }).limit(10);

        const pendingExceptions = await VarianceException.find({
            isResolved: false
        })
            .populate('employeeId', 'fullName')
            .sort({ createdAt: -1 });

        res.status(200).json({ batches, pendingExceptions });
    } catch (error) { next(error); }
};
