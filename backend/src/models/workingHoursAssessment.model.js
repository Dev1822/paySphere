/**
 * Working hours compliance (#1702).
 *
 * Two collections: the establishment's limits, and the assessments run against
 * them.
 *
 * The limits are a document rather than constants because the Factories Act's
 * figures are not the only ones in force. The state Shops and Establishments
 * Acts set their own — nine hours a day and forty-eight a week in most, ten and
 * a half in a few, and the spread-over varies — so an establishment carries its
 * own rule set and the Act's numbers are what it falls back to.
 *
 * An assessment is stored rather than recomputed on read, and stores the limits
 * it ran under. The attendance ledger is edited (`ATTENDANCE_UPDATE` is an
 * audited action for exactly that reason) and the limits can be revised, so an
 * assessment that could not reproduce what was known when it was made would not
 * be evidence of anything — which is the whole point of committing one.
 */

const mongoose = require('mongoose');

const {
  FINDING,
  SEVERITY,
  FACTORIES_ACT_LIMITS,
} = require('../utils/workingHoursCompliance');

const workingHoursLimitsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The site these limits apply to. Empty is the tenant-wide default. */
    establishment: { type: String, default: '', trim: true },

    /**
     * Which statute the establishment is under.
     *
     * Recorded rather than derived, because it decides which figures are right
     * and there is no way to infer it from the data — a software firm in
     * Karnataka is under the Shops and Establishments Act and a plant next door
     * is under the Factories Act, and their limits differ.
     */
    statute: { type: String, default: 'Factories Act, 1948' },

    maxDailyHours: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.maxDailyHours,
      min: 1,
    },
    maxWeeklyHours: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.maxWeeklyHours,
      min: 1,
    },
    maxSpreadOverHours: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.maxSpreadOverHours,
      min: 1,
    },
    maxContinuousHours: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.maxContinuousHours,
      min: 1,
    },
    minIntervalMinutes: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.minIntervalMinutes,
      min: 1,
    },
    maxWeeklyHoursWithOvertime: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.maxWeeklyHoursWithOvertime,
      min: 1,
    },
    maxQuarterlyOvertimeHours: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.maxQuarterlyOvertimeHours,
      min: 0,
    },
    maxConsecutiveDays: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.maxConsecutiveDays,
      min: 1,
    },
    overtimeMultiplier: {
      type: Number,
      default: FACTORIES_ACT_LIMITS.overtimeMultiplier,
      min: 1,
    },

    /**
     * The day the establishment's week starts on, 0 = Sunday.
     *
     * Not cosmetic: a forty-eight-hour week measured over the wrong seven days
     * is a different number, and assuming Monday moves every boundary for an
     * establishment that starts on Sunday.
     */
    weekStartsOn: { type: Number, default: 1, min: 0, max: 6 },

    /**
     * Whether the state has granted a section 66 exemption, and on what terms.
     *
     * The exemption itself is a boolean; the conditions are what an inspection
     * asks about, so they are recorded as text beside it rather than being
     * reduced to one.
     */
    nightHoursExempt: { type: Boolean, default: false },
    nightHoursExemptionRef: { type: String, default: '' },
    nightHoursExemptionConditions: { type: String, default: '' },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One rule set per establishment. The tenant-wide default is the row with an
// empty establishment.
workingHoursLimitsSchema.index(
  { tenantId: 1, establishment: 1 },
  { unique: true },
);

/** One finding, with the section it is under. */
const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: {
      type: String,
      enum: Object.values(SEVERITY),
      default: SEVERITY.BREACH,
    },
    detail: { type: String, default: '' },

    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },

    /** Whichever of these the finding is anchored to. */
    date: { type: Date, default: null },
    weekStart: { type: Date, default: null },
    quarter: { type: String, default: '' },

    hours: { type: Number, default: 0 },
    /** Set on an underpayment; the rupee figure the finding is worth. */
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

/** A per-employee summary. The day-by-day detail is not stored. */
const employeeSummarySchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },

    daysWorked: { type: Number, default: 0 },
    hoursWorked: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },

    overtimeEntitlement: { type: Number, default: 0 },
    overtimePaid: { type: Number, default: 0 },
    overtimeShortfall: { type: Number, default: 0 },

    breachCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const workingHoursAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    establishment: { type: String, default: '' },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    /**
     * The limits this assessment ran under, copied rather than referenced.
     *
     * The limits document is mutable — an establishment corrects its week start
     * or records a night-hours exemption — so a reference would let a committed
     * assessment silently change what it was measured against.
     */
    limits: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    assessedCount: { type: Number, default: 0 },
    breachCount: { type: Number, default: 0 },
    overtimeShortfall: { type: Number, default: 0 },
    compliant: { type: Boolean, default: true },

    /**
     * Findings grouped by section, and the flat list.
     *
     * Both, because they answer different questions: the grouping is what a
     * manager reads ("we have a spread-over problem"), and the flat list is what
     * gets chased ("which day, for whom").
     */
    bySection: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            section: { type: String, default: '' },
            severity: { type: String, enum: Object.values(SEVERITY) },
            count: { type: Number, default: 0 },
            employeeCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    findings: { type: [findingSchema], default: [] },
    employees: { type: [employeeSummarySchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One assessment per establishment per period start. Re-running June corrects
// June rather than producing a second June.
workingHoursAssessmentSchema.index(
  { tenantId: 1, establishment: 1, periodStart: 1 },
  { unique: true },
);

const WorkingHoursLimits = mongoose.model(
  'WorkingHoursLimits',
  workingHoursLimitsSchema,
);

const WorkingHoursAssessment = mongoose.model(
  'WorkingHoursAssessment',
  workingHoursAssessmentSchema,
);

module.exports = { WorkingHoursLimits, WorkingHoursAssessment };
