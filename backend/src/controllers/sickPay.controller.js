/**
 * @fileoverview Sick Pay Controller
 * Issue: #1868
 */
const mongoose = require('mongoose');
const { DisabilityPolicy, ThirdPartyPaymentFeed, SickPayTaxLedger } = require('../models/thirdPartySickPay.model');
const { calculateSickPayTaxability, mapToW2Boxes } = require('../utils/sickPayTaxEngine.utils');
const logger = require('../utils/logger');

exports.createPolicy = async (req, res, next) => {
    try {
        const policy = await DisabilityPolicy.create({ ...req.body, tenantId: req.tenantId });
        res.status(201).json({ message: 'Disability policy created', policy });
    } catch (error) { next(error); }
};

exports.importCarrierFeed = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payments } = req.body; // Array of { employeeId, policyId, paymentDate, grossBenefitAmount }
        const results = [];

        for (const p of payments) {
            const policy = await DisabilityPolicy.findById(p.policyId).session(session);
            if (!policy) continue;

            const taxCalc = calculateSickPayTaxability(p.grossBenefitAmount, policy.employerPremiumPercentage);

            const feed = await ThirdPartyPaymentFeed.create([{
                tenantId: req.tenantId, policyId: policy._id, employeeId: p.employeeId,
                paymentDate: new Date(p.paymentDate), grossBenefitAmount: p.grossBenefitAmount,
                taxablePercentage: taxCalc.taxablePercentage, taxableAmount: taxCalc.taxableAmount,
                nonTaxableAmount: taxCalc.nonTaxableAmount, ficaTaxable: policy.isSubjectToFICA,
                status: 'Reconciled'
            }], { session });

            results.push(feed[0]);
        }

        await session.commitTransaction();
        res.status(201).json({ message: `Imported ${results.length} payments`, results });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.injectToPayroll = async (req, res, next) => {
    try {
        const { feedIds, payrollRunId } = req.body;
        const feeds = await ThirdPartyPaymentFeed.find({ _id: { $in: feedIds }, status: 'Reconciled' });

        const injections = [];
        const SS_WAGE_BASE = 168600; // 2024 limit

        for (const feed of feeds) {
            // Fetch YTD ledger
            const year = new Date(feed.paymentDate).getFullYear();
            let ledger = await SickPayTaxLedger.findOne({ tenantId: req.tenantId, employeeId: feed.employeeId, taxYear: year });

            if (!ledger) {
                ledger = await SickPayTaxLedger.create({
                    tenantId: req.tenantId, employeeId: feed.employeeId, taxYear: year
                });
            }

            const w2Map = mapToW2Boxes(feed.taxableAmount, feed.ficaTaxable, ledger.ytdFICATaxableSickPay, SS_WAGE_BASE);

            ledger.ytdGrossSickPay += feed.grossBenefitAmount;
            ledger.ytdTaxableSickPay += w2Map.box1Addition;
            ledger.ytdFICATaxableSickPay += w2Map.box5Addition;
            await ledger.save();

            feed.status = 'Injected';
            await feed.save();

            injections.push({
                employeeId: feed.employeeId,
                componentName: 'Third-Party Sick Pay (Imputed)',
                amount: w2Map.box1Addition,
                type: 'ImputedIncome',
                isTaxable: true
            });
        }

        logger.info(`[SickPay] Injected ${injections.length} imputed income records.`);
        res.status(200).json({ message: 'Sick pay injected into payroll', injections });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const policies = await DisabilityPolicy.find({ tenantId: req.tenantId });
        const pendingFeeds = await ThirdPartyPaymentFeed.find({ tenantId: req.tenantId, status: 'Pending' })
            .populate('employeeId', 'fullName');
        res.status(200).json({ policies, pendingFeeds });
    } catch (error) { next(error); }
};
