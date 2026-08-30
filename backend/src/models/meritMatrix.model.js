const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const meritMatrixSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    compensationCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompensationCycle',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      index: true, // Optional: if null, applies company-wide
    },
    performanceRating: {
      type: String, // e.g., 'Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'
      required: true,
    },
    compaRatioMin: {
      type: Number,
      required: true,
      min: 0,
    },
    compaRatioMax: {
      type: Number,
      required: true,
      min: 0,
    },
    recommendedIncreaseMin: {
      type: Number,
      required: true,
      min: 0,
      max: 100, // percentage
    },
    recommendedIncreaseMax: {
      type: Number,
      required: true,
      min: 0,
      max: 100, // percentage
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

meritMatrixSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('MeritMatrix', meritMatrixSchema);
