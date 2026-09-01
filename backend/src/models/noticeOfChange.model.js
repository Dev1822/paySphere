/**
 * Section 9A notice of change — proposed changes, determinations and notices
 * (#1973).
 *
 * Three collections, and the reason for each is that the module making the
 * change cannot hold the object.
 *
 * `ProposedChange` is a change **observed**, not a change owned. A salary
 * revision lives in `salaryRevision.utils.js`, a roster change in the roster,
 * a contribution change in benefits. None of them can hold the Fourth Schedule
 * item, the notice date or the section 33 position, and adding those fields to
 * each of them would put five copies of the same twenty-one-day rule in five
 * modules that will drift. So the change is recorded here by reference —
 * `effectedBy` and `sourceRef` say where it actually happened — and this row
 * owns only the section 9A position.
 *
 * `WorkmanDetermination` is a determination **per person per change**, not a
 * flag on the employee. Section 2(s) turns on capacity and, for supervisors, on
 * wages — so the same person can be a workman for a change in March and not for
 * one in September, and a boolean on the employee record cannot say which. It
 * also has to be frozen: a determination made when the notice was served is what
 * the notice was served on, and recomputing it later from today's wages would
 * quietly rewrite the population a served notice covered.
 *
 * `ChangeNotice` is the notice itself, and it exists separately from the change
 * because a change can be noticed more than once. An effective date moved after
 * a short notice needs a fresh notice, the old one still happened, and the
 * question an inspector asks is which notice covered which date.
 */

const mongoose = require('mongoose');

const {
  FOURTH_SCHEDULE,
  CHANGE_VERDICT,
  EXEMPTION_GROUND,
  WORKMAN_GROUND,
  FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
  PENDING_PROCEEDING_IS_SECTION_33,
  NOTICE_DOES_NOT_INVALIDATE,
} = require('../utils/noticeOfChange');

// --- Proposed change --------------------------------------------------------

const proposedChangeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The industrial establishment the change is in. */
    establishment: { type: String, required: true, trim: true },

    description: { type: String, required: true, trim: true },

    /**
     * The module that effects the change, and its record there.
     *
     * Both are free text on purpose. This module observes and does not own, so
     * a hard reference would make it a dependency of every module it watches and
     * would break the moment one of them changed its collection name.
     */
    effectedBy: { type: String, required: true, trim: true },
    sourceRef: { type: String, default: '', trim: true },

    /**
     * The Fourth Schedule item, where somebody has determined one.
     *
     * Nullable, and null means undetermined rather than exempt. A change nobody
     * has classified is a question — see `verdict` below, which never records
     * EXEMPT for an unclassified change.
     */
    scheduleItem: {
      type: String,
      enum: [...Object.keys(FOURTH_SCHEDULE), null],
      default: null,
    },

    /**
     * The qualifiers inside the Schedule itself.
     *
     * These are not exemptions. Items 6 and 9 reach a change made "otherwise
     * than in accordance with standing orders", and item 11 excludes casual
     * fluctuation — a change outside the item never required notice at all, and
     * recording that as an exemption would put it in the wrong queue.
     */
    inAccordanceWithStandingOrders: { type: Boolean, default: false },
    casualFluctuation: { type: Boolean, default: false },

    /**
     * Whether the change improves the workmen's position.
     *
     * Recorded and never acted on. Section 9A is procedural, and the field is
     * here so that a screen can show a favourable change sitting in the notice
     * queue — which is the fact users disbelieve — rather than so the engine can
     * branch on it.
     */
    direction: {
      type: String,
      enum: ['INCREASE', 'DECREASE', 'NEUTRAL', 'MIXED'],
      default: 'NEUTRAL',
    },

    /**
     * The date the change is proposed to take effect.
     *
     * The twenty-one days run backwards from this, so it is required. A change
     * with no effective date has no window, and the engine reports it as
     * undetermined rather than guessing one.
     */
    effectiveOn: { type: Date, required: true },

    /** Moved effective dates, kept rather than overwritten. */
    effectiveDateHistory: [
      {
        from: { type: Date },
        to: { type: Date },
        movedOn: { type: Date, default: Date.now },
        reason: { type: String, default: '', trim: true },
      },
    ],

    /** Section 33 — a proceeding pending in respect of this establishment. */
    proceeding: {
      pending: { type: Boolean, default: false },
      forum: { type: String, default: '', trim: true },
      reference: { type: String, default: '', trim: true },
      /**
       * The express permission under section 33, where obtained.
       *
       * A string reference rather than a boolean. "Permission granted" with
       * nothing to point at is the state this whole module exists to stop being
       * recorded, and section 33 permission is an order with a number on it.
       */
      expressPermissionReference: { type: String, default: '', trim: true },
    },

    /** Section 9B, a settlement or award, or government service rules. */
    exemption: {
      ground: {
        type: String,
        enum: [...Object.values(EXEMPTION_GROUND), null],
        default: null,
      },
      /** The notification number, settlement reference or rules relied on. */
      authority: { type: String, default: '', trim: true },
      /** A section 9B exemption is for a stated period. */
      expiresOn: { type: Date, default: null },
    },

    /** The last computed verdict, for querying. The engine remains authority. */
    lastKnownVerdict: {
      type: String,
      enum: Object.values(CHANGE_VERDICT),
      default: CHANGE_VERDICT.UNDETERMINED,
    },

    /**
     * The two things a reader of this row after the fact needs told.
     *
     * Fields rather than comments, for the same reason `lapseNote` is a field on
     * the establishment register: the person reading the record is deciding what
     * to do, and the counter-intuitive rule is the one that has to be in front of
     * them.
     */
    favourableNote: {
      type: String,
      default: FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
    },
    invalidityNote: { type: String, default: NOTICE_DOES_NOT_INVALIDATE },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// The queue query: everything in this establishment ordered by when it bites.
