/**
 * @fileoverview Expense Claim Schema
 * @description Tracks individual expense submissions, receipt attachments,
 * approval status, and the link to the payroll run that reimbursed it.
 *
 * Issue: #719
 */

const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true }, // in bytes
  },
  { _id: false },
);

const expenseClaimSchema = new mongoose.Schema(
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
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    expenseDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    receipts: [receiptSchema],
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'needs_info',
        'approved',
        'rejected',
        'reimbursed',
      ],
      default: 'pending_approval',
      index: true,
    },
    // Crucial for preventing double-reimbursement
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollUpdate',
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    /**
     * Who rejected it, and when (#794).
     *
     * The controller wrote `approvedBy`/`approvedAt` on a rejection too, so
     * a rejected claim carried an approver — wrong to read and impossible to
     * audit. Declared as their own paths for the reason #559 documents: a
     * path that is not in the schema is silently dropped on write, so
     * setting `rejectedBy` without declaring it looks like it worked and
     * persists nothing.
     */
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    /**
     * When a payroll run actually paid this out.
     *
     * `payrollId` records which run; this records when. Written together by
     * `submitPayrollForReview`, so a payslip regenerated later has the date
     * without having to go and look the run up.
     */
    reimbursedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      maxlength: 500,
      default: '',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    imageHash: { type: String, default: '' },
    isPossibleFraud: { type: Boolean, default: false },
    fraudDetails: { type: String, default: '' },
    fraudRiskScore: { type: Number, default: 0 },
    policyViolations: [{ type: String }],
    ocrMetadata: {
      amountMatches: { type: Boolean, default: true },
      dateMatches: { type: Boolean, default: true },
      currencyMatches: { type: Boolean, default: true },
      extractedAmount: { type: Number },
      extractedDate: { type: Date },
      extractedCurrency: { type: String },
    },
  },
  { timestamps: true },
);

// Index for fast lookup of unreimbursed approved claims during payroll finalization
expenseClaimSchema.index({
  tenantId: 1,
  status: 1,
  payrollId: 1,
  expenseDate: 1,
});

module.exports =
  mongoose.models.ExpenseClaim ||
  mongoose.model('ExpenseClaim', expenseClaimSchema);
