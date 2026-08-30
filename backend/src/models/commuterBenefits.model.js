/**
 * @fileoverview Commuter Benefits & Pre-Tax Deduction Schemas
 * @description Tracks employee elections, vendor transit feeds, and payroll deduction ledgers.
 * Issue: #1623
 */
const mongoose = require('mongoose');

/**
 * CommuterElection Schema
 * Tracks an employee's monthly pre-tax election for transit or parking.
 */
const commuterElectionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    benefitType: { type: String, enum: ['Transit', 'Parking', 'Vanpool'], required: true },
    electionAmount: { type: Number, required: true, min: 0 }, // Monthly pre-tax amount

    effectiveMonth: { type: Number, required: true, min: 1, max: 12 },
    effectiveYear: { type: Number, required: true },

    status: {
        type: String,
        enum: ['Active', 'Cancelled', 'Processed'],
        default: 'Active',
        index: true
    }
}, { timestamps: true });

commuterElectionSchema.index({ tenantId: 1, employeeId: 1, benefitType: 1, effectiveMonth: 1, effectiveYear: 1 }, { unique: true });
const CommuterElection = mongoose.model('CommuterElection', commuterElectionSchema);

/**
 * VendorTransitFeed Schema
 * Tracks monthly invoice feeds from third-party vendors (e.g., Edenred, WageWorks).
 */
const vendorTransitFeedSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vendorName: { type: String, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },

    totalInvoiced: { type: Number, required: true },
    lineItems: [{
        employeeId: mongoose.Schema.Types.ObjectId,
        externalId: String,
        amount: Number
    }],

    status: { type: String, enum: ['Uploaded', 'Reconciled'], default: 'Uploaded' }
}, { timestamps: true });

const VendorTransitFeed = mongoose.model('VendorTransitFeed', vendorTransitFeedSchema);

/**
 * PreTaxDeductionLedger Schema
 * Logs the final pre-tax deductions injected into payroll.
 */
const preTaxDeductionLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },

    benefitType: { type: String, required: true },
    electedAmount: { type: Number, required: true },
    actualDeduction: { type: Number, required: true }, // Capped by IRS limits

    month: { type: Number, required: true },
    year: { type: Number, required: true }
}, { timestamps: true });

const PreTaxDeductionLedger = mongoose.model('PreTaxDeductionLedger', preTaxDeductionLedgerSchema);

module.exports = { CommuterElection, VendorTransitFeed, PreTaxDeductionLedger };
