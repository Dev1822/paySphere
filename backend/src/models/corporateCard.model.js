/**
 * @fileoverview Corporate Card & Reconciliation Schemas
 * @description Tracks corporate card assignments, raw transaction feeds, 
 * receipt matching, and payroll clawback batches.
 * Issue: #1566
 */
const mongoose = require('mongoose');

/**
 * CorporateCard Schema
 * Represents a physical or virtual corporate card assigned to an employee.
 */
const corporateCardSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    cardLastFour: { type: String, required: true, minlength: 4, maxlength: 4 },
    cardIssuer: { type: String, enum: ['Amex', 'Visa', 'Mastercard', 'Brex', 'Ramp'], required: true },

    creditLimit: { type: Number, default: 5000 },
    monthlyLimit: { type: Number, default: 2000 },

    status: {
        type: String,
        enum: ['Active', 'Frozen', 'Cancelled', 'Lost'],
        default: 'Active',
        index: true
    },

    issuedAt: { type: Date, default: Date.now },
    receiptGracePeriodDays: { type: Number, default: 7 } // Days allowed to upload receipt before flagging
}, { timestamps: true });

const CorporateCard = mongoose.model('CorporateCard', corporateCardSchema);

/**
 * CardTransaction Schema
 * Raw transaction feed from the card issuer.
 */
const cardTransactionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorporateCard', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    externalTransactionId: { type: String, required: true, unique: true },
    merchantName: { type: String, required: true },
    merchantCategoryCode: { type: String, default: '' }, // MCC

    amount: { type: Number, required: true }, // Positive for charges
    currency: { type: String, default: 'USD' },
    transactionDate: { type: Date, required: true },

    // Receipt & Policy Compliance
    receiptUrl: { type: String, default: '' },
    receiptUploadedAt: { type: Date, default: null },
    notes: { type: String, default: '' },

    policyFlags: [{ type: String }], // e.g., 'Out of Policy', 'Missing Receipt'
    isPersonalSpend: { type: Boolean, default: false },
    isDisputed: { type: Boolean, default: false },

    status: {
        type: String,
        enum: ['Pending Receipt', 'Approved', 'Rejected', 'Clawback Initiated', 'Clawed Back'],
        default: 'Pending Receipt',
        index: true
    },

    reconciliationBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReconciliationBatch', default: null }
}, { timestamps: true });

const CardTransaction = mongoose.model('CardTransaction', cardTransactionSchema);

/**
 * ReconciliationBatch Schema
 * Monthly or weekly batch processing unreceipted/personal spend for payroll deduction.
 */
const reconciliationBatchSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    totalClawbackAmount: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Draft', 'Approved', 'Injected to Payroll'],
        default: 'Draft',
        index: true
    },

    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const ReconciliationBatch = mongoose.model('ReconciliationBatch', reconciliationBatchSchema);

module.exports = { CorporateCard, CardTransaction, ReconciliationBatch };
