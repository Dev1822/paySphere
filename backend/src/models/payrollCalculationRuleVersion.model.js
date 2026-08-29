const mongoose = require('mongoose');

const overtimeRuleSchema = new mongoose.Schema(
  {
    rateMultiplier: {
      type: Number,
      default: 1,
      min: 0,
    },
    standardMultiplier: {
      type: Number,
      default: 1.5,
      min: 0,
    },
    doubleMultiplier: {
      type: Number,
      default: 2,
      min: 0,
    },
    holidayMultiplier: {
      type: Number,
      default: 2.5,
      min: 0,
    },
    standardDailyHours: {
      type: Number,
      default: 8,
      min: 1,
      max: 24,
    },
    doubleOtDailyThreshold: {
      type: Number,
      default: 9,
      min: 1,
      max: 24,
    },
    weeklyHoursCeiling: {
      type: Number,
      default: 48,
      min: 1,
      max: 168,
    },
  },
  { _id: false },
);

const leaveRuleSchema = new mongoose.Schema(
  {
    dailyRateDivisor: {
      type: Number,
      default: null,
      min: 1,
    },
    maxDays: {
      type: Number,
      default: 31,
      min: 1,
      max: 366,
    },
  },
  { _id: false },
);

const deductionRuleSchema = new mongoose.Schema(
  {
    multiplier: {
      type: Number,
      default: 1,
      min: 0,
    },
  },
  { _id: false },
);

const bonusRuleSchema = new mongoose.Schema(
  {
    multiplier: {
      type: Number,
      default: 1,
      min: 0,
    },
    includeTaxableExpenses: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const salaryRuleSchema = new mongoose.Schema(
  {
    dailyRateDivisor: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  { _id: false },
);

const payrollCalculationRuleVersionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },

    version: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    overtime: {
      type: overtimeRuleSchema,
      default: () => ({}),
    },

    leave: {
      type: leaveRuleSchema,
      default: () => ({}),
    },

    deductions: {
      type: deductionRuleSchema,
      default: () => ({}),
    },

    bonus: {
      type: bonusRuleSchema,
      default: () => ({}),
    },

    salary: {
      type: salaryRuleSchema,
      default: () => ({}),
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);

payrollCalculationRuleVersionSchema.index(
  { tenantId: 1, version: 1 },
  { unique: true },
);

payrollCalculationRuleVersionSchema.index(
  { tenantId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
    },
  },
);

module.exports = mongoose.model(
  'PayrollCalculationRuleVersion',
  payrollCalculationRuleVersionSchema,
);