const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const policyVersionSchema = new mongoose.Schema(
  {
    versionNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true },
    summary: { type: String, default: '', maxlength: 500 },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedAt: { type: Date, default: Date.now },
    changeNote: { type: String, default: '', maxlength: 300 },
  },
  { _id: false, timestamps: false },
);

const companyPolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    policyCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    category: {
      type: String,
      enum: [
        'code-of-conduct',
        'data-security',
        'leave',
        'payroll',
        'remote-work',
        'health-safety',
        'anti-harassment',
        'conflict-of-interest',
        'general',
      ],
      required: true,
      default: 'general',
    },
    description: { type: String, default: '', maxlength: 500 },
    currentVersion: { type: Number, default: 1, min: 1 },
    versions: [policyVersionSchema],
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
    },
    effectiveDate: { type: Date, default: undefined },
    expiryDate: { type: Date, default: undefined },
    requiresAcknowledgment: { type: Boolean, default: true },
    assignedDepartments: [{ type: String, trim: true }],
    isGlobal: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

companyPolicySchema.index({ tenantId: 1, policyCode: 1 }, { unique: true });
companyPolicySchema.index({ tenantId: 1, status: 1, category: 1 });
companyPolicySchema.index({
  tenantId: 1,
  status: 1,
  requiresAcknowledgment: 1,
});
companyPolicySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('CompanyPolicy', companyPolicySchema);
