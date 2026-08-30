/**
 * Perquisite valuation under Rule 3 (#1770).
 *
 * Three collections.
 *
 * `PerquisiteRules` holds the notified figures. A document because the
 * accommodation bands and rates were rewritten by Notification 65/2023 with
 * effect from 1 September 2023 — the old bands were 25 lakh, 10 lakh and below,
 * at 15%, 10% and 7.5% — so a valuation for an earlier year needs the earlier
 * figures, and because it carries the one number that has to be recorded exactly
 * once a year and then frozen: the State Bank of India rate as on 1 April.
 *
 * `PerquisiteGrant` is what the employee actually has — the flat, the car, the
 * loan, the exercised options. Its own collection rather than fields on the
 * employee because a perquisite has a *period*: an employee given a flat in
 * October is charged on six months of salary, and a field cannot hold "from
 * when". Several of the same kind can also run at once, which fields cannot.
 *
 * `PerquisiteStatement` is the committed Form 12BA position. It stores the rules
 * it ran under and the basis of every line, because the form asks for the value
 * **and** the basis, and a value with no working is not what it wants.
 */

const mongoose = require('mongoose');

const {
  PERQUISITE_RULES,
  PERQUISITE_KIND,
  ACCOMMODATION_TYPE,
  FINDING,
  SEVERITY,
} = require('../utils/perquisiteValuation');

// --- The notified figures ---------------------------------------------------

const perquisiteRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The previous year these figures are in force for, e.g. 2026 for 2026-27. */
    previousYear: { type: Number, required: true },

    ownedHighPopulation: {
      type: Number,
      default: PERQUISITE_RULES.ownedAccommodation.highPopulation,
      min: 0,
    },
    ownedHighPercent: {
      type: Number,
      default: PERQUISITE_RULES.ownedAccommodation.highPercent,
      min: 0,
      max: 100,
    },
    ownedMidPopulation: {
      type: Number,
      default: PERQUISITE_RULES.ownedAccommodation.midPopulation,
      min: 0,
    },
    ownedMidPercent: {
      type: Number,
      default: PERQUISITE_RULES.ownedAccommodation.midPercent,
      min: 0,
      max: 100,
    },
    ownedLowPercent: {
      type: Number,
      default: PERQUISITE_RULES.ownedAccommodation.lowPercent,
      min: 0,
      max: 100,
    },

    leasedPercent: {
      type: Number,
      default: PERQUISITE_RULES.leasedPercent,
      min: 0,
      max: 100,
    },
    hotelPercent: {
      type: Number,
      default: PERQUISITE_RULES.hotelPercent,
      min: 0,
      max: 100,
    },
    hotelExemptDays: {
      type: Number,
      default: PERQUISITE_RULES.hotelExemptDays,
      min: 0,
    },
    furniturePercent: {
      type: Number,
      default: PERQUISITE_RULES.furniturePercent,
      min: 0,
      max: 100,
    },

    smallCarMonthly: {
      type: Number,
      default: PERQUISITE_RULES.smallCarMonthly,
      min: 0,
    },
    largeCarMonthly: {
      type: Number,
      default: PERQUISITE_RULES.largeCarMonthly,
      min: 0,
    },
    driverMonthly: {
      type: Number,
      default: PERQUISITE_RULES.driverMonthly,
      min: 0,
    },

    loanExemptAggregate: {
      type: Number,
      default: PERQUISITE_RULES.loanExemptAggregate,
      min: 0,
    },

    /**
     * The State Bank of India lending rates as on the first day of the previous
     * year, by class of loan.
     *
     * Recorded once a year and then frozen, which is the opposite of how every
     * other rate in the tree behaves. Held as a map because the rate differs by
     * class — a housing loan and a personal loan carry different figures and
     * Rule 3(7)(i) asks for the rate for "the same purpose".
     */
    sbiRatesByLoanClass: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },

    /** Where the rates were taken from, for the assessing officer. */
    sbiRateSource: { type: String, default: '', trim: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

perquisiteRulesSchema.index({ tenantId: 1, previousYear: 1 }, { unique: true });

// --- What the employee has --------------------------------------------------

const perquisiteGrantSchema = new mongoose.Schema(
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

    kind: {
      type: String,
      enum: Object.values(PERQUISITE_KIND),
      required: true,
    },

    /**
     * The period the perquisite was provided over.
     *
     * The reason this is a collection rather than fields on the employee: Rule 3
     * values a perquisite for the months it was provided, and a flat given in
     * October is six months of salary rather than twelve.
     */
    providedFrom: { type: Date, required: true },
    providedTo: { type: Date },

    // --- Accommodation ------------------------------------------------------
    accommodationType: {
      type: String,
      enum: [...Object.values(ACCOMMODATION_TYPE), null],
      default: null,
    },
    /**
     * The population of the city, as an absolute number.
     *
     * Recorded rather than derived from an address, because the bands turn on
     * the census figure for the city and no address field in the product carries
     * one — and guessing it moves the rate between 5 and 10 per cent.
     */
    cityPopulation: { type: Number, default: 0, min: 0 },
    rentPaidByEmployer: { type: Number, default: 0, min: 0 },
    /** Reduces the value, floored at zero. Never a deduction. */
    rentRecovered: { type: Number, default: 0, min: 0 },
    hotelCharge: { type: Number, default: 0, min: 0 },
    hotelDays: { type: Number, default: 0, min: 0 },
    furnitureCost: { type: Number, default: 0, min: 0 },
    furnitureHireCharges: { type: Number, default: 0, min: 0 },

    // --- Motor car ----------------------------------------------------------
    engineLitres: { type: Number, default: 0, min: 0 },
    driverProvided: { type: Boolean, default: false },
    /** The employee's own car, reimbursed. A different rule, not a variant. */
    employeeOwned: { type: Boolean, default: false },
    reimbursement: { type: Number, default: 0, min: 0 },

    // --- Loan ---------------------------------------------------------------
    /** Which SBI rate applies. Keys `sbiRatesByLoanClass` above. */
    loanClass: { type: String, default: '', trim: true },
    /** Links to the existing loan so the balances are not re-derived. */
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    interestChargedInYear: { type: Number, default: 0, min: 0 },
    forSpecifiedMedicalTreatment: { type: Boolean, default: false },

    // --- ESOP ---------------------------------------------------------------
    /**
     * Exercises, not vestings.
     *
     * The perquisite arises on exercise. `vestingCalculator.js` computes the
     * vesting and stops there, correctly — a vested option never exercised is
     * never a perquisite.
     */
    exercises: {
      type: [
        new mongoose.Schema(
          {
            shares: { type: Number, default: 0, min: 0 },
            /** On the date of exercise, not the date of vesting or of grant. */
            fairMarketValue: { type: Number, default: 0, min: 0 },
            exercisePrice: { type: Number, default: 0, min: 0 },
            exercisedOn: { type: Date },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

perquisiteGrantSchema.index({ tenantId: 1, employeeId: 1, kind: 1 });
perquisiteGrantSchema.index({ tenantId: 1, providedFrom: 1, providedTo: 1 });

// --- The statement ----------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    rule: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const statementLineSchema = new mongoose.Schema(
  {
    serial: { type: Number, default: 0 },
    kind: { type: String, enum: Object.values(PERQUISITE_KIND) },
    rule: { type: String, default: '' },
    value: { type: Number, default: 0 },
    /** Form 12BA asks for the value *and* the basis. */
    basis: { type: String, default: '' },
    recovered: { type: Number, default: 0 },
  },
  { _id: false },
);

const statementEmployeeSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },

    /** The base the accommodation was a percentage of. */
    ruleThreeSalary: { type: Number, default: 0 },
    ruleThreeMonths: { type: Number, default: 12 },

    lines: { type: [statementLineSchema], default: [] },
    total: { type: Number, default: 0 },

    /**
     * What a further rupee of taxable allowance costs this employee.
     *
     * More than one where they are in employer-owned accommodation. Stored so
     * `fbpEngine.utils.js` can read it when it restructures a package, which it
     * currently cannot see at all.
     */
    marginalAllowanceMultiplier: { type: Number, default: 1 },
  },
  { _id: false },
);

const perquisiteStatementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    previousYear: { type: Number, required: true },

    /** A snapshot, not a reference — the bands moved in 2023 and will again. */
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },

    employeeCount: { type: Number, default: 0 },
    withPerquisites: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    byKind: {
      type: [
        new mongoose.Schema(
          {
            kind: { type: String, enum: Object.values(PERQUISITE_KIND) },
            rule: { type: String, default: '' },
            value: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    /** How many employees an allowance compounds for. */
    compoundingCount: { type: Number, default: 0 },

    summary: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            rule: { type: String, default: '' },
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
    employees: { type: [statementEmployeeSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

perquisiteStatementSchema.index(
  { tenantId: 1, previousYear: 1 },
  { unique: true },
);

const PerquisiteRules = mongoose.model(
  'PerquisiteRules',
  perquisiteRulesSchema,
);
const PerquisiteGrant = mongoose.model(
  'PerquisiteGrant',
  perquisiteGrantSchema,
);
const PerquisiteStatement = mongoose.model(
  'PerquisiteStatement',
  perquisiteStatementSchema,
);

module.exports = { PerquisiteRules, PerquisiteGrant, PerquisiteStatement };
