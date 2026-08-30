/**
 * @fileoverview Employee Referral Bonus Tracking Schemas
 * @description Manages referral program configs, referral submissions, candidate
 * lifecycle tracking, bonus tiers, and payout records for employee referral programs.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

// ============================================================================
// Referral Program Config — defines the bonus structure per tenant
// ============================================================================

const bonusTierSchema = new mongoose.Schema(
  {
    /** The role level or department this tier applies to. */
    targetRole: { type: String, default: 'All', trim: true, maxlength: 80 },
    /** Bonus amount in tenant's base currency. */
    bonusAmount: { type: Number, required: true, min: 0 },
    /** When the bonus is paid: 'Hired', 'Onboarding', '90Days', '6Months'. */
    payoutTrigger: {
      type: String,
      enum: ['Hired', 'Onboarding', '90Days', '6Months'],
      default: 'Hired',
    },
    /** Additional bonus if referral is a referral-of-referral or from specific channel. */
    channelBonus: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '', maxlength: 200 },
  },
  { _id: false },
);

const referralProgramConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    isEnabled: { type: Boolean, default: true },
    /** Maximum active referrals an employee can have at once. */
    maxActiveReferrals: { type: Number, default: 10, min: 1, max: 100 },
    /** How many days after submission before a referral expires. */
    referralExpiryDays: { type: Number, default: 90, min: 7, max: 365 },
    /** Bonus tiers by role level. */
    bonusTiers: { type: [bonusTierSchema], default: [] },
    /** Blacklisted domains — employees from these can't be referred. */
    blacklistedDomains: { type: [String], default: [] },
    /** Require manager approval before referral is submitted. */
    requireManagerApproval: { type: Boolean, default: false },
    /** Allow self-referrals. */
    allowSelfReferrals: { type: Boolean, default: false },
    /** How to notify the referrer on status changes. */
    notificationPreferences: {
      onSubmission: { type: Boolean, default: true },
      onStatusChange: { type: Boolean, default: true },
      onBonusPaid: { type: Boolean, default: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

referralProgramConfigSchema.plugin(auditTrailPlugin);
const ReferralProgramConfig = mongoose.model(
  'ReferralProgramConfig',
  referralProgramConfigSchema,
);

// ============================================================================
// Referral Submission — one per referred candidate
// ============================================================================

const referralSubmissionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** Candidate details. */
    candidateName: { type: String, required: true, trim: true, maxlength: 120 },
    candidateEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    candidatePhone: { type: String, default: '', trim: true, maxlength: 30 },
    candidateLinkedIn: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    /** The position being referred for. */
    positionReferred: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    department: { type: String, default: '', trim: true, maxlength: 80 },
    /** How the referrer knows the candidate. */
    relationship: {
      type: String,
      enum: [
        'FormerColleague',
        'Friend',
        'Family',
        'ProfessionalNetwork',
        'University',
        'Other',
      ],
      default: 'ProfessionalNetwork',
    },
    /** Source channel for tracking. */
    channel: {
      type: String,
      enum: ['Direct', 'LinkedIn', 'JobBoard', 'University', 'Event', 'Other'],
      default: 'Direct',
    },
    resumeUrl: { type: String, default: '', trim: true, maxlength: 1000 },
    notes: { type: String, default: '', maxlength: 1000 },
    status: {
      type: String,
      enum: [
        'Submitted',
        'Screening',
        'Interviewing',
        'Offered',
        'Hired',
        'Rejected',
        'Withdrawn',
        'Expired',
        'BonusPaid',
      ],
      default: 'Submitted',
      index: true,
    },
    submittedAt: { type: Date, required: true, default: Date.now },
    /** When the referral was assigned to a recruiter. */
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: { type: Date, default: null },
    /** Recruitment pipeline stage. */
    pipelineStage: {
      type: String,
      enum: [
        'New',
        'ResumeReview',
        'PhoneScreen',
        'Interview',
        'FinalRound',
        'ReferenceCheck',
        'Offer',
        'Hired',
      ],
      default: 'New',
    },
    /** Interview dates and outcomes. */
    interviews: [
      {
        scheduledAt: { type: Date },
        interviewer: { type: String, default: '' },
        outcome: {
          type: String,
          enum: ['Pass', 'Fail', 'Pending', 'Cancelled'],
          default: 'Pending',
        },
        feedback: { type: String, default: '', maxlength: 1000 },
      },
    ],
    /** Rejection/withdrawal details. */
    rejectionReason: { type: String, default: '', maxlength: 500 },
    withdrawnAt: { type: Date, default: null },
    /** Expiry tracking. */
    expiresAt: { type: Date, required: true },
    /** Hired date — triggers bonus evaluation. */
    hiredAt: { type: Date, default: null },
    /** When the referred candidate's probation ends (for 90-day bonus). */
    probationEndDate: { type: Date, default: null },
    /** Duplicate detection. */
    isDuplicate: { type: Boolean, default: false },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralSubmission',
      default: null,
    },
  },
  { timestamps: true },
);

