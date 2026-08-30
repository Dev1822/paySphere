/**
 * @fileoverview Data Privacy, PII Masking & GDPR/CCPA Schemas
 * @description Tracks privacy consents, field-level masking rules, data erasure requests, 
 * and immutable PII access audit logs for SOC2/GDPR compliance.
 * Issue: #1870
 */
const mongoose = require('mongoose');

/**
 * PrivacyConsent Schema
 * Tracks employee consent for data processing under GDPR/CCPA.
 */
const privacyConsentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    consentType: {
        type: String,
        enum: ['Payroll Processing', 'Benefits Administration', 'Third-Party Sharing', 'Marketing'],
        required: true
    },

    isGranted: { type: Boolean, required: true },
    grantedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },

    consentVersion: { type: String, required: true }, // e.g., "v2.1_2026"
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' }
}, { timestamps: true });

privacyConsentSchema.index({ tenantId: 1, employeeId: 1, consentType: 1 }, { unique: true });
const PrivacyConsent = mongoose.model('PrivacyConsent', privacyConsentSchema);

/**
 * PIIMaskingRule Schema
 * Configures dynamic masking patterns based on user roles and data fields.
 */
const piiMaskingRuleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    fieldName: { type: String, required: true }, // e.g., 'ssn', 'bankAccountNumber', 'homeAddress'

    maskPattern: {
        type: String,
        enum: ['Full', 'Partial', 'None'],
        default: 'Partial'
    },

    // Roles that can see the unmasked data
    bypassRoles: [{ type: String }], // e.g., ['SuperAdmin', 'PayrollDirector']

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

piiMaskingRuleSchema.index({ tenantId: 1, fieldName: 1 }, { unique: true });
const PIIMaskingRule = mongoose.model('PIIMaskingRule', piiMaskingRuleSchema);

/**
 * DataErasureRequest Schema
 * Tracks GDPR "Right to be Forgotten" and CCPA deletion workflows.
 */
const dataErasureRequestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    requestType: { type: String, enum: ['GDPR Erasure', 'CCPA Deletion', 'Data Export'], required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: {
        type: String,
        enum: ['Pending Review', 'Approved', 'Processing', 'Completed', 'Rejected (Legal Hold)'],
        default: 'Pending Review',
        index: true
    },

    // Legal Hold Guardrail: IRS requires 7-year retention of financial data
    hasLegalHold: { type: Boolean, default: true },
    anonymizedAt: { type: Date, default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const DataErasureRequest = mongoose.model('DataErasureRequest', dataErasureRequestSchema);

/**
 * DataAuditLog Schema
 * Immutable log of every time PII is accessed, exported, or modified.
 */
const dataAuditLogSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, required: true },

    action: {
        type: String,
        enum: ['Viewed PII', 'Exported PII', 'Modified PII', 'Executed Erasure'],
        required: true
    },

    targetEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    fieldsAccessed: [{ type: String }], // e.g., ['ssn', 'bankAccountNumber']

    ipAddress: { type: String, default: '' },
    wasMasked: { type: Boolean, default: true } // True if the user only saw masked data
}, { timestamps: true });

const DataAuditLog = mongoose.model('DataAuditLog', dataAuditLogSchema);

module.exports = { PrivacyConsent, PIIMaskingRule, DataErasureRequest, DataAuditLog };
