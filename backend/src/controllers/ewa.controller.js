/**
 * @fileoverview EWA Controller
 * @description Manages daily accruals, withdrawal requests, and payday reconciliation batches.
 * Issue: #1569
 */
const mongoose = require('mongoose');
const { EWAConfig, EWAAccrual, WithdrawalRequest, PaydayReconciliation } = require('../models/earnedWageAccess.model');
const Employee = require('../models/employee.model');
const {
    calculateAvailableBalance,
    calculateDailyAccrual,
    validateWithdrawalRequest,
    generatePayrollOffsets
} = require('../utils/ewaAccrualEngine.utils');
const logger = require('../utils/logger');

exports.getMyBalance = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const config = await EWAConfig.findOne({
            isActive: true
        });
        if (!config || !config.isEnabled) return res.status(403).json({ message: 'EWA is not currently enabled for your company.' });

        // Find current pay period (simplified: current month)
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const accruals = await EWAAccrual.find({
            employeeId: employee._id,
            accrualDate: { $gte: periodStart, $lte: periodEnd }
        }).sort({ accrualDate: 1 });

        const cumulativeNetAccrued = accruals.reduce((sum, a) => sum + a.netDailyAccrual, 0);

        const fundedWithdrawals = await WithdrawalRequest.find({
            employeeId: employee._id,
            status: 'Funded',
            createdAt: { $gte: periodStart, $lte: periodEnd }
        });

        const totalFunded = fundedWithdrawals.reduce((sum, w) => sum + w.requestedAmount, 0);
        const withdrawalCount = fundedWithdrawals.length;

        const availableBalance = calculateAvailableBalance(cumulativeNetAccrued, totalFunded, config.maxAccrualPercentage);

        res.status(200).json({
            cumulativeGross: accruals.reduce((sum, a) => sum + a.grossDailyEarnings, 0),
            cumulativeNetAccrued,
            totalWithdrawn: totalFunded,
            availableBalance,
            withdrawalCount,
            maxWithdrawals: config.maxWithdrawalsPerPeriod,
            transactionFee: config.transactionFee
        });
    } catch (error) { next(error); }
};

exports.requestWithdrawal = async (req, res, next) => {
    try {
        const { requestedAmount } = req.body;
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const config = await EWAConfig.findOne({
            isActive: true
        });

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const accruals = await EWAAccrual.find({
            employeeId: employee._id,
            accrualDate: { $gte: periodStart, $lte: periodEnd }
        });
        const cumulativeNetAccrued = accruals.reduce((sum, a) => sum + a.netDailyAccrual, 0);

        const fundedWithdrawals = await WithdrawalRequest.find({
            employeeId: employee._id,
            status: 'Funded',
            createdAt: { $gte: periodStart, $lte: periodEnd }
        });

        const totalFunded = fundedWithdrawals.reduce((sum, w) => sum + w.requestedAmount, 0);
        const availableBalance = calculateAvailableBalance(cumulativeNetAccrued, totalFunded, config.maxAccrualPercentage);

        const validation = validateWithdrawalRequest(
            requestedAmount, availableBalance, fundedWithdrawals.length,
            config.maxWithdrawalsPerPeriod, config.transactionFee
        );

        if (!validation.isValid) {
            return res.status(400).json({ message: validation.reason });
        }

        const withdrawal = await WithdrawalRequest.create({
            employeeId: employee._id,
            requestedAmount,
            transactionFee: config.transactionFee,
            totalDeduction: validation.totalDeduction,
            status: 'Funded',
            fundedAt: new Date()
        });

        logger.info(`[EWA] Employee ${employee._id} withdrew ${requestedAmount}`);
        res.status(201).json({ message: 'Withdrawal funded successfully', withdrawal });
    } catch (error) { next(error); }
};

exports.runPaydayOffsetBatch = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payrollRunId, periodStart, periodEnd } = req.body;
        const start = new Date(periodStart);
        const end = new Date(periodEnd);

        // Find all funded withdrawals for the period that haven't been reconciled
        const pendingWithdrawals = await WithdrawalRequest.find({
            status: 'Funded',
            fundedAt: { $gte: start, $lte: end }
        }).session(session);

        if (pendingWithdrawals.length === 0) {
            await session.abortTransaction();
            return res.status(200).json({ message: 'No pending EWA withdrawals for this payroll run.' });
        }

        // Group by employee
        const employeeGroups = {};
        for (const w of pendingWithdrawals) {
            const empId = w.employeeId.toString();
            if (!employeeGroups[empId]) employeeGroups[empId] = [];
            employeeGroups[empId].push(w);
        }

        const reconciliations = [];

        for (const [empId, withdrawals] of Object.entries(employeeGroups)) {
            const offsets = generatePayrollOffsets(withdrawals);

            const recon = await PaydayReconciliation.create([{
                employeeId: empId,
                payrollRunId,
                totalAdvancesRecovered: offsets.totalAdvances,
                totalFeesRecovered: offsets.totalFees,
                totalOffsetAmount: offsets.totalOffset,
                withdrawalsCleared: withdrawals.map(w => w._id)
            }], { session });

            // Mark withdrawals as reconciled
            const wIds = withdrawals.map(w => w._id);
            await WithdrawalRequest.updateMany(
                { _id: { $in: wIds } },
                { $set: { status: 'Reconciled', reconciledAt: new Date(), payrollRunId } },
                { session }
            );

            reconciliations.push(recon[0]);
        }

        await session.commitTransaction();
        logger.info(`[EWA] Payday offset batch processed for ${reconciliations.length} employees.`);
        res.status(200).json({ message: 'Payday reconciliation batch processed', reconciliations });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getAdminDashboard = async (req, res, next) => {
    try {
        const config = await EWAConfig.findOne({});

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalLiability = await WithdrawalRequest.aggregate([
            { $match: {
                status: 'Funded',
                fundedAt: { $gte: periodStart }
            } },
            { $group: { _id: null, total: { $sum: '$requestedAmount' }, count: { $sum: 1 } } }
        ]);

        res.status(200).json({
            config,
            currentLiability: totalLiability[0] || { total: 0, count: 0 }
        });
    } catch (error) { next(error); }
};
