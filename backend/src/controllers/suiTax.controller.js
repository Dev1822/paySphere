/**
 * @fileoverview SUI Tax Controller
 * @description Manages state rate notices, wage base ledgers, and voluntary contribution analyses.
 * Issue: #2012
 */
const mongoose = require('mongoose');
const { SUIRateSchedule, StateWageBaseLedger, VoluntaryContributionAnalysis } = require('../models/suiTax.model');
const { calculateSUIWithholding, checkRateExpiration, calculateVoluntaryContributionROI } = require('../utils/suiExperienceRatingEngine.utils');
const { STATE_WAGE_BASES } = require('../constants/sui.constants');
const logger = require('../utils/logger');

exports.uploadRateNotice = async (req, res, next) => {
    try {
        const { stateCode, taxYear, assignedRate, rateTier, noticeReceivedDate } = req.body;
        const wageBase = req.body.taxableWageBase || STATE_WAGE_BASES[stateCode.toUpperCase()] || 7000;

        const schedule = await SUIRateSchedule.findOneAndUpdate(
            { tenantId: req.tenantId, stateCode: stateCode.toUpperCase(), taxYear },
            {
                assignedRate, rateTier, taxableWageBase: wageBase,
                noticeReceivedDate: new Date(noticeReceivedDate),
                effectiveDate: new Date(`${taxYear}-01-01`),
                expirationDate: new Date(`${taxYear}-12-31`)
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'SUI rate notice uploaded', schedule });
    } catch (error) { next(error); }
};

exports.applyRateToPayroll = async (req, res, next) => {
    try {
        const { scheduleId } = req.body;
        const schedule = await SUIRateSchedule.findById(scheduleId);
        if (!schedule) return res.status(404).json({ message: 'Rate schedule not found.' });

        schedule.isAppliedToPayroll = true;
        schedule.appliedAt = new Date();
        await schedule.save();

        logger.info(`[SUI] Applied ${schedule.stateCode} ${schedule.taxYear} rate (${schedule.assignedRate}) to payroll.`);
        res.status(200).json({ message: 'Rate applied to payroll', schedule });
    } catch (error) { next(error); }
};

exports.processPayrollWithholding = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payrollRunId, taxYear, employeePayouts } = req.body;
        // employeePayouts: [{ employeeId, stateCode, grossPay }]

        const ledgers = [];
        const taxLiabilities = [];

        for (const payout of employeePayouts) {
            const state = payout.stateCode.toUpperCase();
            const schedule = await SUIRateSchedule.findOne({ tenantId: req.tenantId, stateCode: state, taxYear }).session(session);

            if (!schedule || !schedule.isAppliedToPayroll) {
                logger.warn(`[SUI] No applied rate for ${state} ${taxYear}. Skipping withholding for employee ${payout.employeeId}.`);
                continue;
            }

            let ledger = await StateWageBaseLedger.findOne({
                tenantId: req.tenantId, employeeId: payout.employeeId, stateCode: state, taxYear
            }).session(session);

            if (!ledger) {
                ledger = new StateWageBaseLedger({
                    tenantId: req.tenantId, employeeId: payout.employeeId, stateCode: state, taxYear
                });
            }

            const calc = calculateSUIWithholding(payout.grossPay, ledger.ytdTaxableWages, schedule.taxableWageBase, schedule.assignedRate);

            ledger.ytdGrossWages += payout.grossPay;
            ledger.ytdTaxableWages = calc.newYtdTaxable;
            ledger.ytdSUITaxPaid += calc.suiTax;
            ledger.hitWageCap = calc.hitWageCap;
            ledger.lastPayrollRunId = payrollRunId;
            await ledger.save({ session });

            ledgers.push(ledger);

            if (calc.suiTax > 0) {
                taxLiabilities.push({
                    employeeId: payout.employeeId,
                    stateCode: state,
                    taxType: 'SUI',
                    amount: calc.suiTax
                });
            }
        }

        await session.commitTransaction();
        res.status(200).json({ message: 'SUI withholdings processed', ledgers: ledgers.length, liabilities: taxLiabilities });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.analyzeVoluntaryContribution = async (req, res, next) => {
    try {
        const { stateCode, taxYear, targetRate, projectedTaxablePayroll } = req.body;

        const schedule = await SUIRateSchedule.findOne({ tenantId: req.tenantId, stateCode: stateCode.toUpperCase(), taxYear });
        if (!schedule) return res.status(404).json({ message: 'Current rate schedule not found.' });

        const roi = calculateVoluntaryContributionROI(schedule.assignedRate, targetRate, projectedTaxablePayroll, stateCode.toUpperCase());

        const analysis = await VoluntaryContributionAnalysis.create({
            tenantId: req.tenantId, stateCode: stateCode.toUpperCase(), taxYear,
            currentRate: schedule.assignedRate, targetRate,
            projectedTaxablePayroll, currentTaxLiability: roi.currentLiability,
            targetTaxLiability: roi.targetLiability, requiredContribution: roi.requiredContribution,
            processingFee: roi.processingFee, netSavings: roi.netSavings,
            roiPercentage: roi.roiPercentage, analyzedBy: req.userId
        });

        res.status(201).json({ message: 'Voluntary contribution analyzed', analysis, roi });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        const schedules = await SUIRateSchedule.find({ tenantId: req.tenantId, taxYear: currentYear }).sort({ stateCode: 1 });

        // Check Rate Expiration Guardrail
        const rateAlerts = schedules.map(s => ({
            ...s.toObject(),
            expirationCheck: checkRateExpiration(currentMonth, s)
        })).filter(s => !s.expirationCheck.isApplied);

        const analyses = await VoluntaryContributionAnalysis.find({ tenantId: req.tenantId, taxYear: currentYear })
            .sort({ createdAt: -1 }).limit(10);

        // Aggregate wage base caps
        const capStatus = await StateWageBaseLedger.aggregate([
            { $match: { tenantId: req.tenantId, taxYear: currentYear } },
            { $group: { _id: '$stateCode', employeesAtCap: { $sum: { $cond: ['$hitWageCap', 1, 0] } }, totalEmployees: { $sum: 1 } } }
        ]);

        res.status(200).json({ schedules: rateAlerts, analyses, capStatus });
    } catch (error) { next(error); }
};
