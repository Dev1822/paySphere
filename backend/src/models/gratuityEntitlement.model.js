/**
 * Payment of Gratuity Act, 1972 — nominations, claims and forfeitures (#2031).
 *
 * Three collections. `settlement.js` computes the amount and holds no state
 * after the run; `gratuityValuation.js` (#1344) measures the whole workforce's
 * obligation under Ind AS 19. Neither can hold any of the following.
 *
 * `GratuityNomination` is the **Form F**, and it is deliberately not the EPF
 * Form 2 nomination in `edliAssurance.model.js`. Separate instruments under
 * separate statutes, and an employee may name different people on each —
 * reusing one for the other pays the wrong person the most sensitive amount in
 * the module. It also has to exist years before anybody leaves, which is why it
 * is not a field on a settlement.
 *
 * `GratuityClaim` is the **obligation**, dated from the last working day. The
 * thirty days under section 7(3) run from that date whether or not anybody
 * applies, and the 7(3A) interest grows every day until payment — so this is a
 * row that has to be re-answered on any date, which a full-and-final line item
 * is not. The two notices under section 7(2) are two fields because they are two
 * obligations, and the one to the controlling authority is the one nobody does.
 *
 * `GratuityForfeiture` carries the **sub-section**, not a flag. Section 4(6)(a)
 * forfeits to the extent of the damage — quantified, mandatory, capped — and
 * 4(6)(b) permits whole or partial forfeiture on three grounds and only where
 * services were terminated *for* the act. A single `forfeited: true` lets a
 * ₹4,000 breakage take ₹6,00,000 and hides the second requirement entirely.
 */

const mongoose = require('mongoose');

const {
  CESSATION_GROUND,
  PAYABILITY,
  OBLIGATION_STATE,
  FORFEITURE_GROUND,
  FORFEITURE_VERDICT,
  CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
  INTEREST_IS_NOT_DISCRETIONARY,
  FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
  FORFEITURE_IS_TWO_RULES,
} = require('../utils/gratuityEntitlement');

// --- The Form F nomination --------------------------------------------------

const nomineeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },

    /**
     * Percentage, not amount.
     *
     * The gratuity is not known when the nomination is made — it depends on the
     * last drawn wages years later — so a nomination expressed in rupees is
     * either stale or meaningless by the time it is used.
     */
    sharePercent: { type: Number, required: true, min: 0, max: 100 },

    /**
     * Whether this nominee is a member of the family as the Act defines it.
     *
     * Recorded rather than inferred from `relationship`, because the definition
     * in section 2(h) is specific — it includes a dependant father, mother,
     * widow and children, and the composition differs for a male and a female
     * employee — and rule 6(3) voids a nomination in favour of anyone outside it
     * where the employee had a family when making it.
     */
    isFamily: { type: Boolean, required: true },

    isMinor: { type: Boolean, default: false },
    /** A minor's share is paid through a guardian. */
    guardian: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const gratuityNominationSchema = new mongoose.Schema(
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

    form: { type: String, default: 'Form F', trim: true },
    madeOn: { type: Date, required: true },

    nominees: {
      type: [nomineeSchema],
      validate: {
        validator: (rows) => Array.isArray(rows) && rows.length > 0,
        message: 'A nomination with no nominees is not a nomination.',
      },
    },

    /**
     * Whether the employee had a family when the nomination was made.
     *
     * Rule 6(3) turns on this and it is a fact about a past date, so it cannot
     * be derived from the employee record now. An employee who was single in
     * 2019 and married in 2022 had no family when they nominated, and that is
     * what makes the nomination valid then and void now.
     */
    hadFamilyWhenMade: { type: Boolean, required: true },

    /**
     * When the employee acquired a family, where they had none before.
     *
     * Rule 6(4): the nomination becomes void and a fresh one in favour of family
     * is required. Void, not stale — so the date is held rather than a flag
     * saying the record needs review.
     */
    acquiredFamilyOn: { type: Date, default: null },
    freshNominationMade: { type: Boolean, default: false },

    /** Superseded nominations are kept. Which one stood when is the question. */
    supersededOn: { type: Date, default: null },

    documentRef: { type: String, default: '', trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

gratuityNominationSchema.index({ tenantId: 1, employeeId: 1, madeOn: -1 });

// --- The claim --------------------------------------------------------------

const gratuityClaimSchema = new mongoose.Schema(
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

    ground: {
      type: String,
      enum: Object.keys(CESSATION_GROUND),
      required: true,
    },

    /**
     * The date gratuity became payable — the last working day.
     *
     * Required, and the whole clock hangs off it. Section 7(3) runs thirty days
     * from here and section 7(3A) interest runs from here to the date of
     * payment, so a claim without it has no obligation the module can state.
     */
    payableFrom: { type: Date, required: true },

    /** Actual completed years, from `settlement.js`. Not recomputed here. */
    completedYears: { type: Number, required: true, min: 0 },

    /** The section 4 figure, from `settlement.js`. Not recomputed here. */
    statutoryAmount: { type: Number, required: true, min: 0 },

    /**
     * A better term under an award, agreement or contract — section 4(5).
     *
     * Null where there is none, and null is different from zero: zero would be a
     * contractual term of nothing, which would still lose to the statutory
     * figure but is a thing somebody chose to record.
     */
    contractualAmount: { type: Number, default: null },

    /** Section 7(2). Two obligations, and the second is the one nobody does. */
    noticeToPayeeOn: { type: Date, default: null },
    noticeToControllingAuthorityOn: { type: Date, default: null },

    /**
     * The Form I application.
     *
     * Recorded, and deliberately not a precondition to anything. Section 7(2)
     * requires the employer to determine and give notice *whether or not an
     * application has been made*, so a claim with no Form I is not a claim that
     * has not started — it is one where the employer's obligation is running and
     * nobody has asked.
     */
    applicationReceivedOn: { type: Date, default: null },

    paidOn: { type: Date, default: null },
    paidAmount: { type: Number, default: null },
    interestPaid: { type: Number, default: null },

    /** The section 7(3A) proviso. Both limbs, or neither counts. */
    relief: {
      delayDueToEmployeeFault: { type: Boolean, default: false },
      /**
       * The controlling authority's written permission for the delay.
       *
       * A reference, not a boolean. Employee fault on its own does not stop the
       * interest, and "we had permission" with nothing to point at is the state
       * this field exists to keep distinguishable from the order.
       */
      controllingAuthorityPermission: { type: String, default: '', trim: true },
    },

    /** Section 4A — compulsory insurance or an approved gratuity fund. */
    section4A: {
      insured: { type: Boolean, default: false },
      insurerOrFund: { type: String, default: '', trim: true },
      registrationNumber: { type: String, default: '', trim: true },
    },

    lastKnownPayability: {
      type: String,
      enum: [...Object.values(PAYABILITY), null],
      default: null,
    },
    lastKnownState: {
      type: String,
      enum: [...Object.values(OBLIGATION_STATE), null],
      default: null,
    },

    /** The two facts a reader of this row is deciding against. Fields, not comments. */
    clockNote: {
      type: String,
      default: CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
    },
    interestNote: { type: String, default: INTEREST_IS_NOT_DISCRETIONARY },
    deathNote: { type: String, default: FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

gratuityClaimSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });
// The sweep that matters: unpaid claims past their thirty days, interest running.
gratuityClaimSchema.index({ tenantId: 1, paidOn: 1, payableFrom: 1 });

// --- Forfeiture -------------------------------------------------------------

const gratuityForfeitureSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GratuityClaim',
      required: true,
      index: true,
    },

    /** Which sub-section. The whole reason this is not a boolean. */
    ground: {
      type: String,
      enum: Object.values(FORFEITURE_GROUND),
      required: true,
    },

    /**
     * The damage or loss, for 4(6)(a).
     *
     * Required in the controller for that ground and not by the schema, because
     * the two 4(6)(b) grounds have no damage figure at all and a schema-level
     * requirement would force a zero onto them that means something different.
     */
    damageAmount: { type: Number, default: null },

    /**
     * Whether services were terminated **for** the act — 4(6)(b).
     *
     * The requirement a flag hides. An employee who resigned, or who was
     * terminated on another ground, is outside the sub-section however serious
     * the conduct was.
     */
    terminatedForTheAct: { type: Boolean, default: false },

    /** 4(6)(b) reaches moral turpitude committed in the course of employment. */
    inCourseOfEmployment: { type: Boolean, default: null },

    /** What the employer claimed, before the engine capped it. */
    amountClaimed: { type: Number, required: true, min: 0 },
    /** What the sub-section permitted. Stored because the gap is the finding. */
    amountPermitted: { type: Number, default: null },
    amountForfeited: { type: Number, default: null },

    verdict: {
      type: String,
      enum: [...Object.values(FORFEITURE_VERDICT), null],
      default: null,
    },

    /** The order or finding the forfeiture rests on. */
    orderRef: { type: String, default: '', trim: true },
    decidedOn: { type: Date, default: null },

    forfeitureNote: { type: String, default: FORFEITURE_IS_TWO_RULES },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

gratuityForfeitureSchema.index({ tenantId: 1, claimId: 1 });

const GratuityNomination = mongoose.model(
  'GratuityNomination',
  gratuityNominationSchema,
);
const GratuityClaim = mongoose.model('GratuityClaim', gratuityClaimSchema);
const GratuityForfeiture = mongoose.model(
  'GratuityForfeiture',
  gratuityForfeitureSchema,
);

module.exports = {
  GratuityNomination,
  GratuityClaim,
  GratuityForfeiture,
};
