/**
 * Industrial Disputes Act, 1947, Chapters VA and VB (#1830).
 *
 * Four collections, and the first one exists because a lay-off is a state no
 * ledger in this product can hold.
 *
 * `LayoffSpell` is not a leave row. The forty-five-day ceiling is *rolling* and
 * counted across separate spells, the days are netted of section 25E
 * disentitlements which are findings about conduct rather than leave codes, and
 * the section 25B service that qualifies a workman **counts the lay-off days
 * themselves** — so an attendance ledger reading present/absent gets every part
 * of it wrong.
 *
 * `ChapterVBAction` is separate from the spells because its subject is
 * different. A spell answers "what is owed"; this answers "was the employer
 * entitled to do this at all", and where permission was required and absent the
 * workmen are deemed not to have been laid off and are owed full wages instead.
 * The two liabilities are therefore stored as two fields on the assessment and
 * never as one — a single number either reader could take would be the most
 * dangerous figure in this product.
 *
 * `SeniorityRecord` exists because section 25G makes the *selection* reviewable.
 * A departure from last-in-first-out is lawful with recorded reasons and
 * unlawful without, so the reason is a stored field rather than a note.
 *
 * `ReemploymentCandidate` is the section 25H register, kept because
 * `recruitmentPipeline.js` hires without knowing that a retrenched workman in
 * the same category has a statutory claim on the vacancy.
 */

const mongoose = require('mongoose');

const {
  LAYOFF_RULES,
  SERVICE_DAY,
  DISENTITLEMENT,
  ACTION,
  PERMISSION_STATE,
  NOT_UNAVOIDABLE,
  FINDING,
  SEVERITY,
} = require('../utils/layoffCompensation');

// --- The rules --------------------------------------------------------------

const layoffRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    continuousServiceDays: {
      type: Number,
      default: LAYOFF_RULES.continuousServiceDays,
      min: 1,
    },
    mineContinuousServiceDays: {
      type: Number,
      default: LAYOFF_RULES.mineContinuousServiceDays,
      min: 1,
    },
    lookbackMonths: {
      type: Number,
      default: LAYOFF_RULES.lookbackMonths,
      min: 1,
    },

    layoffPercent: {
      type: Number,
      default: LAYOFF_RULES.layoffPercent,
      min: 0,
      max: 100,
    },
    layoffCeilingDays: {
      type: Number,
      default: LAYOFF_RULES.layoffCeilingDays,
      min: 0,
    },
    ceilingWindowMonths: {
      type: Number,
      default: LAYOFF_RULES.ceilingWindowMonths,
      min: 1,
    },

    /**
     * The Chapter VB threshold.
     *
     * The one figure here that is not optional to override. Several states have
     * raised it to three hundred, and the difference decides whether an act is a
     * compensable retrenchment or an illegal one — a wrong value does not
     * produce a wrong number, it produces the wrong kind of answer.
     */
    chapterVBThreshold: {
      type: Number,
      default: LAYOFF_RULES.chapterVBThreshold,
      min: 1,
    },
    chapterVBNoticeMonths: {
      type: Number,
      default: LAYOFF_RULES.chapterVBNoticeMonths,
      min: 0,
    },

    retrenchmentDaysPerYear: {
      type: Number,
      default: LAYOFF_RULES.retrenchmentDaysPerYear,
      min: 0,
    },
    closureCapMonths: {
      type: Number,
      default: LAYOFF_RULES.closureCapMonths,
      min: 0,
    },
    maternityLeaveWeeksCounted: {
      type: Number,
      default: LAYOFF_RULES.maternityLeaveWeeksCounted,
      min: 0,
    },
    daysPerMonth: {
      type: Number,
      default: LAYOFF_RULES.daysPerMonth,
      min: 1,
      max: 31,
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

layoffRulesSchema.index({ tenantId: 1, establishment: 1 }, { unique: true });

// --- The spells -------------------------------------------------------------

const serviceDaysSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: Object.values(SERVICE_DAY), required: true },
    days: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const disentitledDaysSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      enum: Object.values(DISENTITLEMENT),
      required: true,
    },
    days: { type: Number, default: 0, min: 0 },
    /** What happened, for the tribunal that asks. */
    note: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const layoffSpellSchema = new mongoose.Schema(
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
    name: { type: String, default: '', trim: true },
    /** Section 25G orders within a category, so it has to be recorded. */
    category: { type: String, default: '', trim: true, index: true },
    belowGroundInMine: { type: Boolean, default: false },

    fromDate: { type: Date, required: true },
    toDate: { type: Date },

    laidOffDays: { type: Number, default: 0, min: 0 },
    /** Section 25C excludes these from the compensable days outright. */
    weeklyHolidays: { type: Number, default: 0, min: 0 },

    /**
     * Section 25E disentitlements, per reason.
     *
     * Findings about conduct rather than leave-type codes, which is the reason
     * a lay-off cannot be modelled as a leave balance at all.
     */
    disentitledDays: { type: [disentitledDaysSchema], default: [] },

    /**
     * The section 25B lookback, by kind of day.
     *
     * Recorded rather than derived, because a day of lay-off and a day of legal
     * strike both count as service and both read as absence to the attendance
     * ledger — and maternity leave counts only to twelve weeks, so a longer
     * leave has to be split rather than counted whole.
     */
    serviceDays: { type: [serviceDaysSchema], default: [] },

    /**
     * The wage base at the date of lay-off, frozen.
     *
     * Chapter VA computes on basic and dearness allowance over twenty-six —
     * a different divisor from the calendar-month proration elsewhere in this
     * product.
     */
    frozenWages: {
      basic: { type: Number, default: 0, min: 0 },
      dearnessAllowance: { type: Number, default: 0, min: 0 },
      benefitsPerDay: { type: Number, default: 0, min: 0 },
      frozenOn: { type: Date },
    },

    /** Which Chapter VB act this spell sits under, where one applies. */
    chapterVBActionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChapterVBAction',
    },

    compensationPaid: { type: Number, default: 0, min: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

layoffSpellSchema.index({ tenantId: 1, employeeId: 1, fromDate: -1 });
layoffSpellSchema.index({ tenantId: 1, establishment: 1, fromDate: -1 });

// --- The Chapter VB act -----------------------------------------------------

const chapterVBActionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    action: { type: String, enum: Object.values(ACTION), required: true },
    /** The headcount the threshold is tested against, as at the act. */
    workmen: { type: Number, default: 0, min: 0 },

    proposedOn: { type: Date, required: true },
    effectiveOn: { type: Date },

    /**
     * Where the permission stands.
     *
     * `NOT_SOUGHT` is the default and is not a neutral state: above the
     * threshold it makes the act illegal, and the workmen are then owed full
     * wages rather than compensation.
     */
    permission: {
      type: String,
      enum: Object.values(PERMISSION_STATE),
      default: PERMISSION_STATE.NOT_SOUGHT,
      index: true,
    },
    permissionApplicationNumber: { type: String, default: '', trim: true },
    permissionAppliedOn: { type: Date },
    permissionDecidedOn: { type: Date },

    /** Section 25N(1)(a), quite apart from the permission. */
    noticeMonths: { type: Number, default: 0, min: 0 },

    // --- Closure only -------------------------------------------------------
    /** Section 25FFF proviso — claimed as beyond the employer's control. */
    unavoidable: { type: Boolean, default: false },
    /**
     * The grounds claimed.
     *
     * Recorded because the proviso's explanation names three that do *not*
     * count, and those are the ones most often claimed — so the cap is refused
     * with a reason rather than silently not applied.
     */
    grounds: {
      type: [{ type: String, enum: Object.values(NOT_UNAVOIDABLE) }],
      default: [],
    },
    groundsNote: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

chapterVBActionSchema.index({ tenantId: 1, establishment: 1, proposedOn: -1 });

// --- Section 25G ------------------------------------------------------------

const seniorityRecordSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    chapterVBActionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChapterVBAction',
      index: true,
    },
    category: { type: String, default: '', trim: true, index: true },

    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '', trim: true },
    serviceDays: { type: Number, default: 0, min: 0 },

    proposed: { type: Boolean, default: false },
    /**
     * Why the selection departed from last-in-first-out.
     *
     * A stored field rather than a note, because section 25G makes a departure
     * lawful with recorded reasons and unlawful without — so the presence or
     * absence of this string is itself the finding.
     */
    departureReason: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// --- Section 25H ------------------------------------------------------------

const reemploymentCandidateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true, index: true },
    serviceDays: { type: Number, default: 0, min: 0 },

    retrenchedOn: { type: Date, required: true },
    /** When the preference was actually offered, which is the discharge. */
    offeredOn: { type: Date },
    reemployedOn: { type: Date },
    declinedOn: { type: Date },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

reemploymentCandidateSchema.index({
  tenantId: 1,
  category: 1,
  reemployedOn: 1,
});

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    workmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'LayoffSpell' },
    workmanName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const layoffAssessmentSchema = new mongoose.Schema(
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

    action: { type: String, enum: Object.values(ACTION) },
    workmen: { type: Number, default: 0 },
    permissionRequired: { type: Boolean, default: false },
    permission: { type: String, enum: Object.values(PERMISSION_STATE) },
    lawful: { type: Boolean, default: true },

    spellCount: { type: Number, default: 0 },
    qualifiedCount: { type: Number, default: 0 },
    payableDays: { type: Number, default: 0 },
    beyondCeilingDays: { type: Number, default: 0 },

    /**
     * The two liabilities, stored as two fields.
     *
     * `compensation` is what is owed on a lawful lay-off; `illegalityExposure`
     * is what is owed on an unlawful one — full wages as if the workmen had
     * continued, several times the first. `applicableLiability` says which one
     * this assessment landed on. A single number either reader could take would
     * be the most dangerous figure in this product.
     */
    compensation: { type: Number, default: 0 },
    illegalityExposure: { type: Number, default: 0 },
    applicableLiability: {
      type: String,
      enum: ['COMPENSATION', 'FULL_WAGES_AS_IF_CONTINUED'],
      default: 'COMPENSATION',
    },

    summary: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            section: { type: String, default: '' },
            severity: { type: String, enum: Object.values(SEVERITY) },
            count: { type: Number, default: 0 },
            workmanCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    findings: { type: [findingSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

layoffAssessmentSchema.index(
  { tenantId: 1, establishment: 1, periodStart: 1 },
  { unique: true },
);

const LayoffRules = mongoose.model('LayoffRules', layoffRulesSchema);
const LayoffSpell = mongoose.model('LayoffSpell', layoffSpellSchema);
const ChapterVBAction = mongoose.model(
  'ChapterVBAction',
  chapterVBActionSchema,
);
const SeniorityRecord = mongoose.model(
  'SeniorityRecord',
  seniorityRecordSchema,
);
const ReemploymentCandidate = mongoose.model(
  'ReemploymentCandidate',
  reemploymentCandidateSchema,
);
const LayoffAssessment = mongoose.model(
  'LayoffAssessment',
  layoffAssessmentSchema,
);

module.exports = {
  LayoffRules,
  LayoffSpell,
  ChapterVBAction,
  SeniorityRecord,
  ReemploymentCandidate,
  LayoffAssessment,
};
