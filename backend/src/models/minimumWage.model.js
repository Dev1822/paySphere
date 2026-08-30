/**
 * Minimum wage notifications and the assessments run against them (#1698).
 *
 * Two collections in one file because neither is useful without the other and
 * the second is meaningless without the first: an assessment is a claim about
 * what a notification required, and reading one without the other tells you a
 * number without telling you its authority.
 *
 * Notifications are append-only. A superseded rate is not deleted or edited —
 * it is left in place with its `effectiveFrom`, and the engine picks whichever
 * one was in force on the wage period being assessed. Overwriting would make a
 * reassessment of a closed period produce arrears that were never owed, which
 * is the same reasoning `statutoryBonus.model.js` uses for keeping each year's
 * `ledgerAfter` rather than maintaining one live balance.
 */

const mongoose = require('mongoose');

const {
  SKILL_CATEGORY,
  AREA_CLASS,
  RATE_BASIS,
  EXCLUSION,
  EXCLUDED_COMPONENT,
} = require('../utils/minimumWages');

/**
 * One gazetted rate.
 *
 * The composite key is (state, scheduled employment, area class, skill
 * category, effective from) — five columns, because that is genuinely how many
 * it takes to identify a rate. Dropping any of them merges two different
 * notifications into one, and the merged figure is wrong for at least one of
 * the populations it now covers.
 */
const minimumWageNotificationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** ISO 3166-2 subdivision code without the country prefix: KA, MH, TN. */
    state: { type: String, required: true, uppercase: true, trim: true },

    /**
     * The scheduled employment as the state names it. Free text rather than an
     * enum: the schedules are state-specific and a closed list here would mean
     * a tenant in a state we have not enumerated cannot record their own
     * notification, which is worse than an inconsistent label.
     */
    scheduledEmployment: { type: String, required: true, trim: true },

    areaClass: {
      type: String,
      enum: Object.values(AREA_CLASS),
      required: true,
    },

    /**
     * The state's own name for the area class — "Zone I", "Area A", "Municipal
     * Corporation area". Displayed rather than matched on, so the register
     * reads the way the gazette does.
     */
    areaClassLabel: { type: String, default: '' },

    skillCategory: {
      type: String,
      enum: Object.values(SKILL_CATEGORY),
      required: true,
    },

    /** The gazette reference, so a line in the register can be traced. */
    notificationRef: { type: String, default: '', trim: true },

    effectiveFrom: { type: Date, required: true },

    rateBasis: {
      type: String,
      enum: Object.values(RATE_BASIS),
      default: RATE_BASIS.MONTHLY,
    },

    /** The gazetted basic, in the unit `rateBasis` names. */
    basicRate: { type: Number, required: true, min: 0 },

    // --- Variable dearness allowance --------------------------------------
    //
    // Nil for the states that fold DA into the basic and revise the whole rate.
    // `vdaRatePerPoint: 0` is how that is expressed, and the engine reads it as
    // "this notification has no VDA" rather than as a missing field.

    vdaBaseCpiPoints: { type: Number, default: 0, min: 0 },
    vdaRatePerPoint: { type: Number, default: 0, min: 0 },

    /**
     * The step the notification rounds the VDA to — ₹1 in most states, ₹0.10 in
     * a few. Recorded because a figure that is a rupee off the gazetted one is
     * a figure an inspector can argue with.
     */
    vdaRounding: { type: Number, default: 1, min: 0.01 },

    /** Free-text note: exemptions, riders, the covering circular. */
    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// The lookup the engine performs on every employee of every assessment: narrow
// to the four key columns, then take the latest effective date not in the
// future. Descending on `effectiveFrom` so that scan is a prefix read rather
// than a sort.
minimumWageNotificationSchema.index({
  tenantId: 1,
  state: 1,
  scheduledEmployment: 1,
  areaClass: 1,
  skillCategory: 1,
  effectiveFrom: -1,
});

/** One payroll component, with the reason it was or was not counted. */
const componentSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    /** Absent on a counted component; a section 2(h) code on an excluded one. */
    code: { type: String, enum: Object.values(EXCLUDED_COMPONENT) },
  },
  { _id: false },
);

