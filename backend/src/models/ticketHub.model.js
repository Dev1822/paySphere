/**
 * @fileoverview Helpdesk & Ticketing Hub Schemas
 * @description Manages ticket categories, SLA policies, structured tickets with
 * multi-message threads, assignment routing, and escalation tracking.
 */
const mongoose = require('mongoose');

// ============================================================================
// Ticket Category Schema
// ============================================================================

const ticketCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    icon: { type: String, default: 'headphones' },
    color: { type: String, default: '#6366f1' },
    defaultPriority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

ticketCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

const TicketCategory = mongoose.model('TicketCategory', ticketCategorySchema);

// ============================================================================
// SLA Policy Schema
// ============================================================================

const slaPolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      required: true,
    },
    firstResponseHours: { type: Number, required: true, min: 1 },
    resolutionHours: { type: Number, required: true, min: 1 },
    escalationAfterHours: { type: Number, required: true, min: 1 },
    escalationContact: { type: String, default: '' },
    businessHoursOnly: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

slaPolicySchema.index({ tenantId: 1, priority: 1 }, { unique: true });

const SLAPolicy = mongoose.model('SLAPolicy', slaPolicySchema);

// ============================================================================
// Ticket Schema
// ============================================================================

const ticketSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    ticketNumber: { type: String, required: true, unique: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketCategory',
      required: true,
    },
    subject: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'WAITING_ON_EMPLOYEE', 'WAITING_ON_THIRD_PARTY', 'RESOLVED', 'CLOSED', 'REOPENED'],
      default: 'OPEN',
      index: true,
    },
    // Requester
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    // Assignment
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assigneeName: { type: String, default: '' },
    team: { type: String, default: 'General' },

    // SLA tracking
    slaPolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SLAPolicy',
      default: null,
    },
    firstResponseAt: { type: Date, default: null },
    firstResponseDueAt: { type: Date, default: null },
    resolutionDueAt: { type: Date, default: null },
    slaBreached: { type: Boolean, default: false },
    slaBreachedAt: { type: Date, default: null },

    // Resolution
    resolutionNote: { type: String, default: '', maxlength: 2000 },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Reopened tracking
    reopenCount: { type: Number, default: 0 },
    lastReopenedAt: { type: Date, default: null },

    // Tags & metadata
    tags: [{ type: String, maxlength: 50 }],
    internalNote: { type: String, default: '', maxlength: 2000 },
    attachments: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
        mimeType: { type: String, default: 'application/octet-stream' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // Satisfaction
    satisfactionRating: { type: Number, min: 1, max: 5, default: null },
    satisfactionComment: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

ticketSchema.index({ tenantId: 1, status: 1, priority: 1 });
ticketSchema.index({ tenantId: 1, assigneeId: 1, status: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

// ============================================================================
// Ticket Comment Schema
// ============================================================================

const ticketCommentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorType: {
      type: String,
      enum: ['EMPLOYEE', 'HR', 'MANAGER', 'SYSTEM'],
      required: true,
    },
    authorName: { type: String, default: '' },
    content: { type: String, required: true, maxlength: 5000 },
    isInternal: { type: Boolean, default: false },
    isSystemEvent: { type: Boolean, default: false },
    attachments: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);

ticketCommentSchema.index({ tenantId: 1, ticketId: 1, createdAt: -1 });

const TicketComment = mongoose.model('TicketComment', ticketCommentSchema);

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  TicketCategory,
  SLAPolicy,
  Ticket,
  TicketComment,
};
