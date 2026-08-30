/**
 * Severance Package Model - Issue #1597
 *
 * Stores retrenchment packages, statutory components, notice pay, and multi-year Section 89 tax relief values.
 */
'use strict';

const mongoose = require('mongoose');

const severancePackageSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    separationType: {
      type: String,
      enum: ['retrenchment', 'layoff', 'vrs', 'redundancy', 'mutual_agreement'],
      required: true,
    },
    tenureYears: { type: Number, required: true, min: 0 },
    lastDrawnMonthlySalary: { type: Number, required: true, min: 0 },
    noticePeriodDays: { type: Number, default: 30 },
    noticePayAmount: { type: Number, default: 0 },
    statutoryRetrenchmentAmount: { type: Number, default: 0 }, // 15 days pay per year of completed service
    voluntaryExGratiaAmount: { type: Number, default: 0 },
    leaveEncashmentAmount: { type: Number, default: 0 },
    grossSeveranceAmount: { type: Number, required: true },
    statutoryTaxExemptionLimit: { type: Number, default: 500000 }, // Section 10(10C) exemption threshold
    taxableSeveranceAmount: { type: Number, required: true },
    section89ReliefAmount: { type: Number, default: 0 },
    netDisbursementAmount: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'approved', 'disbursed', 'cancelled'], default: 'draft' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disbursedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeverancePackage', severancePackageSchema);