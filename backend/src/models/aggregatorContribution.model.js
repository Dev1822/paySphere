/**
 * Code on Social Security, 2020, section 114 (#1829).
 *
 * Three collections, and the reason there are three is that the levy and the
 * benefit are counted on **different axes**.
 *
 * `AggregatorTurnover` is keyed on the aggregator and the year, because the
 * contribution's base is the platform's own turnover — a figure no other
 * collection in this product holds and no payroll record could produce. The
 * split across Seventh Schedule categories is stored as rows rather than a
 * total, because the notified rate may differ by category and a single platform
 * is frequently more than one of them.
 *
 * `GigWorker` is keyed on the **person**, with engagements across aggregators
 * inside it. This is the axis the levy is not on. The same worker may be
 * engaged by three platforms; each owes its own contribution on its own
 * turnover, and the worker is one beneficiary. A collection keyed on the
 * engagement would either count the person three times for benefit purposes or
 * assign them arbitrarily to one platform, and both are wrong.
 *
 * `AggregatorAssessment` is the committed position. It stores **both limbs**
 * rather than the payable figure alone, because which one bound is the only
 * interesting thing about the number and a later reader with one figure could
 * not tell a platform whose contribution tracks turnover from one that is
 * already capped.
 */

const mongoose = require('mongoose');

const {
  AGGREGATOR_RULES,
  AGGREGATOR_CATEGORY,
  LIMB,
  FINDING,
  SEVERITY,
} = require('../utils/aggregatorContribution');

// --- The rules --------------------------------------------------------------

const aggregatorRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /**
     * The band, and a point inside it.
     *
     * A different shape from the other rule sets in this tree. Section 114
     * fixes one to two per cent and the operative figure arrives by
     * notification inside that, so the band and the applied rate are held
     * separately — and an out-of-band figure is clamped rather than trusted.
     */
    minRatePercent: {
      type: Number,
      default: AGGREGATOR_RULES.minRatePercent,
      min: 0,
    },
    maxRatePercent: {
      type: Number,
      default: AGGREGATOR_RULES.maxRatePercent,
      min: 0,
    },
    defaultRatePercent: {
      type: Number,
      default: AGGREGATOR_RULES.defaultRatePercent,
      min: 0,
    },

    /** Where a notification differentiates the rate by Seventh Schedule entry. */
    categoryRates: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },

    /** The proviso's ceiling, on an entirely different base. */
    payoutCeilingPercent: {
      type: Number,
      default: AGGREGATOR_RULES.payoutCeilingPercent,
      min: 0,
    },

    registrationQualifyingDays: {
      type: Number,
      default: AGGREGATOR_RULES.registrationQualifyingDays,
      min: 1,
    },
    lookbackMonths: {
      type: Number,
      default: AGGREGATOR_RULES.lookbackMonths,
      min: 1,
    },
    attributionTolerancePercent: {
      type: Number,
      default: AGGREGATOR_RULES.attributionTolerancePercent,
      min: 0,
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

aggregatorRulesSchema.index({ tenantId: 1 }, { unique: true });

// --- The turnover -----------------------------------------------------------

const categoryTurnoverSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: Object.values(AGGREGATOR_CATEGORY),
      required: true,
    },
    turnover: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const aggregatorTurnoverSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The platform. A tenant may operate more than one. */
    name: { type: String, required: true, trim: true },
    financialYear: { type: Number, required: true, index: true },

    /**
     * The gross, with the category split beside it.
     *
     * Both, so an unattributed remainder is visible. It is turnover the module
     * knows no rate for, and absorbing it into whichever category comes first
     * would produce a plausible contribution computed at the wrong rate.
     */
    totalTurnover: { type: Number, default: 0, min: 0 },
    byCategory: { type: [categoryTurnoverSchema], default: [] },

    /**
     * What was paid or is payable to gig and platform workers.
     *
     * The base of the ceiling, and unrelated to the base of the levy. Held on
     * the same record because the two are compared, and separately because they
     * come from different places — this one from the payout ledger, the
     * turnover from the platform's own accounts.
     */
    workerPayouts: { type: Number, default: 0, min: 0 },

    /** Deposited across the year against a provisional figure. */
    deposited: { type: Number, default: 0, min: 0 },
    /** Until this, everything computed from the record is provisional. */
    turnoverFinalised: { type: Boolean, default: false },
    finalisedOn: { type: Date },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

