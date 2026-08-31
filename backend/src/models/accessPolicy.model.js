const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema(
  {
    attribute: { type: String, required: true },
    operator: {
      type: String,
      required: true,
      enum: [
        'equals',
        'not_equals',
        'in',
        'not_in',
        'exists',
        'greater_than',
        'less_than',
      ],
    },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const accessPolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    description: { type: String },
    effect: {
      type: String,
      required: true,
      enum: ['allow', 'deny'],
      default: 'allow',
    },
    actions: [{ type: String, required: true }],
    resources: [{ type: String, required: true }],
    conditions: [ruleSchema],
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  },
  { timestamps: true },
);

accessPolicySchema.index({ name: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model('AccessPolicy', accessPolicySchema);
