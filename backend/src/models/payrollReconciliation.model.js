'use strict';
const mongoose = require('mongoose');

/**
 * @fileoverview Payroll Reconciliation & Variance Schemas
 * @description Stores immutable payroll register snapshots, reconciliation batches, 
 * and variance exceptions for pre-audit sign-offs.
 * Issue: #1761
 */

/**
 * PayrollRegisterSnapshot Schema
 * Immutable snapshot of a finalized payroll run's line items.
 */
const payrollRegisterSnapshotSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true, unique: true },

  periodMonth: { type: Number, required: true },
  periodYear: { type: Number, required: true },

  // Array of employee line items
  lineItems: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    grossPay: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalTaxes: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 }
  }],

  aggregateGross: { type: Number, default: 0 },
  aggregateNet: { type: Number, default: 0 },
  totalEmployees: { type: Number, default: 0 }
}, { timestamps: true });

const PayrollRegisterSnapshot = mongoose.model('PayrollRegisterSnapshot', payrollRegisterSnapshotSchema);

/**
 * ReconciliationBatch Schema
 * Tracks the diff between a current pending run and the last finalized snapshot.
 */
const reconciliationBatchSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  currentRunId: { type: String, required: true }, // Can be a pending run ID or mock ID
  previousSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRegisterSnapshot' },

  periodMonth: { type: Number, required: true },
  periodYear: { type: Number, required: true },

  totalExceptions: { type: Number, default: 0 },
  resolvedExceptions: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['Pending Review', 'Approved', 'Rejected'],
    default: 'Pending Review',
    index: true
  },

  signedOffBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  signedOffAt: { type: Date, default: null }
}, { timestamps: true });

const ReconciliationBatch = mongoose.model('ReconciliationBatch', reconciliationBatchSchema);

/**
 * VarianceException Schema
 * Tracks specific anomalies found during the reconciliation diff.
 */
const varianceExceptionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReconciliationBatch', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },

  exceptionType: {
    type: String,
    enum: ['Missing Employee', 'New Addition', 'Net Pay Variance', 'Ghost Employee'],
    required: true
  },

  previousNetPay: { type: Number, default: 0 },
  currentNetPay: { type: Number, default: 0 },
  varianceAmount: { type: Number, default: 0 },
  variancePercent: { type: Number, default: 0 },

  // Ghost Employee Guardrail Data
  hrisStatus: { type: String, default: '' }, // e.g., 'Terminated', 'Inactive'

  resolutionNotes: { type: String, default: '' },
  isResolved: { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const VarianceException = mongoose.model('VarianceException', varianceExceptionSchema);

/**
 * PayrollReconciliation Schema (Original)
 */
const payrollReconciliationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true, index: true },
    anomalyType: { type: String, required: true },
    reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    justification: { type: String, required: true },
    status: { type: String, enum: ['active', 'reconciled'], default: 'reconciled' },
  },
  { timestamps: true }
);

const PayrollReconciliation = mongoose.model('PayrollReconciliation', payrollReconciliationSchema);

module.exports = {
  PayrollRegisterSnapshot,
  ReconciliationBatch,
  VarianceException,
  PayrollReconciliation
};
