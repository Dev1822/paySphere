/**
 * @fileoverview Employee Health Challenge & Wellness Tracking Schemas
 * @description Manages company-wide health challenges, individual participation,
 * daily check-ins, leaderboard rankings, and reward disbursements for wellness programs.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

// ============================================================================
// Health Challenge — defines a wellness challenge for the company
// ============================================================================

const healthChallengeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: '', maxlength: 2000 },
    category: {
      type: String,
      enum: [
        'Steps',
        'Water',
        'Sleep',
        'Meditation',
        'Exercise',
        'Weight',
        'Custom',
      ],
      required: true,
      index: true,
    },
    /** Goal value — e.g. 10000 steps/day, 8 glasses of water, etc. */
    goalValue: { type: Number, required: true, min: 1 },
    goalUnit: { type: String, required: true, maxlength: 30 }, // "steps", "glasses", "hours", "minutes", "kg"
    /** How participants log progress. */
    trackingMethod: {
      type: String,
      enum: ['SelfReport', 'DeviceSync', 'PhotoProof', 'ManualEntry'],
      default: 'SelfReport',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    /** Maximum participants (0 = unlimited). */
    maxParticipants: { type: Number, default: 0, min: 0 },
    /** Whether the challenge is currently accepting joiners. */
    isOpen: { type: Boolean, default: true, index: true },
    /** Reward for top performers. */
    rewards: {
      first: { type: Number, default: 0, min: 0 },
      second: { type: Number, default: 0, min: 0 },
      third: { type: Number, default: 0, min: 0 },
      participation: { type: Number, default: 0, min: 0 }, // everyone who completes
      /** Extra leave days for winners. */
      extraLeaveDays: { type: Number, default: 0, min: 0, max: 10 },
    },
    /** Team-based or individual. */
    mode: {
      type: String,
      enum: ['Individual', 'Team'],
      default: 'Individual',
    },
    /** If Team mode, team size. */
    teamSize: { type: Number, default: 4, min: 2, max: 20 },
    /** Leaderboard visibility. */
    leaderboardVisible: { type: Boolean, default: true },
    /** Weekly progress reminders. */
    reminderEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

healthChallengeSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });
healthChallengeSchema.index({ tenantId: 1, isActive: 1, isOpen: 1 });
healthChallengeSchema.plugin(auditTrailPlugin);
const HealthChallenge = mongoose.model(
  'HealthChallenge',
  healthChallengeSchema,
);

// ============================================================================
// Challenge Participation — employee enrollment in a challenge
// ============================================================================

const challengeParticipationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthChallenge',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** For team mode. */
    teamId: { type: String, default: null, maxlength: 50 },
    teamName: { type: String, default: null, maxlength: 100 },
    enrolledAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Quit', 'Disqualified'],
      default: 'Active',
      index: true,
    },
    /** Aggregated stats. */
    totalLogged: { type: Number, default: 0, min: 0 },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    daysCompleted: { type: Number, default: 0, min: 0 },
    /** Average daily value. */
    averagePerDay: { type: Number, default: 0, min: 0 },
    /** Current rank on leaderboard. */
    rank: { type: Number, default: 0, min: 0 },
    /** Whether goal was fully met. */
    goalMet: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    /** Reward earned. */
    rewardEarned: { type: Number, default: 0, min: 0 },
    rewardPaid: { type: Boolean, default: false },
    quitAt: { type: Date, default: null },
    quitReason: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
);

challengeParticipationSchema.index(
  { tenantId: 1, challengeId: 1, employeeId: 1 },
  { unique: true },
);
challengeParticipationSchema.index({ tenantId: 1, challengeId: 1, rank: 1 });
challengeParticipationSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
challengeParticipationSchema.plugin(auditTrailPlugin);
const ChallengeParticipation = mongoose.model(
  'ChallengeParticipation',
  challengeParticipationSchema,
);

// ============================================================================
// Daily Check-In — individual daily progress entry
// ============================================================================

const dailyCheckInSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthChallenge',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** The date this check-in is for. */
    checkInDate: { type: Date, required: true },
    /** The logged value (e.g. 8500 steps). */
    value: { type: Number, required: true, min: 0 },
    /** Whether the daily goal was met. */
    goalMet: { type: Boolean, default: false },
    /** Optional note from the employee. */
    note: { type: String, default: '', maxlength: 500 },
    /** Photo proof URL if trackingMethod is PhotoProof. */
    photoUrl: { type: String, default: '', maxlength: 1000 },
    /** Device data if trackingMethod is DeviceSync. */
    deviceSource: { type: String, default: '', maxlength: 100 },
    /** Verification status for photo proofs. */
    verificationStatus: {
      type: String,
      enum: ['Auto', 'Pending', 'Approved', 'Rejected'],
      default: 'Auto',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

// One check-in per employee per challenge per day.
dailyCheckInSchema.index(
  { tenantId: 1, challengeId: 1, employeeId: 1, checkInDate: 1 },
  { unique: true },
);
dailyCheckInSchema.index({ tenantId: 1, challengeId: 1, checkInDate: 1 });
dailyCheckInSchema.plugin(auditTrailPlugin);
const DailyCheckIn = mongoose.model('DailyCheckIn', dailyCheckInSchema);

// ============================================================================
// Challenge Team — for team-based challenges
// ============================================================================

const challengeTeamSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthChallenge',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
      },
    ],
    totalValue: { type: Number, default: 0, min: 0 },
    averagePerMember: { type: Number, default: 0, min: 0 },
    rank: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

challengeTeamSchema.index(
  { tenantId: 1, challengeId: 1, name: 1 },
  { unique: true },
);
const ChallengeTeam = mongoose.model('ChallengeTeam', challengeTeamSchema);

module.exports = {
  HealthChallenge,
  ChallengeParticipation,
  DailyCheckIn,
  ChallengeTeam,
};
