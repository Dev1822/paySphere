/**
 * Employees' State Insurance Act, 1948 (#1768).
 *
 * Three collections, and the middle one is the one that makes the Rule 50
 * proviso representable at all.
 *
 * `EsiRules` holds the notified figures. A document because every one of them
 * has moved — the ceiling in 2017, the rates in July 2019, the section 42(1)
 * floor in the same year — and because a return filed for an old period has to
 * be reproducible at the figures that were in force then.
 *
 * `EsiCoverageState` is the memory. An `esiApplicable` boolean on the employee
 * is the shape that produces the bug this module exists to fix: it has no
 * record of *when* it changed, so nothing can distinguish "crossed the ceiling
 * in July and must be carried to September" from "was never covered". What is
 * stored instead is the contribution period, the status inside it, and the date
 * the crossing happened — which is also the fact an inspection asks for.
 *
 * `EsiReturn` is the monthly return, and the period register the 78-day count
 * accumulates in. Stored rather than recomputed because both inputs move:
 * payroll rows are edited and the rules are revised, and a return that could not
 * reproduce what was filed would not be a record of having filed it.
 */

const mongoose = require('mongoose');

const {
  ESI_RULES,
  COVERAGE,
  FINDING,
  SEVERITY,
} = require('../utils/esiContribution');

// --- The notified figures ---------------------------------------------------

const esiRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The sub-code these rules apply to. Empty is the tenant-wide default. */
    subCode: { type: String, default: '', trim: true },

    wageCeiling: { type: Number, default: ESI_RULES.wageCeiling, min: 0 },
    disabledWageCeiling: {
      type: Number,
      default: ESI_RULES.disabledWageCeiling,
      min: 0,
    },
    employeeRatePercent: {
      type: Number,
      default: ESI_RULES.employeeRatePercent,
      min: 0,
      max: 100,
    },
    employerRatePercent: {
      type: Number,
      default: ESI_RULES.employerRatePercent,
      min: 0,
      max: 100,
    },
    dailyWageFloor: { type: Number, default: ESI_RULES.dailyWageFloor, min: 0 },
    dueDayOfMonth: {
      type: Number,
      default: ESI_RULES.dueDayOfMonth,
      min: 1,
      max: 28,
    },
    interestRatePercent: {
      type: Number,
      default: ESI_RULES.interestRatePercent,
      min: 0,
    },
    benefitQualifyingDays: {
      type: Number,
      default: ESI_RULES.benefitQualifyingDays,
      min: 0,
    },

    /**
     * Section 2(12) — how many people the establishment employs.
     *
     * Stored rather than counted, for the same reason #1767 stores it: the Act
     * asks how many are *employed in* the establishment, which includes contract
     * labour the payroll does not carry.
     */
    employedHeadcount: { type: Number, default: 0, min: 0 },

    /** The establishment's ESI code, for the return. */
    employerCode: { type: String, default: '', trim: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

esiRulesSchema.index({ tenantId: 1, subCode: 1 }, { unique: true });

// --- The coverage memory ----------------------------------------------------

const esiCoverageStateSchema = new mongoose.Schema(
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

    /** `2026-H1` or `2026-H2`. */
    periodKey: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    status: {
      type: String,
      enum: Object.values(COVERAGE),
      default: COVERAGE.COVERED,
    },

    /**
     * The date the wages crossed the ceiling inside this period.
     *
     * Null unless the status is CONTINUED. This single field is the difference
     * between a correct implementation and the common one — without it there is
     * no way to know that coverage must run to `periodEnd` regardless of what
     * the wages do next.
     */
    continuedFrom: { type: Date, default: null },

    /** Rule 50, proviso — whether the higher ceiling applies. */
    disabled: { type: Boolean, default: false },

    /** The engagement date, for the three-year employer exemption. */
    engagedOn: { type: Date },

    /** Regulation 52A — days accumulated in this period. */
    qualifyingDays: { type: Number, default: 0, min: 0 },

    insuranceNumber: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

// One state row per employee per contribution period. Recomputing a period
// corrects it rather than producing a second one.
esiCoverageStateSchema.index(
  { tenantId: 1, employeeId: 1, periodKey: 1 },
  { unique: true },
);

// The page lists everybody being carried by the proviso, which is this query.
esiCoverageStateSchema.index({ tenantId: 1, periodKey: 1, status: 1 });

// --- The return -------------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },
    month: { type: Number },
    year: { type: Number },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const returnLineSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },
    insuranceNumber: { type: String, default: '' },

    status: { type: String, enum: Object.values(COVERAGE) },

    /** What the coverage test was applied to — overtime excluded. */
    coverageWage: { type: Number, default: 0 },
    /** What the contribution was computed on — overtime included, uncapped. */
    contributionWage: { type: Number, default: 0 },
    ceiling: { type: Number, default: 0 },

    daysWorked: { type: Number, default: 0 },
    employeeContribution: { type: Number, default: 0 },
    employerContribution: { type: Number, default: 0 },

    /** Set where the employee is being carried by the Rule 50 proviso. */
    continuedFrom: { type: Date, default: null },
  },
  { _id: false },
);

const esiReturnSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    subCode: { type: String, default: '', trim: true },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    /** The contribution period this month belongs to, and its benefit period. */
    periodKey: { type: String, required: true },
    periodLabel: { type: String, default: '' },
    benefitPeriodKey: { type: String, default: '' },
    benefitPeriodLabel: { type: String, default: '' },

    /** A snapshot, not a reference — see the header of this file. */
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },

    employeeCount: { type: Number, default: 0 },
    coveredCount: { type: Number, default: 0 },
    /** How many are above the ceiling and being carried by the proviso. */
    continuedCount: { type: Number, default: 0 },

    employeeTotal: { type: Number, default: 0 },
    employerTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    dueOn: { type: Date },
    remittedOn: { type: Date },

    /**
     * Section 39(5)(a) and Regulation 31C. Two fields, because they are two
     * charges — a single "penalty" would understate it by whichever it dropped.
     */
    interest: { type: Number, default: 0 },
    damages: { type: Number, default: 0 },
    damagesBand: { type: String, default: '' },
    daysLate: { type: Number, default: 0 },

    summary: {
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
    lines: { type: [returnLineSchema], default: [] },

    filedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

esiReturnSchema.index(
  { tenantId: 1, subCode: 1, year: 1, month: 1 },
  { unique: true },
);

esiReturnSchema.index({ tenantId: 1, periodKey: 1 });

const EsiRules = mongoose.model('EsiRules', esiRulesSchema);
const EsiCoverageState = mongoose.model(
  'EsiCoverageState',
  esiCoverageStateSchema,
);
const EsiReturn = mongoose.model('EsiReturn', esiReturnSchema);

module.exports = { EsiRules, EsiCoverageState, EsiReturn };
