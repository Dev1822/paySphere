const mongoose = require('mongoose');

const privacyPolicyRuleSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true, // e.g. "Employee.bankAccount" or "Payroll.netSalary"
  },
  maskingType: {
    type: String,
    enum: ['partial', 'full', 'hashing', 'cleartext'],
    required: true,
  },
  roles: {
    type: [String],
    default: [], // Roles affected by this rule (e.g. ['HR', 'Auditor'])
  },
});

const dataPrivacyPolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    rules: {
      type: [privacyPolicyRuleSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

dataPrivacyPolicySchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('DataPrivacyPolicy', dataPrivacyPolicySchema);
