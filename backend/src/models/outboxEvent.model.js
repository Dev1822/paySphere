/**
 * @fileoverview Transactional Outbox Event Schema
 * @description One row per domain event that must survive a crash between
 * "the payroll write committed" and "the downstream job was queued" (#1801).
 * Written inside the same mongoose session/transaction as the business
 * mutation it accompanies, so the event's existence in Mongo is always a true
 * reflection of the mutation having happened — never emitted, never lost.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

const OUTBOX_STATUS = {
  PENDING: 'pending',
  PUBLISHED: 'published',
  FAILED: 'failed',
};

const OUTBOX_EVENT_TYPES = {
  PAYROLL_FINALIZED: 'PAYROLL_FINALIZED',
  PAYSLIP_GENERATION_REQUESTED: 'PAYSLIP_GENERATION_REQUESTED',
  PAYSLIP_EMAIL_REQUESTED: 'PAYSLIP_EMAIL_REQUESTED',
  PAYROLL_REVERSAL_REQUESTED: 'PAYROLL_REVERSAL_REQUESTED',
};

const outboxEventSchema = new mongoose.Schema(
  {
    // Unique per event so BullMQ's `jobId` dedup (see workers/outbox.worker.js)
    // can never enqueue the same downstream job twice, even if this row gets
    // published, then re-picked-up by a crashed-and-restarted worker.
    eventId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },
    eventType: {
      type: String,
      required: true,
      enum: Object.values(OUTBOX_EVENT_TYPES),
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OUTBOX_STATUS),
      default: OUTBOX_STATUS.PENDING,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    // Backoff gate: the publisher only picks up rows due for a (re)try, so a
    // failing event doesn't get hammered every poll tick.
    nextAttemptAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { timestamps: true },
);

// The publisher's poll query filters on status + nextAttemptAt and sorts by
// createdAt; without this compound index that scan gets expensive as the
// collection grows.
outboxEventSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema);

module.exports = { OutboxEvent, OUTBOX_STATUS, OUTBOX_EVENT_TYPES };