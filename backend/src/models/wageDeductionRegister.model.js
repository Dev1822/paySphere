/**
 * Payment of Wages Act, 1936 (#1767).
 *
 * Three collections, and the third is the one that does the work.
 *
 * `WageDeductionRules` holds the establishment's figures. A document rather than
 * constants because two of them move: the section 1(6) applicability ceiling has
 * been revised four times by notification and the approved list of acts under
 * section 8(1) is per-establishment by definition — the Act requires it to be
 * approved by the prescribed authority and displayed at the workplace, so no
 * default can be right for anybody.
 *
 * `WageDeductionRegister` is the register section 13A requires, one per wage
 * period. It stores the assessment rather than recomputing it, and stores the
 * rules it ran under, because both inputs move: `payroll.deductions` is edited
 * and the rules are revised, and a register that could not reproduce what was
 * known when it was made would not be the evidence section 13A is asking for.
 *
 * `DeferredDeduction` is the abatement's memory. When the section 7(3) ceiling
 * forces a loan instalment to give way, the instalment is still owed — the
 * employer deferred it, it did not waive it — and something has to carry the
 * balance to the next period. Without this the abatement would be
 * indistinguishable from a write-off, and the difference is the whole reason
 * the ceiling is survivable.
 */

const mongoose = require('mongoose');

const {
  PAYMENT_OF_WAGES_LIMITS,
  DEDUCTION_KIND,
  FINDING,
  SEVERITY,
} = require('../utils/paymentOfWages');

// --- The establishment's rules ---------------------------------------------

const wageDeductionRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The site these rules apply to. Empty is the tenant-wide default. */
    establishment: { type: String, default: '', trim: true },

    maxDeductionPercent: {
      type: Number,
      default: PAYMENT_OF_WAGES_LIMITS.maxDeductionPercent,
      min: 0,
      max: 100,
    },
    maxDeductionPercentWithCoOperative: {
      type: Number,
      default: PAYMENT_OF_WAGES_LIMITS.maxDeductionPercentWithCoOperative,
      min: 0,
      max: 100,
    },
    maxFinePercent: {
      type: Number,
      default: PAYMENT_OF_WAGES_LIMITS.maxFinePercent,
      min: 0,
      max: 100,
    },
    fineRecoveryWindowDays: {
      type: Number,
      default: PAYMENT_OF_WAGES_LIMITS.fineRecoveryWindowDays,
      min: 1,
    },
    applicabilityWageCeiling: {
      type: Number,
      default: PAYMENT_OF_WAGES_LIMITS.applicabilityWageCeiling,
      min: 0,
    },

    /**
     * Section 5(1) — which of the two deadlines applies.
     *
     * Stored rather than counted from the employee collection because the Act
     * asks how many persons are *employed in* the establishment, which includes
     * contract labour the payroll does not carry, and because the threshold is
     * a thousand — a tenant near it should not have its deadline move because
     * somebody resigned.
     */
    employedHeadcount: { type: Number, default: 0, min: 0 },

    /**
     * Section 8(1) — the acts and omissions for which a fine may be imposed.
     *
     * Empty means "not recorded", not "nothing is approved". The engine reads
     * it that way and skips the check, because a fresh tenant with an empty
     * list would otherwise have every fine in its history reported as unlawful.
     */
    approvedActs: { type: [String], default: [] },

    /** Section 8(8) — where the realisations go. */
    finePurpose: { type: String, default: '', trim: true },

    /** 0 = Sunday. Used for the section 5(4) working-day count. */
    weeklyOffDays: { type: [Number], default: [0] },

    /** ISO dates the establishment is closed, for the same count. */
    holidays: { type: [String], default: [] },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

wageDeductionRulesSchema.index(
  { tenantId: 1, establishment: 1 },
  { unique: true },
);

// --- The register -----------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, default: '' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },

    /**
     * Whatever numbers the finding carried.
     *
     * Mixed rather than a fixed shape because the sixteen finding codes carry
     * genuinely different figures — a ceiling breach carries a total and a
     * ceiling, a time-barred fine carries the age of the act in days — and
     * sixteen optional numeric fields would be a worse record of that than one
     * honest bag.
     */
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const registerDeductionSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    kind: { type: String, enum: Object.values(DEDUCTION_KIND), required: true },
    clause: { type: String, default: '' },

    /** What the deduction engine asked for. */
    amount: { type: Number, default: 0 },
    /** What survived the ceiling. */
    payable: { type: Number, default: 0 },
    /** And what was deferred. */
    carryForward: { type: Number, default: 0 },
  },
  { _id: false },
);

const registerEmployeeSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },

    /** Section 1(6). False means the Act does not reach this employee. */
    covered: { type: Boolean, default: true },

    grossWages: { type: Number, default: 0 },
    /** Gross less the section 9 absence deduction — the section 7(3) base. */
    earnedWages: { type: Number, default: 0 },
    netWages: { type: Number, default: 0 },

    deductions: { type: [registerDeductionSchema], default: [] },

    totalDeducted: { type: Number, default: 0 },
    /** What the engines asked for before the ceiling was applied. */
    totalAttempted: { type: Number, default: 0 },
    ceilingAmount: { type: Number, default: 0 },
    ceilingPercent: { type: Number, default: 0 },
    /** Whether the section 7(3) proviso raised it, and why. */
    ceilingRaised: { type: Boolean, default: false },
    deductionPercent: { type: Number, default: 0 },

    abated: { type: Number, default: 0 },
    carryForward: { type: Number, default: 0 },

    finesRecoverable: { type: Number, default: 0 },
    finesDisallowed: { type: Number, default: 0 },

    dueOn: { type: Date },
    daysLate: { type: Number, default: 0 },
  },
  { _id: false },
);

const wageDeductionRegisterSchema = new mongoose.Schema(
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
    paidOn: { type: Date },

    /**
     * The rules the register ran under.
     *
     * A snapshot, not a reference. Raising the applicability ceiling brings
     * employees into the Act and makes findings appear; lowering it makes them
     * vanish. A register that pointed at the live rules would silently change
     * what it said about a closed period.
     */
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },

    employeeCount: { type: Number, default: 0 },
    coveredCount: { type: Number, default: 0 },
    breachCount: { type: Number, default: 0 },

    totalWages: { type: Number, default: 0 },
    totalDeducted: { type: Number, default: 0 },
    totalAbated: { type: Number, default: 0 },
    totalCarryForward: { type: Number, default: 0 },

    /** Section 8(8) — the realisations, and what they were applied to. */
    totalFinesRealised: { type: Number, default: 0 },
    finePurpose: { type: String, default: '' },

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
    employees: { type: [registerEmployeeSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One register per establishment per wage period. Re-running June corrects June
// rather than producing a second June.
wageDeductionRegisterSchema.index(
  { tenantId: 1, establishment: 1, periodStart: 1 },
  { unique: true },
);

// --- The abatement's memory -------------------------------------------------

const deferredDeductionSchema = new mongoose.Schema(
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

    label: { type: String, default: '' },
    kind: { type: String, enum: Object.values(DEDUCTION_KIND), required: true },

    /** The period the ceiling pushed it out of. */
    deferredFromPeriodStart: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },

    /** How much of it has since been recovered. */
    recovered: { type: Number, default: 0, min: 0 },

    /**
     * A deferred amount that is never recovered.
     *
     * Reachable, and it needs a reason recorded. An employee who leaves owing a
     * deferred loan instalment is a write-off, and an employee whose deductions
     * stay above the ceiling every month until they leave is the same write-off
     * arrived at slowly. Neither should look like a balance still outstanding.
     */
    status: {
      type: String,
      enum: ['outstanding', 'recovered', 'written_off'],
      default: 'outstanding',
      index: true,
    },
    writeOffReason: { type: String, default: '' },
  },
  { timestamps: true },
);

deferredDeductionSchema.index({
  tenantId: 1,
  employeeId: 1,
  status: 1,
});

const WageDeductionRules = mongoose.model(
  'WageDeductionRules',
  wageDeductionRulesSchema,
);

const WageDeductionRegister = mongoose.model(
  'WageDeductionRegister',
  wageDeductionRegisterSchema,
);

const DeferredDeduction = mongoose.model(
  'DeferredDeduction',
  deferredDeductionSchema,
);

module.exports = {
  WageDeductionRules,
  WageDeductionRegister,
  DeferredDeduction,
};
