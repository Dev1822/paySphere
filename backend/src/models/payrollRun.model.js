const mongoose = require('mongoose');

/**
 * One document per payroll-run identity: tenantId + payrollPeriod +
 * payrollRunType (issue #1800).
 *
 * This is the durable idempotency record. It's what lets a retried BullMQ
 * job — or a second admin triggering the same run a moment later — discover
 * that the run already exists (in progress or finished) instead of
 * processing payroll a second time.
 *
 * The unique index is the safety net: even if the Redis lock in
 * lockManager.js is skipped, expires early, or Redis is unreachable, Mongo
 * still refuses a second "processing" row for the same identity.
 */
const payrollRunSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
    },
    // Deterministic period key, e.g. "2026-08", so the same period always
    // maps to the same row regardless of who submitted it.
    payrollPeriod: {
      type: String,
      required: true,
    },
    payrollRunType: {
      type: String,
      required: true,
      default: 'REGULAR',
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed', 'finalizing', 'finalized'],
      default: 'processing',
    },
    jobId: {
      type: String,
      default: null,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    finalizationStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'rolled_back'],
      default: 'pending',
    },
    finalizationStartedAt: {
      type: Date,
      default: null,
    },
    finalizationCompletedAt: {
      type: Date,
      default: null,
    },
    finalizationAttempts: {
      type: Number,
      default: 0,
    },
    finalizationVersion: {
      type: Number,
      default: 0,
    },
    finalizationIdempotencyKey: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    finishedAt: {
      type: Date,
      default: null,
    },  },
  { timestamps: true },
);

// Deterministic payroll-run identity. This is the DB-level guarantee that
// the acceptance criteria call for: even if distributed locking fails,
// two processes cannot both hold a "processing" row for the same
// tenant + period + run type.
payrollRunSchema.index(
  { tenantId: 1, payrollPeriod: 1, payrollRunType: 1 },
  { unique: true },
);

module.exports = mongoose.model('PayrollRun', payrollRunSchema);