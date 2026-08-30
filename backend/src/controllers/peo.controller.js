/**
 * @fileoverview PEO Controller
 * Issue: #1937
 */
const mongoose = require('mongoose');
const { PEOClientMapping, IntercompanyFundingRequest, LaborDistributionJournal } = require('../models/peoFunding.model');
const { calculateFundingRequest, generateLaborDistribution } = require('../utils/peoFundingEngine.utils');

exports.mapClient = async (req, res, next) => {
    try {
        const mapping = await PEOClientMapping.create({ ...req.body, tenantId: req.tenantId });
        res.status(201).json({ message: 'Client mapped to PEO', mapping });
    } catch (error) { next(error); }
};

exports.generateFundingBatch = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { payrollRunId, clientCompanyId, netPayTotal, employerTaxesTotal, grossWagesTotal, departmentWages } = req.body;

        const mapping = await PEOClientMapping.findOne({ clientCompanyId, tenantId: req.tenantId }).session(session);
        if (!mapping) throw new Error('PEO mapping not found for client.');

        const funding = calculateFundingRequest(netPayTotal, employerTaxesTotal, grossWagesTotal, mapping.adminFeePercentage);

        const request = await IntercompanyFundingRequest.create([{
            tenantId: req.tenantId, clientCompanyId, payrollRunId,
            netPayTotal, employerTaxesTotal, adminFeeTotal: funding.adminFeeTotal,
            totalFundingRequested: funding.totalFundingRequested
        }], { session });

        const dist = generateLaborDistribution(departmentWages, mapping.defaultGLAccount, mapping.adminFeePercentage);

        const journalDocs = dist.journals.map(j => ({ ...j, tenantId: req.tenantId, fundingRequestId: request[0]._id }));
        await LaborDistributionJournal.insertMany(journalDocs, { session });

        await session.commitTransaction();
        res.status(201).json({ message: 'Funding batch and journals generated', request: request[0], journals: journalDocs });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const mappings = await PEOClientMapping.find({ tenantId: req.tenantId });
        const requests = await IntercompanyFundingRequest.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(20);
        res.status(200).json({ mappings, requests });
    } catch (error) { next(error); }
};
