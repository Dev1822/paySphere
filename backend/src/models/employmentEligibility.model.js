/**
 * @fileoverview I-9 & Employment Eligibility Schemas
 * @description Tracks I-9 form sections, employment authorization documents, and E-Verify cases.
 * Issue: #1621
 */
const mongoose = require('mongoose');

/**
 * EmploymentAuthorization Schema
 * Tracks documents with expiration dates requiring reverification.
 */
const employmentAuthorizationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    documentType: { type: String, required: true }, // e.g., 'EAD', 'H1B Visa', 'Foreign Passport'
    documentNumber: { type: String, required: true },
    expirationDate: { type: Date, required: true },

    reverificationStatus: {
        type: String,
        enum: ['Valid', 'Expiring Soon', 'Expired', 'Reverified'],
        default: 'Valid'
    },
    alertTriggered: { type: Boolean, default: false }
}, { timestamps: true });

const EmploymentAuthorization = mongoose.model('EmploymentAuthorization', employmentAuthorizationSchema);

/**
 * I9Record Schema
 * Tracks the completion status of I-9 Section 1, 2, and 3.
 */
const i9RecordSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },

    section1Completed: { type: Boolean, default: false },
    section1Date: { type: Date, default: null },

    section2Completed: { type: Boolean, default: false },
    section2Date: { type: Date, default: null },
    section2VerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Payroll Guardrail
    isClearedForPayroll: { type: Boolean, default: false },

    eVerifyCaseId: { type: String, default: null },
    eVerifyStatus: {
        type: String,
        enum: ['Pending', 'Submitted', 'Employment Authorized', 'TNC', 'Resolved', 'Not Submitted'],
        default: 'Not Submitted'
    }
}, { timestamps: true });

const I9Record = mongoose.model('I9Record', i9RecordSchema);

module.exports = { EmploymentAuthorization, I9Record };
