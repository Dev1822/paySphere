/**
 * Labour Welfare Fund (#1701).
 *
 * Two collections: the state rule, and the contribution computed against it.
 *
 * The state rule is data rather than code because there is no central Act —
 * there are fifteen or so state enactments, and they disagree on the
 * periodicity, the amounts, the establishment threshold, the managerial
 * exclusion and the remittance window. A rule expressed as a document can be
 * corrected by a tenant when their state notifies a revision; a rule expressed
 * as a `switch` cannot.
 *
 * Rules are effective-dated and append-only, for the reason
 * `minimumWage.model.js` gives about notifications: a contribution for a period
 * that has closed has to stay reproducible against the amounts that were in
 * force then, and overwriting the rule makes a re-run of December disagree with
 * what was remitted.
 */

const mongoose = require('mongoose');

const { PERIODICITY, EXCLUSION } = require('../utils/labourWelfareFund');

/**
 * One wage slab.
 *
 * `upTo: null` is the open-ended top slab. Inclusive of the boundary, because
 * the notifications are written that way — Maharashtra's lower slab is "wages
 * not exceeding ₹3,000", so an employee on exactly ₹3,000 is in it.
 *
 * The employer's share is stored rather than derived from the employee's. It is
 * three times it in Maharashtra, twice it in Karnataka and equal to it in
 * Kerala, so any rule expressing it as a multiple would be wrong somewhere.
 */
const slabSchema = new mongoose.Schema(
  {
    upTo: { type: Number, default: null },
    employee: { type: Number, required: true, min: 0 },
    employer: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const labourWelfareFundRuleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** ISO 3166-2 subdivision code without the country prefix: MH, KA, KL. */
    state: { type: String, required: true, uppercase: true, trim: true },

    /** The enactment, so a line in the register can be traced. */
    enactment: { type: String, default: '' },

    effectiveFrom: { type: Date, required: true },

    periodicity: {
      type: String,
      enum: Object.values(PERIODICITY),
      required: true,
    },

    /**
     * The months in which the deduction is *made*, 1-12.
     *
     * The period each one closes is derived from this and the periodicity
     * rather than being stated separately, so a rule cannot describe a June
     * collection for a period ending in September — which is not a thing any
     * state does and would be a silent source of wrong periods if it could be
     * expressed.
     */
    contributionMonths: {
      type: [{ type: Number, min: 1, max: 12 }],
      default: [],
    },

    slabs: { type: [slabSchema], default: [] },

    /**
     * The headcount at which the state Act applies to an establishment.
     *
     * Five in some states, ten in others, twenty in a few. Zero means the state
     * names none.
     */
    establishmentThreshold: { type: Number, default: 0, min: 0 },

    /**
     * The wage above which an employee in a managerial or supervisory capacity
     * is excluded.
     *
     * The exclusion is by capacity **and** wage together — a senior engineer on
     * ₹90,000 who supervises nobody is still liable — so this is only consulted
     * for employees flagged managerial. Zero means the state excludes nobody on
     * this ground.
     */
    managerialWageThreshold: { type: Number, default: 0, min: 0 },

    /**
     * Days after the period end by which the contribution must be remitted.
     *
     * An offset rather than a fixed calendar date, because the states express it
     * that way — "within fifteen days of the end of the contribution period" —
     * and a fixed date copied from one state is wrong for all the others.
     */
    remittanceDueDays: { type: Number, default: 15, min: 0 },

    /** Simple annual rate on a delayed remittance. Zero where none is charged. */
    lateInterestRate: { type: Number, default: 0, min: 0 },

    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// The lookup every assessment performs: the latest rule for a state that is not
// in the future. Descending so that is a prefix read rather than a sort.
labourWelfareFundRuleSchema.index({ tenantId: 1, state: 1, effectiveFrom: -1 });

/** One employee's contribution. */
const contributionLineSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },
    state: { type: String, default: '' },
    wages: { type: Number, default: 0 },
    /** The slab ceiling that produced the amounts. Null for the open-ended one. */
    slabUpTo: { type: Number, default: null },
    employeeShare: { type: Number, default: 0 },
    employerShare: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

/** An employee who does not contribute, and why. */
const contributionExclusionSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    state: { type: String, default: '' },
    wages: { type: Number, default: 0 },
    code: { type: String, enum: Object.values(EXCLUSION), required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const labourWelfareFundContributionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    state: { type: String, required: true, uppercase: true },

    /** The month the deduction was made in. */
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    /** The period that month closes, derived by the engine. */
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    periodLabel: { type: String, default: '' },
    periodicity: { type: String, enum: Object.values(PERIODICITY) },

    headcountAtPeriodEnd: { type: Number, default: 0 },
    liableCount: { type: Number, default: 0 },
    excludedCount: { type: Number, default: 0 },

    employeeTotal: { type: Number, default: 0 },
    employerTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    lines: { type: [contributionLineSchema], default: [] },
    exclusions: { type: [contributionExclusionSchema], default: [] },

    // --- Remittance --------------------------------------------------------

    dueBy: { type: Date, default: null },
    paidOn: { type: Date, default: null },
    challanReference: { type: String, default: '' },
    daysLate: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },

    /**
     * The rule this contribution was computed against.
     *
     * Referenced rather than copied, because the rules collection is
     * append-only — the document this points at cannot change underneath the
     * contribution, so a reference is as durable as a copy and does not go stale
     * in a different way from the copy it would otherwise be.
     */
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourWelfareFundRule',
      default: null,
    },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One contribution per tenant per state per collection month. Committing
// December twice would remit twice, and the register would show two liabilities
// for one period.
labourWelfareFundContributionSchema.index(
  { tenantId: 1, state: 1, year: 1, month: 1 },
  { unique: true },
);

// "What is outstanding" — the question the register opens on.
labourWelfareFundContributionSchema.index({ tenantId: 1, paidOn: 1, dueBy: 1 });

const LabourWelfareFundRule = mongoose.model(
  'LabourWelfareFundRule',
  labourWelfareFundRuleSchema,
);

const LabourWelfareFundContribution = mongoose.model(
  'LabourWelfareFundContribution',
  labourWelfareFundContributionSchema,
);

module.exports = { LabourWelfareFundRule, LabourWelfareFundContribution };