/** Section 14, per employee per period. */
const overtimeSchema = new mongoose.Schema(
  {
    hours: { type: Number, default: 0 },
    ordinaryHourlyRate: { type: Number, default: 0 },
    multiplier: { type: Number, default: 2 },
    entitlement: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    shortfall: { type: Number, default: 0 },
  },
  { _id: false },
);

/** One assessed employee. */
const assessmentLineSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },

    state: { type: String, default: '' },
    scheduledEmployment: { type: String, default: '' },
    areaClass: { type: String, default: '' },
    skillCategory: { type: String, default: '' },

    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MinimumWageNotification',
      default: null,
    },
    notificationRef: { type: String, default: '' },
    effectiveFrom: { type: Date, default: null },

    basicRate: { type: Number, default: 0 },
    vda: { type: Number, default: 0 },
    vdaPoints: { type: Number, default: 0 },
    notifiedMonthlyRate: { type: Number, default: 0 },
    notifiedDailyRate: { type: Number, default: 0 },

    daysWorked: { type: Number, default: 0 },
    daysInPeriod: { type: Number, default: 0 },
    proRataFraction: { type: Number, default: 1 },
    entitlement: { type: Number, default: 0 },

    /** What payroll paid in total, kept beside the comparable wage on purpose:
     *  the gap between the two is the entire conversation. */
    grossPaid: { type: Number, default: 0 },
    comparableWage: { type: Number, default: 0 },
    countedComponents: { type: [componentSchema], default: [] },
    excludedComponents: { type: [componentSchema], default: [] },

    shortfall: { type: Number, default: 0 },
    compliant: { type: Boolean, default: true },

    overtime: { type: overtimeSchema, default: () => ({}) },
    totalShortfall: { type: Number, default: 0 },
  },
  { _id: false },
);

/** An employee left out of the assessment, and why. */
const assessmentExclusionSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },
    state: { type: String, default: '' },
    skillCategory: { type: String, default: '' },
    code: { type: String, enum: Object.values(EXCLUSION), required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const minimumWageAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The wage period. Monthly, because that is the Act's wage period. */
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    /**
     * The CPI reading the VDA was computed from, and the date it was published
     * for. Stored rather than looked up at read time: the index is revised, and
     * a committed assessment has to reproduce the figure that was filed.
     */
    cpiPoints: { type: Number, default: 0 },
    cpiAsAt: { type: Date, default: null },

    assessedCount: { type: Number, default: 0 },
    excludedCount: { type: Number, default: 0 },
    shortfallCount: { type: Number, default: 0 },

    wageShortfall: { type: Number, default: 0 },
    overtimeShortfall: { type: Number, default: 0 },
    totalShortfall: { type: Number, default: 0 },
    compliant: { type: Boolean, default: true },

    lines: { type: [assessmentLineSchema], default: [] },
    exclusions: { type: [assessmentExclusionSchema], default: [] },

    byState: {
      type: [
        new mongoose.Schema(
          {
            state: { type: String, default: '' },
            assessed: { type: Number, default: 0 },
            shortfallCount: { type: Number, default: 0 },
            shortfall: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    /**
     * The component-name mapping this assessment ran with.
     *
     * A tenant that renames `conveyance_fixed` to `travel_fixed` next quarter
     * changes what counts as wages, and an assessment that did not record the
     * mapping it used cannot be reconciled against the one that follows.
     * Serialised as source strings because a RegExp does not survive BSON.
     */
    exclusionPatterns: {
      type: [
        new mongoose.Schema(
          {
            pattern: { type: String, required: true },
            code: {
              type: String,
              enum: Object.values(EXCLUDED_COMPONENT),
              required: true,
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One assessment per tenant per wage period. Re-running June corrects June
// rather than producing a second June, which matters because the arrears
// engine reads prior assessments and two Junes would be double-counted.
minimumWageAssessmentSchema.index(
  { tenantId: 1, periodStart: 1 },
  { unique: true },
);

const MinimumWageNotification = mongoose.model(
  'MinimumWageNotification',
  minimumWageNotificationSchema,
);

const MinimumWageAssessment = mongoose.model(
  'MinimumWageAssessment',
  minimumWageAssessmentSchema,
);

module.exports = { MinimumWageNotification, MinimumWageAssessment };
