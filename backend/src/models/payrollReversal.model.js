/**
 * @fileoverview Payroll Reversal & Clawback Schemas
 * @description Tracks formal payroll reversals, gross/tax deltas, and recovery schedules
 * for mid-month clawbacks without mutating the immutable payroll ledger.
 * Issues: #1166, #1936
 */
const mongoose = require('mongoose');

// Legacy Schema - Payroll Reversal with Clawback Schedule
const clawbackScheduleSchema = new mongoose.Schema({
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    deductionAmount: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ['Pending', 'Deducted', 'Skipped'],
        default: 'Pending'
    },
    appliedToPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { _id: true });

const payrollReversalSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    originalPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },

    // Financial Deltas
    grossOverpaid: { type: Number, required: true, min: 0 },
    taxOverpaid: { type: Number, required: true, min: 0 },
    statutoryOverpaid: { type: Number, required: true, min: 0 }, // PF/ESI
    netOverpaid: { type: Number, required: true, min: 0 }, // The actual cash to be clawed back

    reason: { type: String, required: true, maxlength: 1000 },

    status: {
        type: String,
        enum: ['Draft', 'Pending Approval', 'Approved', 'Recovery Active', 'Fully Recovered', 'Cancelled'],
        default: 'Draft',
        index: true
    },

    // Recovery Plan
    recoveryMonths: { type: Number, default: 1, min: 1, max: 12 },
    clawbackSchedule: [clawbackScheduleSchema],

    // Accounting
    journalEntries: [{
        accountName: String,
        nature: { type: String, enum: ['Debit', 'Credit'] },
        amount: Number
    }],

    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null }
}, { timestamps: true });

payrollReversalSchema.index({ tenantId: 1, status: 1 });
const PayrollReversal = mongoose.model('PayrollReversal', payrollReversalSchema);

// New Schema - Payroll Reversal Order (Issue #1936)
const payrollReversalOrderSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    originalPayrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },
    reason: {
        type: String,
        enum: ['Overpayment', 'Lost Check', 'Bounced ACH', 'Duplicate Payment'],
        required: true
    },
    originalGross: { type: Number, required: true },
    originalNet: { type: Number, required: true },
    taxReclaimAmount: { type: Number, default: 0 },
    isCrossPeriod: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['Initiated', 'Taxes Reclaimed', 'Receivable Created', 'Fully Recovered'],
        default: 'Initiated'
    }
}, { timestamps: true });

const PayrollReversalOrder = mongoose.model('PayrollReversalOrder', payrollReversalOrderSchema);

// Overpayment Receivable Schema (Issue #1936)
const overpaymentReceivableSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    reversalId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollReversalOrder', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    totalOwed: { type: Number, required: true },
    amountRecovered: { type: Number, default: 0 },
    remainingBalance: { type: Number, required: true },
    amortizationSchedule: [{
        payrollRunId: mongoose.Schema.Types.ObjectId,
        deductionAmount: Number,
        status: { type: String, default: 'Pending' }
    }],
    status: {
        type: String,
        enum: ['Active', 'Paid Off', 'Written Off'],
        default: 'Active'
    }
}, { timestamps: true });

const OverpaymentReceivable = mongoose.model('OverpaymentReceivable', overpaymentReceivableSchema);

// Tax Adjustment Ledger Schema (Issue #1936)
const taxAdjustmentLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    reversalId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollReversalOrder', required: true },
    taxType: {
        type: String,
        enum: ['Federal', 'State', 'FICA', 'Medicare'],
        required: true
    },
    adjustmentAmount: { type: Number, required: true },
    requiresAmendedReturn: { type: Boolean, default: false },
    quarter: { type: Number },
    year: { type: Number }
}, { timestamps: true });

const TaxAdjustmentLedger = mongoose.model('TaxAdjustmentLedger', taxAdjustmentLedgerSchema);

module.exports = {
    PayrollReversal,
    PayrollReversalOrder,
    OverpaymentReceivable,
    TaxAdjustmentLedger
};
