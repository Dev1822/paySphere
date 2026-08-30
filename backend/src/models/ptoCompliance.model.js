/**
 * @fileoverview PTO Compliance & Accrual Schemas
 * @description Tracks PTO policies, state-specific compliance rules, and accrual ledgers.
 * Issue: #1730
 */
const mongoose = require('mongoose');

/**
 * PTOComplianceRule Schema
 * Defines state-specific legal mandates regarding PTO accrual, caps, and payouts.
 */
const ptoComplianceRuleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true, trim: true }, // e.g., 'CA', 'NY'

    allowsUseItOrLoseIt: { type: Boolean, default: false },
    allowsAccrualCap: { type: Boolean, default: true },
    maxAccrualCapMultiplier: { type: Number, default: 1.5 }, // e.g., Cap at 1.5x annual accrual rate

    mandatesTerminationPayout: { type: Boolean, default: false },
    payoutTaxTreatment: { type: String, enum: ['Supplemental', 'Regular', 'None'], default: 'Supplemental' },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

ptoComplianceRuleSchema.index({ tenantId: 1, stateCode: 1 }, { unique: true });
const PTOComplianceRule = mongoose.model('PTOComplianceRule', ptoComplianceRuleSchema);

/**
 * PTOPolicy Schema
 * Defines the company's PTO accrual tiers based on employee tenure.
 */
const accrualTierSchema = new mongoose.Schema({
    minTenureYears: { type: Number, required: true, min: 0 },
    maxTenureYears: { type: Number, default: 99 },
    annualAccrualHours: { type: Number, required: true } // e.g., 80 hours = 10 days
}, { _id: false });

const ptoPolicySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true }, // e.g., "Standard US PTO Plan"
    type: { type: String, enum: ['PTO', 'Sick', 'Unpaid'], default: 'PTO' },

    accrualFrequency: { type: String, enum: ['Per Paycheck', 'Monthly', 'Annually'], default: 'Per Paycheck' },
    tiers: [accrualTierSchema],

    allowNegativeBalance: { type: Boolean, default: false },
    maxCarryoverHours: { type: Number, default: 0 }, // 0 means no carryover or governed by state cap

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const PTOPolicy = mongoose.model('PTOPolicy', ptoPolicySchema);

/**
 * AccrualLedger Schema
 * Immutable log of every PTO accrual, usage, and adjustment.
 */
const accrualLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PTOPolicy', required: true },

    transactionType: {
        type: String,
        enum: ['Accrual', 'Usage', 'Carryover', 'Adjustment', 'Termination Payout', 'Cap Forfeiture'],
        required: true
    },
    hours: { type: Number, required: true }, // Positive for accruals, negative for usage
    balanceAfter: { type: Number, required: true },

    reason: { type: String, default: '' },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },
    processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

accrualLedgerSchema.index({ tenantId: 1, employeeId: 1, processedAt: -1 });
const AccrualLedger = mongoose.model('AccrualLedger', accrualLedgerSchema);

module.exports = { PTOComplianceRule, PTOPolicy, AccrualLedger };
