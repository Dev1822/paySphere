/**
 * @fileoverview PTO Controller
 * @description Manages PTO policies, state compliance rules, and accrual processing.
 * Issue: #1730
 */
const mongoose = require('mongoose');
const { PTOComplianceRule, PTOPolicy, AccrualLedger } = require('../models/ptoCompliance.model');
const Employee = require('../models/employee.model');
const {
    getAnnualAccrualRate, calculatePerPaycheckAccrual,
    enforceAccrualCap, calculateTerminationPayout
} = require('../utils/ptoAccrualEngine.utils');
const logger = require('../utils/logger');

exports.createComplianceRule = async (req, res, next) => {
    try {
        const rule = await PTOComplianceRule.findOneAndUpdate(
            {
                stateCode: req.body.stateCode.toUpperCase()
            },
            {
                ...req.body,
                stateCode: req.body.stateCode.toUpperCase()
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Compliance rule saved', rule });
    } catch (error) { next(error); }
};

exports.createPolicy = async (req, res, next) => {
    try {
        const policy = await PTOPolicy.create({
            ...req.body
        });
        res.status(201).json({ message: 'PTO policy created', policy });
    } catch (error) { next(error); }
};

exports.runAccrualBatch = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { policyId, paychecksPerYear, payrollRunId } = req.body;
        const policy = await PTOPolicy.findById(policyId).session(session);
        if (!policy) throw new Error('PTO Policy not found');

        // Fetch all active employees assigned to this policy (simplified: all active employees)
        const employees = await Employee.find({
            isActive: true
        }).session(session);
        const ledgers = [];
        let cappedCount = 0;

        for (const emp of employees) {
            const tenureYears = emp.joiningDate
                ? (new Date() - new Date(emp.joiningDate)) / (1000 * 60 * 60 * 24 * 365.25)
                : 0;

            const annualRate = getAnnualAccrualRate(tenureYears, policy.tiers);
            const proposedAccrual = calculatePerPaycheckAccrual(annualRate, paychecksPerYear || 26);

            // Get current balance
            const lastLedger = await AccrualLedger.findOne({
                employeeId: emp._id
            })
                .sort({ processedAt: -1 }).session(session);
            const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;

            // Get state rule
            const stateRule = await PTOComplianceRule.findOne({
                stateCode: emp.workState || 'NY'
            }).session(session);

            const capCheck = enforceAccrualCap(currentBalance, proposedAccrual, annualRate, stateRule);
            if (capCheck.capped) cappedCount++;

            if (capCheck.actualAccrual > 0) {
                const newBalance = Math.round((currentBalance + capCheck.actualAccrual) * 1000) / 1000;

                const ledger = await AccrualLedger.create([{
                    employeeId: emp._id,
                    policyId: policy._id,
                    transactionType: 'Accrual',
                    hours: capCheck.actualAccrual,
                    balanceAfter: newBalance,
                    reason: capCheck.reason,
                    payrollRunId
                }], { session });

                ledgers.push(ledger[0]);
            }
        }

        await session.commitTransaction();
        logger.info(`[PTO] Processed ${ledgers.length} accruals. ${cappedCount} employees hit state caps.`);
        res.status(200).json({ message: 'Accrual batch processed', processed: ledgers.length, cappedCount });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.processTerminationPayout = async (req, res, next) => {
    try {
        const { employeeId, hourlyRate } = req.body;
        const employee = await Employee.findById(employeeId);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const lastLedger = await AccrualLedger.findOne({
            employeeId
        }).sort({ processedAt: -1 });
        const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;

        const stateRule = await PTOComplianceRule.findOne({
            stateCode: employee.workState || 'NY'
        });

        const payout = calculateTerminationPayout(currentBalance, hourlyRate, stateRule);

        if (payout.requiresPayout) {
            await AccrualLedger.create({
                employeeId,
                policyId: lastLedger?.policyId,
                transactionType: 'Termination Payout',
                hours: -payout.payoutHours,
                balanceAfter: 0,
                reason: payout.reason
            });
        }

        res.status(200).json({ message: 'Termination payout evaluated', payout });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const rules = await PTOComplianceRule.find({}).sort({ stateCode: 1 });
        const policies = await PTOPolicy.find({});
        res.status(200).json({ rules, policies });
    } catch (error) { next(error); }
};
