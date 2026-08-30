/**
 * @fileoverview Department Budget Management & Variance Analysis Schemas
 * @description Manages departmental budgets, line-item allocations, actual
 *   expenditure tracking, variance analysis, budget approval workflows,
 *   and multi-year budget planning.
 */

const mongoose = require('mongoose');

// ─── Cost Center ────────────────────────────────────────────────────────────
// Organizational cost centers that budgets are allocated to.

const costCenterSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: { type: String, default: '', maxlength: 500 },
    department: { type: String, required: true, trim: true, index: true },
    /** Parent cost center for hierarchical structure. */
    parentCostCenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptCostCenter',
      default: null,
    },
    /** Cost center manager responsible for budget. */
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    /** Annual budget allocation for this cost center. */
    annualBudget: { type: Number, default: 0, min: 0 },
    /** Currency code (ISO 4217). */
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

costCenterSchema.index(
  { tenantId: 1, code: 1 },
  { unique: true },
);

// ─── Budget Category ────────────────────────────────────────────────────────
// Categories for budget line items (Salary, Bonus, Benefits, etc.).

const budgetCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: { type: String, default: '' },
    /** Parent category for sub-categories. */
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptBudgetCategory',
      default: null,
    },
    /** Default percentage of department budget allocated to this category. */
    defaultAllocationPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

budgetCategorySchema.index(
  { tenantId: 1, code: 1 },
  { unique: true },
);

// ─── Department Budget ──────────────────────────────────────────────────────
// Annual/quarterly budget for a department with line-item allocations.

const departmentBudgetSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    costCenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptCostCenter',
      required: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    fiscalYear: {
      type: Number,
      required: true,
      index: true,
    },
    /** Budget period: Annual, Q1, Q2, Q3, Q4, or specific month. */
    period: {
      type: String,
      enum: ['Annual', 'Q1', 'Q2', 'Q3', 'Q4', 'Monthly'],
      default: 'Annual',
    },
    /** For monthly periods, the month number. */
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    /** Total budgeted amount for this period. */
    totalBudgeted: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Total actual expenditure so far. */
    totalActual: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Total committed (approved but not yet spent). */
    totalCommitted: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Variance = budgeted - actual. */
    variance: {
      type: Number,
      default: 0,
    },
    /** Variance percentage. */
    variancePercent: {
      type: Number,
      default: 0,
    },
    /** Budget utilization rate (actual / budgeted * 100). */
    utilizationRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'UnderReview', 'Approved', 'Rejected', 'Revised', 'Closed'],
      default: 'Draft',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'PartiallyApproved', 'FullyApproved', 'Rejected'],
      default: 'Pending',
    },
    /** Alert thresholds in percentage. */
    warningThreshold: { type: Number, default: 75, min: 0, max: 100 },
    criticalThreshold: { type: Number, default: 90, min: 0, max: 100 },
    /** Previous year budget for comparison. */
    previousYearBudgeted: { type: Number, default: 0, min: 0 },
    previousYearActual: { type: Number, default: 0, min: 0 },
    /** Year-over-year change percentage. */
    yoyChangePercent: { type: Number, default: 0 },
    /** Approval chain. */
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '', maxlength: 500 },
    notes: { type: String, default: '', maxlength: 1000 },
    /** Audit trail. */
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        changedAt: { type: Date, default: Date.now },
        comment: { type: String, default: '' },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

departmentBudgetSchema.index(
  { tenantId: 1, costCenterId: 1, fiscalYear: 1, period: 1, month: 1 },
  { unique: true, sparse: true },
);

// ─── Budget Line Item ───────────────────────────────────────────────────────
// Individual budget allocations within a department budget.

const budgetLineItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    budgetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptBudget',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptBudgetCategory',
      required: true,
    },
    /** Line item name (e.g., "Base Salaries", "Performance Bonus"). */
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 500 },
    /** Budgeted amount for this line item. */
    budgetedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Actual expenditure for this line item. */
    actualAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Committed but not yet spent. */
    committedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Forecasted end-of-period amount. */
    forecastAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Variance for this line item. */
    variance: {
      type: Number,
      default: 0,
    },
    variancePercent: {
      type: Number,
      default: 0,
    },
    utilizationRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Headcount associated with this line item (for salary-related items). */
    headcount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Average cost per head. */
    costPerHead: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

budgetLineItemSchema.index({ budgetId: 1, categoryId: 1 });

// ─── Budget Transaction Log ─────────────────────────────────────────────────
// Records every actual expenditure entry against a budget line item.

const budgetTransactionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    budgetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptBudget',
      required: true,
      index: true,
    },
    lineItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptBudgetLineItem',
      required: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: ['Actual', 'Committed', 'Adjustment', 'Reversal'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: { type: String, default: '', maxlength: 500 },
    /** Reference to the source (payroll run, expense claim, etc.). */
    referenceType: {
      type: String,
      enum: ['Payroll', 'Expense', 'Manual', 'Other'],
      default: 'Manual',
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

budgetTransactionSchema.index({ tenantId: 1, lineItemId: 1, transactionDate: -1 });

// ─── Budget Alert ───────────────────────────────────────────────────────────
// Automated alerts when budget thresholds are breached.

const budgetAlertSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    budgetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptBudget',
      required: true,
      index: true,
    },
    lineItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeptBudgetLineItem',
      default: null,
    },
    alertType: {
      type: String,
      enum: ['Warning', 'Critical', 'Exceeded', 'ForecastBreach'],
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    /** Current utilization when alert was triggered. */
    utilizationAtTrigger: { type: Number, required: true },
    /** Budgeted amount at time of alert. */
    budgetedAmount: { type: Number, required: true },
    /** Actual amount at time of alert. */
    actualAmount: { type: Number, required: true },
    /** Whether this alert has been acknowledged. */
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: { type: Date, default: null },
    /** Who should receive this alert. */
    notifyUserIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  { timestamps: true },
);

budgetAlertSchema.index({ tenantId: 1, alertType: 1, isAcknowledged: 1 });

// ─── Export Models ──────────────────────────────────────────────────────────

const DeptCostCenter = mongoose.model('DeptCostCenter', costCenterSchema);
const DeptBudgetCategory = mongoose.model(
  'DeptBudgetCategory',
  budgetCategorySchema,
);
const DeptBudget = mongoose.model('DeptBudget', departmentBudgetSchema);
const DeptBudgetLineItem = mongoose.model(
  'DeptBudgetLineItem',
  budgetLineItemSchema,
);
const BudgetTransaction = mongoose.model(
  'BudgetTransaction',
  budgetTransactionSchema,
);
const BudgetAlert = mongoose.model('BudgetAlert', budgetAlertSchema);

module.exports = {
  DeptCostCenter,
  DeptBudgetCategory,
  DeptBudget,
  DeptBudgetLineItem,
  BudgetTransaction,
  BudgetAlert,
};