aggregatorTurnoverSchema.index(
  { tenantId: 1, name: 1, financialYear: 1 },
  { unique: true },
);

// --- The workers ------------------------------------------------------------

const engagementSchema = new mongoose.Schema(
  {
    /**
     * Which platform, by name rather than by reference.
     *
     * Two of the three aggregators a worker is engaged by are usually not this
     * tenant's, so there is nothing to reference. The days are taken on the
     * worker's own statement, which is how the Code's registration works.
     */
    aggregator: { type: String, default: '', trim: true },
    /** Whether this platform is one of the tenant's own. */
    ownPlatform: { type: Boolean, default: false },
    days: { type: Number, default: 0, min: 0 },
    fromDate: { type: Date },
    toDate: { type: Date },
    /** What this platform paid them, for the ceiling's base. */
    payouts: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const gigWorkerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    /**
     * Deliberately not an employeeId.
     *
     * A gig worker is not an employee under section 2(35), and referencing the
     * employee collection is the first place that would be lost — every
     * headcount in the tree would start including them.
     */
    contactReference: { type: String, default: '', trim: true },

    engagements: { type: [engagementSchema], default: [] },

    registeredOn: { type: Date },
    registrationNumber: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

gigWorkerSchema.index({ tenantId: 1, name: 1 });

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'GigWorker' },
    workerName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const aggregatorAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, default: '', trim: true },
    financialYear: { type: Number, required: true },

    /** A snapshot, not a reference. */
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },

    totalTurnover: { type: Number, default: 0 },
    attributedTurnover: { type: Number, default: 0 },
    unattributedTurnover: { type: Number, default: 0 },

    /**
     * Both limbs, stored side by side.
     *
     * The payable figure alone would not say whether the contribution tracks
     * turnover or has already been capped — which is the only interesting thing
     * about the number, and the thing a later reader most needs.
     */
    turnoverLimb: { type: Number, default: 0 },
    workerPayouts: { type: Number, default: 0 },
    payoutCeiling: { type: Number, default: 0 },
    capped: { type: Boolean, default: false },
    bindingLimb: { type: String, enum: Object.values(LIMB) },
    headroom: { type: Number, default: 0 },
    payable: { type: Number, default: 0 },

    deposited: { type: Number, default: 0 },
    shortfall: { type: Number, default: 0 },
    excess: { type: Number, default: 0 },
    turnoverFinalised: { type: Boolean, default: false },
    /** Everything above is provisional while this is true. */
    provisional: { type: Boolean, default: true },

    workerCount: { type: Number, default: 0 },
    qualifyingCount: { type: Number, default: 0 },
    registeredCount: { type: Number, default: 0 },
    /** One beneficiary against several contributions. */
    multiAggregatorCount: { type: Number, default: 0 },

    summary: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            section: { type: String, default: '' },
            severity: { type: String, enum: Object.values(SEVERITY) },
            count: { type: Number, default: 0 },
            workerCount: { type: Number, default: 0 },
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

aggregatorAssessmentSchema.index(
  { tenantId: 1, name: 1, financialYear: 1 },
  { unique: true },
);

const AggregatorRules = mongoose.model(
  'AggregatorRules',
  aggregatorRulesSchema,
);
const AggregatorTurnover = mongoose.model(
  'AggregatorTurnover',
  aggregatorTurnoverSchema,
);
const GigWorker = mongoose.model('GigWorker', gigWorkerSchema);
const AggregatorAssessment = mongoose.model(
  'AggregatorAssessment',
  aggregatorAssessmentSchema,
);

module.exports = {
  AggregatorRules,
  AggregatorTurnover,
  GigWorker,
  AggregatorAssessment,
};
