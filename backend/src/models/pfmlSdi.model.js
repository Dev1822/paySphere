/**
 * @fileoverview PFML & SDI Compliance Schemas
 * @description Tracks state-specific Paid Family Medical Leave and State Disability Insurance 
 * policies, contribution ledgers, and job-protection statuses.
 * Issue: #1760
 */
const mongoose = require('mongoose');

/**
 * PFMLPolicy Schema
 * Defines state-mandated withholding rates, wage caps, and job protection durations.
 */
const pfmlPolicySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true }, // e.g., 'CA', 'NY', 'WA'
    programType: { type: String, enum: ['SDI', 'PFML', 'Combined'], required: true },

    taxYear: { type: Number, required: true },

    // Withholding Rates
    employeeRate: { type: Number, required: true, min: 0, max: 1 }, // e.g., 0.009 (0.9%)
    employerRate: { type: Number, default: 0, min: 0, max: 1 },     // Some states require employer contribution

    // Wage Caps & Limits
    annualTaxableWageCap: { type: Number, required: true }, // e.g., $153,164 for CA SDI in 2024
    maxWeeklyBenefit: { type: Number, default: 0 },

    // Job Protection Rules
    maxProtectedWeeks: { type: Number, default: 12 }, // e.g., 12 weeks under FMLA/PFML

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

pfmlPolicySchema.index({ tenantId: 1, stateCode: 1, programType: 1, taxYear: 1 }, { unique: true });
const PFMLPolicy = mongoose.model('PFMLPolicy', pfmlPolicySchema);

/**
 * SDIContributionLedger Schema
 * Tracks YTD taxable wages and contributions to enforce annual wage caps.
 */
const sdiContributionLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PFMLPolicy', required: true },

    periodMonth: { type: Number, required: true },
    periodYear: { type: Number, required: true },

    grossPay: { type: Number, required: true },
    taxableWage: { type: Number, required: true }, // Gross pay minus amount over YTD cap

    employeeWithholding: { type: Number, required: true },
    employerLiability: { type: Number, default: 0 },

    ytdTaxableWages: { type: Number, required: true },
    ytdContributions: { type: Number, required: true },

    hitWageCap: { type: Boolean, default: false }
}, { timestamps: true });

sdiContributionLedgerSchema.index({ tenantId: 1, employeeId: 1, periodYear: 1, periodMonth: 1, policyId: 1 }, { unique: true });
const SDIContributionLedger = mongoose.model('SDIContributionLedger', sdiContributionLedgerSchema);

/**
 * LeaveJobProtection Schema
 * Tracks the expiration of state-mandated job protection for employees on leave.
 */
const leaveJobProtectionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PFMLPolicy', required: true },

    leaveStartDate: { type: Date, required: true },
    maxProtectedWeeks: { type: Number, required: true },
    protectionEndDate: { type: Date, required: true },

    status: {
        type: String,
        enum: ['Active', 'Expiring Soon', 'Expired', 'Returned to Work'],
        default: 'Active',
        index: true
    },

    alertTriggered: { type: Boolean, default: false }
}, { timestamps: true });

const LeaveJobProtection = mongoose.model('LeaveJobProtection', leaveJobProtectionSchema);

module.exports = { PFMLPolicy, SDIContributionLedger, LeaveJobProtection };
