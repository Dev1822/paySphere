const mongoose = require('mongoose');

const benefitPlanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: String,
      enum: [
        'health',
        'dental',
        'vision',
        'retirement',
        'life-insurance',
        'disability',
        'wellness',
        'other',
      ],
      required: true,
    },
    description: { type: String, default: '', maxlength: 500 },
    provider: { type: String, default: '', maxlength: 100 },
    monthlyPremium: { type: Number, required: true, min: 0 },
    employerContribution: { type: Number, default: 0, min: 0 },
    employeeContribution: { type: Number, default: 0, min: 0 },
    coverageType: {
      type: String,
      enum: ['individual', 'individual+spouse', 'family'],
      default: 'individual',
    },
    isActive: { type: Boolean, default: true },
    enrollmentStartDate: { type: Date, default: undefined },
    enrollmentEndDate: { type: Date, default: undefined },
    maxEnrollees: { type: Number, default: undefined, min: 1 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

benefitPlanSchema.index({ tenantId: 1, category: 1, isActive: 1 });
benefitPlanSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BenefitPlan', benefitPlanSchema);
