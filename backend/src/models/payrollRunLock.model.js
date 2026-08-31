'use strict';

const mongoose = require('mongoose');

/**
 * PayrollRunLock Schema
 * Tracks input data locks during payroll run processing
 * Prevents concurrent modifications that could corrupt calculations
 */
const payrollRunLockSchema = new mongoose.Schema(
  {
    // Reference to payroll run
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
      index: true,
    },

    // Payroll period being processed
    payrollPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollPeriod',
      required: true,
      index: true,
      unique: true, // Only one active lock per period
      sparse: true,
    },

    // Employee IDs included in this run
    employeeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
      },
    ],

    // Lock status
    status: {
      type: String,
      enum: ['active', 'released', 'force_released'],
      default: 'active',
      index: true,
    },

    // Boundary timestamp - data captured at this point
    inputBoundary: {
      type: Date,
      required: true,
      description: 'Timestamp marking the data snapshot point',
    },

    // Lock acquisition
    acquiredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    acquiredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Lock release
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    releasedAt: Date,

    // Force release (on failure/crash)
    forcedReleaseReason: String,
    forcedReleaseAt: Date,

    // Metadata about locked records
    lockedRecords: {
      employees: { type: Number, default: 0 },
      attendance: { type: Number, default: 0 },
      leave: { type: Number, default: 0 },
      compensation: { type: Number, default: 0 },
    },

    // Processing metadata
    processingMetadata: mongoose.Schema.Types.Mixed,

    // Tags for organization
    tags: [String],
  },
  {
    timestamps: true,
    collection: 'payroll_run_locks',
  }
);

// Index for finding active locks by period
payrollRunLockSchema.index({ payrollPeriodId: 1, status: 1 });
payrollRunLockSchema.index({ acquiredAt: -1 });

/**
 * Find or create lock for payroll period
 */
payrollRunLockSchema.statics.findOrCreateLock = async function(
  payrollPeriodId,
  payrollRunId,
  userId
) {
  const existing = await this.findOne({
    payrollPeriodId,
    status: 'active',
  });

  if (existing) {
    return existing;
  }

  return await this.create({
    payrollPeriodId,
    payrollRunId,
    acquiredBy: userId,
    inputBoundary: new Date(),
  });
};

/**
 * Check if period is locked
 */
payrollRunLockSchema.statics.isPeriodLocked = async function(payrollPeriodId) {
  const lock = await this.findOne({
    payrollPeriodId,
    status: 'active',
  }).lean();
  return !!lock;
};

/**
 * Get processing duration
 */
payrollRunLockSchema.methods.getProcessingDuration = function() {
  if (!this.releasedAt) {
    return null;
  }
  return this.releasedAt - this.acquiredAt;
};

module.exports = mongoose.model('PayrollRunLock', payrollRunLockSchema);