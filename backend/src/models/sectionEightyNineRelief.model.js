/**
 * Section 89(1) relief — rate tables, assessed years and Form 10E (#1969).
 *
 * Four collections, and the reason for each is that the existing tax path
 * cannot answer the question.
 *
 * `TaxRateTable` is the module's real asset. `taxCalculator.js` holds one
 * current slab set, which is correct for a payroll run and useless for Rule
 * 21A(2): the relief is the *difference* between two rate environments, so a
 * relation year has to be priced at its own year's rates on its own year's
 * income. The table is keyed on assessment year and regime together, and a year
 * with no row is an explicit gap rather than a silently substituted table.
 *
 * `AssessedYear` holds what the employee was actually assessed on for a past
 * year, including which regime. Not derivable from the payroll: the employee's
 * total income includes what the employer never saw, and the regime is the
 * employee's own election which may have changed year to year. Computing a
 * relation year on today's basis produces relief an assessing officer withdraws.
 *
 * `ArrearReliefClaim` is one arrear and its year-wise spread. The allocation is
 * stored rather than recomputed because it may be a recorded determination —
 * a backdated bonus referable to a single year is not proportional to time, and
 * the day-weighted split would be wrong for it.
 *
 * `FormTenEFurnishing` is the employee's act, recorded with its date. Section
 * 192(2A) makes the employer's authority to give the relief conditional on it,
 * so the furnishing is a row of its own rather than a boolean on the claim —
 * the date is what decides whether it preceded the return.
 */

const mongoose = require('mongoose');

const {
  RELIEF_RULES,
  REGIME,
  RELIEF_IS_CONDITIONAL,
} = require('../utils/sectionEightyNineRelief');

// --- Rate tables ------------------------------------------------------------

