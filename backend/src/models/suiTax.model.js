/**
 * @fileoverview SUI Tax Schemas
 * @description Tracks state experience rate notices, YTD wage base accumulators, 
 * and voluntary contribution ROI analyses.
 * Issue: #2012
 */
const mongoose = require('mongoose');

/**
 * SUIRateSchedule Schema
 * Stores the annual experience rate notice assigned by the state.
 */
const suiRateScheduleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true, trim: true },
    taxYear: { type: Number, required: true },

    assignedRate: { type: Number, required: true, min: 0, max: 1 }, // e.g., 0.015 (1.5%)
    rateTier: { type: String, required: true }, // e.g., 'Low Experience Rate'
    taxableWageBase: { type: Number, required: true },

    noticeReceivedDate: { type: Date, default: null },
    effectiveDate: { type: Date, required: true }, // Usually Jan 1st
    expirationDate: { type: Date, required: true }, // Usually Dec 31st

    isAppliedToPayroll: { type: Boolean, default: false },
    appliedAt: { type: Date, default: null }
}, { timestamps: true });

suiRateScheduleSchema.index({ tenantId: 1, stateCode: 1, taxYear: 1 }, { unique: true });
const SUIRateSchedule = mongoose.model('SUIRateSchedule', suiRateScheduleSchema);

/**
 * StateWageBaseLedger Schema
 * Tracks YTD taxable wages per employee per state to enforce wage base caps.
 */
const stateWageBaseLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true },
    taxYear: { type: Number, required: true },

    ytdGrossWages: { type: Number, default: 0 },
    ytdTaxableWages: { type: Number, default: 0 },
    ytdSUITaxPaid: { type: Number, default: 0 },

    hitWageCap: { type: Boolean, default: false },
    lastPayrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { timestamps: true });

stateWageBaseLedgerSchema.index({ tenantId: 1, employeeId: 1, stateCode: 1, taxYear: 1 }, { unique: true });
const StateWageBaseLedger = mongoose.model('StateWageBaseLedger', stateWageBaseLedgerSchema);

/**
 * VoluntaryContributionAnalysis Schema
 * Stores the ROI calculation for buying down the SUI rate via voluntary trust fund contributions.
 */
const voluntaryContributionAnalysisSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true },
    taxYear: { type: Number, required: true },

    currentRate: { type: Number, required: true },
    targetRate: { type: Number, required: true },

    projectedTaxablePayroll: { type: Number, required: true },
    currentTaxLiability: { type: Number, required: true },
    targetTaxLiability: { type: Number, required: true },

    requiredContribution: { type: Number, required: true },
    processingFee: { type: Number, default: 0 },
    netSavings: { type: Number, required: true },
    roiPercentage: { type: Number, required: true },

    status: { type: String, enum: ['Draft', 'Approved', 'Paid', 'Rejected'], default: 'Draft' },
    analyzedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const VoluntaryContributionAnalysis = mongoose.model('VoluntaryContributionAnalysis', voluntaryContributionAnalysisSchema);

module.exports = { SUIRateSchedule, StateWageBaseLedger, VoluntaryContributionAnalysis };
