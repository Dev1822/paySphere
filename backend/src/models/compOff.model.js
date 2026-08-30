/**
 * @fileoverview Compensatory Off (Comp-Off) Management Schemas
 * @description Manages comp-off accrual policies, employee requests,
 *   approval workflows, and comp-off balance tracking.
 * Comp-off is time off earned by working on holidays or weekends.
 */

const mongoose = require('mongoose');

// ─── Accrual Policy ─────────────────────────────────────────────────────────
// Defines how comp-off hours are earned for different work types.

const compOffPolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String, default: '' },
    accrualRules: [
      {
        workType: {
          type: String,
          enum: [
            'weekend',
            'publicHoliday',
            'restrictedHoliday',
            'nightShift',
            'overtime',
          ],
          required: true,
        },
        hoursPerDay: {
          type: Number,
          required: true,
          min: 0.5,
          max: 2,
        },
      },
    ],
    maxAccrualPerMonth: {
      type: Number,
      default: 4,
      min: 0,
    },
    maxAccrualPerYear: {
      type: Number,
      default: 12,
      min: 0,
    },
    maxBalanceCarry: {
      type: Number,
      default: 10,
      min: 0,
    },
    expiryDays: {
      type: Number,
      default: 90,
      min: 30,
      comment: 'Comp-off expires this many days after accrual if unused',
    },
    minAdvanceNoticeDays: {
      type: Number,
      default: 1,
      min: 0,
      comment: 'Minimum days in advance the comp-off must be requested',
    },
    requiresApproval: {
      type: Boolean,
      default: true,
    },
    approverRoles: {
      type: [String],
      default: ['Manager', 'Admin'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// ─── Comp-Off Request ───────────────────────────────────────────────────────
// Individual comp-off request submitted by an employee.

const compOffRequestSchema = new mongoose.Schema(
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
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompOffPolicy',
      required: true,
    },
    workDate: {
      type: Date,
      required: true,
      comment: 'Date the employee worked on (holiday/weekend)',
    },
    compOffDate: {
      type: Date,
      required: true,
      comment: 'Date the employee wants to take as comp-off leave',
    },
    hoursEarned: {
      type: Number,
      required: true,
      min: 0.5,
      max: 16,
    },
    daysEarned: {
      type: Number,
      required: true,
      min: 0.5,
      max: 2,
    },
    workType: {
      type: String,
      enum: [
        'weekend',
        'publicHoliday',
        'restrictedHoliday',
        'nightShift',
        'overtime',
      ],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvalNote: {
      type: String,
      default: '',
      trim: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelledReason: {
      type: String,
      default: '',
    },
    // Audit trail for the request lifecycle
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true },
);

compOffRequestSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
compOffRequestSchema.index({ tenantId: 1, workDate: 1 });
compOffRequestSchema.index({ tenantId: 1, compOffDate: 1 });

// ─── Comp-Off Balance ───────────────────────────────────────────────────────
// Tracks available, used, and expired comp-off balance per employee per year.

const compOffBalanceSchema = new mongoose.Schema(
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
    year: {
      type: Number,
      required: true,
    },
    totalAccrued: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalExpired: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCancelled: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAccruedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

compOffBalanceSchema.index(
  { tenantId: 1, employeeId: 1, year: 1 },
  { unique: true },
);

// ─── Comp-Off Usage Log ─────────────────────────────────────────────────────
// Records every accrual, usage, expiry, and cancellation for audit purposes.

const compOffLedgerSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['accrual', 'usage', 'expiry', 'cancellation', 'adjustment'],
      required: true,
    },
    days: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompOffRequest',
      default: null,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompOffPolicy',
      default: null,
    },
    note: { type: String, default: '' },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

compOffLedgerSchema.index({ tenantId: 1, employeeId: 1, createdAt: -1 });

// ─── Export Models ──────────────────────────────────────────────────────────

const CompOffPolicy = mongoose.model('CompOffPolicy', compOffPolicySchema);
const CompOffRequest = mongoose.model('CompOffRequest', compOffRequestSchema);
const CompOffBalance = mongoose.model('CompOffBalance', compOffBalanceSchema);
const CompOffLedger = mongoose.model('CompOffLedger', compOffLedgerSchema);

module.exports = {
  CompOffPolicy,
  CompOffRequest,
  CompOffBalance,
  CompOffLedger,
};
