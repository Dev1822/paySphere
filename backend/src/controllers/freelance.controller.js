/**
 * @fileoverview Freelance Escrow Controller
 * @description Manages contract creation, escrow funding, milestone submissions, and approvals.
 * Issue: #1367
 */
const mongoose = require('mongoose');
const { FreelanceContract, EscrowLedger, MilestoneDeliverable } = require('../models/freelance.model');
const { checkBudgetGuardrail, calculateReleaseDeductions, validateEscrowSufficiency } = require('../utils/escrowEngine.utils');
const logger = require('../utils/logger');

exports.createContract = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { contractorId, contractorName, title, department, totalBudget, platformFeeRate, withholdingTaxRate } = req.body;

        // Check Budget Guardrail
        const currentSpend = await FreelanceContract.aggregate([
            { $match: {
                department,
                status: { $in: ['Funded', 'In Progress'] }
            } },
            { $group: { _id: null, total: { $sum: '$totalBudget' } } }
        ]);
        const currentDepartmentSpend = currentSpend.length > 0 ? currentSpend[0].total : 0;
        const deptLimit = req.body.departmentBudgetLimit || 1000000;

        const guardrail = checkBudgetGuardrail(totalBudget, currentDepartmentSpend, deptLimit);
        if (!guardrail.isAllowed) {
            await session.abortTransaction();
            return res.status(400).json({ message: guardrail.message });
        }

        const contract = await FreelanceContract.create([{
            contractorId,
            contractorName,
            title,
            department,
            totalBudget,
            platformFeeRate: platformFeeRate || 0.025,
            withholdingTaxRate: withholdingTaxRate || 0.10,
            departmentBudgetLimit: deptLimit,
            createdBy: req.userId
        }], { session });

        await session.commitTransaction();
        res.status(201).json({ message: 'Contract created', contract: contract[0] });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.fundEscrow = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { contractId, amount } = req.body;
        const contract = await FreelanceContract.findById(contractId).session(session);
        if (!contract) throw new Error('Contract not found');

        if (contract.fundedAmount + amount > contract.totalBudget) {
            throw new Error('Funding amount exceeds total contract budget.');
        }

        contract.fundedAmount += amount;
        contract.lockedAmount += amount;
        if (contract.status === 'Draft') contract.status = 'Funded';
        await contract.save({ session });

        await EscrowLedger.create([{
            contractId: contract._id,
            transactionType: 'Initial Funding',
            amount: amount,
            balanceAfter: contract.lockedAmount,
            description: 'Escrow funded by Finance',
            processedBy: req.userId
        }], { session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Escrow funded successfully', contract });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.approveMilestone = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { milestoneId, approvalNotes } = req.body;
        const milestone = await MilestoneDeliverable.findById(milestoneId).session(session);
        if (!milestone || milestone.status !== 'Submitted') {
            throw new Error('Milestone not found or not in Submitted state.');
        }

        const contract = await FreelanceContract.findById(milestone.contractId).session(session);
        const sufficiency = validateEscrowSufficiency(contract, milestone.amount);
        if (!sufficiency.isSufficient) throw new Error(sufficiency.message);

        // Calculate deductions
        const deductions = calculateReleaseDeductions(milestone.amount, contract.platformFeeRate, contract.withholdingTaxRate);

        // Update contract balances
        contract.lockedAmount -= milestone.amount;
        contract.releasedAmount += deductions.netPayout;
        await contract.save({ session });

        // Update milestone
        milestone.status = 'Paid';
        milestone.approvalNotes = approvalNotes || '';
        milestone.approvedBy = req.userId;
        milestone.approvedAt = new Date();
        await milestone.save({ session });

        // Ledger entries
        await EscrowLedger.create([
            {
                contractId: contract._id,
                transactionType: 'Milestone Release',
                amount: -deductions.netPayout,
                balanceAfter: contract.lockedAmount,
                description: `Net payout for ${milestone.title}`,
                processedBy: req.userId
            },
            {
                contractId: contract._id,
                transactionType: 'Fee Deduction',
                amount: -deductions.platformFee,
                balanceAfter: contract.lockedAmount,
                description: `Platform fee (${contract.platformFeeRate * 100}%)`,
                processedBy: req.userId
            }
        ], { session });

        await session.commitTransaction();
        logger.info(`[Escrow] Released ${deductions.netPayout} for milestone ${milestoneId}`);
        res.status(200).json({ message: 'Milestone approved and funds released', milestone, deductions });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getContracts = async (req, res, next) => {
    try {
        const contracts = await FreelanceContract.find({}).sort({ createdAt: -1 });
        res.status(200).json({ contracts });
    } catch (error) { next(error); }
};

exports.getLedger = async (req, res, next) => {
    try {
        const ledger = await EscrowLedger.find({
            contractId: req.params.contractId
        }).sort({ createdAt: -1 });
        res.status(200).json({ ledger });
    } catch (error) { next(error); }
};
