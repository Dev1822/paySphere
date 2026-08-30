/**
 * @fileoverview PEO Funding & Labor Distribution Schemas
 * Issue: #1937
 */
const mongoose = require('mongoose');

const peoClientMappingSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientCompanyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    peoEIN: { type: String, required: true },
    adminFeePercentage: { type: Number, required: true, min: 0, max: 1 },
    defaultGLAccount: { type: String, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
const PEOClientMapping = mongoose.model('PEOClientMapping', peoClientMappingSchema);

const intercompanyFundingRequestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientCompanyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },
    netPayTotal: { type: Number, required: true },
    employerTaxesTotal: { type: Number, required: true },
    adminFeeTotal: { type: Number, required: true },
    totalFundingRequested: { type: Number, required: true },
    status: { type: String, enum: ['Draft', 'Approved', 'Wired', 'Settled'], default: 'Draft' }
}, { timestamps: true });
const IntercompanyFundingRequest = mongoose.model('IntercompanyFundingRequest', intercompanyFundingRequestSchema);

const laborDistributionJournalSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    fundingRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntercompanyFundingRequest', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    glAccountCode: { type: String, required: true },
    debitAmount: { type: Number, required: true },
    creditAmount: { type: Number, default: 0 },
    description: { type: String, default: 'PEO Labor Distribution' }
}, { timestamps: true });
const LaborDistributionJournal = mongoose.model('LaborDistributionJournal', laborDistributionJournalSchema);

module.exports = { PEOClientMapping, IntercompanyFundingRequest, LaborDistributionJournal };
