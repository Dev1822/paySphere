/**
 * BOCW Welfare Cess Act, 1996 (#1827).
 *
 * Four collections, and the shape of the first one is the point.
 *
 * `ConstructionProject` exists because this levy's base is a **project cost**,
 * and nothing else in the product holds one. Every other statutory collection
 * here hangs off an employee or a payroll period; a cess assessment hangs off a
 * job, and two jobs with identical wage bills can carry cess differing by a
 * factor of twenty. The exclusions are stored as rows rather than as a single
 * net figure because an assessment order argues about exactly those lines — a
 * stored net base cannot be defended afterwards.
 *
 * `CessBill` is separate from the project because rule 4 deducts at source from
 * each contractor bill, and those deductions are **advances** against a section
 * 5 assessment that has not happened yet. Folding them into the project as a
 * running total would lose the per-bill trail an inspection follows, and
 * netting them against the assessment at the point of deduction would lose the
 * reconciliation entirely.
 *
 * `CessBeneficiary` records days **per employer**, not a total. The ninety-day
 * test counts construction work across every employer in the preceding twelve
 * months, so a single number would be unable to say whether the sixty days it
 * holds are the whole story or this establishment's share of it — and the
 * difference decides eligibility for exactly the itinerant worker section 12
 * exists to protect.
 *
 * `CessAssessment` is the committed position, storing the rules it ran under
 * because section 3(1) permits a rate anywhere between one and two per cent.
 */

const mongoose = require('mongoose');

const {
  CESS_RULES,
  EXCLUSION,
  CESS_STATUS,
  FINDING,
  SEVERITY,
} = require('../utils/constructionCess');

// --- The rules --------------------------------------------------------------

const cessRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /**
     * The notified rate.
     *
     * Presently one per cent everywhere, and section 3(1) permits anywhere
     * between one and two — so this is a value that is currently constant and
     * is not a constant. The engine clamps an out-of-band figure rather than
     * trusting it, because a finding alone would not stop the number being used.
     */
    cessRatePercent: {
      type: Number,
      default: CESS_RULES.cessRatePercent,
      min: 0,
    },
    minRatePercent: {
      type: Number,
      default: CESS_RULES.minRatePercent,
      min: 0,
    },
    maxRatePercent: {
      type: Number,
      default: CESS_RULES.maxRatePercent,
      min: 0,
    },

    advanceDeductionPercent: {
      type: Number,
      default: CESS_RULES.advanceDeductionPercent,
      min: 0,
    },
    paymentWindowDays: {
      type: Number,
      default: CESS_RULES.paymentWindowDays,
      min: 1,
    },
    interestPercentPerMonth: {
      type: Number,
      default: CESS_RULES.interestPercentPerMonth,
      min: 0,
    },
    penaltyCeilingPercent: {
      type: Number,
      default: CESS_RULES.penaltyCeilingPercent,
      min: 0,
    },

    applicabilityWorkers: {
      type: Number,
      default: CESS_RULES.applicabilityWorkers,
      min: 1,
    },
    beneficiaryMinAge: {
      type: Number,
      default: CESS_RULES.beneficiaryMinAge,
      min: 0,
    },
    beneficiaryMaxAge: {
      type: Number,
      default: CESS_RULES.beneficiaryMaxAge,
      min: 0,
    },
    beneficiaryQualifyingDays: {
      type: Number,
      default: CESS_RULES.beneficiaryQualifyingDays,
      min: 1,
    },
    beneficiaryLookbackMonths: {
      type: Number,
      default: CESS_RULES.beneficiaryLookbackMonths,
      min: 1,
    },

    /** Section 7 of the BOCW Act — whether the establishment is registered. */
    registeredUnderSection7: { type: Boolean, default: false },
    section7RegistrationNumber: { type: String, default: '', trim: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

cessRulesSchema.index({ tenantId: 1, establishment: 1 }, { unique: true });

// --- The projects -----------------------------------------------------------

const exclusionSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: Object.values(EXCLUSION), required: true },
    amount: { type: Number, default: 0, min: 0 },
    /** Why it was excluded, for the order that asks. */
    note: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const constructionProjectSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    name: { type: String, required: true, trim: true },
    /** The Board the cess is remitted to, which is state-wise. */
    welfareBoardState: { type: String, default: '', trim: true },
    site: { type: String, default: '', trim: true },

    /**
     * The gross figure, before section 3's exclusions.
     *
     * Stored gross with the exclusions beside it rather than as a net base,
     * because the base is a conclusion and the two inputs are the facts — and
     * an assessment order argues about the inputs.
     */
    totalProjectCost: { type: Number, default: 0, min: 0 },
    exclusions: { type: [exclusionSchema], default: [] },

    startedOn: { type: Date },
    /** Rule 5 runs the payment window from here, or from the assessment. */
    completedOn: { type: Date },
    /** Section 5 — when the Board finalised the number. */
    assessedOn: { type: Date },
    assessmentOrderNumber: { type: String, default: '', trim: true },

    /** Remitted directly, as against deducted at source from a bill. */
    cessPaid: { type: Number, default: 0, min: 0 },

    buildingWorkers: { type: Number, default: 0, min: 0 },

    /** Cached from the last assessment, for the project list's status column. */
    status: {
      type: String,
      enum: Object.values(CESS_STATUS),
      default: CESS_STATUS.ADVANCE_ACCRUING,
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

constructionProjectSchema.index({
  tenantId: 1,
  establishment: 1,
  startedOn: -1,
});

// --- The bills --------------------------------------------------------------

const cessBillSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConstructionProject',
      required: true,
      index: true,
    },

    /** The vendor row this bill came from, where there is one. */
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    contractorName: { type: String, default: '', trim: true },

    billNumber: { type: String, default: '', trim: true },
    billedOn: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },

    /**
     * What was actually withheld under rule 4(1).
     *
     * Recorded rather than computed, so that a bill paid gross — which is the
     * failure the register exists to catch — is a shortfall rather than an
     * assumption that the deduction happened.
     */
    cessDeducted: { type: Number, default: 0, min: 0 },
    remittedOn: { type: Date },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

