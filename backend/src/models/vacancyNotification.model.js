/**
 * Employment Exchanges (CNV) Act, 1959 — notifications and returns (#1879).
 *
 * Four collections, and the reason for each is that the recruitment pipeline
 * cannot answer the question.
 *
 * `EstablishmentHeadcount` is a dated series rather than a current figure. The
 * twenty-five-person threshold is evaluated **as at the date a requisition
 * opened**, because an establishment crosses it during a year and the
 * obligation starts then — not retrospectively and not from the next audit.
 * Storing one current number would make every historical requisition
 * unanswerable.
 *
 * `VacancyNotifiability` is a determination against a requisition, with its
 * section 3 ground. Not a filter and not a flag: promotions, absorption of
 * surplus staff and engagements under three months are a large share of real
 * requisitions, and a queue that showed all of them would train people to clear
 * it without reading. A ground later contradicted by the facts stays on the
 * record, because that contradiction is what an inspection asks about.
 *
 * `ExchangeNotification` records what went to which exchange and when. The
 * fifteen-day window runs backwards from the intended fill date, so the
 * notification's own date is the thing the whole obligation turns on.
 *
 * `EmploymentExchangeReturn` covers ER-I and ER-II. It is keyed on the
 * reference date rather than on a requisition, because ER-I is a return about
 * the establishment's **employment** and is owed for a quarter in which no
 * vacancy arose at all.
 */

const mongoose = require('mongoose');

const {
  CNV_RULES,
  SECTOR,
  NOTIFIABILITY,
  EXCLUSION,
  RETURN_KIND,
  NO_OBLIGATION_TO_RECRUIT,
} = require('../utils/vacancyNotification');

// --- Headcount --------------------------------------------------------------

const establishmentHeadcountSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    sector: {
      type: String,
      enum: Object.values(SECTOR),
      default: SECTOR.PRIVATE,
    },

    /**
     * The date the count was taken. Part of the identity of the row.
     *
     * A single current figure cannot answer whether the Act reached a
     * requisition opened last February, and answering it with today's number
     * either invents an obligation or excuses one.
     */
    asOn: { type: Date, required: true },
    headcount: { type: Number, required: true, min: 0 },

    /** How the count was arrived at. Section 2(f) counts persons employed. */
    basis: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

establishmentHeadcountSchema.index(
  { tenantId: 1, establishment: 1, asOn: 1 },
  { unique: true },
);

// --- Determination ----------------------------------------------------------

const vacancyNotifiabilitySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /**
     * The requisition this is about.
     *
     * A loose reference rather than a populated one: requisitions live in the
     * recruitment pipeline and this module writes nothing back to them. It reads
     * a category, an intended fill date and an expected duration, and owns
     * nothing about candidates.
     */
    requisitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Requisition',
      required: true,
    },
    title: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },

    openedOn: { type: Date, required: true },

    /**
     * The date the vacancy is intended to be filled.
     *
     * The fifteen-day window runs backwards from here, which is why this is
     * required rather than optional: without it the obligation has no deadline
     * and the module can only report a default after the fact.
     */
    intendedFillDate: { type: Date, required: true },

    /** As expected at the time. The exclusion under three months turns on it. */
    durationMonths: { type: Number, default: null, min: 0 },
    /** As it turned out. A ground contradicted by this is its own finding. */
    actualDurationMonths: { type: Number, default: null, min: 0 },

    status: {
      type: String,
      enum: Object.values(NOTIFIABILITY),
      default: NOTIFIABILITY.UNDETERMINED,
    },

    /**
     * The section 3 or Rule 4 ground, where the vacancy is excluded.
     *
     * Stored rather than computed away. A requisition determined to be "less
     * than three months' duration" and then run for a year is exactly the
     * record an inspection is looking for, and the ground has to survive being
     * contradicted.
     */
    exclusionGround: {
      type: String,
      enum: [...Object.values(EXCLUSION), null],
      default: null,
    },
    exclusionNote: { type: String, default: '', trim: true, maxlength: 2000 },

    determinedOn: { type: Date },
    determinedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /**
     * Whether a retrenched workman in this category has a section 25H
     * preference (#1830).
     *
     * Recorded here rather than looked up so that the two obligations can be
     * shown against the same vacancy without either implying the other has been
     * dealt with. They are owed to different parties and satisfying one
     * discharges neither.
     */
    retrenchedPreferenceInCategory: { type: Boolean, default: false },

    filledOn: { type: Date },
  },
  { timestamps: true },
);

