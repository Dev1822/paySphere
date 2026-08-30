/**
 * @fileoverview Investigation Workflow Models
 * @description Mongoose schemas for tracking investigation steps, case comments,
 * assignment history, and evidence attachments within the Grievance & Employee
 * Relations Hub. These models underpin the case lifecycle from initial filing
 * through resolution, with full audit trail support.
 */
const mongoose = require('mongoose');

// ============================================================================
// Investigation Step Schema
// ============================================================================

const investigationStepSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      required: true,
      index: true,
    },
    stepNumber: { type: Number, required: true },
    actionType: {
      type: String,
      enum: [
        'INTAKE_INTERVIEW',
        'WITNESS_STATEMENT',
        'EVIDENCE_COLLECTION',
        'FACT_FINDING',
        'HEARING_SCHEDULED',
        'HEARING_CONDUCTED',
        'FOLLOW_UP',
        'RECOMMENDATION',
        'LEGAL_REVIEW',
        'EXTERNAL_ESCALATION',
        'COMMUNICATION_SENT',
        'OTHER',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    confidentialNotes: { type: String, default: '', maxlength: 5000 },
    isConfidential: { type: Boolean, default: false },
    attachments: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
        mimeType: { type: String, default: 'application/octet-stream' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED'],
      default: 'PENDING',
    },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

investigationStepSchema.index({ tenantId: 1, caseId: 1, stepNumber: 1 });
investigationStepSchema.index({ tenantId: 1, performedBy: 1 });

const InvestigationStep = mongoose.model(
  'InvestigationStep',
  investigationStepSchema,
);

// ============================================================================
// Case Comment Schema
// ============================================================================

const caseCommentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: { type: String, required: true, maxlength: 3000 },
    isInternal: { type: Boolean, default: false },
    isEncrypted: { type: Boolean, default: false },
    encryptedContent: { type: String, default: null },
    encryptionIV: { type: String, default: null },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaseComment',
      default: null,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String, maxlength: 4 },
        reactedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

caseCommentSchema.index({ tenantId: 1, caseId: 1, createdAt: -1 });

const CaseComment = mongoose.model('CaseComment', caseCommentSchema);

// ============================================================================
// Case Assignment History Schema
// ============================================================================

const caseAssignmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: [
        'INVESTIGATOR',
        'LEGAL_COUNSEL',
        'HRBP',
        'OBSERVER',
        'REVIEWER',
        'EXTERNAL_CONSULTANT',
      ],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    unassignedAt: { type: Date, default: null },
    unassignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

caseAssignmentSchema.index({ tenantId: 1, caseId: 1, isActive: 1 });

const CaseAssignment = mongoose.model('CaseAssignment', caseAssignmentSchema);

// ============================================================================
// Case Evidence Schema
// ============================================================================

const caseEvidenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      required: true,
      index: true,
    },
    evidenceType: {
      type: String,
      enum: [
        'DOCUMENT',
        'EMAIL',
        'PHOTOGRAPH',
        'VIDEO',
        'AUDIO',
        'SCREENSHOT',
        'POLICE_REPORT',
        'MEDICAL_RECORD',
        'WITNESS_DECLARATION',
        'OTHER',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isAdmissible: { type: Boolean, default: true },
    confidentialityLevel: {
      type: String,
      enum: ['PUBLIC', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL', 'RESTRICTED'],
      default: 'CONFIDENTIAL',
    },
    hash: { type: String, default: null },
    verified: { type: Boolean, default: false },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

caseEvidenceSchema.index({ tenantId: 1, caseId: 1 });

const CaseEvidence = mongoose.model('CaseEvidence', caseEvidenceSchema);

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  InvestigationStep,
  CaseComment,
  CaseAssignment,
  CaseEvidence,
};
