/**
 * @fileoverview Equity Compensation Controller
 * @description Manages equity grants, vesting executions, and ASC 718 amortization.
 * Issue: #2010
 */
const mongoose = require('mongoose');
const { EquityGrant, VestingEvent, ASC718ExpenseLedger, BlackoutPeriod } = require('../models/equityCompensation.model');
const {
    calculateSellToCover, checkBlackoutPeriod,
    calculateASC718Amortization, generateASC718JournalEntry
} = require('../utils/equityVestingEngine.utils');
const logger = require('../utils/logger');

exports.createGrant = async (req, res, next) => {
    try {
        const grant = await EquityGrant.create({ ...req.body, tenantId: req.tenantId });

        // Generate initial ASC 718 ledger entries for the vesting period
        const totalValue = grant.totalSharesGranted * grant.grantDateFairValue;
        const startDate = new Date(grant.grantDate);

        for (let i = 0; i < grant.totalVestingMonths; i++) {
            const periodDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const month = periodDate.getMonth() + 1;
            const year = periodDate.getFullYear();

            const amort = calculateASC718Amortization(totalValue, grant.totalVestingMonths, i + 1);

            await ASC718ExpenseLedger.findOneAndUpdate(
                { tenantId: req.tenantId, grantId: grant._id, periodYear: year, periodMonth: month },
                {
                    totalGrantValue: totalValue, monthlyAmortization: amort.monthlyAmortization,
                    ytdAmortization: amort.ytdAmortization, glAccountCode: '6500-Stock-Based-Comp'
                },
                { upsert: true }
            );
        }

        res.status(201).json({ message: 'Equity grant created and ASC 718 schedule generated', grant });
    } catch (error) { next(error); }
};

exports.executeVesting = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { grantId, vestingDate, sharesVested, fmv, ytdWages } = req.body;

        const grant = await EquityGrant.findById(grantId).session(session);
        if (!grant || grant.status !== 'Active') throw new Error('Grant not found or inactive.');

        // Check Blackout Guardrail
        const blackouts = await BlackoutPeriod.find({ tenantId: req.tenantId, isActive: true }).session(session);
        const blackoutCheck = checkBlackoutPeriod(vestingDate, blackouts);

        if (blackoutCheck.isBlocked) {
            const event = await VestingEvent.create([{
                tenantId: req.tenantId, grantId, employeeId: grant.employeeId,
                vestingDate: new Date(vestingDate), sharesVested, fairMarketValue: fmv,
                grossProceeds: 0, sharesLiquidated: 0, taxWithholdingAmount: 0, netSharesDelivered: 0,
                status: 'Blocked (Blackout)'
            }], { session });

            await session.commitTransaction();
            return res.status(403).json({ message: blackoutCheck.reason, event: event[0] });
        }

        // Calculate Sell-to-Cover
        const stc = calculateSellToCover(sharesVested, fmv, ytdWages);

        const event = await VestingEvent.create([{
            tenantId: req.tenantId, grantId, employeeId: grant.employeeId,
            vestingDate: new Date(vestingDate), sharesVested, fairMarketValue: fmv,
            grossProceeds: stc.grossProceeds, sharesLiquidated: stc.sharesLiquidated,
            taxWithholdingAmount: stc.taxWithholdingAmount, netSharesDelivered: stc.netSharesDelivered,
            status: 'Executed'
        }], { session });

        // Update Grant Totals
        grant.sharesVested += sharesVested;
        grant.sharesLiquidated += stc.sharesLiquidated;
        grant.sharesDelivered += stc.netSharesDelivered;

        if (grant.sharesVested >= grant.totalSharesGranted) {
            grant.status = 'Fully Vested';
        }
        await grant.save({ session });

        await session.commitTransaction();
        logger.info(`[Equity] Executed vesting for grant ${grantId}. Liquidated ${stc.sharesLiquidated} shares for taxes.`);
        res.status(201).json({ message: 'Vesting executed successfully', event: event[0], sellToCover: stc });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const grants = await EquityGrant.find({ tenantId: req.tenantId, status: 'Active' })
            .populate('employeeId', 'fullName department').sort({ grantDate: -1 });

        const upcomingVestings = await VestingEvent.find({ tenantId: req.tenantId, status: 'Pending' })
            .populate('employeeId', 'fullName').sort({ vestingDate: 1 }).limit(20);

        const blackouts = await BlackoutPeriod.find({ tenantId: req.tenantId, isActive: true }).sort({ startDate: 1 });

        res.status(200).json({ grants, upcomingVestings, blackouts });
    } catch (error) { next(error); }
};
