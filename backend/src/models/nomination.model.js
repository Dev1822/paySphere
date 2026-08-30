/**
 * @fileoverview Nomination & Recognition Category Schemas
 * @description Mongoose schemas for structured peer-to-peer value-based nominations,
 * approval workflows, and monthly recognition cycles. Extends the existing
 * Kudos system with formal categories, manager approvals, and analytics.
 */
const mongoose = require('mongoose');

// ============================================================================
// Nomination Category Schema
// ============================================================================

const nominationCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    icon: { type: String, default: 'star' },
    color: { type: String, default: '#6366f1' },
    pointsPerNomination: { type: Number, required: true, min: 1, default: 10 },
    maxNominationsPerMonth: { type: Number, required: true, min: 1, default: 3 },
    requiresManagerApproval: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

nominationCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

const NominationCategory = mongoose.model(
  'NominationCategory',
  nominationCategorySchema,
);

// ============================================================================
// Nomination Schema
// ============================================================================

const nominationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NominationCategory',
      required: true,
    },
    nomineeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    nominatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title: { type: String, required: true, maxlength: 200 },
    reason: { type: String, required: true, maxlength: 2000 },
    impactDescription: { type: String, default: '', maxlength: 1000 },
    isPublic: { type: Boolean, default: true },
    pointsAwarded: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING_APPROVAL',
    },
    approvalNote: { type: String, default: '', maxlength: 500 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    reactionCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecognitionCycle',
      default: null,
    },
    // Reactions subdocument for quick emoji reactions
    reactions: [
      {
        _id: false,
        emoji: { type: String, required: true, maxlength: 4 },
        count: { type: Number, default: 0, min: 0 },
      },
    ],
  },
  { timestamps: true },
);

nominationSchema.index({ tenantId: 1, createdAt: -1 });
nominationSchema.index({ tenantId: 1, categoryId: 1 });
nominationSchema.index({ tenantId: 1, nomineeId: 1, createdAt: -1 });

const Nomination = mongoose.model('Nomination', nominationSchema);

// ============================================================================
// Recognition Cycle Schema
// ============================================================================

const recognitionCycleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2020, max: 2100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'CLOSED', 'FINALIZED'],
      default: 'DRAFT',
    },
    totalNominations: { type: Number, default: 0 },
    totalPointsAwarded: { type: Number, default: 0 },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

recognitionCycleSchema.index({ tenantId: 1, month: 1, year: 1 }, { unique: true });

const RecognitionCycle = mongoose.model('RecognitionCycle', recognitionCycleSchema);

// ============================================================================
// Nomination Comment Schema
// ============================================================================

const nominationCommentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    nominationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Nomination',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: { type: String, required: true, maxlength: 1000 },
    isManagerComment: { type: Boolean, default: false },
  },
  { timestamps: true },
);

nominationCommentSchema.index({ tenantId: 1, nominationId: 1, createdAt: -1 });

const NominationComment = mongoose.model('NominationComment', nominationCommentSchema);

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  NominationCategory,
  Nomination,
  RecognitionCycle,
  NominationComment,
};
