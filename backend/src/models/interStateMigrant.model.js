/**
 * Inter-State Migrant Workmen Act, 1979 (#1826).
 *
 * Three collections, and the first one is the answer to "why not put a flag on
 * the contract-labour deployment".
 *
 * `MigrantWorkman` is its own collection because section 13(1)(b) needs a
 * comparison the deployment record cannot make. Parity is against *a local
 * workman doing the same or similar work*, so the module needs the local rate
 * for the trade — a number that lives in the payroll roll — alongside two
 * notified schedules that live in `minimumWages.js`. A boolean on a deployment
 * would let an establishment tick a box and produce no comparison at all, which
 * is the failure this collection exists to prevent.
 *
 * `MigrantFacilityRegister` is separate from the workman because section 16 is
 * an obligation of the *establishment* — accommodation is provided to a camp,
 * not to a person — and because the cost of an un-provided facility is
 * recoverable from the contractor as an arrear of land revenue, which makes it
 * a site-level liability rather than a per-workman one.
 *
 * `MigrantAssessment` is the committed position, storing the rules it ran under
 * because the section 4 and 8 thresholds are amended by state rules and because
 * the notified schedules behind the floor move every year.
 */

const mongoose = require('mongoose');

const {
  MIGRANT_RULES,
  WAGE_BASIS,
  FACILITY,
  JOURNEY_LEG,
  FINDING,
  SEVERITY,
} = require('../utils/interStateMigrant');

// --- The rules --------------------------------------------------------------

const migrantRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    registrationThreshold: {
      type: Number,
      default: MIGRANT_RULES.registrationThreshold,
      min: 1,
    },
    licensingThreshold: {
      type: Number,
      default: MIGRANT_RULES.licensingThreshold,
      min: 1,
    },
    displacementPercent: {
      type: Number,
      default: MIGRANT_RULES.displacementPercent,
      min: 0,
      max: 100,
    },
    /**
     * Section 14's rupee floor.
     *
     * Unrevised since 1979, so for any realistic wage the percentage limb binds
     * and this is dead. Held anyway: it is live for a part-month engagement and
     * for an assessment run against a historical period, and a constant that is
     * presently never reached is still not a constant.
     */
    displacementFloor: {
      type: Number,
      default: MIGRANT_RULES.displacementFloor,
      min: 0,
    },
    journeyWagesPayable: {
      type: Boolean,
      default: MIGRANT_RULES.journeyWagesPayable,
    },
    passbookRefreshDays: {
      type: Number,
      default: MIGRANT_RULES.passbookRefreshDays,
      min: 1,
    },
    daysPerMonth: {
      type: Number,
      default: MIGRANT_RULES.daysPerMonth,
      min: 1,
      max: 31,
    },
    requiredFacilities: {
      type: [{ type: String, enum: Object.values(FACILITY) }],
      default: () => Object.values(FACILITY),
    },

    /**
     * Whether the principal employer holds a section 4 certificate.
     *
     * On the rules rather than on a workman because it is a fact about the
     * establishment, and it sits behind the same permission as the thresholds
     * for the same reason: both are levers on whether the site is in breach.
     */
    registeredUnderSection4: { type: Boolean, default: false },
    section4RegistrationNumber: { type: String, default: '', trim: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

migrantRulesSchema.index({ tenantId: 1, establishment: 1 }, { unique: true });

// --- The workmen ------------------------------------------------------------

const journeyLegSchema = new mongoose.Schema(
  {
    leg: { type: String, enum: Object.values(JOURNEY_LEG), required: true },
    fare: { type: Number, default: 0, min: 0 },
    journeyDays: { type: Number, default: 0, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    paidOn: { type: Date },
  },
  { _id: false },
);

const migrantWorkmanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    name: { type: String, required: true, trim: true },
    trade: { type: String, default: '', trim: true, index: true },

    /** The two states are what make this workman a migrant at all. */
    homeState: { type: String, required: true, trim: true },
    hostState: { type: String, required: true, trim: true },

    /** Where the workman came through a contractor, which is the usual case. */
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor' },

    recruitedOn: { type: Date, required: true },
    /** Set on termination. The return fare is owed regardless of when. */
    releasedOn: { type: Date },

    /**
     * The three candidate rates, stored together.
     *
     * The home and host rates are copied from the notified schedules rather
     * than referenced, because an assessment made in June should not change in
     * September when a new notification lands. The comparable rate is recorded
     * by a person: it is what a local workman doing similar work is actually
     * paid, which is a fact about this site rather than about a schedule.
     */
    homeStateRate: { type: Number, default: 0, min: 0 },
    hostStateRate: { type: Number, default: 0, min: 0 },
    /**
     * Null rather than zero where nobody has looked.
     *
     * `bindingWageRate` distinguishes the two, and it matters: an absent
     * comparator means only the section 13(1)(a) floor has been tested, and a
     * recorded zero means somebody asserted there is no comparable work.
     */
    localComparableRate: { type: Number, default: null, min: 0 },
    localComparableTrade: { type: String, default: '', trim: true },

    paidDailyRate: { type: Number, default: 0, min: 0 },
    daysWorked: { type: Number, default: 0, min: 0 },
    /** Where the establishment states the monthly figure rather than deriving it. */
    monthlyWages: { type: Number, default: null, min: 0 },

    // --- Section 14 ---------------------------------------------------------
    displacementPaid: { type: Number, default: 0, min: 0 },
    displacementPaidOn: { type: Date },
    /**
     * Recorded so that a recovery is *visible*.
     *
     * Section 14 makes the allowance non-refundable. Nothing should ever write
     * a non-zero value here, and the field exists precisely so that the case
     * where something did is a finding rather than an invisible net-off.
     */
    displacementRecovered: { type: Number, default: 0, min: 0 },

    // --- Section 15 ---------------------------------------------------------
    journeyLegs: { type: [journeyLegSchema], default: [] },
    journeyWagesPaid: { type: Number, default: 0, min: 0 },
    /**
     * Whether the return fare has been provided for.
     *
     * Its own flag rather than an inference from `releasedOn`, because the
     * liability arises at recruitment and the whole point is to have it on the
     * books before anybody is thinking about the workman leaving.
     */
    returnAccrued: { type: Boolean, default: false },

    // --- Section 12 with Rule 8 ---------------------------------------------
    passbookIssuedOn: { type: Date },
    passbookUpdatedOn: { type: Date },
    /** The event that starts the refresh window. */
    rateChangedOn: { type: Date },
    passbookLanguage: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

migrantWorkmanSchema.index({ tenantId: 1, establishment: 1, recruitedOn: -1 });
migrantWorkmanSchema.index({ tenantId: 1, contractorId: 1 });

// --- The facilities ---------------------------------------------------------

const migrantFacilityRegisterSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    facility: {
      type: String,
      enum: Object.values(FACILITY),
      required: true,
    },
    provided: { type: Boolean, default: false },

    /**
     * What it would cost the government to provide it instead.
     *
     * Section 16 lets the appropriate government provide a missing facility and
     * recover the cost from the contractor as an arrear of land revenue, so an
     * absent facility has a price rather than only a status.
     */
    substituteCost: { type: Number, default: 0, min: 0 },

    notes: { type: String, default: '', trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

migrantFacilityRegisterSchema.index(
  { tenantId: 1, establishment: 1, facility: 1 },
  { unique: true },
);

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    workmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'MigrantWorkman' },
    workmanName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const assessmentWorkmanSchema = new mongoose.Schema(
  {
    workmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'MigrantWorkman' },
    name: { type: String, default: '' },
    trade: { type: String, default: '' },
    homeState: { type: String, default: '' },
    hostState: { type: String, default: '' },

    /**
     * Which candidate bound, stored alongside the rate.
     *
     * The module's whole subject. A rate on its own would not say whether the
     * workman is measured against a notified schedule or against the colleague
     * beside them, and those are different breaches with different remedies.
     */
    bindingRate: { type: Number, default: 0 },
    bindingBasis: { type: String, enum: Object.values(WAGE_BASIS) },
    statutoryFloor: { type: Number, default: 0 },
    paidDailyRate: { type: Number, default: 0 },
    floorGap: { type: Number, default: 0 },
    parityGap: { type: Number, default: 0 },
    wageArrears: { type: Number, default: 0 },

    displacementDue: { type: Number, default: 0 },
    displacementShortfall: { type: Number, default: 0 },
    journeyDue: { type: Number, default: 0 },
    journeyOutstanding: { type: Number, default: 0 },
    returnAccrued: { type: Boolean, default: false },

    passbookIssued: { type: Boolean, default: false },
    passbookStale: { type: Boolean, default: false },

    outstanding: { type: Number, default: 0 },
  },
  { _id: false },
);

const migrantAssessmentSchema = new mongoose.Schema(
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
    migrantPeak: { type: Number, default: 0 },
    registered: { type: Boolean, default: false },
    workmanCount: { type: Number, default: 0 },

    wageArrears: { type: Number, default: 0 },
    /**
     * The count this module exists for.
     *
     * Workmen above every notified floor and below a comparable local workman.
     * Nothing else in the product can see them, and a total arrears figure
     * would not distinguish them from an ordinary minimum-wage shortfall.
     */
    parityOnlyCount: { type: Number, default: 0 },

    displacementDue: { type: Number, default: 0 },
    displacementShortfall: { type: Number, default: 0 },
    journeyDue: { type: Number, default: 0 },
    journeyOutstanding: { type: Number, default: 0 },
    facilityExposure: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },

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
    workmen: { type: [assessmentWorkmanSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

migrantAssessmentSchema.index(
  { tenantId: 1, establishment: 1, periodStart: 1 },
  { unique: true },
);

const MigrantRules = mongoose.model('MigrantRules', migrantRulesSchema);
const MigrantWorkman = mongoose.model('MigrantWorkman', migrantWorkmanSchema);
const MigrantFacilityRegister = mongoose.model(
  'MigrantFacilityRegister',
  migrantFacilityRegisterSchema,
);
const MigrantAssessment = mongoose.model(
  'MigrantAssessment',
  migrantAssessmentSchema,
);

module.exports = {
  MigrantRules,
  MigrantWorkman,
  MigrantFacilityRegister,
  MigrantAssessment,
};
