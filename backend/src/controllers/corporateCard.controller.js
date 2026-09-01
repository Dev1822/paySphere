/**
 * @fileoverview Corporate Card Controller
 * @description Manages card assignments, transaction feeds, receipt uploads, 
 * and reconciliation batch processing.
 * Issue: #1566
 */
const mongoose = require('mongoose');
const { CorporateCard, CardTransaction, ReconciliationBatch } = require('../models/corporateCard.model');
const Employee = require('../models/employee.model');
const {
    evaluatePolicyViolations,
    calculateBatchClawbacks,
    generatePayrollDeductions
} = require('../utils/reconciliationEngine.utils');
const logger = require('../utils/logger');

exports.assignCard = async (req, res, next) => {
    try {
        const { employeeId, cardLastFour, cardIssuer, creditLimit, monthlyLimit, receiptGracePeriodDays } = req.body;

        const card = await CorporateCard.create({
            employeeId,
            cardLastFour,
            cardIssuer,
            creditLimit,
            monthlyLimit,
            receiptGracePeriodDays
        });

        res.status(201).json({ message: 'Corporate card assigned', card });
    } catch (error) { next(error); }
};

exports.importTransactions = async (req, res, next) => {
    try {
        const { transactions } = req.body; // Array of raw transaction objects
        const created = [];

        for (const tx of transactions) {
            const card = await CorporateCard.findOne({
                cardLastFour: tx.cardLastFour,
                status: 'Active'
            });

            if (!card) continue;

            // Mock policy rules
            const blockedMCCs = ['7995', '4111']; // Casinos, etc.
            const maxLimit = card.monthlyLimit;

            const flags = evaluatePolicyViolations(tx, blockedMCCs, maxLimit);

            const newTx = await CardTransaction.create({
                cardId: card._id,
                employeeId: card.employeeId,
                externalTransactionId: tx.externalId,
                merchantName: tx.merchant,
                merchantCategoryCode: tx.mcc || '',
                amount: tx.amount,
                transactionDate: new Date(tx.date),
                policyFlags: flags,
                status: flags.length > 0 ? 'Rejected' : 'Pending Receipt'
            });

            created.push(newTx);
        }

        res.status(201).json({ message: `Imported ${created.length} transactions`, created });
    } catch (error) { next(error); }
};

exports.uploadReceipt = async (req, res, next) => {
    try {
        const { transactionId, receiptUrl, notes, isPersonalSpend } = req.body;

        const tx = await CardTransaction.findOne({
            _id: transactionId
        });
        if (!tx) return res.status(404).json({ message: 'Transaction not found' });

        tx.receiptUrl = receiptUrl;
        tx.receiptUploadedAt = new Date();
        tx.notes = notes || tx.notes;
        tx.isPersonalSpend = isPersonalSpend || false;

        if (tx.isPersonalSpend) {
            tx.status = 'Clawback Initiated';
        } else if (tx.policyFlags.length === 0) {
            tx.status = 'Approved';
        }

        await tx.save();
        res.status(200).json({ message: 'Receipt uploaded and transaction updated', tx });
    } catch (error) { next(error); }
};

exports.runReconciliationBatch = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { periodStart, periodEnd } = req.body;
        const start = new Date(periodStart);
        const end = new Date(periodEnd);

        // Fetch all pending or rejected transactions in the period
        const transactions = await CardTransaction.find({
            transactionDate: { $gte: start, $lte: end },
            status: { $in: ['Pending Receipt', 'Rejected', 'Clawback Initiated'] }
        }).session(session);

        // Get grace period from the first transaction's card (simplified)
        let gracePeriod = 7;
        if (transactions.length > 0) {
            const card = await CorporateCard.findById(transactions[0].cardId);
            if (card) gracePeriod = card.receiptGracePeriodDays;
        }

        const { clawbackItems, totalClawback } = calculateBatchClawbacks(transactions, gracePeriod, new Date());

        if (clawbackItems.length === 0) {
            await session.abortTransaction();
            return res.status(200).json({ message: 'No transactions require clawback for this period.' });
        }

        const batch = await ReconciliationBatch.create([{
            periodStart: start,
            periodEnd: end,
            totalClawbackAmount: totalClawback,
            transactionCount: clawbackItems.length,
            status: 'Draft'
        }], { session });

        // Update transactions to link to this batch
        const txIds = clawbackItems.map(i => i.transactionId);
        await CardTransaction.updateMany(
            { _id: { $in: txIds } },
            { $set: { reconciliationBatchId: batch[0]._id, status: 'Clawback Initiated' } },
            { session }
        );

        await session.commitTransaction();
        logger.info(`[Reconciliation] Batch ${batch[0]._id} created with ${totalClawback} clawback.`);
        res.status(201).json({ message: 'Reconciliation batch created', batch, clawbackItems });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.injectClawbacksToPayroll = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const batch = await ReconciliationBatch.findById(batchId);
        if (!batch || batch.status !== 'Draft') {
            return res.status(400).json({ message: 'Batch not found or already processed.' });
        }

        const transactions = await CardTransaction.find({ reconciliationBatchId: batchId });
        const { clawbackItems } = calculateBatchClawbacks(transactions, 7, new Date());
        const payrollDeductions = generatePayrollDeductions(clawbackItems);

        // In a real system, this would push to the PayrollUpdate model
        batch.status = 'Injected to Payroll';
        batch.processedBy = req.userId;
        await batch.save();

        await CardTransaction.updateMany(
            { reconciliationBatchId: batchId },
            { $set: { status: 'Clawed Back' } }
        );

        res.status(200).json({ message: 'Clawbacks injected into payroll', payrollDeductions });
    } catch (error) { next(error); }
};

exports.getMyTransactions = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const transactions = await CardTransaction.find({
            employeeId: employee._id
        })
            .sort({ transactionDate: -1 }).limit(100);

        res.status(200).json({ transactions });
    } catch (error) { next(error); }
};
