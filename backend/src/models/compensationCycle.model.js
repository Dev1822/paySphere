const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const compensationCycleSchema = new mongoose.Schema(
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
      maxlength: [100, 'Cycle name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Draft', 'Open', 'Pending_Approval', 'Closed'],
      default: 'Draft',
      index: true,
    },
    budgetAllocated: {
      type: Number,
      default: 0,
    },
    budgetUtilized: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure only one open cycle per tenant
compensationCycleSchema.index(
  { tenantId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Open' },
    name: 'unique_open_cycle_per_tenant',
  },
);

compensationCycleSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('CompensationCycle', compensationCycleSchema);
