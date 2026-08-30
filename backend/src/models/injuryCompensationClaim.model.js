/**
 * Employees' Compensation Act, 1923 — workplace injury claims (#1699).
 *
 * One collection, and the computation is stored on the claim rather than
 * recomputed on read.
 *
 * The reasoning is the same as `gratuityValuation.model.js` and
 * `statutoryBonus.model.js`: a claim is a figure that gets deposited with a
 * Commissioner, and it has to stay reconstructable. The Schedule IV factor
 * depends on the age at the *accident*, the wage cap and the two floors are
 * revised by notification, and the section 4A interest depends on a payment
 * date that has not happened yet — so a claim recomputed six months later from
 * live constants would disagree with what was deposited, and the disagreement
 * would be invisible.
 */

const mongoose = require('mongoose');

const {
  INJURY,
  BAR,
  SCHEDULE_I_INJURIES,
} = require('../utils/employeesCompensation');

/**
 * Where a claim is.
 *
 * `DEPOSITED` is not decoration. Section 8 requires compensation for death to
 * be *deposited with the Commissioner* rather than paid to the dependants
 * directly, and a payment that skips that step has not discharged the
 * liability — the employer can be made to pay twice. A lifecycle that went
 * straight from computed to paid would model the thing incorrectly for the most
 * serious head of claim there is.
 */
const CLAIM_STATUS = {
  REPORTED: 'REPORTED',
  UNDER_ASSESSMENT: 'UNDER_ASSESSMENT',
  COMPUTED: 'COMPUTED',
  DEPOSITED: 'DEPOSITED',
  PAID: 'PAID',
  CONTESTED: 'CONTESTED',
  REJECTED: 'REJECTED',
};

/** The monthly wage, before and after Explanation II. */
const wagesSchema = new mongoose.Schema(
  {
    actual: { type: Number, default: 0 },
    capped: { type: Number, default: 0 },
    capApplied: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * The computed head of compensation.
 *
 * One flexible sub-document rather than four schemas, because the four heads
 * share most of their fields and the ones they do not share are each present
 * for exactly one head. Four collections of near-identical shape would make
 * every read a union.
 */
const headSchema = new mongoose.Schema(
  {
    head: { type: String, enum: Object.values(INJURY) },
    /** The statutory reference, carried so the page can cite it. */
    section: { type: String, default: '' },

    wages: { type: wagesSchema, default: () => ({}) },
    age: { type: Number, default: null },
    relevantFactor: { type: Number, default: 0 },
    wageShare: { type: Number, default: 0 },

    computed: { type: Number, default: 0 },
    floor: { type: Number, default: 0 },
    floorApplied: { type: Boolean, default: false },

    // --- Permanent partial only -------------------------------------------
    scheduleInjury: {
      type: String,
      enum: [...Object.keys(SCHEDULE_I_INJURIES), null],
      default: null,
    },
    injuryDescription: { type: String, default: '' },
    lossOfEarningCapacityPercent: { type: Number, default: 0 },
    permanentTotalBasis: { type: Number, default: 0 },

    // --- Temporary only ---------------------------------------------------
    disablementDays: { type: Number, default: 0 },
    waitingDays: { type: Number, default: 0 },
    waitingWaived: { type: Boolean, default: false },
    fiveYearCapApplied: { type: Boolean, default: false },
    compensableDays: { type: Number, default: 0 },
    halfMonthlyPayment: { type: Number, default: 0 },
    halfMonths: { type: Number, default: 0 },

    compensation: { type: Number, default: 0 },
  },
  { _id: false },
);

/** Section 4A, as at the date the claim was last computed. */
const chargesSchema = new mongoose.Schema(
  {
    dueBy: { type: Date, default: null },
    daysLate: { type: Number, default: 0 },
    interestDays: { type: Number, default: 0 },
    interestRate: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    penaltyShare: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const injuryCompensationClaimSchema = new mongoose.Schema(
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
    /**
     * Denormalised at the point of the accident.
     *
     * A claim outlives the employment — a death claim by definition, and a
     * permanent disablement claim usually — so resolving the name through the
     * employee record at read time gives an empty column on exactly the claims
     * that matter most.
     */
    employeeName: { type: String, default: '' },
    designation: { type: String, default: '' },
    dateOfBirth: { type: Date, default: null },

    // --- The accident ------------------------------------------------------

    accidentDate: { type: Date, required: true },
    reportedOn: { type: Date, default: Date.now },
    place: { type: String, default: '' },
    /** What happened, in the words of the accident report. */
    circumstances: { type: String, default: '' },

    injuryType: {
      type: String,
      enum: Object.values(INJURY),
      required: true,
    },

    // --- What the employer says about liability ----------------------------

    /**
     * The section 3 bars asserted against the claim.
     *
     * Stored as asserted rather than as applied, because whether a bar *bites*
     * depends on the head — the section 3(1)(b) provisos do not apply to death
     * or permanent total disablement — and that determination belongs to the
     * engine rather than to whoever filled in the form.
     */
    assertedBars: [{ type: String, enum: Object.values(BAR) }],
    appliedBars: [{ type: String, enum: Object.values(BAR) }],
    disappliedBars: [{ type: String, enum: Object.values(BAR) }],
    barReasons: [{ type: String }],

    payable: { type: Boolean, default: true },

    // --- The computation ---------------------------------------------------

    monthlyWages: { type: Number, default: 0 },
    ageAtAccident: { type: Number, default: null },
    ageWarning: { type: String, default: '' },

    head: { type: headSchema, default: () => ({}) },
    funeralExpenses: { type: Number, default: 0 },
    compensation: { type: Number, default: 0 },
    charges: { type: chargesSchema, default: () => ({}) },
    totalPayable: { type: Number, default: 0 },

    // --- Discharge ---------------------------------------------------------

    status: {
      type: String,
      enum: Object.values(CLAIM_STATUS),
      default: CLAIM_STATUS.REPORTED,
    },

    /** Section 8. Set when the deposit is made, not when it is intended. */
    depositedOn: { type: Date, default: null },
    commissionerReference: { type: String, default: '' },

    paidOn: { type: Date, default: null },

    /**
     * The penalty share the Commissioner actually imposed, where one has been.
     * Nought until then — the maximum is fifty percent and assuming it would
     * overstate every open claim on the register.
     */
    penaltyShare: { type: Number, default: 0, min: 0, max: 0.5 },

    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// The register's default view: open claims for a tenant, most recent accident
// first. Status is in the key because "what is still outstanding" is the
// question the page opens on.
injuryCompensationClaimSchema.index({
  tenantId: 1,
  status: 1,
  accidentDate: -1,
});

// "Has this employee claimed before" — asked whenever a second accident is
// reported, and a collection scan without it.
injuryCompensationClaimSchema.index({ tenantId: 1, employeeId: 1 });

/**
 * Named for the injury rather than for the Act.
 *
 * `EmployeeCompensation` is already taken in this tree by the longitudinal
 * compensation timeline (`employeeCompensation.controller.js`), which is about
 * what somebody has been *paid over time* — an entirely different subject that
 * happens to share three quarters of a name. Two collections whose names differ
 * by a plural is how a query ends up reading the wrong one.
 */
const InjuryCompensationClaim = mongoose.model(
  'InjuryCompensationClaim',
  injuryCompensationClaimSchema,
);

module.exports = { InjuryCompensationClaim, CLAIM_STATUS };
