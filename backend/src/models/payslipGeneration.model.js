/**
 * Payslip Generation Model - Issue #1904
 *
 * Tracks payslip PDF generation jobs with deterministic identity.
 * Prevents duplicate generation for the same payroll/employee combo.
 * Status: pending -> processing -> completed / failed
 */
'use strict';

const mongoose = require('mongoose');

const payslipGenerationSchema = new mongoose.Schema(
  {
    // Deterministic ID: hash of payrollId + employeeId
    jobHash: { type: String, unique: true, required: true, index: true },
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    // Job lifecycle
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'], 
      default: 'pending',
      index: true 
    },
    // File metadata
    pdfPath: { type: String, default: null },
    pdfUrl: { type: String, default: null },
    fileSize: { type: Number, default: 0 },
    // Error tracking
    errorMessage: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    // Recovery
    lastProcessedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    queueJobId: { type: String, default: null }
  },
  { timestamps: true }
);

// Index for bulk lookups
payslipGenerationSchema.index({ payrollId: 1, tenantId: 1 });
payslipGenerationSchema.index({ status: 1, tenantId: 1 });

module.exports = mongoose.model('PayslipGeneration', payslipGenerationSchema);