cessBillSchema.index({ tenantId: 1, projectId: 1, billedOn: -1 });

// --- The beneficiaries ------------------------------------------------------

const employerDaysSchema = new mongoose.Schema(
  {
    employer: { type: String, default: '', trim: true },
    days: { type: Number, default: 0, min: 0 },
    /**
     * Whether these days were worked here.
     *
     * The flag that keeps the register honest. Days recorded elsewhere are
     * taken on the worker's statement and cannot be verified from this
     * establishment's attendance — and the engine reports a worker whose days
     * are *all* from here as "nobody has asked" rather than as ineligible.
     */
    thisEstablishment: { type: Boolean, default: false },
    fromDate: { type: Date },
    toDate: { type: Date },
  },
  { _id: false },
);

const cessBeneficiarySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    name: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    trade: { type: String, default: '', trim: true },

    /**
     * Days per employer over the lookback.
     *
     * Not a total. Section 12 counts ninety days across every construction
     * employer, and a single number could not say whether it is the whole story
     * or this site's share of it.
     */
    daysByEmployer: { type: [employerDaysSchema], default: [] },

    registeredOn: { type: Date },
    boardRegistrationNumber: { type: String, default: '', trim: true },
    /** Registration lapses and has to be renewed. */
    renewalDueOn: { type: Date },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

cessBeneficiarySchema.index({ tenantId: 1, establishment: 1, name: 1 });

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConstructionProject',
    },
    projectName: { type: String, default: '' },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CessBeneficiary' },
    workerName: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const assessmentProjectSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConstructionProject',
    },
    name: { type: String, default: '' },

    totalProjectCost: { type: Number, default: 0 },
    excluded: { type: Number, default: 0 },
    base: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    assessed: { type: Number, default: 0 },

    advanceDeducted: { type: Number, default: 0 },
    cessPaid: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    interestMonths: { type: Number, default: 0 },
    /** Stored, and never added into `payable`. */
    penaltyCeiling: { type: Number, default: 0 },
    payable: { type: Number, default: 0 },

    status: { type: String, enum: Object.values(CESS_STATUS) },
    dueOn: { type: Date },
  },
  { _id: false },
);

const cessAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    /** A snapshot, not a reference. */
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },

    applicable: { type: Boolean, default: true },
    buildingWorkers: { type: Number, default: 0 },
    registered: { type: Boolean, default: false },

    projectCount: { type: Number, default: 0 },
    totalProjectCost: { type: Number, default: 0 },
    excluded: { type: Number, default: 0 },
    base: { type: Number, default: 0 },
    assessed: { type: Number, default: 0 },
    advanceDeducted: { type: Number, default: 0 },
    cessPaid: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    payable: { type: Number, default: 0 },
    penaltyCeiling: { type: Number, default: 0 },
    refundDue: { type: Number, default: 0 },

    beneficiaryCount: { type: Number, default: 0 },
    eligibleCount: { type: Number, default: 0 },
    registeredCount: { type: Number, default: 0 },
    /**
     * Beneficiaries who reached ninety days only by counting work elsewhere.
     *
     * Stored because it is the number that says whether the register is being
     * kept honestly: an establishment deriving eligibility from its own
     * attendance would report zero here and be wrong about every one of them.
     */
    qualifiedElsewhereCount: { type: Number, default: 0 },

    summary: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, enum: Object.values(FINDING) },
            section: { type: String, default: '' },
            severity: { type: String, enum: Object.values(SEVERITY) },
            count: { type: Number, default: 0 },
            subjectCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    findings: { type: [findingSchema], default: [] },
    projects: { type: [assessmentProjectSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

cessAssessmentSchema.index(
  { tenantId: 1, establishment: 1, periodStart: 1 },
  { unique: true },
);

const CessRules = mongoose.model('CessRules', cessRulesSchema);
const ConstructionProject = mongoose.model(
  'ConstructionProject',
  constructionProjectSchema,
);
const CessBill = mongoose.model('CessBill', cessBillSchema);
const CessBeneficiary = mongoose.model(
  'CessBeneficiary',
  cessBeneficiarySchema,
);
const CessAssessment = mongoose.model('CessAssessment', cessAssessmentSchema);

module.exports = {
  CessRules,
  ConstructionProject,
  CessBill,
  CessBeneficiary,
  CessAssessment,
};
