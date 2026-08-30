/**
 * @fileoverview Document Vault & E-Signature Schemas
 * @description Manages employee document storage, categorization, access control,
 * and digital e-signature request workflows with audit trails.
 */
const mongoose = require('mongoose');

// ============================================================================
// Document Category Schema
// ============================================================================

const documentCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    icon: { type: String, default: 'file' },
    color: { type: String, default: '#6366f1' },
    accessLevel: {
      type: String,
      enum: ['EMPLOYEE_ONLY', 'HR_ONLY', 'ADMIN_ONLY', 'MANAGER_AND_ABOVE'],
      default: 'HR_ONLY',
    },
    retentionDays: { type: Number, default: 2555 }, // ~7 years default
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

documentCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

const DocumentCategory = mongoose.model('DocumentCategory', documentCategorySchema);

// ============================================================================
// Employee Document Schema
// ============================================================================

const employeeDocumentSchema = new mongoose.Schema(
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
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentCategory',
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    fileHash: { type: String, default: null }, // SHA-256 for integrity
    version: { type: Number, default: 1 },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isConfidential: { type: Boolean, default: false },
    tags: [{ type: String, maxlength: 50 }],
    expiryDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW'],
      default: 'ACTIVE',
    },
    accessLog: [
      {
        accessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        accessedAt: { type: Date, default: Date.now },
        action: {
          type: String,
          enum: ['VIEWED', 'DOWNLOADED', 'UPDATED', 'DELETED'],
        },
      },
    ],
  },
  { timestamps: true },
);

employeeDocumentSchema.index({ tenantId: 1, employeeId: 1, categoryId: 1 });
employeeDocumentSchema.index({ tenantId: 1, status: 1 });

const EmployeeDocument = mongoose.model('EmployeeDocument', employeeDocumentSchema);

// ============================================================================
// E-Signature Request Schema
// ============================================================================

const eSignatureRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeDocument',
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, default: '', maxlength: 1000 },

    // Signers in order
    signers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        name: { type: String, required: true },
        email: { type: String, required: true },
        order: { type: Number, required: true },
        status: {
          type: String,
          enum: ['PENDING', 'SIGNED', 'DECLINED', 'EXPIRED'],
          default: 'PENDING',
        },
        signedAt: { type: Date, default: null },
        declinedAt: { type: Date, default: null },
        declineReason: { type: String, default: '' },
        ipAddress: { type: String, default: '' },
        signatureData: { type: String, default: null }, // Base64 signature image
      },
    ],

    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },

    // Security
    accessCode: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },

    // Audit
    auditTrail: [
      {
        event: { type: String, required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorName: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        details: { type: String, default: '' },
        ipAddress: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true },
);

eSignatureRequestSchema.index({ tenantId: 1, status: 1 });
eSignatureRequestSchema.index({ tenantId: 1, 'signers.userId': 1, status: 1 });

const ESignatureRequest = mongoose.model('ESignatureRequest', eSignatureRequestSchema);

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  DocumentCategory,
  EmployeeDocument,
  ESignatureRequest,
};
