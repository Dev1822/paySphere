/**
 * EDLI paragraph 22 — nominations, exemptions and claims (#1878).
 *
 * Four collections, and three of them exist because the benefit cannot be
 * computed from what this product already stores.
 *
 * `EpfNomination` is the Form 2 nomination, and it is **not**
 * `peerNominationEngine.js`. That module is peer recognition. This one decides
 * who receives an assurance on a member's death, and a claim computed without
 * knowing whether a valid nomination exists is a figure with no payee.
 *
 * `EdliExemption` records an exemption under section 17(2A) and the group
 * policy behind it. The exemption is conditional on that policy paying **not
 * less than** the scheme would, so an exempted establishment needs the
 * paragraph 22 figure computed anyway in order to check — and for an exempted
 * establishment nobody else is computing it at all.
 *
 * `EdliPriorService` holds service at another establishment. The ₹2,50,000
 * floor turns on twelve months of continuous employment preceding the month of
 * death, and that continuity may run across employers — so an employee who
 * joined three months ago having worked elsewhere for the preceding year
 * qualifies and one with a gap does not. Neither this employer's joining date
 * nor its attendance ledger can tell them apart, which is why this is a stated
 * record with its basis on it rather than something derived.
 *
 * `EdliClaim` snapshots the computed benefit with its components and the rules
 * it was computed under. The overall cap moved from ₹6,00,000 to ₹7,00,000 in
 * 2021 and the bonus cap moved with it; a claim for an earlier death that
 * recomputes under today's figures produces a number the EPFO will not
 * recognise, and the figure a family was quoted has to be reproducible from its
 * own record.
 */

const mongoose = require('mongoose');

const {
  EDLI_RULES,
  SERVICE_BASIS,
  PAYEE_LIMB,
  BINDING,
  FINDING,
  SEVERITY,
} = require('../utils/edliAssurance');

// --- Nomination -------------------------------------------------------------

const nomineeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, default: '', trim: true },
    dateOfBirth: { type: Date },

    /**
     * Per cent, and the shares are not forced to total a hundred here.
     *
     * A nomination that adds to sixty is a real thing that members file, and
     * the remainder falls to the next limb of the scheme. Refusing to store it
     * would mean the register disagreed with the Form 2 on file, and the
     * engine reports the gap as a finding instead.
     */
    sharePercent: { type: Number, required: true, min: 0, max: 100 },

    /** A minor nominee's benefit is paid through a guardian. */
    guardianName: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const epfNominationSchema = new mongoose.Schema(
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
    uan: { type: String, default: '', trim: true },

    nominees: { type: [nomineeSchema], default: [] },

    /**
     * The family as the scheme defines it, where no nomination exists.
     * Recorded rather than looked up, because the definition is the scheme's
     * and not the HR system's.
     */
    family: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true },
          relationship: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },

    legalHeirs: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true },
          relationship: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },

    filedOn: { type: Date },
    formReference: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

epfNominationSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });

// --- Exemption --------------------------------------------------------------

const edliExemptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    exempted: { type: Boolean, default: false },
    orderReference: { type: String, default: '', trim: true },
    exemptedFrom: { type: Date },

    insurer: { type: String, default: '', trim: true },
    policyNumber: { type: String, default: '', trim: true },

    /**
     * How the group policy computes its benefit.
     *
     * Stored as a formula rather than as a single amount because it varies with
     * the member — and the whole point of the record is to compare it against
     * paragraph 22 for a particular person. `flatBenefit` is the degenerate
     * case where the policy pays one figure to everybody, which is exactly the
     * kind of policy that falls short for a senior member.
     */
    benefitBasis: {
      type: String,
      enum: ['FLAT', 'MULTIPLE_OF_SALARY', 'SCHEDULE'],
      default: 'FLAT',
    },
    flatBenefit: { type: Number, default: 0, min: 0 },
    salaryMultiple: { type: Number, default: 0, min: 0 },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

edliExemptionSchema.index({ tenantId: 1, establishment: 1 }, { unique: true });

// --- Prior service ----------------------------------------------------------

