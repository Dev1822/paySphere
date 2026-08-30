/**
 * Tuition Reimbursement Model - Issue #1816
 *
 * Tracks employee educational assistance claims, annual Section 127 statutory caps ($5,250),
 * exempt disbursements, and taxable compensation spillover perquisites.
 */
'use strict';

const mongoose = require('mongoose');

const tuitionReimbursementSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    claimNumber: { type: String, required: true },
    fiscalYear: { type: Number, required: true }, // e.g. 2026
    courseName: { type: String, required: true },
    institutionName: { type: String, required: true },
    isAccredited: { type: Boolean, default: true },
    completionDate: { type: Date, required: true },
    gradeOrCertification: { type: String, required: true }, // e.g. "Grade A", "Pass"
    claimedAmount: { type: Number, required: true, min: 0 },
    cumulativePriorDisbursementsInFiscalYear: { type: Number, default: 0, min: 0 },
    statutoryAnnualExemptionCap: { type: Number, default: 5250 }, // Section 127 default $5,250
    exemptReimbursementAmount: { type: Number, required: true },
    taxableSpilloverPerquisiteAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'disbursed', 'rejected'],
      default: 'pending_review',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disbursedAt: { type: Date },
  },
  { timestamps: true }
);

tuitionReimbursementSchema.index({ tenantId: 1, claimNumber: 1 }, { unique: true });

module.exports = mongoose.model('TuitionReimbursement', tuitionReimbursementSchema);