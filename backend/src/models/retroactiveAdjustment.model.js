const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const retroactiveAdjustmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    originalStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalaryStructure',
      required: true,
    },
    newStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalaryStructure',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED'],
      default: 'PENDING',
    },
    referenceId: {
      type: String,
      default: '',
    },
    calculatedArrears: [
      {
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        originalGross: { type: Number, default: 0 },
        newGross: { type: Number, default: 0 },
        grossDelta: { type: Number, default: 0 },
        originalPF: { type: Number, default: 0 },
        newPF: { type: Number, default: 0 },
        pfDelta: { type: Number, default: 0 },
        originalESI: { type: Number, default: 0 },
        newESI: { type: Number, default: 0 },
        esiDelta: { type: Number, default: 0 },
        originalPT: { type: Number, default: 0 },
        newPT: { type: Number, default: 0 },
        ptDelta: { type: Number, default: 0 },
        netDelta: { type: Number, default: 0 },
      },
    ],
    totalArrears: {
      type: Number,
      default: 0,
    },
    totalTaxLiability: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

retroactiveAdjustmentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('RetroactiveAdjustment', retroactiveAdjustmentSchema);
