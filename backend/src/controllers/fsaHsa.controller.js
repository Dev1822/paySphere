/**
 * @fileoverview FSA & HSA Controller
 * @description Manages plan configurations, employee elections, and payroll deductions.
 * Issue: #1758
 */
const mongoose = require('mongoose');
const { PlanYearConfiguration, FSAHSAElection, ContributionLedger } = require('../models/fsaHsa.model');
const Employee = require('../models/employee.model');
const { calculatePerPaycheckDeduction, validateLimits, evaluatePlanYearTransition } = require('../utils/fsaHsaEngine.utils');
const logger = require('../utils/logger');

exports.configurePlanYear = async (req, res, next) => {
    try {
        const config = await PlanYearConfiguration.findOneAndUpdate(
            {
                planYear: req.body.planYear
            },
            {
                ...req.body
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Plan year configuration saved', config });
    } catch (error) { next(error); }
};

exports.submitElection = async (req, res, next) => {
    try {
        const { employeeId, planYear, accountType, electedAnnualAmount, coverageType, isCatchUp, catchUpAmount } = req.body;

        const config = await PlanYearConfiguration.findOne({
            planYear,
            isActive: true
        });
        if (!config) return res.status(400).json({ message: 'No active plan configuration for this year.' });

        const limitCheck = validateLimits(electedAnnualAmount, catchUpAmount || 0, accountType, config, coverageType);
        if (!limitCheck.isValid) {
            return res.status(400).json({ message: limitCheck.reason });
        }

        const election = await FSAHSAElection.findOneAndUpdate(
            {
                employeeId,
                planYear,
                accountType
            },
            {
                electedAnnualAmount, coverageType, isCatchUp: isCatchUp || false,
                catchUpAmount: catchUpAmount || 0, status: 'Active'
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Election submitted', election });
    } catch (error) { next(error); }
};

exports.processPayrollDeductions = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payrollRunId, month, year, paychecksPerYear } = req.body;
        const planYear = year; // Assuming calendar year plan for simplicity

        const config = await PlanYearConfiguration.findOne({
            planYear
        }).session(session);
        if (!config) throw new Error('Plan year not configured.');

        const elections = await FSAHSAElection.find({
            planYear,
            status: 'Active'
        }).session(session);

        const ledgers = [];
        const payrollInjections = [];

        for (const election of elections) {
            const totalAnnual = election.electedAnnualAmount + (election.isCatchUp ? election.catchUpAmount : 0);
            const perPaycheck = calculatePerPaycheckDeduction(totalAnnual, paychecksPerYear || 26, 'Prorated');

            // Get current YTD accumulator
            const lastLedger = await ContributionLedger.findOne({ electionId: election._id })
                .sort({ periodYear: -1, periodMonth: -1 }).session(session);
            const currentYTD = lastLedger ? lastLedger.ytdAccumulator : 0;

            // Ensure we don't over-deduct beyond the annual election
            const remaining = totalAnnual - currentYTD;
            const actualDeduction = Math.min(perPaycheck, remaining);

            if (actualDeduction <= 0) {
                election.status = 'Exhausted';
                await election.save({ session });
                continue;
            }

            const newYTD = Math.round((currentYTD + actualDeduction) * 100) / 100;

            const ledger = await ContributionLedger.create([{
                electionId: election._id,
                employeeId: election.employeeId,
                payrollRunId,
                periodMonth: month,
                periodYear: year,
                employeeDeduction: actualDeduction,
                totalContribution: actualDeduction,
                ytdAccumulator: newYTD
            }], { session });

            ledgers.push(ledger[0]);

            payrollInjections.push({
                employeeId: election.employeeId,
                componentName: `Pre-Tax ${election.accountType}`,
                amount: actualDeduction,
                type: 'PreTaxDeduction',
                isTaxable: false
            });
        }

        await session.commitTransaction();
        logger.info(`[FSA/HSA] Processed ${ledgers.length} deductions for ${month}/${year}`);
        res.status(200).json({ message: 'Deductions processed', payrollInjections });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.runYearEndTransition = async (req, res, next) => {
    try {
        const { oldPlanYear, newPlanYear } = req.body;
        const config = await PlanYearConfiguration.findOne({
            planYear: oldPlanYear
        });
        if (!config) return res.status(404).json({ message: 'Old plan year config not found.' });

        const fsaElections = await FSAHSAElection.find({
            planYear: oldPlanYear,
            accountType: 'FSA'
        });

        const transitions = [];

        for (const election of fsaElections) {
            const lastLedger = await ContributionLedger.findOne({ electionId: election._id }).sort({ createdAt: -1 });
            const ytdContributions = lastLedger ? lastLedger.ytdAccumulator : 0;

            // Mocking claims data: assume employee used 80% of their election
            const mockClaims = ytdContributions * 0.80;
            const currentBalance = ytdContributions - mockClaims;

            const transition = evaluatePlanYearTransition(currentBalance, config);
            transitions.push({
                employeeId: election.employeeId,
                endingBalance: currentBalance,
                ...transition
            });
        }

        res.status(200).json({ message: 'Year-end transition evaluated', transitions });
    } catch (error) { next(error); }
};

exports.getPortalData = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const currentYear = new Date().getFullYear();
        const elections = await FSAHSAElection.find({ employeeId: employee._id, planYear: currentYear });

        const ledgers = await ContributionLedger.find({ employeeId: employee._id })
            .sort({ periodYear: -1, periodMonth: -1 }).limit(20);

        const config = await PlanYearConfiguration.findOne({
            planYear: currentYear
        });

        res.status(200).json({ elections, ledgers, config });
    } catch (error) { next(error); }
};
