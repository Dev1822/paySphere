'use strict';

const mongoose = require('mongoose');

/**
 * PayrollReconciliation Schema
 * Tracks component-level verification of payroll calculations
 * Ensures deterministic consistency between inputs and stored results
 */
const payrollReconciliationSchema = new mongoose.Schema(
  {
    // Reference to the payroll being reconciled
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
      required: true,
      index: true,
    },

    // Status of the reconciliation
    status: {
      type: String,
      enum: [
        'pending', // Initial state
        'verified', // Payroll is consistent
        'mismatch_detected', // Component mismatch found
        'reconciled', // Legacy: anomaly reconciled
        'approved', // Approved by reviewer
        'rejected', // Rejected, needs correction
        'escalated', // Escalated for investigation
      ],
      default: 'pending',
      index: true,
    },

    // Component-level details (new determinism tracking)
    mismatchedComponent: {
      type: String,
      enum: [
        'grossSalary',
        'overtime',
        'bonuses',
        'deductions',
        'taxComponents',
        'netSalary',
      ],
      sparse: true, // Only populated when mismatch found
    },

    // Detailed differences between stored and calculated values
    differences: {
      component: String,
      stored: Number,
      calculated: Number,
      variance: {
        absolute: String, // e.g., "50.00"
        percentage: String, // e.g., "1.23%"
      },
    },

    // Legacy anomaly tracking (backward compatibility)
    anomalyType: String,
    justification: String,

    // User tracking for audit
    detectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    detectedAt: Date,

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    verifiedAt: Date,

    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    reconciledAt: Date,

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    resolvedAt: Date,

    // Resolution details
    resolutionNotes: String,

    // Payroll context for reference
    payrollContext: {
      employeeId: mongoose.Schema.Types.ObjectId,
      payrollPeriod: Date,
      status: String,
    },

    // Tags for filtering and organization
    tags: [String],

    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
    collection: 'payroll_reconciliations',
  }
);

// Indexes for efficient querying
payrollReconciliationSchema.index({ payrollId: 1, createdAt: -1 });
payrollReconciliationSchema.index({ status: 1, createdAt: -1 });
payrollReconciliationSchema.index({ mismatchedComponent: 1 });
payrollReconciliationSchema.index({ detectedBy: 1 });
payrollReconciliationSchema.index({ 'payrollContext.employeeId': 1 });

// Text index for search
payrollReconciliationSchema.index({
  resolutionNotes: 'text',
  mismatchedComponent: 'text',
});

/**
 * Get reconciliation status summary
 */
payrollReconciliationSchema.statics.getStatusSummary = async function(
  filters = {}
) {
  const statusCounts = await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  return Object.fromEntries(
    statusCounts.map(item => [item._id, item.count])
  );
};

/**
 * Find unresolved reconciliations
 */
payrollReconciliationSchema.statics.findUnresolved = async function(
  options = {}
) {
  const unresolvedStatuses = ['pending', 'mismatch_detected', 'escalated'];
  return this.find({
    status: { $in: unresolvedStatuses },
    ...options,
  })
    .populate('payrollId')
    .populate('detectedBy', 'fullName email')
    .sort('-createdAt');
};

/**
 * Find mismatches by component
 */
payrollReconciliationSchema.statics.findMismatchesByComponent = async function(
  component,
  options = {}
) {
  return this.find({
    mismatchedComponent: component,
    ...options,
  })
    .populate('payrollId')
    .sort('-createdAt');
};

/**
 * Get variance statistics
 */
payrollReconciliationSchema.statics.getVarianceStatistics = async function(
  component = null,
  filters = {}
) {
  const matchStage = {
    status: 'mismatch_detected',
    differences: { $exists: true },
    ...filters,
  };

  if (component) {
    matchStage.mismatchedComponent = component;
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$mismatchedComponent',
        count: { $sum: 1 },
        avgVariance: {
          $avg: {
            $toDouble: {
              $substr: ['$differences.variance.absolute', 0, -1],
            },
          },
        },
      },
    },
    { $sort: { avgVariance: -1 } },
  ]);

  return stats;
};

/**
 * Archive old reconciliation records (e.g., after 90 days)
 */
payrollReconciliationSchema.statics.archiveOldRecords = async function(
  daysOld = 90
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    status: 'verified',
    createdAt: { $lt: cutoffDate },
  });

  return result;
};

module.exports = mongoose.model(
  'PayrollReconciliation',
  payrollReconciliationSchema
);