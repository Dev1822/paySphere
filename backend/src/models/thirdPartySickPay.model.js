/**
 * @fileoverview Third-Party Sick Pay Schemas
 * @description Tracks disability policies, carrier payment feeds, and taxable allocations.
 * Issue: #1868
 */
const mongoose = require('mongoose');

const disabilityPolicySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    policyName: { type: String, required: true },
    carrierName: { type: String, required: true },

    // Premium Split determines taxability
    employerPremiumPercentage: { type: Number, required: true, min: 0, max: 1 }, // e.g., 0.60 (60% paid by ER)
    employeePremiumPercentage: { type: Number, required: true, min: 0, max: 1 }, // e.g., 0.40 (40% paid by EE post-tax)

    isSubjectToFICA: { type: Boolean, default: true }, // Usually true for first 6 months of disability
    isSubjectToFUTA: { type: Boolean, default: true }
}, { timestamps: true });

const DisabilityPolicy = mongoose.model('DisabilityPolicy', disabilityPolicySchema);

const thirdPartyPaymentFeedSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DisabilityPolicy', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    paymentDate: { type: Date, required: true },
    grossBenefitAmount: { type: Number, required: true },

    // Calculated Fields
    taxablePercentage: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    nonTaxableAmount: { type: Number, default: 0 },

    ficaTaxable: { type: Boolean, default: true },
    status: { type: String, enum: ['Pending', 'Reconciled', 'Injected'], default: 'Pending' }
}, { timestamps: true });

const ThirdPartyPaymentFeed = mongoose.model('ThirdPartyPaymentFeed', thirdPartyPaymentFeedSchema);

const sickPayTaxLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    taxYear: { type: Number, required: true },

    ytdGrossSickPay: { type: Number, default: 0 },
    ytdTaxableSickPay: { type: Number, default: 0 }, // Maps to W-2 Box 1
    ytdFICATaxableSickPay: { type: Number, default: 0 } // Maps to W-2 Box 3/5
}, { timestamps: true });

sickPayTaxLedgerSchema.index({ tenantId: 1, employeeId: 1, taxYear: 1 }, { unique: true });
const SickPayTaxLedger = mongoose.model('SickPayTaxLedger', sickPayTaxLedgerSchema);

module.exports = { DisabilityPolicy, ThirdPartyPaymentFeed, SickPayTaxLedger };
