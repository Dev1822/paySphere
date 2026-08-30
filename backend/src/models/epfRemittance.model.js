/**
 * EPF belated remittance — the ledger behind section 7Q and 14B (#1875).
 *
 * Three collections, and the first exists because a remittance is not one
 * event.
 *
 * `EpfRemittanceMonth` holds what was due for a wage month and every payment
 * made against it, as a list rather than as a `remittedOn` field. A part
 * payment on the fifteenth and the balance four months later is one arrear with
 * two different delays, and the graded damages in paragraph 32A attach to each
 * separately — so a single date on the row cannot express the ordinary case,
 * let alone the awkward one.
 *
 * `EpfDamagesWaiver` is separate from the month because its subject is
 * different. A month answers what was owed and when it was paid; a waiver
 * answers whether the damages that follow are collectible, and it is decided by
 * the Board over a period covering many months at once. Keeping it on the month
 * would mean recording the same order a dozen times and letting the copies
 * disagree.
 *
 * `EpfRemittanceAssessment` snapshots a computed position with the rules it was
 * computed under. The interest rate and the four slabs have been amended before
 * — an assessment that cannot reproduce its own figure is not an assessment.
 *
 * The two liabilities are stored as two fields and there is no third field
 * adding them, for the same reason `utils/epfBelatedRemittance.js` returns no
 * such key: interest under section 7Q cannot be waived by anyone and damages
 * under 14B can be waived to nil, and a schema that offered their sum would
 * have it provided for in full by the first report that read it.
 */

const mongoose = require('mongoose');

const {
  EPF_REMITTANCE_RULES,
  COMPONENT,
  WAIVER_STATE,
  DUE_BASIS,
  FINDING,
  SEVERITY,
} = require('../utils/epfBelatedRemittance');

// --- The rules --------------------------------------------------------------

const damageSlabSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    /**
     * Exclusive, and null on the last band.
     *
     * Paragraph 32A reads "less than two months", "two months and above but
     * less than four", and so on, so a default of exactly two months belongs to
     * the second band. Storing the boundary as an upper bound rather than as a
     * range keeps that readable.
     */
    upToMonths: { type: Number, default: null, min: 0 },
    ratePercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const epfRemittanceRulesSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    /** The EPF code of the establishment, or blank for the tenant default. */
    establishment: { type: String, default: '', trim: true },

    dueDayOfNextMonth: {
      type: Number,
      default: EPF_REMITTANCE_RULES.dueDayOfNextMonth,
      min: 1,
      max: 28,
    },

    /**
     * Zero, and stored so that it can be seen to be zero.
     *
     * The five days that used to follow the fifteenth were withdrawn with
     * effect from January 2016 and are still applied in a great many internal
     * spreadsheets. An establishment that has been carrying them finds out here
     * rather than in a demand notice.
     */
    graceDays: {
      type: Number,
      default: EPF_REMITTANCE_RULES.graceDays,
      min: 0,
      max: 15,
    },

    interestRatePercent: {
      type: Number,
      default: EPF_REMITTANCE_RULES.interestRatePercent,
      min: 0,
    },

    damageSlabs: {
      type: [damageSlabSchema],
      default: () =>
        EPF_REMITTANCE_RULES.damageSlabs.map((slab) => ({ ...slab })),
    },

    damagesCapPercentOfArrears: {
      type: Number,
      default: EPF_REMITTANCE_RULES.damagesCapPercentOfArrears,
      min: 0,
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

epfRemittanceRulesSchema.index(
  { tenantId: 1, establishment: 1 },
  { unique: true },
);

// --- The month --------------------------------------------------------------

/**
 * One payment against one account.
 *
 * `reference` is the TRRN, which is the only thing that ties a row here to a
 * challan at the Regional Office. It is not required, because a reconstruction
 * from bank statements after the fact is a real and common way this ledger gets
 * populated, and refusing those rows would leave the ledger empty for exactly
 * the establishments that need it.
 */
const remittanceEventSchema = new mongoose.Schema(
  {
    component: {
      type: String,
      enum: Object.values(COMPONENT),
      required: true,
    },
    paidOn: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    reference: { type: String, default: '', trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: true },
);

const amountDueSchema = new mongoose.Schema(
  {
    component: {
      type: String,
      enum: Object.values(COMPONENT),
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const epfRemittanceMonthSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /** The month the wages relate to, not the month of remittance. */
    year: { type: Number, required: true, min: 1952 },
    month: { type: Number, required: true, min: 1, max: 12 },

    /**
     * How the amount due was established.
     *
     * `SECTION_7A` matters to the reader rather than to the arithmetic: a
     * liability determined by the Commissioner for a past period carries
     * interest and damages from its **original** due dates and not from the
     * date of the order, so the row looks exactly like an ordinary month and
     * has to say why it is not one.
     */
    basis: {
      type: String,
      enum: Object.values(DUE_BASIS),
      default: DUE_BASIS.ECR,
    },

    /** The section 7A order, where there is one. */
    determinationReference: { type: String, default: '', trim: true },
    determinedOn: { type: Date },

    /** Members in the ECR for the month. Reporting only. */
    memberCount: { type: Number, default: 0, min: 0 },

    amountsDue: { type: [amountDueSchema], default: [] },
    remittances: { type: [remittanceEventSchema], default: [] },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

epfRemittanceMonthSchema.index(
  { tenantId: 1, establishment: 1, year: 1, month: 1 },
  { unique: true },
);

/**
 * The dues as a plain object, in the shape the engine takes.
 *
 * @returns {Object<string, number>}
 */
epfRemittanceMonthSchema.methods.duesByComponent = function duesByComponent() {
  const dues = {};
  for (const row of this.amountsDue || []) {
    dues[row.component] = (dues[row.component] || 0) + row.amount;
  }
  return dues;
};

/**
 * The remittances grouped by account, in the shape the engine takes.
 *
 * @returns {Object<string, Array<{paidOn: Date, amount: number, reference: string}>>}
 */
epfRemittanceMonthSchema.methods.remittancesByComponent =
  function remittancesByComponent() {
    const grouped = {};
    for (const row of this.remittances || []) {
      if (!grouped[row.component]) grouped[row.component] = [];
      grouped[row.component].push({
        paidOn: row.paidOn,
        amount: row.amount,
        reference: row.reference,
      });
    }
    return grouped;
  };

// --- The waiver -------------------------------------------------------------

const epfDamagesWaiverSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /**
     * The period the order covers, inclusive at both ends.
     *
     * An order under paragraph 32B is made over a stretch of months rather than
     * against one, which is why this is a range rather than a field on the
     * month.
     */
    fromYear: { type: Number, required: true, min: 1952 },
    fromMonth: { type: Number, required: true, min: 1, max: 12 },
    toYear: { type: Number, required: true, min: 1952 },
    toMonth: { type: Number, required: true, min: 1, max: 12 },

    state: {
      type: String,
      enum: Object.values(WAIVER_STATE),
      default: WAIVER_STATE.NONE,
    },

    /** Only meaningful where the state is GRANTED_IN_PART. */
    waivedPercent: { type: Number, default: 0, min: 0, max: 100 },

    /**
     * Why the Board was asked.
     *
     * Paragraph 32B is available to an establishment declared sick and in
     * respect of which a scheme for rehabilitation has been sanctioned, so the
     * ground is a matter of record and not a note.
     */
    ground: { type: String, default: '', trim: true, maxlength: 2000 },

    orderReference: { type: String, default: '', trim: true },
    appliedOn: { type: Date },
    decidedOn: { type: Date },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

epfDamagesWaiverSchema.index({ tenantId: 1, establishment: 1, fromYear: 1 });

// --- The assessment ---------------------------------------------------------

const findingSchema = new mongoose.Schema(
  {
    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    wageMonth: { type: String, default: '' },
    component: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const epfRemittanceAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /** The date the position was measured as at. Open defaults run to it. */
    asAt: { type: Date, required: true },

    periodFrom: { type: String, default: '' },
    periodTo: { type: String, default: '' },

    /**
     * The rules the figures were computed under.
     *
     * Snapshotted rather than referenced. The twelve per cent and the four
     * slabs have been amended before, and an assessment that reproduces a
     * different number when reopened next year is worse than no assessment.
     */
    rulesSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    /** Section 7Q. Mandatory, and no authority under the Act can waive it. */
    interestUnderSection7Q: { type: Number, default: 0, min: 0 },

    /** Section 14B under the paragraph 32A slabs, before any waiver. */
    damagesAssessedUnderSection14B: { type: Number, default: 0, min: 0 },

    /** Section 14B after a waiver that has actually been granted. */
    damagesPayableUnderSection14B: { type: Number, default: 0, min: 0 },

    /**
     * The part of the payable damages behind a pending application.
     * Already inside `damagesPayableUnderSection14B`; disclosable separately.
     */
    damagesContingentOnWaiver: { type: Number, default: 0, min: 0 },

    /** The contributions themselves, paid late or not yet paid. */
    arrears: { type: Number, default: 0, min: 0 },

    /**
     * The member's twelve per cent deducted from wages and not remitted.
     *
     * Its own field at the top level, never netted, and never removed by a
     * waiver. It was not the employer's money before it was late.
     */
    heldInTrust: { type: Number, default: 0, min: 0 },

    findings: { type: [findingSchema], default: [] },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// No virtual, no method and no field summing the two liabilities above. See the
// header, and `utils/epfBelatedRemittance.js`.

epfRemittanceAssessmentSchema.index({
  tenantId: 1,
  establishment: 1,
  asAt: -1,
});

const EpfRemittanceRules = mongoose.model(
  'EpfRemittanceRules',
  epfRemittanceRulesSchema,
);
const EpfRemittanceMonth = mongoose.model(
  'EpfRemittanceMonth',
  epfRemittanceMonthSchema,
);
const EpfDamagesWaiver = mongoose.model(
  'EpfDamagesWaiver',
  epfDamagesWaiverSchema,
);
const EpfRemittanceAssessment = mongoose.model(
  'EpfRemittanceAssessment',
  epfRemittanceAssessmentSchema,
);

module.exports = {
  EpfRemittanceRules,
  EpfRemittanceMonth,
  EpfDamagesWaiver,
  EpfRemittanceAssessment,
};
