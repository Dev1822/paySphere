/**
 * Industrial Employment (Standing Orders) Act, 1946 — establishments, certified
 * sets and modifications (#2029).
 *
 * Three collections, and each exists because a field on an existing record
 * cannot hold the object.
 *
 * `StandingOrdersEstablishment` holds the **applicability**, and it holds a
 * headcount history rather than a strength. The six-month clock runs from the
 * day the establishment first employed the threshold number of workmen, and the
 * proviso to section 1(3) keeps it applicable afterwards however far strength
 * falls — so a schema carrying only the current number can neither date the
 * obligation nor keep it. `applicableFrom` is stored once and never recomputed
 * for that reason.
 *
 * `CertifiedStandingOrders` is a certified **set** with a life, not a
 * certificate with a date. Section 7 makes it operative thirty days after
 * authenticated copies are sent — seven, after an appeal — and both are dates of
 * dispatch by an authority rather than dates the employer picked. During that
 * gap the previous set governs, so more than one set has to be able to exist at
 * once and the superseded one cannot be deleted. `coveredMatters` is on the set
 * because a set silent on a Schedule matter leaves that matter on the Model
 * orders alone, which is a fact about the set and not about the establishment.
 *
 * `StandingOrdersModification` exists because section 10(1) bars a *unilateral*
 * modification, not a modification. The exception is an agreement with the
 * workmen or a representative body, and an agreement is a document — so the
 * record has a party and a reference on it, and a modification claiming
 * agreement without them is stored as what it is rather than as a clearance.
 *
 * The `standingOrdersCertified` boolean on `subsistenceAllowance.model.js`
 * (#1828) is the thing this replaces. It should read `instrumentForMatter(...,
 * 'SUSPENSION_AND_MISCONDUCT')` instead, and `noticeOfChange` (#1973) should
 * read the same function for `SHIFT_WORKING` — but neither migration is in this
 * change, because moving a consumer is a behaviour change and this is the record
 * they will move onto.
 */

const mongoose = require('mongoose');

const {
  SCHEDULE_MATTERS,
  ORDERS_STATE,
  INSTRUMENT,
  ONCE_APPLICABLE_ALWAYS_APPLICABLE,
  UNCERTIFIED_IS_NOT_UNREGULATED,
  MODIFICATION_BAR_IS_UNILATERAL,
  OPERATION_LAGS_CERTIFICATION,
} = require('../utils/standingOrders');

// --- The establishment ------------------------------------------------------

const standingOrdersEstablishmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The industrial establishment. Distinct from the legal entity. */
    establishment: { type: String, required: true, trim: true },

    /**
     * The sphere whose rules apply — a state code, or CENTRAL.
     *
     * Required and never derived. The threshold is 100 centrally and 50 in
     * several states, and an establishment near a border is under the Act it is
     * under. A wrong answer here tells an employer with 60 workmen that six
     * months have not been running against them.
     */
    state: { type: String, required: true, trim: true, uppercase: true },

    /**
     * Strength on dates, oldest first.
     *
     * A history rather than a number. The clock runs from the **first**
     * crossing, so a single current figure can date the obligation from today at
     * the earliest — turning six months that have been running since March into
     * six months starting now.
     */
    headcountHistory: [
      {
        on: { type: Date, required: true },
        workmen: { type: Number, required: true, min: 0 },
        /** Why the strength moved, where known. Never acted on. */
        note: { type: String, default: '', trim: true },
      },
    ],

    /**
     * The date the Act became applicable.
     *
     * Written once, from the first crossing, and deliberately **not** recomputed
     * on every headcount change. Recomputation is how an establishment drops out
     * of the Act by attrition, which the proviso to section 1(3) forbids.
     */
    applicableFrom: { type: Date, default: null },

    /** Five copies to the Certifying Officer under section 3(1). */
    draftSubmittedOn: { type: Date, default: null },
    certifyingOfficer: { type: String, default: '', trim: true },

    /** The last computed state, for querying. The engine remains authority. */
    lastKnownState: {
      type: String,
      enum: [...Object.values(ORDERS_STATE), null],
      default: null,
    },
    lastKnownInstrument: {
      type: String,
      enum: [...Object.values(INSTRUMENT), null],
      default: null,
    },

    /**
     * The two facts a reader of this row has to be told, as fields.
     *
     * The same reasoning as `lapseNote` on the establishment register in #1972:
     * whoever opens this record is deciding what to do, and both of these are
     * counter-intuitive enough that leaving them in a code comment puts them
     * where that person will never see them.
     */
    applicabilityNote: {
      type: String,
      default: ONCE_APPLICABLE_ALWAYS_APPLICABLE,
    },
    uncertifiedNote: { type: String, default: UNCERTIFIED_IS_NOT_UNREGULATED },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

