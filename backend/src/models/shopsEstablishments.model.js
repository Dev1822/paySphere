/**
 * Shops and Commercial Establishments Acts — registrations, particulars and
 * closure (#1972).
 *
 * Three collections, and the reason for each is that the entity register cannot
 * hold the object.
 *
 * `EstablishmentRegistration` is a certificate with a **lifecycle**, not a
 * document with an expiry field. `documentVault.routes.js` will store the
 * scanned certificate and can even remind on a date. What it will not do is know
 * that the state's renewal cycle is five years rather than one, that thirty days
 * have run since the establishment commenced, or that a certificate which has
 * expired means the establishment is trading unregistered rather than filing a
 * renewal late. `commencedOn` is required separately from `registeredOn`,
 * because the registration window runs from the first and an establishment that
 * never registered has no second.
 *
 * `CertificateParticular` is a particular **as it appears on the certificate**,
 * with the date the establishment's own value diverged from it. Two values and a
 * date, rather than one current value: the fifteen-day clock runs from when the
 * particular changed, and a schema holding only the current value can only date
 * the obligation from when somebody noticed. The headcount band is the one that
 * matters — it sits on the certificate, `employee.controller.js` changes it with
 * an ordinary hire, and nothing connects the two.
 *
 * `EstablishmentClosure` exists because closure is an obligation rather than the
 * absence of one. An employer who simply stops filing stays on the register,
 * stays inspectable and keeps accruing, and only a row with an intimation date
 * on it can say the establishment left deliberately.
 */

const mongoose = require('mongoose');

const {
  PARTICULAR,
  REGISTRATION_STATE,
  LAPSED_IS_OPERATING_UNREGISTERED,
  WEEKLY_HOLIDAY_IS_TWO_TESTS,
} = require('../utils/shopsEstablishments');

// --- Registration -----------------------------------------------------------

const establishmentRegistrationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The establishment this is about. Distinct from the legal entity. */
    establishment: { type: String, required: true, trim: true },

    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },

    /**
     * The state whose Act applies. Everything else follows from it.
     *
     * Required rather than derived from the address, because an establishment
     * near a border is registered where it is registered and the address is not
     * the answer.
     */
    state: { type: String, required: true, trim: true, uppercase: true },

    /**
     * When the establishment commenced work.
     *
     * Required, and separate from `registeredOn`. The registration window runs
     * from this date, and an establishment that never registered has no
     * `registeredOn` at all — which is exactly the case a schema keyed on the
     * certificate could not represent.
     */
    commencedOn: { type: Date, required: true },

    registeredOn: { type: Date, default: null },
    certificateNumber: { type: String, default: '', trim: true },

    /**
     * The expiry as it appears on the certificate.
     *
     * Held rather than always derived, because a state's cycle changes and a
     * certificate issued under the old one runs to the date printed on it. The
     * engine derives from the cycle only where this is absent.
     */
    validTo: { type: Date, default: null },

    /**
     * The day of the week the establishment is notified as closed.
     *
     * 0 is Sunday. Nullable because an establishment that trades seven days is a
     * real answer, and it still owes each employee a whole day — the two are
     * separate tests.
     */
    closingDay: { type: Number, default: null, min: 0, max: 6 },

    /**
     * Whether the Factories Act also reaches this establishment.
     *
     * Recorded rather than inferred, and never reconciled. Where both apply they
     * are separate obligations under separate Acts, and #1702 keeps the second.
     */
    alsoCoveredByFactoriesAct: { type: Boolean, default: false },

    /** The last computed state, for querying. The engine remains the authority. */
    lastKnownState: {
      type: String,
      enum: Object.values(REGISTRATION_STATE),
      default: REGISTRATION_STATE.WITHIN_WINDOW,
    },

    /**
     * The distinction the register refuses to collapse, stored on the row.
     *
     * A default field rather than a comment, because the person who reads this
     * record after an expiry is deciding whether it is a renewal task or a
     * cease-trading problem.
     */
    lapseNote: { type: String, default: LAPSED_IS_OPERATING_UNREGISTERED },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

establishmentRegistrationSchema.index(
  { tenantId: 1, establishment: 1 },
  { unique: true },
);
// The query that matters runs on a schedule: which certificates expire soon.
establishmentRegistrationSchema.index({ tenantId: 1, validTo: 1 });

// --- Particulars ------------------------------------------------------------

const certificateParticularSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EstablishmentRegistration',
      required: true,
      index: true,
    },

    particular: {
      type: String,
      enum: Object.values(PARTICULAR),
      required: true,
    },

    /**
     * The value printed on the certificate.
     *
     * The comparison is against this and not against a previous row, because the
     * obligation is to make the certificate match — an amendment that was
     * applied for and refused leaves the certificate where it was.
     */
    onCertificate: { type: String, default: '', trim: true },

    /** The establishment's actual current value. */
    current: { type: String, default: '', trim: true },

    /**
     * When the establishment's value diverged.
     *
     * The field the whole clock runs from. Nullable, and an undated divergence
     * is reported as undated rather than given a fresh fifteen days — dating it
     * from today would turn a change made in March into a deadline in June.
     */
    changedOn: { type: Date, default: null },

    /** When the amendment was actually notified, where it was. */
    notifiedOn: { type: Date, default: null },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

certificateParticularSchema.index(
  { tenantId: 1, registrationId: 1, particular: 1 },
  { unique: true },
);

// --- Closure ----------------------------------------------------------------

const establishmentClosureSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EstablishmentRegistration',
      required: true,
      unique: true,
    },

    closedOn: { type: Date, required: true },

    /**
     * When the Inspector was told and the certificate surrendered.
     *
     * Two fields rather than one boolean, because the intimation and the
     * surrender are separate acts with the same deadline and an establishment
     * commonly does the first and forgets the second.
     */
    intimatedOn: { type: Date, default: null },
    surrenderedOn: { type: Date, default: null },

    reason: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

/**
 * The two sentences a report or a validator most often needs, exposed so it
 * does not have to import the engine.
 */
establishmentRegistrationSchema.statics.LAPSED_IS_OPERATING_UNREGISTERED =
  LAPSED_IS_OPERATING_UNREGISTERED;
establishmentRegistrationSchema.statics.WEEKLY_HOLIDAY_IS_TWO_TESTS =
  WEEKLY_HOLIDAY_IS_TWO_TESTS;

const EstablishmentRegistration = mongoose.model(
  'EstablishmentRegistration',
  establishmentRegistrationSchema,
);
const CertificateParticular = mongoose.model(
  'CertificateParticular',
  certificateParticularSchema,
);
const EstablishmentClosure = mongoose.model(
  'EstablishmentClosure',
  establishmentClosureSchema,
);

module.exports = {
  EstablishmentRegistration,
  CertificateParticular,
  EstablishmentClosure,
};
