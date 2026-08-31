const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const sandboxSessionSchema = new mongoose.Schema(
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
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targets: {
      departments: [{ type: String }],
      employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    },
    draftComponents: [
      {
        code: { type: String, required: true },
        value: { type: Number, required: true },
        type: { type: String, default: 'EARNING' }, // EARNING, DEDUCTION
      },
    ],
    transactionJournal: [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true }
);

const simulatedPayrollSchema = new mongoose.Schema(
  {
    sandboxSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SandboxSession',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    employeeName: { type: String, required: true },
    department: { type: String, default: 'Unassigned' },
    originalGross: { type: Number, default: 0 },
    originalNet: { type: Number, default: 0 },
    originalTax: { type: Number, default: 0 },
    simulatedGross: { type: Number, default: 0 },
    simulatedNet: { type: Number, default: 0 },
    simulatedTax: { type: Number, default: 0 },
    simulatedEmployerCost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sandboxSessionSchema.plugin(softDeletePlugin);
simulatedPayrollSchema.plugin(softDeletePlugin);

const SandboxSession = mongoose.model('SandboxSession', sandboxSessionSchema);
const SimulatedPayroll = mongoose.model('SimulatedPayroll', simulatedPayrollSchema);

module.exports = {
  SandboxSession,
  SimulatedPayroll,
};
