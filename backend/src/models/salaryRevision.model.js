/**
 * @fileoverview Salary Revision Simulator Schemas
 * @description Manages salary revision simulations, what-if scenarios,
 *   approved revision batches, individual revision records, and
 *   budget impact projections.
 */

const mongoose = require('mongoose');

// ─── Revision Scenario ──────────────────────────────────────────────────────
// A saved simulation scenario that can be compared against others.

const revisionScenarioSchema = new mongoose.Schema(
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
      maxlength: 150,
    },
    description: { type: String, default: '', maxlength: 1000 },
    fiscalYear: { type: Number, required: true, index: true },
    effectiveDate: { type: Date, required: true },
    /** Scenario type determines how revisions are applied. */
    scenarioType: {
      type: String,
      enum: [
        'UniformPercent',
        'DepartmentWise',
        'PerformanceBased',
        'MarketAdjustment',
        'Custom',
      ],
      default: 'UniformPercent',
      index: true,
    },
    /** For UniformPercent: global hike percentage. */
    globalHikePercent: { type: Number, default: 0, min: 0, max: 100 },
    /** For DepartmentWise: per-department percentages. */
    departmentHikes: [
      {
        department: { type: String, required: true },
        hikePercent: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    /** For PerformanceBased: rating-to-hike mapping. */
    performanceBands: [
      {
        rating: { type: String, required: true },
        hikePercent: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    /** Maximum hike cap per employee (absolute or percentage of current salary). */
    maxHikeCapPercent: { type: Number, default: 50, min: 0, max: 200 },
    /** Whether to include bonus in the revision calculation. */
    includeBonus: { type: Boolean, default: false },
    /** Whether to include statutory contributions (PF, ESI) impact. */
    includeStatutoryImpact: { type: Boolean, default: true },
    /** Status of the scenario. */
    status: {
      type: String,
      enum: ['Draft', 'Simulated', 'Submitted', 'Approved', 'Rejected', 'Applied'],
      default: 'Draft',
      index: true,
    },
    /** Computed totals after simulation. */
    totalEmployees: { type: Number, default: 0 },
    totalCurrentPayroll: { type: Number, default: 0 },
    totalRevisedPayroll: { type: Number, default: 0 },
    totalIncrementCost: { type: Number, default: 0 },
    averageHikePercent: { type: Number, default: 0 },
    medianHikePercent: { type: Number, default: 0 },
    /** Maximum and minimum hikes in the scenario. */
    maxHikePercent: { type: Number, default: 0 },
    minHikePercent: { type: Number, default: 0 },
    /** Annualized impact (12 × monthly increment cost). */
    annualizedImpact: { type: Number, default: 0 },
    /** Budget impact percentage vs current payroll. */
    budgetImpactPercent: { type: Number, default: 0 },
    /** Headcount breakdown. */
    headcountByDepartment: [
      {
        department: { type: String, required: true },
        count: { type: Number, default: 0 },
        avgHike: { type: Number, default: 0 },
        totalIncrement: { type: Number, default: 0 },
      },
    ],
    headcountByLevel: [
      {
        level: { type: String, required: true },
        count: { type: Number, default: 0 },
        avgHike: { type: Number, default: 0 },
        totalIncrement: { type: Number, default: 0 },
      },
    ],
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        comment: { type: String, default: '' },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

revisionScenarioSchema.index({ tenantId: 1, fiscalYear: 1 });

// ─── Revision Line Item ─────────────────────────────────────────────────────
// Individual employee revision within a scenario.

const revisionLineItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    scenarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RevisionScenario',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** Current salary snapshot. */
    currentMonthlySalary: { type: Number, required: true, min: 0 },
    currentAnnualCTC: { type: Number, default: 0, min: 0 },
    currentBasicSalary: { type: Number, default: 0, min: 0 },
    /** Revised salary. */
    revisedMonthlySalary: { type: Number, required: true, min: 0 },
    revisedAnnualCTC: { type: Number, default: 0, min: 0 },
    revisedBasicSalary: { type: Number, default: 0, min: 0 },
    /** Increment details. */
    hikePercent: { type: Number, required: true, min: 0 },
    hikeAmount: { type: Number, required: true, min: 0 },
    /** Employee metadata for grouping. */
    department: { type: String, default: '', index: true },
    role: { type: String, default: '' },
    level: { type: String, default: '', index: true },
    performanceRating: { type: String, default: '' },
    tenureMonths: { type: Number, default: 0 },
    /** Whether this revision was overridden manually. */
    isManualOverride: { type: Boolean, default: false },
    overrideReason: { type: String, default: '', maxlength: 500 },
    /** Status of this individual revision. */
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Applied'],
      default: 'Pending',
      index: true,
    },
    /** Statutory impact per employee. */
    pfImpact: { type: Number, default: 0 },
    esiImpact: { type: Number, default: 0 },
    gratuityImpact: { type: Number, default: 0 },
    totalStatutoryImpact: { type: Number, default: 0 },
    /** Approval chain. */
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

revisionLineItemSchema.index(
  { scenarioId: 1, employeeId: 1 },
  { unique: true },
);

// ─── Revision Batch ─────────────────────────────────────────────────────────
// A batch of approved revisions ready to be applied to payroll.

const revisionBatchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    scenarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RevisionScenario',
      required: true,
    },
    batchNumber: { type: String, required: true, unique: true },
    effectiveDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Applied', 'Failed', 'RolledBack'],
      default: 'Pending',
      index: true,
    },
    totalEmployees: { type: Number, default: 0 },
    totalIncrementCost: { type: Number, default: 0 },
    processedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    appliedAt: { type: Date, default: null },
    rolledBackAt: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// ─── Revision Audit Log ─────────────────────────────────────────────────────
// Immutable audit trail for every revision action.

const revisionAuditLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    scenarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RevisionScenario',
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      index: true,
    },
    action: {
      type: String,
      enum: [
        'ScenarioCreated',
        'ScenarioSimulated',
        'ScenarioSubmitted',
        'ScenarioApproved',
        'ScenarioRejected',
        'RevisionApproved',
        'RevisionRejected',
        'RevisionOverridden',
        'BatchCreated',
        'BatchApplied',
        'BatchRolledBack',
      ],
      required: true,
    },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true },
);

revisionAuditLogSchema.index({ tenantId: 1, createdAt: -1 });

// ─── Export Models ──────────────────────────────────────────────────────────

const RevisionScenario = mongoose.model(
  'RevisionScenario',
  revisionScenarioSchema,
);
const RevisionLineItem = mongoose.model(
  'RevisionLineItem',
  revisionLineItemSchema,
);
const RevisionBatch = mongoose.model('RevisionBatch', revisionBatchSchema);
const RevisionAuditLog = mongoose.model(
  'RevisionAuditLog',
  revisionAuditLogSchema,
);

module.exports = {
  RevisionScenario,
  RevisionLineItem,
  RevisionBatch,
  RevisionAuditLog,
};
