/**
 * @fileoverview Alert Rule Model
 *
 * Stores configurable anomaly-detection rules that admins can create,
 * tune, and disable without code changes. Each rule targets one anomaly
 * type (salary spike, excessive overtime, duplicate bank account, etc.)
 * and carries the thresholds that the scan engine evaluates against.
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const ALERT_TYPES = [
  'SALARY_SPIKE',
  'EXCESSIVE_OVERTIME',
  'EXCESSIVE_BONUS_RATIO',
  'DUPLICATE_BANK_ACCOUNT',
  'NET_SALARY_OUTLIER',
  'ABNORMAL_DEDUCTION',
  'HIGH_LEAVE_WITH_PAY',
];

const SEVERITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const NOTIFICATION_CHANNELS = ['EMAIL', 'IN_APP', 'WEBHOOK'];

const alertRuleSchema = new mongoose.Schema(
  {
    /** Human-readable name, e.g. "Salary spike > 40%" */
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Rule name cannot exceed 120 characters'],
    },

    /** What kind of anomaly this rule detects */
    alertType: {
      type: String,
      required: true,
      enum: ALERT_TYPES,
    },

    /** Threshold that triggers the alert — meaning varies by alertType */
    threshold: {
      type: Number,
      required: true,
      min: [0, 'Threshold must be non-negative'],
    },

    /** Some rules compare against a secondary value (e.g. base salary) */
    secondaryThreshold: {
      type: Number,
      default: null,
    },

    /** Minimum severity of alerts produced by this rule */
    severity: {
      type: String,
      enum: SEVERITY_LEVELS,
      default: 'MEDIUM',
    },

    /** Is this rule active? Disabled rules are skipped during scans */
    enabled: {
      type: Boolean,
      default: true,
    },

    /** How to notify when this rule fires */
    notificationChannels: {
      type: [String],
      enum: NOTIFICATION_CHANNELS,
      default: ['IN_APP'],
      validate: {
        validator: (v) => v && v.length > 0,
        message: 'At least one notification channel is required',
      },
    },

    /** Optional webhook URL for WEBHOOK channel */
    webhookUrl: {
      type: String,
      default: '',
      maxlength: [500, 'Webhook URL cannot exceed 500 characters'],
    },

    /** Which departments to apply this rule to (empty = all) */
    departmentScope: {
      type: [String],
      default: [],
    },

    /** Which roles to apply this rule to (empty = all) */
    roleScope: {
      type: [String],
      default: [],
    },

    /** Free-form description for audit/documentation */
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    /** Number of times this rule has fired historically */
    fireCount: {
      type: Number,
      default: 0,
    },

    /** Timestamp of the most recent time this rule fired */
    lastFiredAt: {
      type: Date,
      default: null,
    },

    /** Who created this rule */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /** Tenant scoping */
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

alertRuleSchema.index({ tenantId: 1, alertType: 1 });
alertRuleSchema.index({ tenantId: 1, enabled: 1 });
alertRuleSchema.index({ tenantId: 1, createdAt: -1 });

alertRuleSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('AlertRule', alertRuleSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;
module.exports.NOTIFICATION_CHANNELS = NOTIFICATION_CHANNELS;
