/**
 * @fileoverview Bank Disbursement & NACHA Schemas
 * @description Tracks employee bank account mappings, NACHA originator configurations,
 * and historical disbursement file exports.
 * Issue: #1733
 */
const mongoose = require('mongoose');

/**
 * BankAccountMapping Schema
 * Stores employee direct deposit details and split percentages.
 */
const bankAccountMappingSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    accountNickname: { type: String, default: 'Primary Account' },
    routingNumber: { type: String, required: true, match: /^[0-9]{9}$/ },
    accountNumber: { type: String, required: true },
    accountType: { type: String, enum: ['Checking', 'Savings'], required: true },

    // Split deposit configuration
    splitPercentage: { type: Number, default: 100, min: 0, max: 100 },
    priority: { type: Number, default: 1 }, // 1 = Primary, 2 = Secondary

    isVerified: { type: Boolean, default: false }, // Requires micro-deposit or pre-note verification
    prenoteStatus: { type: String, enum: ['Pending', 'Approved', 'Failed'], default: 'Pending' }
}, { timestamps: true });

bankAccountMappingSchema.index({ tenantId: 1, employeeId: 1, priority: 1 });
const BankAccountMapping = mongoose.model('BankAccountMapping', bankAccountMappingSchema);

/**
 * NACHABatchConfiguration Schema
 * Stores the company's ACH originator details required for NACHA File Headers.
 */
const nachaBatchConfigurationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },

    // File Header Fields
    immediateDestination: { type: String, required: true, match: /^[0-9]{9}$/ }, // Bank Routing Number
    immediateOrigin: { type: String, required: true, match: /^[0-9]{9}$/ },      // Company Tax ID or Routing
    destinationName: { type: String, required: true, maxlength: 23 },            // Bank Name
    originatorName: { type: String, required: true, maxlength: 23 },             // Company Name

    // Batch Header Fields
    companyIdentification: { type: String, required: true, maxlength: 10 },      // 1 + Tax ID
    companyEntryDescription: { type: String, default: 'PAYROLL', maxlength: 10 },
    standardEntryClass: { type: String, default: 'PPD', enum: ['PPD', 'CCD'] }, // Prearranged Payment and Deposit

    // Operating Bank Account (Offset/Debit account)
    operatingBankRouting: { type: String, required: true, match: /^[0-9]{9}$/ },
    operatingBankAccount: { type: String, required: true }
}, { timestamps: true });

const NACHABatchConfiguration = mongoose.model('NACHABatchConfiguration', nachaBatchConfigurationSchema);

/**
 * DisbursementFile Schema
 * Audit log of generated NACHA files.
 */
const disbursementFileSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },

    fileName: { type: String, required: true },
    fileContent: { type: String, required: true }, // The strict 94-char fixed width text

    // Balancing Metrics
    batchCount: { type: Number, default: 0 },
    entryCount: { type: Number, default: 0 },
    totalDebitAmount: { type: Number, default: 0 }, // Company operating account debit
    totalCreditAmount: { type: Number, default: 0 }, // Employee account credits

    status: {
        type: String,
        enum: ['Generated', 'Uploaded to Bank', 'Rejected', 'Settled'],
        default: 'Generated'
    },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const DisbursementFile = mongoose.model('DisbursementFile', disbursementFileSchema);

module.exports = { BankAccountMapping, NACHABatchConfiguration, DisbursementFile };
