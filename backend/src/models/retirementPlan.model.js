/**
 * @fileoverview Retirement Plan & NDT Schemas
 * @description Tracks 401(k) configurations, deferral ledgers, and non-discrimination testing results.
 * Issue: #1867
 */
const mongoose = require('mongoose');

const retirementPlanConfigSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    planYear: { type: Number, required: true },
    isSafeHarbor: { type: Boolean, default: false },

    matchFormula: {
        type: String,
        enum: ['None', 'DollarForDollar', 'FiftyCentsOnDollar', 'Custom'],
        default: 'None'
    },
    matchLimitPercentage: { type: Number, default: 0.06 }, // e.g., 6% of compensation
    maxMatchAmount: { type: Number, default: Infinity },

    requiresTrueUp: { type: Boolean, default: false },
    hceCompensationThreshold: { type: Number, default: 150000 } // IRS HCE threshold
}, { timestamps: true });

retirementPlanConfigSchema.index({ tenantId: 1, planYear: 1 }, { unique: true });
const RetirementPlanConfig = mongoose.model('RetirementPlanConfig', retirementPlanConfigSchema);

const employeeDeferralLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    planYear: { type: Number, required: true },

    grossCompensation: { type: Number, default: 0 },
    employeeDeferralAmount: { type: Number, default: 0 },
    employeeDeferralRate: { type: Number, default: 0 },
    employerMatchAmount: { type: Number, default: 0 },

    isHCE: { type: Boolean, default: false },
    isNHCE: { type: Boolean, default: true }
}, { timestamps: true });

employeeDeferralLedgerSchema.index({ tenantId: 1, employeeId: 1, planYear: 1 }, { unique: true });
const EmployeeDeferralLedger = mongoose.model('EmployeeDeferralLedger', employeeDeferralLedgerSchema);

const ndtTestResultSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    planYear: { type: Number, required: true },
    testType: { type: String, enum: ['ADP', 'ACP'], required: true },

    hcePercentage: { type: Number, required: true },
    nhcePercentage: { type: Number, required: true },

    passed: { type: Boolean, required: true },
    correctiveActionRequired: { type: Boolean, default: false },
    correctiveAmount: { type: Number, default: 0 }, // QNEC or refund amount

    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const NDTTestResult = mongoose.model('NDTTestResult', ndtTestResultSchema);

module.exports = { RetirementPlanConfig, EmployeeDeferralLedger, NDTTestResult };
