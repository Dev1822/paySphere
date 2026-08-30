/**
 * @fileoverview Tip Pool Controller
 * @description Manages tip pool configurations, daily ledgers, and distribution batches.
 * Issue: #1567
 */
const { TipPoolConfiguration, DailyGratuityLedger, TipDistributionBatch } = require('../models/tipPool.model');
const Employee = require('../models/employee.model');
const { filterEligibleEmployees, calculateWeightedShare, calculateMakeWholeTopUp } = require('../utils/tipAllocationEngine.utils');
const logger = require('../utils/logger');

exports.createPoolConfig = async (req, res, next) => {
    try {
        const { poolName, jobWeights, allowManagers, allowOwners } = req.body;
        const config = await TipPoolConfiguration.create({
            tenantId: req.tenantId, poolName, jobWeights, allowManagers, allowOwners
        });
        res.status(201).json({ message: 'Tip pool configuration created', config });
    } catch (error) { next(error); }
};

exports.recordDailyTips = async (req, res, next) => {
    try {
        const { date, grossCashTips, grossCreditTips, bohtipOutPercentage } = req.body;

        const totalGross = (grossCashTips || 0) + (grossCreditTips || 0);
        const bohTipOutAmount = Math.round(totalGross * ((bohtipOutPercentage || 0) / 100) * 100) / 100;
        const netFOHTips = totalGross - bohTipOutAmount;

        const ledger = await DailyGratuityLedger.findOneAndUpdate(
            { tenantId: req.tenantId, date: new Date(date) },
            {
                grossCashTips, grossCreditTips, totalGrossTips: totalGross,
                bohtipOutPercentage, bohTipOutAmount, netFOHTips,
                status: 'Finalized', recordedBy: req.userId
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Daily tips recorded', ledger });
    } catch (error) { next(error); }
};

exports.calculateDistributionBatch = async (req, res, next) => {
    try {
        const { periodStart, periodEnd, poolId, statutoryMinimumWage } = req.body;
        const start = new Date(periodStart);
        const end = new Date(periodEnd);

        const poolConfig = await TipPoolConfiguration.findById(poolId);
        if (!poolConfig) return res.status(404).json({ message: 'Pool configuration not found' });

        // Fetch all daily ledgers in the period
        const ledgers = await DailyGratuityLedger.find({
            tenantId: req.tenantId, date: { $gte: start, $lte: end }, status: 'Finalized'
        });

        const totalPoolTips = ledgers.reduce((sum, l) => sum + l.netFOHTips, 0);

        // Fetch eligible employees and their hours (mocked timesheet data)
        const allEmployees = await Employee.find({ tenantId: req.tenantId, isActive: true });
        const eligibleEmployees = filterEligibleEmployees(allEmployees, poolConfig);

        // Mock hours and classifications for demonstration
        const employeeData = eligibleEmployees.map(emp => ({
            ...emp.toObject(),
            hoursWorked: Math.floor(Math.random() * 20) + 10, // Mock 10-30 hours
            cashWageHourly: 2.13, // Federal tipped minimum
            jobClassification: emp.role || 'Server'
        }));

        // Calculate total weighted hours
        let totalWeightedHours = 0;
        for (const emp of employeeData) {
            const weightConfig = poolConfig.jobWeights.find(w => w.jobClassification === emp.jobClassification);
            const weight = weightConfig ? weightConfig.weightPercentage : 100;
            totalWeightedHours += emp.hoursWorked * (weight / 100);
        }

        const distributions = [];
        let totalMakeWhole = 0;

        for (const emp of employeeData) {
            const weightConfig = poolConfig.jobWeights.find(w => w.jobClassification === emp.jobClassification);
            const weight = weightConfig ? weightConfig.weightPercentage : 100;

            const rawShare = calculateWeightedShare(totalPoolTips, emp.hoursWorked, weight, totalWeightedHours);
            const makeWhole = calculateMakeWholeTopUp(emp.cashWageHourly, rawShare, emp.hoursWorked, statutoryMinimumWage || 7.25);

            distributions.push({
                employeeId: emp._id,
                hoursWorked: emp.hoursWorked,
                jobClassification: emp.jobClassification,
                rawTipShare: rawShare,
                makeWholeTopUp: makeWhole.makeWholeTopUp,
                finalPayout: rawShare + makeWhole.makeWholeTopUp
            });

            totalMakeWhole += makeWhole.makeWholeTopUp;
        }

        const batch = await TipDistributionBatch.create({
            tenantId: req.tenantId, periodStart: start, periodEnd: end,
            totalDistributed: totalPoolTips, makeWholeAdjustments: totalMakeWhole,
            distributions, status: 'Calculated'
        });

        logger.info(`[TipPool] Calculated batch with ${totalMakeWhole} in make-whole adjustments.`);
        res.status(201).json({ message: 'Distribution batch calculated', batch });
    } catch (error) { next(error); }
};

exports.getDashboardData = async (req, res, next) => {
    try {
        const pools = await TipPoolConfiguration.find({ tenantId: req.tenantId, isActive: true });
        const recentLedgers = await DailyGratuityLedger.find({ tenantId: req.tenantId })
            .sort({ date: -1 }).limit(14);

        res.status(200).json({ pools, recentLedgers });
    } catch (error) { next(error); }
};
