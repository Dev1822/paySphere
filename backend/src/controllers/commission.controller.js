/**
 * @fileoverview Commission Controller
 * @description Manages commission plans, quota attainment calculations, and clawbacks.
 * Issue: #1472
 */
const { CommissionPlan, QuotaAttainment, DrawLedger, Clawback } = require('../models/commission.model');
const Employee = require('../models/employee.model');
const { calculateCommission, processDrawRecovery, processClawback } = require('../utils/commissionEngine.utils');
const logger = require('../utils/logger');

exports.createPlan = async (req, res, next) => {
    try {
        const plan = await CommissionPlan.create({
            ...req.body
        });
        res.status(201).json({ message: 'Commission plan created', plan });
    } catch (error) { next(error); }
};

exports.recordRevenue = async (req, res, next) => {
    try {
        const { employeeId, periodMonth, periodYear, revenueBooked } = req.body;

        // Find active plan for this employee (simplified: just get the latest active plan)
        const plan = await CommissionPlan.findOne({
            isActive: true
        }).sort({ effectiveFrom: -1 });
        if (!plan) return res.status(400).json({ message: 'No active commission plan found.' });

        const calc = calculateCommission(revenueBooked, plan.quotaAmount, plan.baseCommissionRate, plan.accelerators);

        // Fetch current draw balance
        const lastLedger = await DrawLedger.findOne({
            employeeId
        }).sort({ createdAt: -1 });
        const currentDrawBalance = lastLedger ? lastLedger.balanceAfter : 0;

        // Process draw recovery
        const drawResult = processDrawRecovery(calc.totalCommission, currentDrawBalance);

        const attainment = await QuotaAttainment.findOneAndUpdate(
            { employeeId, periodMonth, periodYear },
            {
                planId: plan._id,
                revenueBooked,
                quotaTarget: plan.quotaAmount,
                attainmentPercentage: calc.attainment,
                calculatedCommission: drawResult.netPayout,
                status: 'Calculated'
            },
            { upsert: true, new: true }
        );

        // Record draw offset in ledger if applicable
        if (drawResult.drawOffset > 0) {
            await DrawLedger.create({
                employeeId,
                transactionType: 'Commission Offset',
                amount: -drawResult.drawOffset,
                balanceAfter: drawResult.newDrawBalance,
                referenceId: attainment._id,
                description: `Offset against ${periodMonth}/${periodYear} commission`
            });
        }

        res.status(200).json({ message: 'Revenue recorded and commission calculated', attainment, drawResult });
    } catch (error) { next(error); }
};

exports.issueDrawAdvance = async (req, res, next) => {
    try {
        const { employeeId, amount } = req.body;
        const lastLedger = await DrawLedger.findOne({
            employeeId
        }).sort({ createdAt: -1 });
        const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;
        const newBalance = currentBalance + amount;

        await DrawLedger.create({
            employeeId,
            transactionType: 'Draw Advance',
            amount,
            balanceAfter: newBalance,
            description: 'Monthly recoverable draw advance'
        });

        res.status(201).json({ message: 'Draw advance issued', newBalance });
    } catch (error) { next(error); }
};

exports.processClawback = async (req, res, next) => {
    try {
        const { employeeId, originalAttainmentId, dealName, clawbackAmount, reason } = req.body;

        const lastLedger = await DrawLedger.findOne({
            employeeId
        }).sort({ createdAt: -1 });
        const currentBalance = lastLedger ? lastLedger.balanceAfter : 0;

        const clawbackResult = processClawback(clawbackAmount, currentBalance);

        const clawback = await Clawback.create({
            employeeId,
            originalAttainmentId,
            dealName,
            clawbackAmount,
            reason,
            status: clawbackResult.requiresPayrollDeduction ? 'Recovered via Payroll' : 'Recovered via Draw'
        });

        // Add to draw ledger
        await DrawLedger.create({
            employeeId,
            transactionType: 'Clawback',
            amount: clawbackAmount,
            balanceAfter: clawbackResult.newDrawBalance,
            referenceId: clawback._id,
            description: `Clawback for ${dealName} (${reason})`
        });

        logger.warn(`[Commission] Clawback of ${clawbackAmount} processed for employee ${employeeId}`);
        res.status(201).json({ message: 'Clawback processed', clawback, clawbackResult });
    } catch (error) { next(error); }
};

exports.getMyDashboard = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const attainments = await QuotaAttainment.find({
            employeeId: employee._id
        })
            .populate('planId', 'name quotaAmount')
            .sort({ periodYear: -1, periodMonth: -1 }).limit(12);

        const lastLedger = await DrawLedger.findOne({
            employeeId: employee._id
        }).sort({ createdAt: -1 });
        const drawBalance = lastLedger ? lastLedger.balanceAfter : 0;

        const clawbacks = await Clawback.find({
            employeeId: employee._id,
            status: 'Pending Recovery'
        });

        res.status(200).json({ attainments, drawBalance, clawbacks });
    } catch (error) { next(error); }
};
