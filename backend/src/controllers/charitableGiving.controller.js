/**
 * @fileoverview Charitable Giving Controller
 * @description Manages campaigns, pledges, payroll deductions, and corporate match exports.
 * Issue: #2011
 */
const mongoose = require('mongoose');
const { CharityOrganization, GivingCampaign, EmployeePledge, CorporateMatchLedger } = require('../models/charitableGiving.model');
const { calculatePeriodDeduction, evaluateCampaignCaps, generateDisbursementReport } = require('../utils/givingMatchingEngine.utils');
const { MATCHING_RULES } = require('../constants/charitable.constants');
const logger = require('../utils/logger');

exports.createCampaign = async (req, res, next) => {
    try {
        const campaign = await GivingCampaign.create({ ...req.body, tenantId: req.tenantId });
        res.status(201).json({ message: 'Giving campaign created', campaign });
    } catch (error) { next(error); }
};

exports.submitPledge = async (req, res, next) => {
    try {
        const { campaignId, charityId, pledgeAmount, frequency, paychecksPerYear } = req.body;

        const campaign = await GivingCampaign.findById(campaignId);
        if (!campaign || campaign.status !== 'Active') {
            return res.status(400).json({ message: 'Campaign is not active.' });
        }

        // Calculate total annual pledge for cap enforcement
        let totalPledgedAnnual = pledgeAmount;
        if (frequency === 'Per Paycheck') totalPledgedAnnual = pledgeAmount * (paychecksPerYear || 26);
        else if (frequency === 'Monthly') totalPledgedAnnual = pledgeAmount * 12;
        else if (frequency === 'Bi-Weekly') totalPledgedAnnual = pledgeAmount * 26;

        const pledge = await EmployeePledge.create({
            tenantId: req.tenantId, campaignId, employeeId: req.employeeId, charityId,
            pledgeAmount, frequency, totalPledgedAnnual, startDate: new Date()
        });

        campaign.participantCount += 1;
        await campaign.save();

        res.status(201).json({ message: 'Pledge submitted', pledge });
    } catch (error) { next(error); }
};

exports.processPayrollDeductions = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payrollRunId, month, year, paychecksPerYear } = req.body;

        const activePledges = await EmployeePledge.find({
            tenantId: req.tenantId, status: 'Active'
        }).populate('campaignId').session(session);

        const deductions = [];
        const matchLedgers = [];

        for (const pledge of activePledges) {
            const campaign = pledge.campaignId;
            if (campaign.status !== 'Active') continue;

            const periodDeduction = calculatePeriodDeduction(pledge.pledgeAmount, pledge.frequency, paychecksPerYear || 26);
            if (periodDeduction <= 0) continue;

            // Determine multiplier for corporate match
            let multiplier = 0;
            if (campaign.matchingRule === MATCHING_RULES.DOLLAR_FOR_DOLLAR) multiplier = 1;
            else if (campaign.matchingRule === MATCHING_RULES.TWO_TO_ONE) multiplier = 2;
            else if (campaign.matchingRule === MATCHING_RULES.FIFTY_CENTS_ON_DOLLAR) multiplier = 0.5;

            const capEval = evaluateCampaignCaps(pledge, campaign, periodDeduction, multiplier);

            // Update Pledge YTD
            pledge.ytdDeducted += capEval.finalDeduction;
            pledge.ytdMatched += capEval.finalMatch;
            pledge.status = capEval.newStatus;
            await pledge.save({ session });

            // Update Campaign Totals
            campaign.totalRaised += capEval.finalDeduction;
            campaign.totalMatched += capEval.finalMatch;
            await campaign.save({ session });

            if (capEval.finalDeduction > 0) {
                deductions.push({
                    employeeId: pledge.employeeId,
                    componentName: `Charity: ${campaign.name}`,
                    amount: capEval.finalDeduction,
                    type: 'PostTaxDeduction', // Charitable giving is typically post-tax
                    isTaxable: false
                });
            }

            if (capEval.finalMatch > 0) {
                const ledger = await CorporateMatchLedger.create([{
                    tenantId: req.tenantId, campaignId: campaign._id, employeeId: pledge.employeeId,
                    pledgeId: pledge._id, payrollRunId, employeeDonation: capEval.finalDeduction,
                    corporateMatch: capEval.finalMatch, hitMatchCap: capEval.haltMatching,
                    periodMonth: month, periodYear: year
                }], { session });
                matchLedgers.push(ledger[0]);
            }
        }

        await session.commitTransaction();
        logger.info(`[Charity] Processed ${deductions.length} deductions and ${matchLedgers.length} corporate matches.`);
        res.status(200).json({ message: 'Charitable deductions processed', deductions, matchLedgers });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.exportDisbursements = async (req, res, next) => {
    try {
        const { campaignId, year } = req.body;
        const ledgers = await CorporateMatchLedger.find({
            tenantId: req.tenantId, campaignId, periodYear: year
        }).populate('pledgeId');

        // Map charityId from pledge for aggregation
        const enrichedLedgers = ledgers.map(l => ({ ...l.toObject(), charityId: l.pledgeId?.charityId }));
        const report = generateDisbursementReport(enrichedLedgers);

        res.status(200).json({ message: 'Disbursement report generated', report });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const campaigns = await GivingCampaign.find({ tenantId: req.tenantId }).sort({ startDate: -1 });
        const myPledges = await EmployeePledge.find({ tenantId: req.tenantId, employeeId: req.employeeId })
            .populate('campaignId').populate('charityId');

        res.status(200).json({ campaigns, myPledges });
    } catch (error) { next(error); }
};
