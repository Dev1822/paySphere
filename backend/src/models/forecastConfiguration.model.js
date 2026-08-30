const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const forecastConfigurationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    historicalRange: {
      fromYear: { type: Number, required: true },
      fromMonth: { type: Number, required: true },
      toYear: { type: Number, required: true },
      toMonth: { type: Number, required: true },
    },
    targetPeriod: {
      targetYear: { type: Number, required: true },
      targetMonth: { type: Number, required: true },
    },
    adjustmentFactors: {
      inflationRate: { type: Number, default: 0 }, // e.g. 5 for 5%
      incrementTrend: { type: Number, default: 0 }, // e.g. 8 for 8%
    },
    confidenceInterval: {
      type: Number,
      default: 0.95, // 95% confidence interval
    },
    departmentBudgets: {
      type: Map,
      of: Number, // Key: department name or ID, Value: budget cap
      default: {},
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    results: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

forecastConfigurationSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('ForecastConfiguration', forecastConfigurationSchema);
