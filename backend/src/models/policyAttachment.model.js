const mongoose = require('mongoose');

const policyAttachmentSchema = new mongoose.Schema(
  {
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccessPolicy',
      required: true,
    },
    principalType: { type: String, required: true, enum: ['User', 'Role'] },
    principalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  },
  { timestamps: true },
);

policyAttachmentSchema.index(
  { policyId: 1, principalId: 1, principalType: 1 },
  { unique: true },
);

module.exports = mongoose.model('PolicyAttachment', policyAttachmentSchema);