// Unique candidate per tenant (prevent duplicate referrals)
referralSubmissionSchema.index(
  { tenantId: 1, candidateEmail: 1 },
  { unique: true },
);
referralSubmissionSchema.index({ tenantId: 1, status: 1, submittedAt: -1 });
referralSubmissionSchema.index({ tenantId: 1, referrerId: 1, status: 1 });
referralSubmissionSchema.index({ tenantId: 1, expiresAt: 1, status: 1 });
referralSubmissionSchema.plugin(auditTrailPlugin);
const ReferralSubmission = mongoose.model(
  'ReferralSubmission',
  referralSubmissionSchema,
);

// ============================================================================
// Referral Bonus Payout — tracks bonus disbursements
// ============================================================================

const referralBonusPayoutSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralSubmission',
      required: true,
      index: true,
    },
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** The bonus tier that triggered this payout. */
    tierTargetRole: { type: String, required: true, maxlength: 80 },
    baseBonus: { type: Number, required: true, min: 0 },
    channelBonus: { type: Number, default: 0, min: 0 },
    totalBonus: { type: Number, required: true, min: 0 },
    payoutTrigger: {
      type: String,
      enum: ['Hired', 'Onboarding', '90Days', '6Months'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Paid', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    /** When this payout was triggered (e.g. candidate hire date). */
    triggeredAt: { type: Date, required: true, default: Date.now },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    /** Link to payroll record if paid through payroll. */
    payrollRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollUpdate',
      default: null,
    },
    paidAt: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: ['Payroll', 'DirectTransfer', 'GiftCard', 'Other'],
      default: 'Payroll',
    },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

referralBonusPayoutSchema.index({ tenantId: 1, referrerId: 1, status: 1 });
referralBonusPayoutSchema.plugin(auditTrailPlugin);
const ReferralBonusPayout = mongoose.model(
  'ReferralBonusPayout',
  referralBonusPayoutSchema,
);

// ============================================================================
// Referral Activity Log — audit trail for referral pipeline events
// ============================================================================

const referralActivityLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralSubmission',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'Submitted',
        'Assigned',
        'StageChanged',
        'InterviewScheduled',
        'InterviewCompleted',
        'StatusChanged',
        'Rejected',
        'Withdrawn',
        'Hired',
        'BonusTriggered',
        'BonusApproved',
        'BonusPaid',
        'Expired',
      ],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    details: { type: Object, default: {} },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

referralActivityLogSchema.index({ tenantId: 1, referralId: 1, timestamp: -1 });
const ReferralActivityLog = mongoose.model(
  'ReferralActivityLog',
  referralActivityLogSchema,
);

module.exports = {
  ReferralProgramConfig,
  ReferralSubmission,
  ReferralBonusPayout,
  ReferralActivityLog,
};
