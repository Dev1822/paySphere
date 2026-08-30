const mongoose = require('mongoose');

const headcountPlanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    department: { type: String, required: true, trim: true, index: true },
    fiscalYear: { type: Number, required: true, index: true },
    approvedHeadcount: { type: Number, required: true, min: 0 },
    budgetLimit: { type: Number, required: true, min: 0 },
    utilizedHeadcount: { type: Number, default: 0, min: 0 },
    utilizedBudget: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

headcountPlanSchema.index(
  { tenantId: 1, department: 1, fiscalYear: 1 },
  { unique: true },
);

const HeadcountPlan = mongoose.model('HeadcountPlan', headcountPlanSchema);

module.exports = HeadcountPlan;
