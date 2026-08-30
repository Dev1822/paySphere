const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

const probationPolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Policy name cannot exceed 100 characters'],
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      default: '',
      trim: true,
    },
    durationMonths: {
      type: Number,
      required: true,
      min: [1, 'Duration must be at least 1 month'],
    },
    maxExtensions: {
      type: Number,
      default: 1,
      min: [0, 'Max extensions cannot be negative'],
    },
    maxTotalMonths: {
      type: Number,
      required: true,
      min: [1, 'Max total months must be at least 1'],
    },
    salaryStepUpType: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'none'],
      default: 'none',
    },
    salaryStepUpValue: {
      type: Number,
      default: 0,
      min: [0, 'Salary step-up value cannot be negative'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

probationPolicySchema.index({ tenantId: 1, name: 1 }, { unique: true });

probationPolicySchema.plugin(auditTrailPlugin);

module.exports = mongoose.model('ProbationPolicy', probationPolicySchema);
