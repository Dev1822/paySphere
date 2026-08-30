/**
 * Apprentices Act, 1961 (#1771).
 *
 * Three collections, and the first one is the answer to "why not just add a flag
 * to the employee".
 *
 * `Apprentice` is its own collection because under section 18 an apprentice is
 * not a worker. Modelling one as an employee with a boolean fails on the first
 * query: every existing count in the tree would include them by default, which
 * is right for section 8 and wrong for provident fund, ESI, bonus and gratuity —
 * and the failure is silent, because a bonus calculation that quietly includes
 * apprentices produces a plausible number that is simply too large. Getting it
 * right that way would mean auditing every headcount in the product and
 * remembering the convention at each one.
 *
 * `EstablishmentStrength` records the composition the band is measured against.
 * Recorded rather than counted, because section 8's base is total strength
 * including contract and casual workers — a number no collection in the product
 * holds, since contract labour is tracked by deployment rather than by head.
 *
 * `ApprenticeshipAssessment` is the committed position, storing the rules it ran
 * under because the applicability threshold moved from forty to thirty, the
 * band's floor was set by the 2019 amendment, and the Rule 11 stipends were last
 * revised in the same year.
 */

const mongoose = require('mongoose');

const {
  APPRENTICESHIP_RULES,
  PRESCRIBED_STIPEND,
  REGISTRATION,
  FINDING,
  SEVERITY,
} = require('../utils/apprenticeshipCompliance');

// --- The rules --------------------------------------------------------------

const apprenticeshipRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    applicabilityHeadcount: {
      type: Number,
      default: APPRENTICESHIP_RULES.applicabilityHeadcount,
      min: 1,
    },
    bandFloorPercent: {
      type: Number,
      default: APPRENTICESHIP_RULES.bandFloorPercent,
      min: 0,
      max: 100,
    },
    bandCeilingPercent: {
      type: Number,
      default: APPRENTICESHIP_RULES.bandCeilingPercent,
      min: 0,
      max: 100,
    },
    fresherSubQuotaPercent: {
      type: Number,
      default: APPRENTICESHIP_RULES.fresherSubQuotaPercent,
      min: 0,
      max: 100,
    },
    registrationWindowDays: {
      type: Number,
      default: APPRENTICESHIP_RULES.registrationWindowDays,
      min: 1,
    },
    secondYearUpliftPercent: {
      type: Number,
      default: APPRENTICESHIP_RULES.secondYearUpliftPercent,
      min: 0,
    },
    thirdYearUpliftPercent: {
      type: Number,
      default: APPRENTICESHIP_RULES.thirdYearUpliftPercent,
      min: 0,
    },
    napsReimbursementPercent: {
      type: Number,
      default: APPRENTICESHIP_RULES.napsReimbursementPercent,
      min: 0,
      max: 100,
    },
    napsMonthlyCeiling: {
      type: Number,
      default: APPRENTICESHIP_RULES.napsMonthlyCeiling,
      min: 0,
    },
    napsMinimumAttendanceDays: {
      type: Number,
      default: APPRENTICESHIP_RULES.napsMinimumAttendanceDays,
      min: 0,
    },

    /**
     * The Rule 11 first-year stipends, by qualification.
     *
     * First-year only, because the second and third years are computed from
     * these figures rather than stored: an employer who paid above the minimum
     * should not owe an escalation on its own generosity, and storing all three
     * years would let the three drift out of the ratio the Rule fixes.
     */
    prescribedStipends: {
      type: Map,
      of: Number,
      default: () => new Map(Object.entries(PRESCRIBED_STIPEND)),
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

apprenticeshipRulesSchema.index(
  { tenantId: 1, establishment: 1 },
  { unique: true },
);

// --- The establishment's composition ----------------------------------------

const establishmentStrengthSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /** The month this composition was counted for. */
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    /**
     * Recorded rather than counted from the employee collection.
     *
     * Section 8's base is total strength including contract and casual workers,
     * and the product tracks contract labour by deployment rather than by head —
     * so the number has to be stated. Recording it also fixes it: a band
     * assessed in June should not change in September because somebody resigned.
     */
    directEmployees: { type: Number, default: 0, min: 0 },
    contractWorkers: { type: Number, default: 0, min: 0 },
    casualWorkers: { type: Number, default: 0, min: 0 },

    /** Who counted, for the inspection that asks. */
    countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

establishmentStrengthSchema.index(
  { tenantId: 1, establishment: 1, year: 1, month: 1 },
  { unique: true },
);

// --- The apprentices --------------------------------------------------------

const apprenticeMonthSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    calendarYear: { type: Number, required: true },

    /** Which year of the apprenticeship this month falls in. */
    apprenticeshipYear: { type: Number, default: 1, min: 1, max: 3 },

    workingDays: { type: Number, default: 26, min: 1 },
    daysAttended: { type: Number, default: 0, min: 0 },
    /** Not absences. The opposite convention from loss of pay. */
    holidays: { type: Number, default: 0, min: 0 },
    authorisedLeaveDays: { type: Number, default: 0, min: 0 },

    stipendPaid: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const apprenticeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    name: { type: String, required: true, trim: true },

    qualification: {
      type: String,
      enum: Object.keys(PRESCRIBED_STIPEND),
      required: true,
    },

    /** Rule 7A(2) — a fresher or skill-certificate holder, for the sub-quota. */
    isFresher: { type: Boolean, default: false },

    trade: { type: String, default: '', trim: true },

    engagedOn: { type: Date, required: true },
    /** Where the apprenticeship has ended. */
    completedOn: { type: Date },

    /**
     * When the contract was registered on the portal.
     *
     * Null past the window is the whole liability: an unregistered contract is
     * not an apprenticeship, so the person was an ordinary employee and the
     * provident fund, ESI, bonus and gratuity that section 18 excluded become
     * payable retrospectively.
     */
    registeredOn: { type: Date },
    portalContractNumber: { type: String, default: '', trim: true },

    /** Cached from the last assessment, for the roll's status column. */
    registrationStatus: {
      type: String,
      enum: Object.values(REGISTRATION),
      default: REGISTRATION.PENDING,
      index: true,
    },

    months: { type: [apprenticeMonthSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

apprenticeSchema.index({ tenantId: 1, establishment: 1, engagedOn: -1 });

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    apprenticeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apprentice' },
    apprenticeName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const assessmentApprenticeSchema = new mongoose.Schema(
  {
    apprenticeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apprentice' },
    name: { type: String, default: '' },
    qualification: { type: String, default: '' },
    isFresher: { type: Boolean, default: false },

    registrationStatus: {
      type: String,
      enum: Object.values(REGISTRATION),
    },
    registrationDueBy: { type: Date },
    registrationDaysLate: { type: Number, default: 0 },

    stipendPaid: { type: Number, default: 0 },
    stipendShortfall: { type: Number, default: 0 },
    reimbursement: { type: Number, default: 0 },

    /** Set only where the contract lapsed. */
    exposureTotal: { type: Number, default: 0 },
    exposureProvidentFund: { type: Number, default: 0 },
    exposureEsi: { type: Number, default: 0 },
    exposureBonus: { type: Number, default: 0 },
    exposureGratuity: { type: Number, default: 0 },
  },
  { _id: false },
);

const apprenticeshipAssessmentSchema = new mongoose.Schema(
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

    /** The band. */
    applicable: { type: Boolean, default: true },
    totalStrength: { type: Number, default: 0 },
    apprenticeCount: { type: Number, default: 0 },
    bandFloor: { type: Number, default: 0 },
    bandCeiling: { type: Number, default: 0 },
    shortfall: { type: Number, default: 0 },
    excess: { type: Number, default: 0 },

    /**
     * The same establishment counted under each statute.
     *
     * Stored together rather than as one number, because the point of the
     * module is that they differ — and a later reader with one figure would not
     * know which convention produced it.
     */
    strengthByStatute: { type: mongoose.Schema.Types.Mixed, default: {} },

    registeredCount: { type: Number, default: 0 },
    lapsedCount: { type: Number, default: 0 },

    stipendPaid: { type: Number, default: 0 },
    stipendShortfall: { type: Number, default: 0 },
    reimbursementReceivable: { type: Number, default: 0 },
    /** What the unregistered contracts expose the establishment to. */
    exposure: { type: Number, default: 0 },

    summary: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            section: { type: String, default: '' },
            severity: { type: String, enum: Object.values(SEVERITY) },
            count: { type: Number, default: 0 },
            apprenticeCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    findings: { type: [findingSchema], default: [] },
    apprentices: { type: [assessmentApprenticeSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

apprenticeshipAssessmentSchema.index(
  { tenantId: 1, establishment: 1, periodStart: 1 },
  { unique: true },
);

const ApprenticeshipRules = mongoose.model(
  'ApprenticeshipRules',
  apprenticeshipRulesSchema,
);
const EstablishmentStrength = mongoose.model(
  'EstablishmentStrength',
  establishmentStrengthSchema,
);
const Apprentice = mongoose.model('Apprentice', apprenticeSchema);
const ApprenticeshipAssessment = mongoose.model(
  'ApprenticeshipAssessment',
  apprenticeshipAssessmentSchema,
);

module.exports = {
  ApprenticeshipRules,
  EstablishmentStrength,
  Apprentice,
  ApprenticeshipAssessment,
};
