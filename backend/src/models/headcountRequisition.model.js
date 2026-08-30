const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

const headcountRequisitionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requisitionCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    type: {
      type: String,
      enum: ['New', 'Backfill'],
      required: true,
    },
    replacedEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    department: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    requestedCount: { type: Number, required: true, min: 1 },
    ctcBudget: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },
    status: {
      type: String,
      enum: [
        'Draft',
        'HR_Approval',
        'Finance_Approval',
        'Approved',
        'Rejected',
        'Fulfilled',
      ],
      default: 'Draft',
      index: true,
    },
    justification: { type: String, default: '', maxlength: 2000 },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByHR: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedByFinance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

headcountRequisitionSchema.index(
  { tenantId: 1, requisitionCode: 1 },
  { unique: true },
);

headcountRequisitionSchema.plugin(auditTrailPlugin);

const HeadcountRequisition = mongoose.model(
  'HeadcountRequisition',
  headcountRequisitionSchema,
);

module.exports = HeadcountRequisition;
