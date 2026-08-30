const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const revisionProposalSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    compensationCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompensationCycle',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentSalary: {
      type: Number,
      required: true,
    },
    proposedSalary: {
      type: Number,
      required: true,
    },
    proposedIncreaseAmount: {
      type: Number,
      required: true,
    },
    proposedIncreasePercentage: {
      type: Number,
      required: true,
    },
    performanceRating: {
      type: String,
      required: true,
    },
    compaRatio: {
      type: Number,
      required: true,
    },
    isOutsideMeritMatrix: {
      type: Boolean,
      default: false,
    },
    justification: {
      type: String,
      validate: {
        validator: function (v) {
          // Justification is required if outside merit matrix
          if (this.isOutsideMeritMatrix && (!v || v.trim().length === 0)) {
            return false;
          }
          return true;
        },
        message:
          'Justification is required when proposed increase is outside the merit matrix corridor',
      },
    },
    status: {
      type: String,
      enum: [
        'Draft',
        'Submitted',
        'Manager_Approved',
        'Finance_Approved',
        'Rejected',
      ],
      default: 'Draft',
      index: true,
    },
    version: {
      type: Number,
      default: 1, // for optimistic concurrency
    },
    approvalHistory: [
      {
        actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actionDate: { type: Date, default: Date.now },
        action: { type: String, enum: ['Submitted', 'Approved', 'Rejected'] },
        comment: { type: String },
      },
    ],
    currency: {
      type: String,
      default: 'INR',
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // enables __v checking for save()
  },
);

// Ensure one proposal per employee per cycle
revisionProposalSchema.index(
  { compensationCycleId: 1, employeeId: 1 },
  { unique: true, name: 'unique_proposal_per_employee_in_cycle' },
);

revisionProposalSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('RevisionProposal', revisionProposalSchema);
