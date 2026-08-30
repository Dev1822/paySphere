const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const cycleBudgetSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Optional: Can be allocated to a specific manager instead of just a department
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    utilizedAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
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

// Ensure unique budget per department within a cycle
cycleBudgetSchema.index(
  { compensationCycleId: 1, departmentId: 1 },
  { unique: true, name: 'unique_budget_per_dept_in_cycle' },
);

cycleBudgetSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('CycleBudget', cycleBudgetSchema);
