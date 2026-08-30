/**
 * National and Festival Holidays Acts — calendar, substitutions and holidays
 * worked (#1970).
 *
 * Four collections, and the reason for each is that the leave engine cannot
 * hold the object.
 *
 * `HolidayCalendar` is the list for one establishment for one year, with its
 * settlement date. The settlement date is on the calendar rather than derived,
 * because the obligation is to fix the list *before the year begins* and a
 * calendar with rows in it says nothing about when they were fixed.
 *
 * `Holiday` is a single day, and it carries `kind`. This is the one modelling
 * decision the whole module turns on: a national holiday and a festival holiday
 * are different objects, not the same object with a flag. The three national
 * days cannot be substituted by any agreement, and a schema where the two are
 * interchangeable is a schema from which one of them will eventually be
 * swapped for a Friday before a long weekend.
 *
 * `HolidaySubstitution` records a substitution with its agreement. Only a
 * festival holiday can have one; a substitution against a national holiday is
 * refused by the engine rather than stored as a valid row, and where one is
 * found on the record it is a finding.
 *
 * `HolidayWorked` is a holiday somebody worked. Deliberately not an attendance
 * row and deliberately not an overtime row: the entitlement is a whole day at
 * the statutory rate however few hours were worked, and it does not consume the
 * overtime quota `workingHoursCompliance.js` tracks. Storing it as overtime
 * would underpay the short day and spend a statutory quota it should not touch.
 */

const mongoose = require('mongoose');

const {
  KIND,
  TREATMENT,
  HOLIDAY_WORK_IS_NOT_OVERTIME,
  NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
} = require('../utils/nationalFestivalHolidays');

// --- Calendar ---------------------------------------------------------------

const holidayCalendarSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /** The state whose Act applies. The rules follow from it. */
    state: { type: String, required: true, trim: true, uppercase: true },

    /** Calendar year, not financial year. The Acts run on the calendar. */
    year: { type: Number, required: true, min: 1990 },

    /**
     * When the list was settled and sent to the Inspector.
     *
     * The point of the row. The obligation is to fix the list before the year
     * begins — 31 December of the preceding year in most states — and a
     * calendar full of rows says nothing about when they were fixed.
     */
    settledOn: { type: Date, default: null },

    /** Where it was displayed, which the Rules also require. */
    displayedAt: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

holidayCalendarSchema.index(
  { tenantId: 1, establishment: 1, year: 1 },
  { unique: true },
);

// --- Holidays ---------------------------------------------------------------

const holidaySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    calendarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HolidayCalendar',
      required: true,
      index: true,
    },

    /**
     * NATIONAL or FESTIVAL, and the whole module turns on the difference.
     *
     * Required and not defaulted. A default of FESTIVAL would make every
     * mis-entered national holiday substitutable, which is the exact failure the
     * two kinds exist to prevent.
     */
    kind: { type: String, enum: Object.values(KIND), required: true },

    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },

    /**
     * Denormalised from `kind` so that a query does not have to know the rule.
     *
     * Always false for a national holiday, and the pre-validate hook below
     * enforces it rather than trusting the caller.
     */
    substitutable: { type: Boolean, default: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// The one invariant worth a hook. A national holiday is not substitutable, and
// that is not a property the caller gets to set — see the header.
holidaySchema.pre('validate', function enforceNationalHolidayIsFixed(next) {
  if (this.kind === KIND.NATIONAL) this.substitutable = false;
  next();
});

holidaySchema.index({ tenantId: 1, calendarId: 1, date: 1 }, { unique: true });

// --- Substitutions ----------------------------------------------------------

const holidaySubstitutionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    holidayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Holiday',
      required: true,
      index: true,
    },

    /** The day the holiday was moved to. */
    substitutedDate: { type: Date, required: true },

    /**
     * The employee's agreement, with its date.
     *
     * Section 4 permits substitution of a festival holiday with agreement. A
     * boolean would lose the date, and the date is what makes the agreement
     * checkable against the substitution it authorised.
     */
    agreedOn: { type: Date, default: null },
    agreedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

    /**
     * Section 3, stored on the row.
     *
     * A default field rather than a comment, so anybody reading a substitution
     * sees the limit on the power being exercised.
     */
    limitNote: {
      type: String,
      default: NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
    },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// --- Holidays worked --------------------------------------------------------

const holidayWorkedSchema = new mongoose.Schema(
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
    holidayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Holiday',
      required: true,
    },

    holidayDate: { type: Date, required: true },

    /**
     * Recorded and deliberately not used to scale the entitlement.
     *
     * A four-hour day and a ten-hour day on a holiday owe the same thing. The
     * hours are kept because an inspection asks, not because the arithmetic
     * needs them.
     */
    hoursWorked: { type: Number, default: 0, min: 0 },

    dailyWage: { type: Number, required: true, min: 0 },

    treatment: {
      type: String,
      enum: Object.values(TREATMENT),
      default: TREATMENT.DOUBLE_WAGES,
    },

    /** What was actually paid, against what the treatment makes payable. */
    paid: { type: Number, default: 0, min: 0 },

    /** Where the state compensates with a day rather than with money. */
    substitutedHolidayGrantedOn: { type: Date, default: null },

    /**
     * Section 5, stored on the row.
     *
     * Kept here because this is the record a payroll engineer reads when
     * deciding where the amount comes from, and the wrong answer — the overtime
     * multiplier — is the obvious one.
     */
    notOvertimeNote: { type: String, default: HOLIDAY_WORK_IS_NOT_OVERTIME },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

holidayWorkedSchema.index(
  { tenantId: 1, employeeId: 1, holidayDate: 1 },
  { unique: true },
);

/**
 * The three fixed dates, exposed so a report or a validator can assert against
 * them without importing the engine.
 */
holidaySchema.statics.NATIONAL = KIND.NATIONAL;
holidayWorkedSchema.statics.CONSUMES_OVERTIME_QUOTA = false;

const HolidayCalendar = mongoose.model(
  'HolidayCalendar',
  holidayCalendarSchema,
);
const Holiday = mongoose.model('Holiday', holidaySchema);
const HolidaySubstitution = mongoose.model(
  'HolidaySubstitution',
  holidaySubstitutionSchema,
);
const HolidayWorked = mongoose.model('HolidayWorked', holidayWorkedSchema);

module.exports = {
  HolidayCalendar,
  Holiday,
  HolidaySubstitution,
  HolidayWorked,
};