proposedChangeSchema.index({ tenantId: 1, establishment: 1, effectiveOn: 1 });
// The scheduled sweep: what is inside its notice window right now.
proposedChangeSchema.index({
  tenantId: 1,
  lastKnownVerdict: 1,
  effectiveOn: 1,
});

proposedChangeSchema.statics.SECTION_33_NOTE = PENDING_PROCEEDING_IS_SECTION_33;

// --- Workman determination --------------------------------------------------

const workmanDeterminationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    changeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProposedChange',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    /**
     * The capacity and the wages **as they were when the determination was
     * made**, copied rather than referenced.
     *
     * A supervisor on ₹9,800 is a workman; the same supervisor after a raise is
     * not. Reading the employee record at report time would move people in and
     * out of a population a notice was already served on, and the notice does
     * not change because somebody got a raise afterwards.
     */
    capacity: { type: String, required: true, trim: true },
    monthlyWages: { type: Number, default: null },

    isWorkman: { type: Boolean, required: true },
    ground: {
      type: String,
      enum: Object.values(WORKMAN_GROUND),
      required: true,
    },
    /** Why, in words, including for the affirmative case. */
    reason: { type: String, default: '', trim: true },

    determinedOn: { type: Date, default: Date.now },
    determinedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

workmanDeterminationSchema.index(
  { tenantId: 1, changeId: 1, employeeId: 1 },
  { unique: true },
);

// --- The notice -------------------------------------------------------------

const changeNoticeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    changeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProposedChange',
      required: true,
      index: true,
    },

    /** The prescribed form. Central default is Form E; rules differ. */
    form: { type: String, default: 'Form E', trim: true },

    /**
     * When the notice was served on the workmen.
     *
     * Not when it was drafted, approved or dated. The twenty-one days run from
     * service, and the gap between a notice dated the 1st and served on the 9th
     * is eight days of the period the employer does not have.
     */
    servedOn: { type: Date, required: true },

    /**
     * The effective date this notice was served against.
     *
     * Copied onto the notice rather than read from the change, because moving
     * the effective date afterwards is exactly what happens when a notice comes
     * up short — and the question is which notice covered which date.
     */
    effectiveDateNoticed: { type: Date, required: true },

    /** The item stated on the notice. A Form E stating no item is not a notice. */
    scheduleItems: [{ type: Number }],

    /** How many workmen it was served on, and how. */
    workmenServed: { type: Number, default: 0 },
    manner: {
      type: String,
      enum: ['NOTICE_BOARD', 'INDIVIDUAL', 'UNION', 'MIXED'],
      default: 'NOTICE_BOARD',
    },

    /** Where the served copy lives. */
    documentRef: { type: String, default: '', trim: true },

    servedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

changeNoticeSchema.index({ tenantId: 1, changeId: 1, servedOn: -1 });

const ProposedChange = mongoose.model('ProposedChange', proposedChangeSchema);
const WorkmanDetermination = mongoose.model(
  'WorkmanDetermination',
  workmanDeterminationSchema,
);
const ChangeNotice = mongoose.model('ChangeNotice', changeNoticeSchema);

module.exports = {
  ProposedChange,
  WorkmanDetermination,
  ChangeNotice,
};
