/**
 * Parental Leave Top-Up Claim Model - Issue #1817
 *
 * Records statutory maternity/paternity/parental leave periods, government social security
 * benefit offsets, net employer top-up disbursements, and insurance reconciliation audits.
 */
'use strict';

const mongoose = require('mongoose');

const parentalLeaveClaimSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: {
      type: String,
      enum: ['paternity', 'maternity_supplement', 'adoption', 'shared_parental'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalWorkingDaysOnLeave: { type: Number, required: true, min: 1 },
    regularMonthlySalary: { type: Number, required: true, min: 0 },
    proRatedNormalSalary: { type: Number, required: true },
    statutoryDailyInsuranceRate: { type: Number, required: true, min: 0 }, // Government daily payout
    totalStatutoryBenefitEstimated: { type: Number, required: true },
    employerTopUpAmount: { type: Number, required: true },
    actualStatutoryBenefitReceived: { type: Number, default: 0 },
    reconciliationAdjustmentAmount: { type: Number, default: 0 }, // Clawback/supplement on variance
    status: {
      type: String,
      enum: ['submitted', 'approved', 'disbursed', 'reconciled', 'rejected'],
      default: 'submitted',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reconciledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ParentalLeaveClaim', parentalLeaveClaimSchema);