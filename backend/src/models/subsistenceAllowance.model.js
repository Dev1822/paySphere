/**
 * Section 10A of the Industrial Employment (Standing Orders) Act, 1946 (#1828).
 *
 * Two collections, and the first one exists because a suspension is a state the
 * product could not previously hold.
 *
 * `Suspension` is not a leave type and not a settlement. The employment
 * subsists, the workman does no work, and the employer must pay on a rising
 * scale — so it can be neither a row in the leave ledger, which pays nothing,
 * nor a settlement, which would close the record and make reinstatement a
 * re-hire.
 *
 * Three fields carry the weight:
 *
 *   `attributability` is a **finding**, stored with who made it and when,
 *   because the uplift from fifty per cent to seventy-five turns on it. Storing
 *   only the resulting rate would lose the reason, and the reason is what an
 *   enquiry record has to evidence.
 *
 *   `frozenWages` is a snapshot rather than a reference to the employee's
 *   current salary. Section 10A is on the wages "immediately preceding" the
 *   suspension, and a grade revision granted during a two-year suspension must
 *   not move it.
 *
 *   `outcome` converts what has already been drawn rather than re-deriving it.
 *   The same ledger rows are a set-off against back wages on reinstatement and
 *   an unrecoverable payment on dismissal, and which one they are arrives
 *   months after they were paid.
 *
 * `SubsistenceRules` holds the scale, the section 1(3) threshold — fifty in
 * several states rather than the central hundred — and the one declaration of
 * whether the allowance is wages for the provident fund, ESI and bonus, so that
 * is one decision rather than three.
 */

const mongoose = require('mongoose');

const {
  SUBSISTENCE_RULES,
  ATTRIBUTABILITY,
  OUTCOME,
  WAGE_BASIS,
  FINDING,
  SEVERITY,
} = require('../utils/subsistenceAllowance');

// --- The rules --------------------------------------------------------------

const subsistenceRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    firstTierDays: {
      type: Number,
      default: SUBSISTENCE_RULES.firstTierDays,
      min: 1,
    },
    /**
     * The scale.
     *
     * A certified standing order may better section 10A and may not undercut
     * it, so the engine clamps a stored figure below the statute rather than
     * trusting it — an underpayment that looks authorised is worse than a loud
     * wrong number.
     */
    firstTierPercent: {
      type: Number,
      default: SUBSISTENCE_RULES.firstTierPercent,
      min: 0,
      max: 100,
    },
    secondTierDays: {
      type: Number,
      default: SUBSISTENCE_RULES.secondTierDays,
      min: 1,
    },
    secondTierPercent: {
      type: Number,
      default: SUBSISTENCE_RULES.secondTierPercent,
      min: 0,
      max: 100,
    },
    thirdTierPercent: {
      type: Number,
      default: SUBSISTENCE_RULES.thirdTierPercent,
      min: 0,
      max: 100,
    },

    /** Section 1(3) — fifty in several states rather than the central hundred. */
    standingOrdersThreshold: {
      type: Number,
      default: SUBSISTENCE_RULES.standingOrdersThreshold,
      min: 1,
    },
    /** An establishment below the threshold that adopted them is still bound. */
    standingOrdersCertified: { type: Boolean, default: false },
    certifiedOn: { type: Date },

    /**
     * Whether the allowance is wages for anything else.
     *
     * One declaration, consumed everywhere. It is not remuneration for work
     * done, so the defaults are `false` — the point of holding them here is
     * that an establishment taking a different view states it once rather than
     * having six modules each reach their own conclusion from a payslip row.
     */
    countsForProvidentFund: {
      type: Boolean,
      default: SUBSISTENCE_RULES.countsForProvidentFund,
    },
    countsForEsi: { type: Boolean, default: SUBSISTENCE_RULES.countsForEsi },
    countsForBonus: {
      type: Boolean,
      default: SUBSISTENCE_RULES.countsForBonus,
    },
    countsForTds: { type: Boolean, default: SUBSISTENCE_RULES.countsForTds },

    daysPerMonth: {
      type: Number,
      default: SUBSISTENCE_RULES.daysPerMonth,
      min: 1,
      max: 31,
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

subsistenceRulesSchema.index(
  { tenantId: 1, establishment: 1 },
  { unique: true },
);

// --- The suspensions --------------------------------------------------------

const attributabilityFindingSchema = new mongoose.Schema(
  {
    finding: {
      type: String,
      enum: Object.values(ATTRIBUTABILITY),
      default: ATTRIBUTABILITY.NOT_DETERMINED,
    },
    /**
     * Who decided, and on what.
     *
     * The rate is a consequence; this is the fact. An overridable rate would
     * let the recorded number stop saying whether a finding was made at all,
     * which is exactly what an enquiry record has to evidence.
     */
    determinedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    determinedOn: { type: Date },
    reason: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const subsistencePaymentSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    /** What the schedule said was due for the month. */
    due: { type: Number, default: 0, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    paidOn: { type: Date },
    /** Which tier the month fell in, for the register that asks. */
    tier: { type: Number, default: 1, min: 1, max: 3 },
    percent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const suspensionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** Denormalised for the register, which outlives the employment. */
    name: { type: String, default: '', trim: true },

    suspendedOn: { type: Date, required: true },
    /** The order that suspended, for the record an enquiry produces. */
    orderReference: { type: String, default: '', trim: true },

    /**
     * Why, in one line.
     *
     * Deliberately not the enquiry's subject matter. A suspension pending a
     * POSH enquiry attracts section 10A the same way, and what that enquiry is
     * *about* is the committee's and not the payroll module's — this field
     * exists to identify the suspension, not to describe the allegation.
     */
    groundSummary: { type: String, default: '', trim: true },

    attributability: {
      type: attributabilityFindingSchema,
      default: () => ({}),
    },

    /**
     * The wage base, frozen at the date of suspension.
     *
     * A snapshot rather than a reference. Section 10A is on the wages the
     * workman was entitled to immediately preceding the suspension, so a
     * revision to the grade two years later moves nothing.
     */
    frozenWages: {
      basis: {
        type: String,
        enum: Object.values(WAGE_BASIS),
        default: WAGE_BASIS.BASIC_PLUS_DA,
      },
      basic: { type: Number, default: 0, min: 0 },
      dearnessAllowance: { type: Number, default: 0, min: 0 },
      frozenOn: { type: Date },
    },

    payments: { type: [subsistencePaymentSchema], default: [] },

    // --- The end of it ------------------------------------------------------
    outcome: {
      type: String,
      enum: Object.values(OUTCOME),
      default: OUTCOME.PENDING,
      index: true,
    },
    concludedOn: { type: Date },
    /** Where reinstatement carried an order for back wages. */
    backWages: { type: Number, default: 0, min: 0 },
    /** What the drawn allowance was set off against, once resolved. */
    setOff: { type: Number, default: 0, min: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

suspensionSchema.index({ tenantId: 1, establishment: 1, suspendedOn: -1 });
suspensionSchema.index({ tenantId: 1, outcome: 1, suspendedOn: 1 });

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    suspensionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Suspension' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const assessmentSuspensionSchema = new mongoose.Schema(
  {
    suspensionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Suspension' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },

    suspendedOn: { type: Date },
    days: { type: Number, default: 0 },
    attributability: { type: String, enum: Object.values(ATTRIBUTABILITY) },
    currentTier: { type: Number, default: 1 },
    currentPercent: { type: Number, default: 0 },

    due: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    shortfall: { type: Number, default: 0 },
    excess: { type: Number, default: 0 },

    /**
     * What a finding that the delay is not the workman's would add.
     *
     * Stored because it turns "somebody should look at this" into a number, and
     * a number is what gets an enquiry finding actually made.
     */
    differenceIfAttributed: { type: Number, default: 0 },

    nextTransitionOn: { type: Date },
    outcome: { type: String, enum: Object.values(OUTCOME) },
  },
  { _id: false },
);

const subsistenceAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    /** A snapshot, not a reference. */
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },

    applicable: { type: Boolean, default: true },
    workmen: { type: Number, default: 0 },
    standingOrdersCertified: { type: Boolean, default: false },

    suspensionCount: { type: Number, default: 0 },
    openCount: { type: Number, default: 0 },

    due: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    shortfall: { type: Number, default: 0 },

    /** Open, past the first tier, and nobody has made the finding. */
    awaitingFindingCount: { type: Number, default: 0 },
    exposureIfAttributed: { type: Number, default: 0 },
    setOffOnReinstatement: { type: Number, default: 0 },

    summary: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            section: { type: String, default: '' },
            severity: { type: String, enum: Object.values(SEVERITY) },
            count: { type: Number, default: 0 },
            suspensionCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    findings: { type: [findingSchema], default: [] },
    suspensions: { type: [assessmentSuspensionSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

subsistenceAssessmentSchema.index(
  { tenantId: 1, establishment: 1, periodStart: 1 },
  { unique: true },
);

const SubsistenceRules = mongoose.model(
  'SubsistenceRules',
  subsistenceRulesSchema,
);
const Suspension = mongoose.model('Suspension', suspensionSchema);
const SubsistenceAssessment = mongoose.model(
  'SubsistenceAssessment',
  subsistenceAssessmentSchema,
);

module.exports = { SubsistenceRules, Suspension, SubsistenceAssessment };
