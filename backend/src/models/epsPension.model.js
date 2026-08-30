/**
 * Employees' Pension Scheme, 1995 (#1769).
 *
 * Three collections, and the middle one exists because the product does not
 * currently store the thing the formula needs.
 *
 * `EpsAssumptions` holds the scheme's parameters. A document because every one
 * of them has moved — the wage ceiling on 1 September 2014, the ₹1,000 minimum
 * in the same year, the higher-wage option reopened by the Supreme Court in
 * November 2022 — and because a valuation has to remain reproducible at the
 * figures that were in force when it was made.
 *
 * `EpsWageMonth` is the sixty-month history. `salaryStructure.js` records what
 * an employee is paid *now* and revises in place; `payroll.model.js` records
 * what was paid in a month and is edited. Neither is a wage history, and
 * paragraph 11(1) needs one — sixty contributory months, each with a flag
 * saying whether it was contributory at all, because a month of unpaid leave is
 * not a month of zero pay for this purpose, it is not a month.
 *
 * `EpsValuation` is the committed statement. It stores the assumptions it ran
 * under and both orderings of the capping and averaging, so that the figure a
 * member is quoted can be defended against the one they will get from an online
 * calculator that averages first.
 */

const mongoose = require('mongoose');

const {
  EPS_ASSUMPTIONS,
  OUTCOME,
  FINDING,
  SEVERITY,
} = require('../utils/epsPension');

// --- The scheme's parameters ------------------------------------------------

const epsAssumptionsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The establishment these apply to. Empty is the tenant-wide default. */
    establishment: { type: String, default: '', trim: true },

    wageCeiling: { type: Number, default: EPS_ASSUMPTIONS.wageCeiling, min: 0 },
    contributionPercent: {
      type: Number,
      default: EPS_ASSUMPTIONS.contributionPercent,
      min: 0,
      max: 100,
    },
    averagingMonths: {
      type: Number,
      default: EPS_ASSUMPTIONS.averagingMonths,
      min: 1,
    },
    formulaDivisor: {
      type: Number,
      default: EPS_ASSUMPTIONS.formulaDivisor,
      min: 1,
    },
    minimumEligibleServiceYears: {
      type: Number,
      default: EPS_ASSUMPTIONS.minimumEligibleServiceYears,
      min: 0,
    },
    serviceBonusThresholdYears: {
      type: Number,
      default: EPS_ASSUMPTIONS.serviceBonusThresholdYears,
      min: 0,
    },
    serviceBonusYears: {
      type: Number,
      default: EPS_ASSUMPTIONS.serviceBonusYears,
      min: 0,
    },
    minimumMonthlyPension: {
      type: Number,
      default: EPS_ASSUMPTIONS.minimumMonthlyPension,
      min: 0,
    },
    superannuationAge: {
      type: Number,
      default: EPS_ASSUMPTIONS.superannuationAge,
      min: 40,
      max: 75,
    },
    earlyPensionMinAge: {
      type: Number,
      default: EPS_ASSUMPTIONS.earlyPensionMinAge,
      min: 40,
      max: 75,
    },
    earlyPensionReductionPercent: {
      type: Number,
      default: EPS_ASSUMPTIONS.earlyPensionReductionPercent,
      min: 0,
      max: 100,
    },
    deferredPensionIncreasePercent: {
      type: Number,
      default: EPS_ASSUMPTIONS.deferredPensionIncreasePercent,
      min: 0,
      max: 100,
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

epsAssumptionsSchema.index({ tenantId: 1, establishment: 1 }, { unique: true });

// --- The wage history -------------------------------------------------------

const epsWageMonthSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    /**
     * The pay for the month, uncapped.
     *
     * Stored uncapped deliberately. Capping on write would make the stored
     * history unable to answer "what would this have been under the higher-wage
     * option", and a member who exercised that option in the 2023 window needs
     * exactly that answer for the same sixty months.
     */
    wage: { type: Number, required: true, min: 0 },

    /**
     * Whether a contribution was made for this month.
     *
     * The proviso to paragraph 11(1) excludes non-contributory periods from the
     * averaging span, so this flag is what makes the window reach back further
     * rather than average in a zero. A month of unpaid leave sets it false; a
     * month at zero pay that was still contributory would be a different thing
     * and should not be conflated with it.
     */
    contributory: { type: Boolean, default: true },

    /** Why it was not, where it was not. Free text, for the member's query. */
    nonContributoryReason: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

epsWageMonthSchema.index(
  { tenantId: 1, employeeId: 1, year: 1, month: 1 },
  { unique: true },
);

// The averaging walks backwards from the newest, so this is the read shape.
epsWageMonthSchema.index({ tenantId: 1, employeeId: 1, year: -1, month: -1 });

// --- The valuation ----------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    paragraph: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    memberName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    memberName: { type: String, default: '' },

    outcome: { type: String, enum: Object.values(OUTCOME), required: true },

    pensionableSalary: { type: Number, default: 0 },
    /**
     * What averaging first and capping second would have produced.
     *
     * Stored, not derived, because it is the number a member will arrive with
     * from an online calculator and the difference has to be explainable years
     * after the valuation was made.
     */
    averageThenCap: { type: Number, default: 0 },

    monthsUsed: { type: Number, default: 0 },
    /** How many calendar months the window spanned to find them. */
    windowMonths: { type: Number, default: 0 },

    eligibleYears: { type: Number, default: 0 },
    pensionableYears: { type: Number, default: 0 },
    serviceBonusApplied: { type: Boolean, default: false },

    formulaPension: { type: Number, default: 0 },
    pastServiceBenefit: { type: Number, default: 0 },
    ageAdjustmentPercent: { type: Number, default: 0 },

    monthlyPension: { type: Number, default: 0 },
    annualPension: { type: Number, default: 0 },

    /** Paragraph 14, for a member below ten years. */
    withdrawalBenefit: { type: Number, default: 0 },
    withdrawalFactor: { type: Number, default: 0 },

    /** The projection, where one was run. */
    projected: { type: Boolean, default: false },
    yearsRemaining: { type: Number, default: 0 },
  },
  { _id: false },
);

const epsValuationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /** The date the valuation speaks as at. */
    valuationDate: { type: Date, required: true },

    /** A snapshot, not a reference — see the header of this file. */
    assumptions: { type: mongoose.Schema.Types.Mixed, default: {} },

    memberCount: { type: Number, default: 0 },
    pensionerCount: { type: Number, default: 0 },
    withdrawalCount: { type: Number, default: 0 },

    monthlyPensionTotal: { type: Number, default: 0 },
    annualPensionTotal: { type: Number, default: 0 },

    /**
     * How many members' salary would have been over-stated by the other
     * ordering. The one figure that says whether the distinction mattered here.
     */
    affectedByCapOrder: { type: Number, default: 0 },

    summary: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            paragraph: { type: String, default: '' },
            severity: { type: String, enum: Object.values(SEVERITY) },
            count: { type: Number, default: 0 },
            memberCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    findings: { type: [findingSchema], default: [] },
    members: { type: [memberSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

epsValuationSchema.index(
  { tenantId: 1, establishment: 1, valuationDate: 1 },
  { unique: true },
);

const EpsAssumptions = mongoose.model('EpsAssumptions', epsAssumptionsSchema);
const EpsWageMonth = mongoose.model('EpsWageMonth', epsWageMonthSchema);
const EpsValuation = mongoose.model('EpsValuation', epsValuationSchema);

module.exports = { EpsAssumptions, EpsWageMonth, EpsValuation };