const slabSchema = new mongoose.Schema(
  {
    from: { type: Number, required: true, min: 0 },
    /** Null is the open top slab. */
    upto: { type: Number, default: null },
    rate: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const surchargeBandSchema = new mongoose.Schema(
  {
    above: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const taxRateTableSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /**
     * The two halves of the key. A table is only ever resolved on both.
     *
     * Resolving on the year alone would let a 2021-22 relation year be priced
     * against a regime the employee was never assessed under, which is the same
     * error as using today's rates by a different route.
     */
    assessmentYear: { type: Number, required: true, min: 1990 },
    regime: {
      type: String,
      enum: Object.values(REGIME),
      required: true,
    },

    slabs: { type: [slabSchema], required: true },

    /** Section 87A. Both move by year and by regime, so both live here. */
    rebateIncomeLimit: { type: Number, default: 0, min: 0 },
    rebateCap: { type: Number, default: 0, min: 0 },

    surcharge: { type: [surchargeBandSchema], default: [] },

    /**
     * Health and education cess.
     *
     * Defaulted from the rules but overridable, because the four per cent
     * replaced a three per cent and a 2017-18 relation year is still computed
     * at the older figure.
     */
    cessRate: {
      type: Number,
      default: RELIEF_RULES.defaultCessRate,
      min: 0,
      max: 1,
    },

    /** Where the figures came from. A Finance Act reference, usually. */
    source: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

taxRateTableSchema.index(
  { tenantId: 1, assessmentYear: 1, regime: 1 },
  { unique: true },
);

// --- Assessed years ---------------------------------------------------------

const assessedYearSchema = new mongoose.Schema(
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

    financialYear: { type: Number, required: true, min: 1990 },

    /**
     * Total income as assessed, not as the employer computed it.
     *
     * The relation-year term is a difference against what the year actually
     * bore. An employee with house property income the employer never saw has
     * a different marginal rate, and inferring the figure from Form 16 would
     * understate the relation-year tax and overstate the relief.
     */
    totalIncome: { type: Number, required: true, min: 0 },

    /**
     * The regime the employee was actually assessed under for that year.
     *
     * Required rather than defaulted. There is no safe default: an arrear
     * relating to 2021-22 may relate to an old-regime year while the year of
     * receipt is a default section 115BAC year, and assuming today's basis
     * produces relief in the employee's favour that is later withdrawn.
     */
    regime: {
      type: String,
      enum: Object.values(REGIME),
      required: true,
    },

    /** How the figure was established — an ITR-V, an intimation, a Form 16. */
    evidence: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

assessedYearSchema.index(
  { tenantId: 1, employeeId: 1, financialYear: 1 },
  { unique: true },
);

// --- Claims -----------------------------------------------------------------

const allocationRowSchema = new mongoose.Schema(
  {
    financialYear: { type: Number, required: true, min: 1990 },
    amount: { type: Number, required: true, min: 0 },
    /** DAYS where the module derived it, RECORDED where somebody supplied it. */
    basis: { type: String, default: 'DAYS', trim: true },
  },
  { _id: false },
);

const arrearReliefClaimSchema = new mongoose.Schema(
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

    amount: { type: Number, required: true, min: 0 },

    /** The date of receipt. The year of receipt is derived from it. */
    paidOn: { type: Date, required: true },

    /** The period the arrear relates to, from the revision's own dates. */
    relatesFrom: { type: Date, required: true },
    relatesTo: { type: Date, required: true },

    /**
     * The year-wise spread.
     *
     * Stored rather than recomputed on read. A day-weighted split is right for
     * a backdated revision and wrong for a one-off bonus referable to a single
     * year, and which of those this is cannot be recovered from the dates.
     */
    allocation: { type: [allocationRowSchema], default: [] },

    /** The regime for the year of receipt. */
    regime: { type: String, enum: Object.values(REGIME), required: true },

    /**
     * The year of receipt's total income before the arrear.
     *
     * The first two terms of Rule 21A(2) are both computed on this, so a wrong
     * figure here moves the relief twice.
     */
    totalIncomeExcludingArrears: { type: Number, default: 0, min: 0 },

    /**
     * Whether the relief has been given in the TDS computation.
     *
     * Separate from whether it may be. A relief that may be given and has not
     * been is the employee bearing the cash-flow cost until a refund, and that
     * is a finding rather than a settled state.
     */
    applied: { type: Boolean, default: false },
    appliedOn: { type: Date },

    /** Where the employee filed the return, if known. Fixes the 10E deadline. */
    returnFiledOn: { type: Date },

    /** A loose reference. The module reads the arrear and writes nothing back. */
    arrearRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

arrearReliefClaimSchema.index({ tenantId: 1, employeeId: 1, paidOn: -1 });

// --- Form 10E ---------------------------------------------------------------

const formTenEFurnishingSchema = new mongoose.Schema(
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
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ArrearReliefClaim',
      required: true,
    },

    /**
     * The date the particulars were furnished.
     *
     * The whole point of the row. Furnished after the return was filed, the
     * relief is disallowed and furnishing it late does not revive it — so the
     * date is what is stored and a boolean would lose the answer.
     */
    furnishedOn: { type: Date, required: true },

    assessmentYear: { type: Number, required: true, min: 1990 },

    /** An acknowledgement number from the portal, where the employee has one. */
    acknowledgement: { type: String, default: '', trim: true },

    /**
     * Section 192(2A), stored on the row.
     *
     * A default field rather than a comment, so that anybody reading the
     * furnishing sees what it is a condition of.
     */
    conditionalNote: { type: String, default: RELIEF_IS_CONDITIONAL },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

formTenEFurnishingSchema.index({ tenantId: 1, claimId: 1 }, { unique: true });

/**
 * The rule reference and the year the Form 10E condition started, exposed so a
 * report or a validator can assert against them without importing the engine.
 */
arrearReliefClaimSchema.statics.RULE = RELIEF_RULES.rule;
formTenEFurnishingSchema.statics.MANDATORY_FROM_ASSESSMENT_YEAR =
  RELIEF_RULES.formTenEMandatoryFromAssessmentYear;

const TaxRateTable = mongoose.model('TaxRateTable', taxRateTableSchema);
const AssessedYear = mongoose.model('AssessedYear', assessedYearSchema);
const ArrearReliefClaim = mongoose.model(
  'ArrearReliefClaim',
  arrearReliefClaimSchema,
);
const FormTenEFurnishing = mongoose.model(
  'FormTenEFurnishing',
  formTenEFurnishingSchema,
);

module.exports = {
  TaxRateTable,
  AssessedYear,
  ArrearReliefClaim,
  FormTenEFurnishing,
};