standingOrdersEstablishmentSchema.index(
  { tenantId: 1, establishment: 1 },
  { unique: true },
);
// The sweep that matters: which establishments are inside an unexpired
// six-month submission window, and which have run past one.
standingOrdersEstablishmentSchema.index({ tenantId: 1, applicableFrom: 1 });

// --- The certified set ------------------------------------------------------

const certifiedStandingOrdersSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StandingOrdersEstablishment',
      required: true,
      index: true,
    },

    /** Increments per establishment. A superseded set is kept, never deleted. */
    revision: { type: Number, required: true, min: 1 },

    certifiedOn: { type: Date, default: null },

    /**
     * Section 5(3) — the date authenticated copies were **sent**.
     *
     * This is what section 7 runs from, and it is a date of dispatch by the
     * Certifying Officer. It is routinely later than `certifiedOn`, and using
     * `certifiedOn` in its place brings the orders into operation up to several
     * weeks early — during which the employer would be enforcing terms that do
     * not yet bind anybody.
     */
    authenticatedCopiesSentOn: { type: Date, default: null },

    /** Section 6. An appeal changes the section 7 lag from thirty days to seven. */
    appealPreferred: { type: Boolean, default: false },
    appellateAuthority: { type: String, default: '', trim: true },
    appellateDecisionSentOn: { type: Date, default: null },

    /**
     * The Schedule matters this set actually provides for.
     *
     * A set silent on a matter is not defective — the Model orders fill that
     * matter alone — so this is a list rather than a completeness flag, and the
     * gap is reportable per matter. Two consumers ask about one matter each.
     */
    coveredMatters: [
      {
        type: String,
        enum: Object.keys(SCHEDULE_MATTERS),
      },
    ],

    /** Where the certified copy lives. */
    documentRef: { type: String, default: '', trim: true },

    /**
     * Set once a later revision has come into operation.
     *
     * Held rather than inferred from `revision`, because the superseding set is
     * certified before it is operative and the previous one governs throughout
     * that gap — so "the highest revision" and "the set in force" are different
     * questions with different answers for thirty days at a time.
     */
    supersededOn: { type: Date, default: null },

    operationNote: { type: String, default: OPERATION_LAGS_CERTIFICATION },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

certifiedStandingOrdersSchema.index(
  { tenantId: 1, establishmentId: 1, revision: -1 },
  { unique: true },
);

// --- Modifications ----------------------------------------------------------

const standingOrdersModificationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StandingOrdersEstablishment',
      required: true,
      index: true,
    },
    /** The set being modified. Null where nothing is certified yet. */
    ordersId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CertifiedStandingOrders',
      default: null,
    },

    description: { type: String, required: true, trim: true },

    /** Which Schedule matters the modification touches. */
    matters: [
      {
        type: String,
        enum: Object.keys(SCHEDULE_MATTERS),
      },
    ],

    proposedOn: { type: Date, required: true },

    /**
     * The section 10(1) exception, as a document.
     *
     * Both fields or neither. An agreement is a memorandum of settlement, a
     * union letter, a signed minute — something with a reference — and a record
     * naming a party with nothing to point at is the state this collection
     * exists to stop being stored as a clearance.
     */
    agreement: {
      party: { type: String, default: '', trim: true },
      reference: { type: String, default: '', trim: true },
      agreedOn: { type: Date, default: null },
    },

    /** Section 10(2) — the application to the Certifying Officer. */
    applicationMadeOn: { type: Date, default: null },

    lastKnownVerdict: { type: String, default: null },

    modificationNote: { type: String, default: MODIFICATION_BAR_IS_UNILATERAL },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

standingOrdersModificationSchema.index({
  tenantId: 1,
  establishmentId: 1,
  proposedOn: -1,
});

const StandingOrdersEstablishment = mongoose.model(
  'StandingOrdersEstablishment',
  standingOrdersEstablishmentSchema,
);
const CertifiedStandingOrders = mongoose.model(
  'CertifiedStandingOrders',
  certifiedStandingOrdersSchema,
);
const StandingOrdersModification = mongoose.model(
  'StandingOrdersModification',
  standingOrdersModificationSchema,
);

module.exports = {
  StandingOrdersEstablishment,
  CertifiedStandingOrders,
  StandingOrdersModification,
};
