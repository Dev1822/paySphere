const mongoose = require('mongoose');

const policyAcknowledgmentSchema = new mongoose.Schema(
  {
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyPolicy',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    policyVersion: { type: Number, required: true, min: 1 },
    policyCode: { type: String, required: true, trim: true, uppercase: true },
    acknowledgedAt: { type: Date, default: Date.now },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

policyAcknowledgmentSchema.index(
  { policyId: 1, employeeId: 1, policyVersion: 1 },
  { unique: true },
);
policyAcknowledgmentSchema.index({ tenantId: 1, employeeId: 1 });
policyAcknowledgmentSchema.index({ policyId: 1, policyVersion: 1 });

module.exports = mongoose.model(
  'PolicyAcknowledgment',
  policyAcknowledgmentSchema,
);
