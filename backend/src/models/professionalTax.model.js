/**
 * Professional tax — the state rules, the certificates and the returns (#1876).
 *
 * Four collections, and the shape of the first is the whole feature.
 *
 * `ProfessionalTaxRule` is **dated and per state**, not a current-state table
 * keyed by state code. Karnataka's threshold moved to ₹25,000 in April 2023 and
 * Maharashtra's women's threshold moved with it; a payroll re-run for March has
 * to reproduce the table that was in force in March. Replacing a rule in place
 * would make every historical payslip unreproducible, so a change is a new
 * document with its own `effectiveFrom` and the old one stays.
 *
 * `ProfessionalTaxRegistration` is per work state, because the state that
 * applies is the state of the **place of work** — not the registered office and
 * not the employee's residence. A company in Mumbai with an office in Bengaluru
 * holds two certificates, remits to two authorities on two schedules, and there
 * is no combined figure anybody can pay.
 *
 * `ProfessionalTaxPayment` exists because accrued and paid are different
 * numbers. Section 16(iii) of the Income-tax Act allows professional tax
 * **actually paid**, so an amount deducted in March and remitted in April
 * belongs to the following year's deduction. The salary computation reads this
 * collection and deliberately not the accrual.
 *
 * `ProfessionalTaxAssessment` snapshots a year with the rules it was computed
 * under, for the reason the rules are dated at all.
 */

const mongoose = require('mongoose');

const {
  ANNUAL_CEILING,
  PERIODICITY,
  LEVY_LEVEL,
  CERTIFICATE,
  EXEMPTION,
  CATEGORY,
  FINDING,
  SEVERITY,
} = require('../utils/professionalTax');

// --- The rule ---------------------------------------------------------------

