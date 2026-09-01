const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const jobDependencySchema = new mongoose.Schema(
  {
    // Unique identifier for this job in the workflow
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Workflow/chain identifier
    workflowId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Job type: 'payroll-finalization', 'payslip-generation', etc.
    jobType: {
      type: String,
      required: true,
      enum: ['payroll-finalization', 'payslip-generation', 'export', 'email-delivery'],
    },
    
    // Current status
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
      default: 'pending',
    },
    
    // Array of job IDs this job depends on
    dependencies: [
      {
        jobId: String,
        jobType: String,
      },
    ],
    
    // Array of jobs that depend on this one
    dependents: [
      {
        jobId: String,
        jobType: String,
      },
    ],
    
    // Retry configuration
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    
    // Execution details
    data: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    error: {
      message: String,
      stack: String,
      timestamp: Date,
    },
    
    // Timestamps
    startedAt: Date,
    completedAt: Date,
    nextRetryAt: Date,
    
    // Tenant isolation
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

jobDependencySchema.index({ workflowId: 1, tenantId: 1 });
jobDependencySchema.index({ status: 1, nextRetryAt: 1 });
jobDependencySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('JobDependency', jobDependencySchema);