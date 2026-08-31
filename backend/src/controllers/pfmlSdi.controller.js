/**
 * @fileoverview PFML & SDI Controller
 * @description Manages state policies, contribution ledgers, and job protection tracking.
 * Issue: #1760
 */
const mongoose = require('mongoose');
const { PFMLPolicy, SDIContributionLedger, LeaveJobProtection } = require('../models/pfmlSdi.model');
const Employee = require('../models/employee.model');
const { calculateWithholding, evaluateJobProtection } = require('../utils/pfmlSdiEngine.utils');
const logger = require('../utils/logger');

exports.createPolicy = async (req, res, next) => {
    try {
        const policy = await PFMLPolicy.findOneAndUpdate(
            {
                stateCode: req.body.stateCode.toUpperCase(),
                programType: req.body.programType,
                taxYear: req.body.taxYear
            },
            {
                ...req.body,
                stateCode: req.body.stateCode.toUpperCase()
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'PFML/SDI policy saved', policy });
    } catch (error) { next(error); }
};

exports.processPayrollWithholdings = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { month, year, employeePayouts } = req.body;
        // employeePayouts: [{ employeeId, grossPay, stateCode }]

        const ledgers = [];
        const payrollDeductions = [];

        for (const payout of employeePayouts) {
            const policy = await PFMLPolicy.findOne({
                stateCode: payout.stateCode.toUpperCase(),
                taxYear: year,
                isActive: true
            }).session(session);

            if (!policy) continue; // No policy for this state

            // Fetch YTD wages
            const lastLedger = await SDIContributionLedger.findOne({
                employeeId: payout.employeeId, policyId: policy._id
            }).sort({ periodYear: -1, periodMonth: -1 }).session(session);

            const ytdWages = lastLedger ? lastLedger.ytdTaxableWages : 0;

            const calc = calculateWithholding(
                payout.grossPay, ytdWages, policy.annualTaxableWageCap,
                policy.employeeRate, policy.employerRate
            );

            if (calc.taxableWage <= 0 && calc.employeeWithholding <= 0) continue;

            const ledger = await SDIContributionLedger.create([{
                employeeId: payout.employeeId,
                policyId: policy._id,
                periodMonth: month,
                periodYear: year,
                grossPay: payout.grossPay,
                taxableWage: calc.taxableWage,
                employeeWithholding: calc.employeeWithholding,
                employerLiability: calc.employerLiability,
                ytdTaxableWages: calc.ytdWages,
                ytdContributions: (lastLedger ? lastLedger.ytdContributions : 0) + calc.employeeWithholding,
                hitWageCap: calc.hitWageCap
            }], { session });

            ledgers.push(ledger[0]);

            if (calc.employeeWithholding > 0) {
                payrollDeductions.push({
                    employeeId: payout.employeeId,
                    componentName: `${payout.stateCode} ${policy.programType} Tax`,
                    amount: calc.employeeWithholding,
                    type: 'TaxWithholding',
                    isTaxable: false
                });
            }
        }

        await session.commitTransaction();
        logger.info(`[PFML/SDI] Processed ${ledgers.length} withholdings for ${month}/${year}`);
        res.status(200).json({ message: 'Withholdings processed', payrollDeductions });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.startLeaveProtection = async (req, res, next) => {
    try {
        const { employeeId, stateCode, leaveStartDate } = req.body;
        const year = new Date(leaveStartDate).getFullYear();

        const policy = await PFMLPolicy.findOne({
            stateCode: stateCode.toUpperCase(),
            taxYear: year,
            isActive: true
        });
        if (!policy) return res.status(400).json({ message: 'No active PFML policy for this state/year.' });

        const protectionEndDate = new Date(leaveStartDate);
        protectionEndDate.setDate(protectionEndDate.getDate() + (policy.maxProtectedWeeks * 7));

        const protection = await LeaveJobProtection.findOneAndUpdate(
            {
                employeeId,
                status: 'Active'
            },
            {
                policyId: policy._id, leaveStartDate: new Date(leaveStartDate),
                maxProtectedWeeks: policy.maxProtectedWeeks, protectionEndDate, status: 'Active'
            },
            { upsert: true, new: true }
        );

        res.status(201).json({ message: 'Job protection tracking started', protection });
    } catch (error) { next(error); }
};

exports.runProtectionAudit = async (req, res, next) => {
    try {
        const activeProtections = await LeaveJobProtection.find({
            status: { $in: ['Active', 'Expiring Soon'] }
        }).populate('employeeId', 'fullName');

        let alertsTriggered = 0;

        for (const p of activeProtections) {
            const evalResult = evaluateJobProtection(p.protectionEndDate, new Date());

            if (evalResult.status !== p.status || (evalResult.requiresAlert && !p.alertTriggered)) {
                p.status = evalResult.status;
                if (evalResult.requiresAlert && !p.alertTriggered) {
                    p.alertTriggered = true;
                    alertsTriggered++;
                    logger.warn(`[PFML] Job Protection Expiring: Employee ${p.employeeId.fullName} has ${evalResult.daysRemaining} days remaining.`);
                }
                await p.save();
            }
        }

        res.status(200).json({ message: 'Protection audit complete', alertsTriggered });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const policies = await PFMLPolicy.find({
            isActive: true
        }).sort({ stateCode: 1 });
        const protections = await LeaveJobProtection.find({
            status: { $ne: 'Returned to Work' }
        })
            .populate('employeeId', 'fullName department');

        // Aggregate YTD caps
        const currentYear = new Date().getFullYear();
        const capStatus = await SDIContributionLedger.aggregate([
            { $match: {
                periodYear: currentYear
            } },
            { $group: { _id: '$employeeId', ytdWages: { $max: '$ytdTaxableWages' }, hitCap: { $max: '$hitWageCap' } } }
        ]);

        res.status(200).json({ policies, protections, capStatus });
    } catch (error) { next(error); }
};
