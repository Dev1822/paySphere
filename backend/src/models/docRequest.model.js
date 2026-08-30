/**
 * @fileoverview Document Request & E-Signature Workflow Schemas
 * @description Manages employee requests for official HR documents such as
 *   experience letters, salary certificates, NOCs, relieving letters,
 *   employment verification, and custom documents. Includes approval workflow,
 *   e-signature tracking, delivery status, and audit logging.
 */

const mongoose = require('mongoose');

// ─── Document Template ──────────────────────────────────────────────────────
// Predefined document types that employees can request.

const documentTemplateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: { type: String, default: '', maxlength: 1000 },
    category: {
      type: String,
      enum: [
        'Employment',
        'Compensation',
        'Tax',
        'Legal',
        'Immigration',
        'Custom',
      ],
      default: 'Employment',
      index: true,
    },
    /** Fields the employee must fill when requesting this document. */
    requiredFields: [
      {
        fieldName: { type: String, required: true },
        fieldLabel: { type: String, required: true },
        fieldType: {
          type: String,
          enum: ['text', 'date', 'select', 'textarea'],
          default: 'text',
        },
        options: { type: [String], default: [] },
        isOptional: { type: Boolean, default: false },
      },
    ],
    /** Turnaround time in business days. */
    standardTATDays: { type: Number, default: 3, min: 0, max: 30 },
    /** Whether this document requires manager approval. */
    requiresManagerApproval: { type: Boolean, default: true },
    /** Whether this document requires HR approval. */
    requiresHRApproval: { type: Boolean, default: true },
    /** Whether the document needs a digital signature. */
    requiresSignature: { type: Boolean, default: false },
    /** Fee charged for the document, if any. */
    feeAmount: { type: Number, default: 0, min: 0 },
    /** Active years of employment required. */
    minEmploymentMonths: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

documentTemplateSchema.index(
  { tenantId: 1, code: 1 },
  { unique: true },
);

// ─── Document Request ───────────────────────────────────────────────────────
// An individual request submitted by an employee.

const documentRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentTemplate',
      required: true,
      index: true,
    },
    requestNumber: {
      type: String,
      required: true,
      unique: true,
    },
    /** Custom field values submitted by the employee. */
    fieldValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** Free-text additional notes. */
    notes: { type: String, default: '', maxlength: 500 },
    urgency: {
      type: String,
      enum: ['Normal', 'Urgent'],
      default: 'Normal',
    },
    status: {
      type: String,
      enum: [
        'Draft',
        'Submitted',
        'ManagerReview',
        'ManagerApproved',
        'ManagerRejected',
        'HRReview',
        'HROnHold',
        'HRApproved',
        'HRRejected',
        'Processing',
        'ReadyForSignature',
        'Signed',
        'Delivered',
        'Cancelled',
        'Expired',
      ],
      default: 'Draft',
      index: true,
    },
    /** Scheduled delivery date based on TAT. */
    expectedDeliveryDate: { type: Date, default: null },
    actualDeliveryDate: { type: Date, default: null },
    /** The generated document URL after processing. */
    documentUrl: { type: String, default: '', maxlength: 2000 },
    /** File name of the generated document. */
    documentFileName: { type: String, default: '', maxlength: 255 },
    /** Delivery method after document is generated. */
    deliveryMethod: {
      type: String,
      enum: ['Download', 'Email', 'Both'],
      default: 'Download',
    },
    /** Approval chain */
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    managerActionAt: { type: Date, default: null },
    managerComment: { type: String, default: '', maxlength: 500 },
    hrAssigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    hrActionAt: { type: Date, default: null },
    hrComment: { type: String, default: '', maxlength: 500 },
    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelReason: { type: String, default: '', maxlength: 500 },
    /** Audit trail for full lifecycle tracking. */
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        changedAt: { type: Date, default: Date.now },
        comment: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true },
);

documentRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
documentRequestSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

// ─── E-Signature Log ────────────────────────────────────────────────────────
// Tracks each signature event on a generated document.

const eSignatureLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentRequest',
      required: true,
      index: true,
    },
    signerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    signerRole: {
      type: String,
      enum: ['Employee', 'Manager', 'HR', 'Director', 'Admin'],
      required: true,
    },
    signerName: { type: String, required: true },
    signerEmail: { type: String, required: true },
    signatureType: {
      type: String,
      enum: ['Digital', 'Wet', 'Stamp', 'Auto'],
      default: 'Digital',
    },
    status: {
      type: String,
      enum: ['Pending', 'Signed', 'Declined', 'Expired'],
      default: 'Pending',
      index: true,
    },
    signedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    declineReason: { type: String, default: '', maxlength: 500 },
    /** IP address of the signer at time of signature. */
    ipAddress: { type: String, default: '' },
    /** User agent string for audit. */
    userAgent: { type: String, default: '' },
    /** Signature image or certificate reference. */
    signatureRef: { type: String, default: '' },
    /** Expiry for the signing link. */
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

eSignatureLogSchema.index({ requestId: 1, status: 1 });

// ─── Document Delivery Log ──────────────────────────────────────────────────
// Tracks how and when a document was delivered to the employee.

const documentDeliveryLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentRequest',
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ['Download', 'Email', 'Postal'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Sent', 'Bounced', 'Failed'],
      default: 'Pending',
    },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    emailTo: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    postalAddress: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    attempts: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// ─── Export Models ──────────────────────────────────────────────────────────

const DocumentTemplate = mongoose.model(
  'DocumentTemplate',
  documentTemplateSchema,
);
const DocumentRequest = mongoose.model(
  'DocumentRequest',
  documentRequestSchema,
);
const ESignatureLog = mongoose.model('ESignatureLog', eSignatureLogSchema);
const DocumentDeliveryLog = mongoose.model(
  'DocumentDeliveryLog',
  documentDeliveryLogSchema,
);

module.exports = {
  DocumentTemplate,
  DocumentRequest,
  ESignatureLog,
  DocumentDeliveryLog,
};
