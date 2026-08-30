/**
 * Deferred Compensation Plan Model - Issue #1813
 *
 * Tracks Section 409A Nonqualified Deferred Compensation (NQDC) plans, phantom return benchmarks,
 * quarterly compounding balances, and scheduled future distribution tranches.
 */
'use strict';

const mongoose = require('mongoose');

const distributionTrancheSchema = new mongoose.Schema({
  trancheNumber: { type: Number, required: true },
  scheduledDate: { type: Date, required: true },
  percentageOfBalance: { type: Number, required: true, min: 1, max: 100 },
  disbursedAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['scheduled', 'disbursed', 'forfeited'], default: 'scheduled' },
  disbursedAt: { type: Date },
});

const deferredCompensationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    planYear: { type: Number, required: true }, // e.g. 2026
    planType: {
      type: String,
      enum: ['elective_salary_deferral', 'bonus_deferral', 'employer_supplemental_executive_retirement'],
      default: 'elective_salary_deferral',
    },
    deferralPercentage: { type: Number, required: true, min: 1, max: 80 },
    initialPrincipalAmount: { type: Number, required: true, min: 0 },
    accumulatedBalance: { type: Number, required: true, min: 0 },
    phantomBenchmarkRatePercent: { type: Number, default: 6.5 }, // Annualized benchmark growth %
    totalInterestCredited: { type: Number, default: 0 },
    ficaTaxPaidAtDeferral: { type: Number, default: 0 }, // FICA is due at deferral
    distributionTrigger: {
      type: String,
      enum: ['fixed_date', 'separation_from_service', 'change_in_control', 'death_disability'],
      default: 'fixed_date',
    },
    distributionSchedule: [distributionTrancheSchema],
    status: { type: String, enum: ['active', 'distributing', 'fully_paid', 'cancelled'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

deferredCompensationSchema.index({ tenantId: 1, employeeId: 1, planYear: 1 }, { unique: true });

module.exports = mongoose.model('DeferredCompensation', deferredCompensationSchema);