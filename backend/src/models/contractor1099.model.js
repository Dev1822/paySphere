/**
 * @fileoverview Contractor 1099 & TIN Validation Schemas
 * @description Tracks annual contractor payments, TIN match statuses, and FIRE format drafts.
 * Issue: #1871
 */
const mongoose = require('mongoose');

/**
 * ContractorPaymentLedger Schema
 * Tracks YTD payments to non-employee contractors.
 */
const contractorPaymentLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true, index: true }, // Assuming Contractor model exists

    taxYear: { type: Number, required: true },
    paymentDate: { type: Date, required: true },

    // Box Allocations
    box1_NEC_NonemployeeCompensation: { type: Number, default: 0 },
    box3_MISC_OtherIncome: { type: Number, default: 0 },
    box4_MISC_FederalTaxWithheld: { type: Number, default: 0 }, // Backup withholding

    grossAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['ACH', 'Check', 'Wire'], default: 'ACH' }
}, { timestamps: true });

contractorPaymentLedgerSchema.index({ tenantId: 1, contractorId: 1, taxYear: 1 });
const ContractorPaymentLedger = mongoose.model('ContractorPaymentLedger', contractorPaymentLedgerSchema);

/**
 * TINValidationRecord Schema
 * Tracks the IRS TIN Matching status for a contractor.
 */
const tinValidationRecordSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true, unique: true },

    tinType: { type: String, enum: ['SSN', 'EIN'], required: true },
    tinValue: { type: String, required: true }, // Masked in UI, stored encrypted in DB ideally
    legalName: { type: String, required: true },

    irsMatchStatus: {
        type: String,
        enum: ['Pending', 'Match', 'Mismatch', 'B-Notice Sent'],
        default: 'Pending',
        index: true
    },

    requiresBackupWithholding: { type: Boolean, default: false },
    lastValidatedAt: { type: Date, default: null }
}, { timestamps: true });

const TINValidationRecord = mongoose.model('TINValidationRecord', tinValidationRecordSchema);

/**
 * Form1099Draft Schema
 * Stores the generated IRS FIRE-format magnetic media file.
 */
const form1099DraftSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    taxYear: { type: Number, required: true },

    totalNECRecords: { type: Number, default: 0 },
    totalMISCRecords: { type: Number, default: 0 },
    totalBackupWithholding: { type: Number, default: 0 },

    fileContent: { type: String, required: true }, // Fixed-width FIRE format
    fileName: { type: String, required: true },

    status: { type: String, enum: ['Draft', 'Submitted to IRS', 'Accepted', 'Rejected'], default: 'Draft' }
}, { timestamps: true });

const Form1099Draft = mongoose.model('Form1099Draft', form1099DraftSchema);

module.exports = { ContractorPaymentLedger, TINValidationRecord, Form1099Draft };
