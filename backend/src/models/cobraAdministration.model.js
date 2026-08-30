/**
 * @fileoverview COBRA Administration & Billing Schemas
 * @description Tracks qualifying events, election windows, and premium billing ledgers 
 * to ensure ERISA compliance for continuation health coverage.
 * Issue: #1759
 */
const mongoose = require('mongoose');

/**
 * COBRAQualifyingEvent Schema
 * Records the event that triggers COBRA eligibility (e.g., termination, reduction in hours).
 */
const cobraQualifyingEventSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    eventType: {
        type: String,
        enum: ['Termination', 'ReductionInHours', 'Divorce', 'Death', 'MedicareEntitlement', 'DependentAgingOut'],
        required: true
    },
    eventDate: { type: Date, required: true },
    coverageEndDate: { type: Date, required: true }, // Date active coverage ends

    // ERISA Compliance Tracking
    noticeSentDate: { type: Date, default: null },
    isNoticeOverdue: { type: Boolean, default: false },

    status: {
        type: String,
        enum: ['Pending Notice', 'Notice Sent', 'Elected', 'Declined', 'Expired'],
        default: 'Pending Notice'
    }
}, { timestamps: true });

const COBRAQualifyingEvent = mongoose.model('COBRAQualifyingEvent', cobraQualifyingEventSchema);

/**
 * COBRAElection Schema
 * Tracks the participant's election of COBRA coverage and premium calculation basis.
 */
const cobraElectionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'COBRAQualifyingEvent', required: true, unique: true },

    electionDate: { type: Date, required: true }, // Must be within 60 days of event/notice
    coverageStartDate: { type: Date, required: true },
    maxCoverageEndDate: { type: Date, required: true }, // Usually 18 or 36 months

    // Premium Calculation Basis
    baseMonthlyPremium: { type: Number, required: true }, // Employer + Employee cost
    adminFeeRate: { type: Number, default: 0.02 }, // 2% standard, 50% for disability extension
    totalMonthlyPremium: { type: Number, required: true },

    isDisabilityExtension: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['Active', 'Cancelled', 'Exhausted', 'TerminatedForNonPayment'],
        default: 'Active'
    }
}, { timestamps: true });

const COBRAElection = mongoose.model('COBRAElection', cobraElectionSchema);

/**
 * PremiumBillingLedger Schema
 * Tracks monthly premium invoices, due dates, and payment grace periods.
 */
const premiumBillingLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: 'COBRAElection', required: true, index: true },

    coverageMonth: { type: Number, required: true },
    coverageYear: { type: Number, required: true },

    amountDue: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },

    dueDate: { type: Date, required: true },
    gracePeriodEndDate: { type: Date, required: true }, // 45 days for first payment, 30 days for subsequent
    isFirstPayment: { type: Boolean, default: false },

    status: {
        type: String,
        enum: ['Unpaid', 'Paid', 'Grace Period', 'Defaulted'],
        default: 'Unpaid'
    }
}, { timestamps: true });

premiumBillingLedgerSchema.index({ electionId: 1, coverageYear: 1, coverageMonth: 1 }, { unique: true });
const PremiumBillingLedger = mongoose.model('PremiumBillingLedger', premiumBillingLedgerSchema);

module.exports = { COBRAQualifyingEvent, COBRAElection, PremiumBillingLedger };
