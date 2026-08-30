/**
 * @fileoverview Employee Service Milestone & Anniversary Recognition Schemas
 * @description Manages configurable service milestone tiers, tracks employee
 * work anniversaries, records milestone achievements, and manages reward
 * disbursements tied to service length.
 *
 * A milestone is a year-of-service threshold (1, 2, 5, 10, etc.) at which an
 * employee receives a reward. The config is per-tenant so each company can
 * define its own tier structure independently.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

// ============================================================================
// Milestone Configuration — defines the tier structure for a tenant
// ============================================================================

const rewardConfigSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Cash', 'Gift', 'ExtraLeave', 'Certificate', 'Custom'],
      required: true,
    },
    /** Monetary value in the tenant's base currency, for Cash rewards. */
    cashAmount: { type: Number, default: 0, min: 0 },
    /** Number of extra leave days, for ExtraLeave rewards. */
    extraLeaveDays: { type: Number, default: 0, min: 0, max: 30 },
    /** Free-text description for Gift, Certificate, or Custom. */
    description: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false },
);

const milestoneTierSchema = new mongoose.Schema(
  {
    /** Years of service this tier activates at. */
    yearsOfService: { type: Number, required: true, min: 1, max: 50 },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      /** e.g. "Bronze Star", "Silver Jubilee", "Gold Leader" */
    },
    reward: { type: rewardConfigSchema, required: true },
    /** Whether this tier triggers automatic payroll credit. */
    autoCreditPayroll: { type: Boolean, default: false },
    /** Whether a congratulatory announcement is posted to the company feed. */
    announcePublicly: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const milestoneConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    /** Whether the milestone program is active for this tenant. */
    isEnabled: { type: Boolean, default: true },
    /**
     * When to evaluate milestones: 'Anniversary' checks on the employee's
     * joining date each year; 'Monthly' runs a batch on the 1st of each month;
     * 'Manual' only triggers on explicit admin action.
     */
    evaluationMode: {
      type: String,
      enum: ['Anniversary', 'Monthly', 'Manual'],
      default: 'Anniversary',
    },
    /** Advance notice (days) before anniversary to prepare the reward. */
    advanceNoticeDays: { type: Number, default: 7, min: 0, max: 90 },
    /** Maximum years of service to evaluate (skip milestones beyond this). */
    maxEvaluationYears: { type: Number, default: 30, min: 1, max: 50 },
    tiers: {
      type: [milestoneTierSchema],
      validate: {
        validator: function (tiers) {
          const years = tiers.map((t) => t.yearsOfService);
          return new Set(years).size === years.length;
        },
        message: 'Duplicate yearsOfService values are not allowed in tiers.',
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

milestoneConfigSchema.plugin(auditTrailPlugin);
const MilestoneConfig = mongoose.model(
  'MilestoneConfig',
  milestoneConfigSchema,
);

// ============================================================================
// Milestone Achievement — one row per employee per earned milestone
// ============================================================================

const milestoneAchievementSchema = new mongoose.Schema(
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
    /** The years-of-service tier that was achieved. */
    yearsAchieved: { type: Number, required: true, min: 1 },
    /** Snapshot of the tier config at time of achievement. */
    tierLabel: { type: String, required: true, maxlength: 80 },
    rewardType: {
      type: String,
      enum: ['Cash', 'Gift', 'ExtraLeave', 'Certificate', 'Custom'],
      required: true,
    },
    rewardAmount: { type: Number, default: 0, min: 0 },
    rewardDescription: { type: String, default: '', maxlength: 500 },
    /** When the milestone was detected/evaluated. */
    detectedAt: { type: Date, required: true, default: Date.now },
    /** When the reward was actually disbursed or granted. */
    disbursedAt: { type: Date, default: null },
    /**
     * Lifecycle: Detected → Acknowledged → Disbursed, or Detected → Skipped.
     * Skipped allows admins to manually exclude an achievement (e.g. employee
     * left before the anniversary).
     */
    status: {
      type: String,
      enum: ['Detected', 'Acknowledged', 'Disbursed', 'Skipped'],
      default: 'Detected',
      index: true,
    },
    /** Reference to payroll row if autoCreditPayroll was true. */
    payrollRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollUpdate',
      default: null,
    },
    /** Admin who acknowledged or skipped this milestone. */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    /** Reason for skipping, if applicable. */
    skipReason: { type: String, default: '', maxlength: 500 },
    /** Whether a public announcement was posted. */
    announcementPosted: { type: Boolean, default: false },
    notes: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);

// One achievement per employee per year-of-service tier.
milestoneAchievementSchema.index(
  { tenantId: 1, employeeId: 1, yearsAchieved: 1 },
  { unique: true },
);
milestoneAchievementSchema.index({ tenantId: 1, status: 1, detectedAt: -1 });
milestoneAchievementSchema.index({
  tenantId: 1,
  employeeId: 1,
  detectedAt: -1,
});

milestoneAchievementSchema.plugin(auditTrailPlugin);
const MilestoneAchievement = mongoose.model(
  'MilestoneAchievement',
  milestoneAchievementSchema,
);

// ============================================================================
// Milestone Evaluation Log — audit trail for batch/manual evaluations
// ============================================================================

const milestoneEvaluationLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    /** 'Scheduled' (Monthly batch), 'Anniversary' (daily check), or 'Manual' */
    triggerType: {
      type: String,
      enum: ['Scheduled', 'Anniversary', 'Manual'],
      required: true,
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    evaluatedAt: { type: Date, required: true, default: Date.now },
    /** Number of employees scanned. */
    employeesEvaluated: { type: Number, default: 0, min: 0 },
    /** Number of new milestones detected in this run. */
    milestonesDetected: { type: Number, default: 0, min: 0 },
    /** Number of milestones that already existed (duplicates skipped). */
    duplicatesSkipped: { type: Number, default: 0, min: 0 },
    /** Any errors during the run. */
    errors: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['Running', 'Completed', 'Failed'],
      default: 'Running',
    },
  },
  { timestamps: true },
);

milestoneEvaluationLogSchema.index({ tenantId: 1, evaluatedAt: -1 });
const MilestoneEvaluationLog = mongoose.model(
  'MilestoneEvaluationLog',
  milestoneEvaluationLogSchema,
);

module.exports = {
  MilestoneConfig,
  MilestoneAchievement,
  MilestoneEvaluationLog,
};
