/**
 * @fileoverview Employee Offboarding & Exit Clearance Schemas
 * @description Manages the full employee offboarding lifecycle including
 *   resignation/termination tracking, clearance checklists, asset return,
 *   knowledge transfer, exit interviews, final settlement, and analytics.
 */

const mongoose = require('mongoose');

// ─── Offboarding Process ────────────────────────────────────────────────────
// Master record for an employee's offboarding journey.

const offboardingProcessSchema = new mongoose.Schema(
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
    /** Resignation or Termination */
    exitType: {
      type: String,
      enum: ['Resignation', 'Termination', 'Retirement', 'EndOfContract', 'MutualSeparation'],
      required: true,
    },
    /** Last working day as confirmed by HR. */
    lastWorkingDay: { type: Date, required: true, index: true },
    /** Date the resignation was submitted. */
    resignationDate: { type: Date, default: null },
    /** Notice period in days per contract. */
    noticePeriodDays: { type: Number, default: 30, min: 0 },
    /** Whether notice period is being served or bought out. */
    noticePeriodStatus: {
      type: String,
      enum: ['Serving', 'BoughtOut', 'Waived', 'GardenLeave'],
      default: 'Serving',
    },
    /** Reason for leaving (from exit interview or resignation letter). */
    leavingReason: {
      type: String,
      enum: [
        'BetterOpportunity',
        'Compensation',
        'Relocation',
        'CareerGrowth',
        'WorkLifeBalance',
        'Management',
        'CompanyCulture',
        'Health',
        'Personal',
        'Retirement',
        'ContractEnd',
        'Performance',
        'Misconduct',
        'Other',
      ],
      default: 'Other',
    },
    leavingReasonNotes: { type: String, default: '', maxlength: 1000 },
    /** Overall offboarding status. */
    status: {
      type: String,
      enum: [
        'Initiated',
        'InProgress',
        'ClearancePending',
        'SettlementPending',
        'Completed',
        'OnHold',
      ],
      default: 'Initiated',
      index: true,
    },
    /** Progress percentage (0-100). */
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    /** Handover details. */
    reportingToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    handoverToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    handoverStatus: {
      type: String,
      enum: ['NotStarted', 'InProgress', 'Completed'],
      default: 'NotStarted',
    },
    handoverNotes: { type: String, default: '', maxlength: 2000 },
    /** Exit interview. */
    exitInterviewConducted: { type: Boolean, default: false },
    exitInterviewDate: { type: Date, default: null },
    exitInterviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    exitInterviewRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    exitInterviewFeedback: { type: String, default: '', maxlength: 5000 },
    /** Final settlement. */
    settlementStatus: {
      type: String,
      enum: ['NotInitiated', 'InProgress', 'Processed', 'Paid'],
      default: 'NotInitiated',
    },
    settlementAmount: { type: Number, default: 0, min: 0 },
    settlementProcessedAt: { type: Date, default: null },
    /** Rehire eligibility. */
    isEligibleForRehire: { type: Boolean, default: true },
    rehireNotes: { type: String, default: '', maxlength: 500 },
    /** Completion. */
    completedAt: { type: Date, default: null },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** Status history for full audit trail. */
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        comment: { type: String, default: '' },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

offboardingProcessSchema.index(
  { tenantId: 1, employeeId: 1 },
  { unique: true },
);

// ─── Clearance Checklist Item ───────────────────────────────────────────────
// Individual clearance task that must be completed before offboarding.

const clearanceChecklistItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    offboardingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OffboardingProcess',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['IT', 'HR', 'Finance', 'Admin', 'Manager', 'Facilities', 'Legal'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 500 },
    /** Whether this item is mandatory. */
    isMandatory: { type: Boolean, default: true },
    /** Assigned to a specific user for clearance. */
    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'InReview', 'Cleared', 'Rejected', 'Skipped'],
      default: 'Pending',
      index: true,
    },
    clearedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    clearedAt: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 500 },
    /** Due date for this clearance item. */
    dueDate: { type: Date, default: null },
    /** Order in the checklist. */
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

clearanceChecklistItemSchema.index(
  { offboardingId: 1, category: 1, sortOrder: 1 },
);

// ─── Asset Return Record ────────────────────────────────────────────────────
// Tracks company assets that must be returned.

const assetReturnSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    offboardingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OffboardingProcess',
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: ['Laptop', 'Phone', 'Tablet', 'Badge', 'Keys', 'Vehicle', 'Other'],
      required: true,
    },
    assetDescription: { type: String, required: true, trim: true, maxlength: 200 },
    assetTag: { type: String, default: '', trim: true, maxlength: 50 },
    serialNumber: { type: String, default: '', trim: true, maxlength: 100 },
    /** Estimated value for deduction calculation. */
    estimatedValue: { type: Number, default: 0, min: 0 },
    /** Condition when returned. */
    returnCondition: {
      type: String,
      enum: ['Good', 'Fair', 'Poor', 'Damaged', 'Lost'],
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Returned', 'Damaged', 'Lost', 'Waived'],
      default: 'Pending',
      index: true,
    },
    returnedAt: { type: Date, default: null },
    receivedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** Deduction amount if asset is not returned or damaged. */
    deductionAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

// ─── Knowledge Transfer Record ──────────────────────────────────────────────
// Tracks knowledge transfer sessions and documentation.

const knowledgeTransferSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    offboardingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OffboardingProcess',
      required: true,
      index: true,
    },
    /** Who the knowledge is being transferred to. */
    transferToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    /** Topic or area of knowledge. */
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    /** Whether a session was conducted. */
    sessionConducted: { type: Boolean, default: false },
    sessionDate: { type: Date, default: null },
    sessionDurationMinutes: { type: Number, default: 0, min: 0 },
    /** Documentation link (Confluence, Google Docs, etc.). */
    documentationUrl: { type: String, default: '', maxlength: 500 },
    status: {
      type: String,
      enum: ['Pending', 'InProgress', 'Completed'],
      default: 'Pending',
      index: true,
    },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);

// ─── Offboarding Activity Log ───────────────────────────────────────────────
// Granular audit trail for all offboarding actions.

const offboardingActivityLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    offboardingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OffboardingProcess',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'ProcessInitiated',
        'StatusChanged',
        'ClearanceCompleted',
        'AssetReturned',
        'KnowledgeTransferCompleted',
        'ExitInterviewScheduled',
        'ExitInterviewCompleted',
        'SettlementInitiated',
        'SettlementProcessed',
        'ProcessCompleted',
        'ProcessOnHold',
        'CommentAdded',
      ],
      required: true,
    },
    details: { type: mongoose.Schema.Mixed, default: {} },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true },
);

offboardingActivityLogSchema.index({ tenantId: 1, offboardingId: 1, createdAt: -1 });

// ─── Export Models ──────────────────────────────────────────────────────────

const OffboardingProcess = mongoose.model(
  'OffboardingProcess',
  offboardingProcessSchema,
);
const ClearanceChecklistItem = mongoose.model(
  'ClearanceChecklistItem',
  clearanceChecklistItemSchema,
);
const AssetReturn = mongoose.model('AssetReturn', assetReturnSchema);
const KnowledgeTransfer = mongoose.model(
  'KnowledgeTransfer',
  knowledgeTransferSchema,
);
const OffboardingActivityLog = mongoose.model(
  'OffboardingActivityLog',
  offboardingActivityLogSchema,
);

module.exports = {
  OffboardingProcess,
  ClearanceChecklistItem,
  AssetReturn,
  KnowledgeTransfer,
  OffboardingActivityLog,
};
