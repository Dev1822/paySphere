/**
 * @fileoverview Escheatment & Unclaimed Property Schemas
 * @description Tracks uncashed payroll checks, due diligence outreach logs, 
 * and NAUPA state remittance batches.
 * Issue: #2013
 */
const mongoose = require('mongoose');

/**
 * UncashedPayrollCheck Schema
 * Tracks physical checks or bounced ACH transfers that remain unclaimed.
 */
const uncashedPayrollCheckSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    checkNumber: { type: String, required: true },
    issueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    propertyType: { type: String, default: 'MS05' }, // NAUPA code for Wages

    // Employee Last Known Address (determines which state gets the funds)
    lastKnownState: { type: String, required: true, uppercase: true },
    lastKnownAddress: { type: String, required: true },
    lastKnownZip: { type: String, required: true },

    // Dormancy Tracking
    dormancyDate: { type: Date, required: true },
    isDormant: { type: Boolean, default: false },

    // Status
    status: {
        type: String,
        enum: ['Outstanding', 'Cashed', 'Voided', 'Due Diligence Sent', 'Escheated to State', 'Stop Payment Issued'],
        default: 'Outstanding',
        index: true
    },

    stopPaymentRequested: { type: Boolean, default: false }
}, { timestamps: true });

uncashedPayrollCheckSchema.index({ tenantId: 1, checkNumber: 1 }, { unique: true });
const UncashedPayrollCheck = mongoose.model('UncashedPayrollCheck', uncashedPayrollCheckSchema);

/**
 * DueDiligenceLog Schema
 * Tracks statutory outreach attempts (letters) required before escheatment.
 */
const dueDiligenceLogSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    checkId: { type: mongoose.Schema.Types.ObjectId, ref: 'UncashedPayrollCheck', required: true },

    letterSentDate: { type: Date, required: true },
    sentVia: { type: String, enum: ['USPS First Class', 'USPS Certified', 'Email'], default: 'USPS First Class' },

    responseReceived: { type: Boolean, default: false },
    responseDate: { type: Date, default: null },
    responseAction: { type: String, enum: ['None', 'Check Cashed', 'Address Updated', 'Reissued'], default: 'None' }
}, { timestamps: true });

const DueDiligenceLog = mongoose.model('DueDiligenceLog', dueDiligenceLogSchema);

/**
 * EscheatmentBatch Schema
 * Tracks the final NAUPA file generation and state remittance.
 */
const escheatmentBatchSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true },
    reportingYear: { type: Number, required: true },

    totalChecks: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    naupaFileContent: { type: String, default: '' },
    naupaFileName: { type: String, default: '' },

    status: { type: String, enum: ['Draft', 'Submitted to State', 'Accepted', 'Rejected'], default: 'Draft' },
    submittedAt: { type: Date, default: null },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

escheatmentBatchSchema.index({ tenantId: 1, stateCode: 1, reportingYear: 1 }, { unique: true });
const EscheatmentBatch = mongoose.model('EscheatmentBatch', escheatmentBatchSchema);

module.exports = { UncashedPayrollCheck, DueDiligenceLog, EscheatmentBatch };
