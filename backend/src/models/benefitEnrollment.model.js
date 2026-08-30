const mongoose = require('mongoose');

const benefitEnrollmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BenefitPlan',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['enrolled', 'pending', 'cancelled', 'terminated'],
      default: 'pending',
    },
    enrolledAt: { type: Date, default: undefined },
    cancelledAt: { type: Date, default: undefined },
    cancellationReason: { type: String, default: '', maxlength: 300 },
    dependents: [
      {
        name: { type: String, trim: true },
        relationship: {
          type: String,
          enum: ['spouse', 'child', 'parent'],
          required: true,
        },
        dateOfBirth: { type: Date },
      },
    ],
    monthlyDeduction: { type: Number, default: 0, min: 0 },
    coverageType: {
      type: String,
      enum: ['individual', 'individual+spouse', 'family'],
      default: 'individual',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

benefitEnrollmentSchema.index(
  { tenantId: 1, employeeId: 1, planId: 1 },
  { unique: true },
);
benefitEnrollmentSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('BenefitEnrollment', benefitEnrollmentSchema);
