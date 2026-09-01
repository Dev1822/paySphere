/**
 * Employee Import Job Model - Issue #1112
 *
 * Tracks the lifecycle of a bulk CSV import.
 * Status transitions:
 *   pending -> validating -> preview_ready -> importing -> done
 *                                                       -> failed
 *                                                       -> rolled_back
 */
'use strict';

const mongoose = require('mongoose');

const IMPORT_STATUSES = ['pending', 'validating', 'preview_ready', 'importing', 'done', 'failed', 'rolled_back'];

const employeeImportSchema = new mongoose.Schema(
  {
    tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    status:    { type: String, enum: IMPORT_STATUSES, default: 'pending' },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    errorRows: { type: Number, default: 0 },
    // e.g. [{ row: 3, message: 'email is invalid' }]
    errors: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Employee IDs created during commit - used to roll back the entire import.
    importedEmployeeIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // Temporarily stores valid rows between preview and commit.
    validatedRows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Track processed vs pending batches for resumability
    processedBatches: { type: [Number], default: [] },
    lastProcessedBatch: { type: Number, default: -1 },
    duplicateRows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    duplicateCount: { type: Number, default: 0 },
    successfulRows: { type: Number, default: 0 },
    batchSize: { type: Number, default: 100 },
    jobQueueId: { type: String, default: null },  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeImport', employeeImportSchema);