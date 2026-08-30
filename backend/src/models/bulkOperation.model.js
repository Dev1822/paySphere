const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'error', 'rolled_back'],
      default: 'pending',
    },
    error: {
      type: String,
    },
  },
  { _id: false },
);

const bulkOperationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    operationType: {
      type: String,
      enum: ['SALARY_REVISION', 'DEPARTMENT_TRANSFER', 'ROLE_CHANGE'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'completed',
        'rolled_back',
        'failed',
        'rolling_back',
      ],
      default: 'pending',
      index: true,
    },
    spec: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    snapshots: [snapshotSchema],
    errorMessage: {
      type: String,
    },
    totalCount: {
      type: Number,
      default: 0,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('BulkOperation', bulkOperationSchema);
