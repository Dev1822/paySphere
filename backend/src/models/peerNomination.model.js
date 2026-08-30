/**
 * @fileoverview Employee Peer Nomination & Award Schemas
 * @description Manages award categories, peer nominations, voting, review
 * workflows, and award disbursements for employee recognition programs.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

// ============================================================================
// Award Category — defines types of awards a company gives
// ============================================================================

const awardCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    /** Icon or emoji for the award. */
    icon: { type: String, default: '🏆', maxlength: 10 },
    /** Monetary reward in base currency. */
    rewardAmount: { type: Number, default: 0, min: 0 },
    /** Extra leave days for the winner. */
    extraLeaveDays: { type: Number, default: 0, min: 0, max: 10 },
    /** How often this award is given. */
    frequency: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'Annual', 'OneTime'],
      default: 'Monthly',
    },
    /** Maximum nominations per nominator per cycle. */
    maxNominationsPerNominator: { type: Number, default: 3, min: 1, max: 20 },
    /** Maximum nominations a person can receive per cycle. */
    maxNominationsPerNominee: { type: Number, default: 5, min: 1, max: 50 },
    /** Whether self-nomination is allowed. */
    allowSelfNomination: { type: Boolean, default: false },
    /** Whether voting is enabled for this award. */
    votingEnabled: { type: Boolean, default: false },
    /** Maximum votes per voter per cycle. */
    maxVotesPerVoter: { type: Number, default: 3, min: 1, max: 20 },
    /** Whether manager approval is needed before awarding. */
    requireManagerApproval: { type: Boolean, default: true },
    /** Who can nominate: All, Manager, or Peer. */
    nominationScope: {
      type: String,
      enum: ['All', 'Manager', 'Peer'],
      default: 'All',
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

awardCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
awardCategorySchema.plugin(auditTrailPlugin);
const AwardCategory = mongoose.model('AwardCategory', awardCategorySchema);

// ============================================================================
// Award Cycle — a time period in which nominations are collected
// ============================================================================

const awardCycleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AwardCategory',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    /** When voting starts (if voting enabled). */
    votingStartDate: { type: Date, default: null },
    votingEndDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Upcoming', 'Nominating', 'Voting', 'Reviewing', 'Completed'],
      default: 'Upcoming',
      index: true,
    },
    /** Winner(s) announced. */
    winnersAnnounced: { type: Boolean, default: false },
    announcedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

awardCycleSchema.index({ tenantId: 1, categoryId: 1, startDate: 1 });
const AwardCycle = mongoose.model('AwardCycle', awardCycleSchema);

// ============================================================================
// Nomination — an individual peer nomination
// ============================================================================

const nominationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AwardCycle',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AwardCategory',
      required: true,
    },
    nominatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    nomineeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** Why this person deserves the award. */
    justification: {
      type: String,
      required: true,
      minlength: 20,
      maxlength: 2000,
    },
    /** Specific example or story. */
    example: { type: String, default: '', maxlength: 2000 },
    /** Core values demonstrated. */
    coreValues: { type: [String], default: [] },
    /** Is this a public or anonymous nomination. */
    isAnonymous: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        'Submitted',
        'UnderReview',
        'Approved',
        'Rejected',
        'Winner',
        'Withdrawn',
      ],
      default: 'Submitted',
      index: true,
    },
    /** Manager or admin review. */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: '', maxlength: 500 },
    /** Vote count if voting is enabled. */
    voteCount: { type: Number, default: 0, min: 0 },
    /** Final rank after voting/review. */
    rank: { type: Number, default: 0, min: 0 },
    /** Whether this is a winner. */
    isWinner: { type: Boolean, default: false },
    /** Award details when winner. */
    awardedAt: { type: Date, default: null },
    rewardAmount: { type: Number, default: 0, min: 0 },
    extraLeaveDays: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// One nomination per nominator-nominee-cycle
nominationSchema.index(
  { tenantId: 1, cycleId: 1, nominatorId: 1, nomineeId: 1 },
  { unique: true },
);
nominationSchema.index({ tenantId: 1, cycleId: 1, voteCount: -1 });
nominationSchema.index({ tenantId: 1, nomineeId: 1, status: 1 });
nominationSchema.plugin(auditTrailPlugin);
const Nomination = mongoose.model('Nomination', nominationSchema);

// ============================================================================
// Vote — individual vote on a nomination
// ============================================================================

const voteSchema = new mongoose.Schema(
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
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** Optional comment with vote. */
    comment: { type: String, default: '', maxlength: 500 },
    votedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

// One vote per voter per nomination
voteSchema.index(
  { tenantId: 1, nominationId: 1, voterId: 1 },
  { unique: true },
);
const Vote = mongoose.model('Vote', voteSchema);

module.exports = {
  AwardCategory,
  AwardCycle,
  Nomination,
  Vote,
};