const slabSchema = new mongoose.Schema(
  {
    /**
     * Inclusive, and null on the last band.
     *
     * A table whose last band is bounded lets a high earner fall off the end
     * and attract nothing at all, which looks like an exemption rather than a
     * bug — so the engine returns the last band regardless and this field
     * records the intent.
     */
    upTo: { type: Number, default: null, min: 0 },
    /** Per period of the rule's own periodicity: per month, or per half-year. */
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const professionalTaxRuleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** Two-letter state code, upper case. */
    state: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, default: '', trim: true },

    /**
     * The date the notification took effect.
     *
     * Part of the identity of the rule rather than a metadata field. Two rules
     * for the same state with different dates is the normal case, and
     * `resolveRule` picks by date and never by "the latest one".
     */
    effectiveFrom: { type: Date, required: true },

    periodicity: {
      type: String,
      enum: Object.values(PERIODICITY),
      required: true,
    },

    /**
     * Kerala levies at the panchayat or municipality of the workplace, so the
     * rate depends on the local body rather than on the state. A state-keyed
     * table cannot express that on its own.
     */
    levyLevel: {
      type: String,
      enum: Object.values(LEVY_LEVEL),
      default: LEVY_LEVEL.STATE,
    },
    requiresLocalBody: { type: Boolean, default: false },
    localBody: { type: String, default: '', trim: true },

    slabs: { type: [slabSchema], default: [] },

    /**
     * Maharashtra's February.
     *
     * ₹300 against ₹200 in the other eleven months, so the year lands exactly
     * on the Article 276 ceiling. Twelve times ₹200 is short by ₹100 on every
     * employee above the threshold, every year, and it looks entirely
     * reasonable — which is why this is a stored rule rather than a constant in
     * a branch.
     */
    specialMonth: {
      month: { type: Number, min: 1, max: 12 },
      amount: { type: Number, min: 0 },
    },

    /** A separate table where a state distinguishes a category. */
    categorySlabs: {
      type: Map,
      of: [slabSchema],
      default: undefined,
    },

    /** The employer's own annual liability under the enrolment certificate. */
    enrolmentAnnualAmount: { type: Number, default: 0, min: 0 },

    /**
     * Where the state makes the return periodicity depend on the prior year's
     * liability. Whether a return is late is not answerable without it.
     */
    monthlyReturnThreshold: { type: Number, default: 0, min: 0 },

    source: { type: String, default: '', trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

professionalTaxRuleSchema.index(
  { tenantId: 1, state: 1, effectiveFrom: 1 },
  { unique: true },
);

// --- The certificates -------------------------------------------------------

const professionalTaxRegistrationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The work state the certificate covers. */
    state: { type: String, required: true, trim: true, uppercase: true },
    localBody: { type: String, default: '', trim: true },

    /**
     * Which certificate this is.
     *
     * The enrolment certificate covers the employer's own tax on the trade it
     * carries on — annual, and deducted from nobody. The registration
     * certificate is the authority under which it deducts from employees. They
     * are different obligations with different returns, and the product has
     * never had a concept of the first.
     */
    certificate: {
      type: String,
      enum: Object.values(CERTIFICATE),
      required: true,
    },

    number: { type: String, default: '', trim: true },
    issuedOn: { type: Date },
    active: { type: Boolean, default: true },

    /**
     * Resolved from the prior year's liability where the state makes it depend
     * on that. Stored rather than derived because it is what the department
     * put on the certificate, and a return is late against that and not
     * against a recomputation.
     */
    returnPeriodicity: {
      type: String,
      enum: Object.values(PERIODICITY),
      default: PERIODICITY.MONTHLY,
    },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

professionalTaxRegistrationSchema.index(
  { tenantId: 1, state: 1, certificate: 1 },
  { unique: true },
);

// --- The payments -----------------------------------------------------------

const professionalTaxPaymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    state: { type: String, required: true, trim: true, uppercase: true },

    certificate: {
      type: String,
      enum: Object.values(CERTIFICATE),
      default: CERTIFICATE.REGISTRATION,
    },

    /**
     * The date the money reached the state.
     *
     * This is the field section 16(iii) turns on, which is why it is required
     * and why the period it covers is separate from it. A remittance for March
     * paid in April is allowable in the following year, and conflating the two
     * dates would move a deduction between years.
     */
    paidOn: { type: Date, required: true },

    /** The period the payment discharges, which is not when it was paid. */
    periodYear: { type: Number, min: 1900 },
    periodMonth: { type: Number, min: 1, max: 12 },

    amount: { type: Number, required: true, min: 0 },
    challanReference: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

professionalTaxPaymentSchema.index({ tenantId: 1, state: 1, paidOn: 1 });

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    authority: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    state: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const registrationLineSchema = new mongoose.Schema(
  {
    state: { type: String, required: true },
    periodicity: { type: String, default: '' },
    levyLevel: { type: String, default: '' },
    employeeCount: { type: Number, default: 0 },

    /** What was deducted from employees under the registration certificate. */
    deductedFromEmployees: { type: Number, default: 0, min: 0 },

    /**
     * The employer's own annual tax under the enrolment certificate.
     * Beside the deduction and deliberately not added to it: different
     * certificate, different return, different authority to answer to.
     */
    employerEnrolmentLiability: { type: Number, default: 0, min: 0 },

    enrolled: { type: Boolean, default: false },
  },
  { _id: false },
);

const professionalTaxAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    financialYear: { type: Number, required: true, min: 1900 },

    /** One line per registration certificate. There is no total across them. */
    registrations: { type: [registrationLineSchema], default: [] },

    /** What was deducted from employees over the year. */
    accrued: { type: Number, default: 0, min: 0 },

    /**
     * What was actually paid, in the shape section 16(iii) wants.
     *
     * Not the same number as `accrued`, and the difference is not allowable to
     * the employee this year whatever was deducted from them.
     */
    paidForSection16iii: { type: Number, default: 0, min: 0 },

    /** The dated rules the figures were computed under. */
    rulesSnapshot: { type: mongoose.Schema.Types.Mixed, default: [] },

    findings: { type: [findingSchema], default: [] },
    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

professionalTaxAssessmentSchema.index(
  { tenantId: 1, financialYear: 1 },
  { unique: true },
);

/**
 * The Article 276 ceiling, exposed on the model so a validator or a report can
 * assert against it without importing the engine.
 */
professionalTaxAssessmentSchema.statics.ANNUAL_CEILING = ANNUAL_CEILING;

// --- Employee attributes ----------------------------------------------------

/**
 * The per-employee facts this levy needs and the employee record does not hold.
 *
 * Its own collection rather than fields on `Employee` for two reasons. The work
 * state is not the address — it is where the person actually works, and for a
 * remote employee on the rolls of a branch those differ — so putting it beside
 * the address invites the two to be conflated. And the exemptions are per-person
 * statutory findings (a disability, a parent of a child with a disability,
 * service in the armed forces) that a payroll administrator should not be able
 * to set from the ordinary employee form.
 */
const professionalTaxProfileSchema = new mongoose.Schema(
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
    },

    /** The place of work. Not the registered office, not the residence. */
    workState: { type: String, required: true, trim: true, uppercase: true },
    localBody: { type: String, default: '', trim: true },

    category: {
      type: String,
      enum: Object.values(CATEGORY),
      default: CATEGORY.DEFAULT,
    },

    exemptions: {
      type: [{ type: String, enum: Object.values(EXEMPTION) }],
      default: [],
    },

    /** What the exemption rests on. An exemption with no basis is a note. */
    exemptionBasis: { type: String, default: '', trim: true, maxlength: 1000 },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

professionalTaxProfileSchema.index(
  { tenantId: 1, employeeId: 1 },
  { unique: true },
);

const ProfessionalTaxRule = mongoose.model(
  'ProfessionalTaxRule',
  professionalTaxRuleSchema,
);
const ProfessionalTaxRegistration = mongoose.model(
  'ProfessionalTaxRegistration',
  professionalTaxRegistrationSchema,
);
const ProfessionalTaxPayment = mongoose.model(
  'ProfessionalTaxPayment',
  professionalTaxPaymentSchema,
);
const ProfessionalTaxAssessment = mongoose.model(
  'ProfessionalTaxAssessment',
  professionalTaxAssessmentSchema,
);
const ProfessionalTaxProfile = mongoose.model(
  'ProfessionalTaxProfile',
  professionalTaxProfileSchema,
);

module.exports = {
  ProfessionalTaxRule,
  ProfessionalTaxRegistration,
  ProfessionalTaxPayment,
  ProfessionalTaxAssessment,
  ProfessionalTaxProfile,
};
