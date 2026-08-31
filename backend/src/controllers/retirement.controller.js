/**
 * @fileoverview Retirement Controller
 * Issue: #1867
 */
const mongoose = require('mongoose');
const { RetirementPlanConfig, EmployeeDeferralLedger, NDTTestResult } = require('../models/retirementPlan.model');
const { calculateADP, evaluateADPTest, calculateTrueUp } = require('../utils/ndtTestingEngine.utils');
const logger = require('../utils/logger');

exports.configurePlan = async (req, res, next) => {
    try {
        const config = await RetirementPlanConfig.findOneAndUpdate(
            {
                planYear: req.body.planYear
            },
            {
                ...req.body
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Plan configured', config });
    } catch (error) { next(error); }
};

exports.runNDTTest = async (req, res, next) => {
    try {
        const { planYear, testType } = req.body;
        const ledgers = await EmployeeDeferralLedger.find({
            planYear
        });

        const hceLedgers = ledgers.filter(l => l.isHCE);
        const nhceLedgers = ledgers.filter(l => l.isNHCE);

        const hceADP = calculateADP(hceLedgers);
        const nhceADP = calculateADP(nhceLedgers);

        const result = evaluateADPTest(hceADP, nhceADP);

        const testRecord = await NDTTestResult.create({
            planYear,
            testType,
            hcePercentage: hceADP,
            nhcePercentage: nhceADP,
            passed: result.passed,
            correctiveActionRequired: !result.passed,
            generatedBy: req.userId
        });

        res.status(201).json({ message: 'NDT Test completed', test: testRecord, evaluation: result });
    } catch (error) { next(error); }
};

exports.runTrueUpBatch = async (req, res, next) => {
    try {
        const { planYear } = req.body;
        const config = await RetirementPlanConfig.findOne({
            planYear
        });
        if (!config) return res.status(404).json({ message: 'Plan not configured' });

        const ledgers = await EmployeeDeferralLedger.find({
            planYear
        });
        const trueUps = [];

        for (const ledger of ledgers) {
            const calc = calculateTrueUp(ledger.grossCompensation, ledger.employeeDeferralRate, ledger.employerMatchAmount, config);
            if (calc.trueUpAmount > 0) {
                trueUps.push({ employeeId: ledger.employeeId, trueUpAmount: calc.trueUpAmount });
            }
        }

        logger.info(`[Retirement] Generated ${trueUps.length} true-up contributions.`);
        res.status(200).json({ message: 'True-up batch generated', trueUps });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const currentYear = new Date().getFullYear();
        const config = await RetirementPlanConfig.findOne({
            planYear: currentYear
        });
        const tests = await NDTTestResult.find({
            planYear: currentYear
        }).sort({ createdAt: -1 });
        res.status(200).json({ config, tests });
    } catch (error) { next(error); }
};
