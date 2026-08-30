/**
 * ESPP Enrollment Model - Issue #1596
 *
 * Tracks an employee's enrollment in an offering period, deduction rate, and accumulated funds.
 */
'use strict';

const mongoose = require('mongoose');

const esppEnrollmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    offeringPeriod: {
      name: { type: String, required: true }, // e.g. "2026-H1"
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      grantPrice: { type: Number, required: true }, // Fair Market Value at offering start
    },
    contributionPercent: { type: Number, required: true, min: 1, max: 15, default: 5 },
    accumulatedFunds: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'paused', 'withdrawn', 'completed'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

esppEnrollmentSchema.index({ tenantId: 1, employeeId: 1, 'offeringPeriod.name': 1 }, { unique: true });

module.exports = mongoose.model('EsppEnrollment', esppEnrollmentSchema);