const edliPriorServiceSchema = new mongoose.Schema(
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

    previousEstablishment: { type: String, default: '', trim: true },
    previousEpfCode: { type: String, default: '', trim: true },

    months: { type: Number, required: true, min: 0 },

    /**
     * Whether there was a break between the two engagements.
     *
     * The floor turns on *continuous* employment, so a break is not a matter of
     * subtracting months — it stops the aggregation entirely. A boolean rather
     * than two dates because the fact recorded on a service certificate is
     * usually the fact and not the dates.
     */
    gapBetween: { type: Boolean, default: false },

    /**
     * What the months rest on.
     *
     * A floor of ₹2,50,000 resting on an unsupported declaration is a different
     * fact from one resting on a passbook, and the family is quoted the same
     * number either way — so the basis is stored and reported.
     */
    basis: {
      type: String,
      enum: Object.values(SERVICE_BASIS),
      default: SERVICE_BASIS.DECLARED,
    },
    documentReference: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

edliPriorServiceSchema.index({ tenantId: 1, employeeId: 1 });

// --- Claim ------------------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    authority: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const windowMonthSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    /** What was actually paid that month. */
    actual: { type: Number, default: 0, min: 0 },
    /** ...and what the statutory ceiling allowed of it. */
    capped: { type: Number, default: 0, min: 0 },
    /** Whether a wage row existed at all, as against a month of nil wages. */
    present: { type: Boolean, default: false },
  },
  { _id: false },
);

const edliClaimSchema = new mongoose.Schema(
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
    },
    uan: { type: String, default: '', trim: true },

    dateOfDeath: { type: Date, required: true },

    /** The twelve months preceding the month of death, with the cap shown. */
    window: { type: [windowMonthSchema], default: [] },

    averageMonthlyWages: { type: Number, default: 0, min: 0 },
    averageBalance: { type: Number, default: 0, min: 0 },

    /** Thirty-five times the capped average. */
    assuranceComponent: { type: Number, default: 0, min: 0 },
    /** Half the average balance, before its own cap... */
    bonusBeforeCap: { type: Number, default: 0, min: 0 },
    /** ...and after it. */
    bonusComponent: { type: Number, default: 0, min: 0 },

    /** What the scheme pays. */
    benefit: { type: Number, default: 0, min: 0 },

    /**
     * Which of the four boundaries produced that figure.
     *
     * A benefit sitting exactly on ₹7,00,000 looks like a coincidence and is
     * not one; a family told "seven lakh" should be able to see which limit
     * produced it.
     */
    binding: {
      type: String,
      enum: Object.values(BINDING),
      default: BINDING.NONE,
    },

    minimumAvailable: { type: Boolean, default: false },
    continuousMonths: { type: Number, default: 0, min: 0 },
    serviceBasis: {
      type: String,
      enum: Object.values(SERVICE_BASIS),
      default: SERVICE_BASIS.THIS_ESTABLISHMENT,
    },

    /** Which limb of the scheme the payee was found under. */
    payeeLimb: {
      type: String,
      enum: Object.values(PAYEE_LIMB),
      default: PAYEE_LIMB.UNRESOLVED,
    },
    payees: {
      type: [
        {
          _id: false,
          name: { type: String, required: true },
          relationship: { type: String, default: '' },
          sharePercent: { type: Number, default: 0 },
        },
      ],
      default: [],
    },

    /**
     * The section 17(2A) comparison, where the establishment is exempted.
     *
     * `shortfall` is kept as its own field and is deliberately not added to
     * `benefit`: it is the part of the same benefit the policy did not cover,
     * not an additional payment, and it is a liability of the establishment
     * rather than of the insurer.
     */
    exemptedPolicyBenefit: { type: Number, default: null },
    exemptedShortfall: { type: Number, default: 0, min: 0 },

    /** The figures in force at the date of death, snapshotted. */
    rulesSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    findings: { type: [findingSchema], default: [] },

    /** Form 5-IF. */
    filedOn: { type: Date },
    claimReference: { type: String, default: '', trim: true },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

edliClaimSchema.index(
  { tenantId: 1, employeeId: 1, dateOfDeath: 1 },
  { unique: true },
);

/**
 * The statutory ceiling, exposed so a report can assert against it without
 * importing the engine.
 */
edliClaimSchema.statics.WAGE_CEILING = EDLI_RULES.wageCeiling;

const EpfNomination = mongoose.model('EpfNomination', epfNominationSchema);
const EdliExemption = mongoose.model('EdliExemption', edliExemptionSchema);
const EdliPriorService = mongoose.model(
  'EdliPriorService',
  edliPriorServiceSchema,
);
const EdliClaim = mongoose.model('EdliClaim', edliClaimSchema);

module.exports = {
  EpfNomination,
  EdliExemption,
  EdliPriorService,
  EdliClaim,
};