vacancyNotifiabilitySchema.index(
  { tenantId: 1, requisitionId: 1 },
  { unique: true },
);

// --- Notification -----------------------------------------------------------

const exchangeNotificationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    requisitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Requisition',
      required: true,
    },

    /** The prescribed exchange, which is notified at state level. */
    exchange: { type: String, required: true, trim: true },

    /** The date the notification reached the exchange. */
    notifiedOn: { type: Date, required: true },
    reference: { type: String, default: '', trim: true },

    vacancyCount: { type: Number, default: 1, min: 1 },

    /**
     * Section 5, stored on the record and rendered wherever it is shown.
     *
     * A default rather than a caller-supplied string: an employer that reads a
     * compliance record as "you must hire through the exchange" either stops
     * notifying or holds a role open for nothing, and the record itself is what
     * has to say otherwise.
     */
    noObligationToRecruit: {
      type: String,
      default: NO_OBLIGATION_TO_RECRUIT,
    },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

exchangeNotificationSchema.index({
  tenantId: 1,
  requisitionId: 1,
  notifiedOn: 1,
});

// --- Returns ----------------------------------------------------------------

const occupationalRowSchema = new mongoose.Schema(
  {
    occupation: { type: String, required: true, trim: true },
    men: { type: Number, default: 0, min: 0 },
    women: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const employmentExchangeReturnSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    kind: {
      type: String,
      enum: Object.values(RETURN_KIND),
      required: true,
    },

    /**
     * The prescribed reference date — the last day of the quarter for ER-I.
     *
     * The return is keyed on this rather than on any requisition, because ER-I
     * is about the establishment's employment and is owed for a quarter in
     * which no vacancy arose at all.
     */
    asOn: { type: Date, required: true },
    dueOn: { type: Date, required: true },

    /** Employment as on the reference date. */
    headcount: { type: Number, default: 0, min: 0 },
    vacanciesNotified: { type: Number, default: 0, min: 0 },

    /** ER-II only. The occupational breakdown. */
    occupational: { type: [occupationalRowSchema], default: [] },

    filedOn: { type: Date },
    acknowledgement: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

employmentExchangeReturnSchema.index(
  { tenantId: 1, establishment: 1, kind: 1, asOn: 1 },
  { unique: true },
);

/**
 * The threshold and the window, exposed so a report or a validator can assert
 * against them without importing the engine.
 */
employmentExchangeReturnSchema.statics.PRE_FILL_NOTICE_DAYS =
  CNV_RULES.preFillNoticeDays;
establishmentHeadcountSchema.statics.PRIVATE_SECTOR_THRESHOLD =
  CNV_RULES.privateSectorThreshold;

const EstablishmentHeadcount = mongoose.model(
  'EstablishmentHeadcount',
  establishmentHeadcountSchema,
);
const VacancyNotifiability = mongoose.model(
  'VacancyNotifiability',
  vacancyNotifiabilitySchema,
);
const ExchangeNotification = mongoose.model(
  'ExchangeNotification',
  exchangeNotificationSchema,
);
const EmploymentExchangeReturn = mongoose.model(
  'EmploymentExchangeReturn',
  employmentExchangeReturnSchema,
);

module.exports = {
  EstablishmentHeadcount,
  VacancyNotifiability,
  ExchangeNotification,
  EmploymentExchangeReturn,
};
