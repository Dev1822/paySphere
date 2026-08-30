/**
 * @fileoverview Outcome Incentive Rule Schema
 * @description Defines dynamic incentive rules linking verifiable clinical events to financial bonus amounts.
 */
const mongoose = require('mongoose');

const outcomeIncentiveRuleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true }, // e.g., 'STEMI Cath Lab < 90 mins'

    // The telemetry model or data source that generates the event
    metricSource: {
      type: String,
      required: true,
      enum: [
        'clinicalTelemetry',
        'cardiologyStemi',
        'sepsisStewardship',
        'ecmoVentilation',
        'emergencyTriage',
      ],
    },

    // The department or unit this rule applies to
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: false,
      index: true,
    },

    // The threshold condition. Stored as JSON or structured object.
    // e.g. { field: 'doorToBalloonTime', operator: '<=', value: 90 }
    condition: {
      field: { type: String, required: true },
      operator: {
        type: String,
        required: true,
        enum: ['==', '!=', '>', '>=', '<', '<='],
      },
      value: { type: mongoose.Schema.Types.Mixed, required: true },
    },

    // Total bonus amount to be split among the active shift team
    bonusPoolAmount: { type: Number, required: true, min: 0 },

    // The currency of the bonus
    currency: { type: String, default: 'USD' },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

outcomeIncentiveRuleSchema.index({ tenantId: 1, metricSource: 1, isActive: 1 });

const OutcomeIncentiveRule = mongoose.model(
  'OutcomeIncentiveRule',
  outcomeIncentiveRuleSchema,
);

module.exports = OutcomeIncentiveRule;
