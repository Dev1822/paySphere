'use strict';
const mongoose = require('mongoose');

const idempotencyRecordSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed'],
      required: true,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
    },
    responseStatus: {
      type: Number,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '24h' }, // TTL index
    },
  },
  { timestamps: true },
);

// Compound index for fast lookup per tenant
idempotencyRecordSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true },
);

module.exports = mongoose.model('IdempotencyRecord', idempotencyRecordSchema);
