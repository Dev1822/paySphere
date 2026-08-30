const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

const reviewSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    reviewDate: {
      type: Date,
      required: true,
    },
    recommendation: {
      type: String,
      enum: ['confirm', 'extend', 'terminate'],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
  },
  { _id: true, timestamps: true },
);

const probationTrackerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProbationPolicy',
      required: true,
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
      enum: ['active', 'extended', 'confirmed', 'terminated'],
      default: 'active',
    },
    extensionCount: {
      type: Number,
      default: 0,
    },
    reviews: [reviewSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

probationTrackerSchema.index(
  { tenantId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['active', 'extended'] } },
  },
);
probationTrackerSchema.index({ tenantId: 1, endDate: 1, status: 1 });

probationTrackerSchema.plugin(auditTrailPlugin);

module.exports = mongoose.model('ProbationTracker', probationTrackerSchema);
