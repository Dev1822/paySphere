/**
 * @fileoverview National and Festival Holidays Acts (#1970).
 *
 * Three decisions carry this controller.
 *
 * **It refuses a substitution against a national holiday rather than recording
 * one.** This is the only place the module says no, and it is the reason the
 * two kinds of holiday are different objects. 26 January, 15 August and 2
 * October cannot be substituted by any agreement — it is outside the employer's
 * power rather than a policy they may set — so `recordSubstitution` returns 409
 * with the sentence attached instead of writing a row somebody can point at.
 *
 * **It produces a payable and does not post it.** Where a holiday was worked
 * the module computes what is owed — twice the day's wages, or wages plus a
 * substituted holiday — and hands it over. The payroll picks it up the way it
 * picks up any other earning. It deliberately does not route through the
 * overtime engine: the entitlement is a whole day however few hours were
 * worked, and running it through the multiplier would underpay the short day
 * and consume a statutory quota it should not touch.
 *
 * **An unseeded state is answered, not defaulted.** The festival count, the
 * qualifying-days condition and the absent-either-side forfeiture genuinely
 * differ between states. Where there are no rules on file the assessment says
 * so and computes nothing, because a default that got any of them wrong would
 * change wages with nothing objecting.
 *
 * Everything that decides a kind, an entitlement or a due date is in
 * `utils/nationalFestivalHolidays.js`.
 */

const mongoose = require('mongoose');

const {
  HolidayCalendar,
  Holiday,
  HolidaySubstitution,
  HolidayWorked,
} = require('../models/nationalFestivalHolidays.model');
const {
  STATE_RULES,
  KIND,
  TREATMENT,
  HOLIDAY_WORK_IS_NOT_OVERTIME,
  NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
  resolveRules,
  nationalHolidaysFor,
  substitutionPermitted,
  eligibility,
  holidayWagePosition,
  assessYear,
} = require('../utils/nationalFestivalHolidays');
const eventBus = require('../services/event.service');

/**
 * @param {*} value
 * @returns {string}
 */
function readEstablishment(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {*} value
 * @returns {Date|null}
 */
function readDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Find the calendar for an establishment and year.
 *
 * @param {object} input
 * @returns {Promise<object|null>}
 */
function findCalendar({ tenantId, establishment, year }) {
  return HolidayCalendar.findOne({ tenantId, establishment, year });
}

/**
 * GET /api/holidays/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      states: STATE_RULES,
      kinds: KIND,
      treatments: TREATMENT,
      notes: {
        holidayWorkIsNotOvertime: HOLIDAY_WORK_IS_NOT_OVERTIME,
        nationalHolidaysAreNotSubstitutable:
          NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
      },
      note: 'A state that is not listed here has no rules on file. The festival count, the qualifying-days condition and the forfeiture rule differ genuinely, and defaulting any of them would change wages with nothing objecting.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/holidays/calendars
 *
 * Creates the year's calendar and seeds the three national holidays into it.
 *
 * Seeded rather than left to the user. They are fixed by date and are not the
 * employer's to choose, and a blank calendar somebody fills in by hand is a
 * calendar one of them can be left out of.
 */
exports.createCalendar = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);
    const year = Number(req.body.year);

    if (!Number.isInteger(year) || year < 1990) {
      return res.status(400).json({ message: 'year must be a calendar year' });
    }

    const state = String(req.body.state || '')
      .trim()
      .toUpperCase();
    if (!state) {
      return res.status(400).json({ message: 'state is required' });
    }

    const rules = resolveRules(state);

    const calendar = await HolidayCalendar.findOneAndUpdate(
      {
        establishment,
        year
      },
      {
        $set: {
          state,
          displayedAt: String(req.body.displayedAt || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const seeded = [];
    for (const holiday of nationalHolidaysFor(year)) {
      const row = await Holiday.findOneAndUpdate(
        {
          calendarId: calendar._id,
          date: holiday.date
        },
        {
          $setOnInsert: {
            kind: KIND.NATIONAL,
            name: holiday.name,
            substitutable: false,
            recordedBy: req.userId,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      seeded.push(row);
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'HOLIDAY_CALENDAR_OPENED',
      resourceType: 'HolidayCalendar',
      resourceIds: [calendar._id],
      details: {
        establishment: establishment || '(default)',
        year,
        state,
        nationalHolidaysSeeded: seeded.length,
        // Named because it is the figure the festival list is measured against.
        festivalHolidaysRequired: rules?.festivalHolidayCount ?? null,
        rulesOnFile: Boolean(rules),
      },
      req,
    });

    return res.status(201).json({
      calendar,
      national: seeded,
      rules,
      note: rules
        ? `${rules.label || state} requires ${rules.festivalHolidayCount} festival holidays on top of the three national ones.`
        : 'No rules are on file for this state. The festival count cannot be checked until they are.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/holidays/calendars/:id/settle
 *
 * Records that the list was settled and sent to the Inspector. The date is the
 * whole point — the obligation is to fix the list before the year begins, and a
 * calendar full of rows says nothing about when they were fixed.
 */
exports.settleCalendar = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid calendar id' });
    }

    const settledOn = readDate(req.body.settledOn) || new Date();

    const calendar = await HolidayCalendar.findOneAndUpdate(
      {
        _id: req.params.id
      },
      {
        $set: {
          settledOn,
          displayedAt: String(req.body.displayedAt || '').trim(),
        },
      },
      { new: true },
    );

    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'HOLIDAY_LIST_SETTLED',
      resourceType: 'HolidayCalendar',
      resourceIds: [calendar._id],
      details: {
        year: calendar.year,
        state: calendar.state,
        settledOn,
        displayedAt: calendar.displayedAt,
      },
      req,
    });

    return res.json({ calendar });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/holidays/calendars/:id/holidays
 *
 * Adds a festival holiday. A national holiday cannot be added here — the three
 * are seeded with the calendar and are not a list anybody edits.
 */
exports.addHoliday = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid calendar id' });
    }

    const calendar = await HolidayCalendar.findOne({
      _id: req.params.id
    });
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found' });
    }

    const date = readDate(req.body.date);
    if (!date) {
      return res.status(400).json({ message: 'date must be a valid date' });
    }

    if (req.body.kind === KIND.NATIONAL) {
      return res.status(409).json({
        message:
          'The three national holidays are seeded with the calendar and are not a list anybody edits. They are fixed by date and are not the employer’s to choose.',
        note: NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
      });
    }

    const holiday = await Holiday.findOneAndUpdate(
      {
        calendarId: calendar._id,
        date
      },
      {
        $set: {
          kind: KIND.FESTIVAL,
          name: String(req.body.name || '').trim(),
          substitutable: true,
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'FESTIVAL_HOLIDAY_DECLARED',
      resourceType: 'Holiday',
      resourceIds: [holiday._id],
      details: {
        calendarId: calendar._id,
        year: calendar.year,
        name: holiday.name,
        date,
      },
      req,
    });

    return res.status(201).json({ holiday });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/holidays/substitutions
 *
 * The one place the module refuses. See the header.
 */
exports.recordSubstitution = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.holidayId)) {
      return res.status(400).json({ message: 'Invalid holiday id' });
    }

    const holiday = await Holiday.findOne({
      _id: req.body.holidayId
    }).lean();
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

    const substitutedDate = readDate(req.body.substitutedDate);
    if (!substitutedDate) {
      return res
        .status(400)
        .json({ message: 'substitutedDate must be a valid date' });
    }

    const agreedOn = readDate(req.body.agreedOn);

    const permitted = substitutionPermitted({
      holiday,
      agreement: agreedOn ? { agreedOn } : null,
    });

    if (!permitted.permitted) {
      return res.status(409).json({
        message: permitted.reason,
        authority: permitted.authority,
        kind: holiday.kind,
      });
    }

    const substitution = await HolidaySubstitution.create({
      holidayId: holiday._id,
      substitutedDate,
      agreedOn,

      agreedBy: mongoose.isValidObjectId(req.body.agreedBy)
        ? req.body.agreedBy
        : undefined,

      recordedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'HOLIDAY_SUBSTITUTED',
      resourceType: 'HolidaySubstitution',
      resourceIds: [substitution._id],
      details: {
        holidayId: holiday._id,
        // Audited with the kind, because a NATIONAL here would mean the refusal
        // above was bypassed and that is the record an inspection asks about.
        kind: holiday.kind,
        holidayDate: holiday.date,
        substitutedDate,
        agreedOn,
      },
      req,
    });

    return res.status(201).json({ substitution });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/holidays/worked
 *
 * Records a holiday worked and returns what is owed. It does not post to a
 * payroll run — the module produces a payable and the run picks it up.
 */
exports.recordWorked = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.holidayId)) {
      return res.status(400).json({ message: 'Invalid holiday id' });
    }
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const holiday = await Holiday.findOne({
      _id: req.body.holidayId
    }).lean();
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

    const calendar = await HolidayCalendar.findOne({
      _id: holiday.calendarId
    }).lean();

    const rules = resolveRules(calendar?.state);
    if (!rules) {
      return res.status(409).json({
        message: `No rules are on file for ${calendar?.state || 'this state'}, so what is owed for a holiday worked cannot be computed. Twice the wages and wages-plus-a-substituted-holiday are both real answers in different states, and guessing changes pay.`,
      });
    }

    const dailyWage = Number(req.body.dailyWage);
    if (!Number.isFinite(dailyWage) || dailyWage < 0) {
      return res
        .status(400)
        .json({ message: 'dailyWage must be a non-negative number' });
    }

    const position = holidayWagePosition({
      holiday,
      dailyWage,
      hoursWorked: Number(req.body.hoursWorked) || 0,
      rules,
      substitutedHolidayGrantedOn: req.body.substitutedHolidayGrantedOn,
    });

    const record = await HolidayWorked.findOneAndUpdate(
      {
        employeeId: req.body.employeeId,
        holidayDate: holiday.date
      },
      {
        $set: {
          holidayId: holiday._id,
          hoursWorked: Number(req.body.hoursWorked) || 0,
          dailyWage,
          treatment: position.treatment,
          paid: Number(req.body.paid) || 0,
          substitutedHolidayGrantedOn: readDate(
            req.body.substitutedHolidayGrantedOn,
          ),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'HOLIDAY_WORKED_RECORDED',
      resourceType: 'HolidayWorked',
      resourceIds: [record._id],
      details: {
        employeeId: req.body.employeeId,
        holidayDate: holiday.date,
        kind: holiday.kind,
        hoursWorked: record.hoursWorked,
        // Both, because the gap between them is the finding.
        payable: position.wagesPayable,
        paid: record.paid,
        treatment: position.treatment,
      },
      req,
    });

    return res.status(201).json({
      worked: record,
      position,
      note: HOLIDAY_WORK_IS_NOT_OVERTIME,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/holidays/eligibility
 *
 * Read-only. Answers whether one employee is entitled to wages for one holiday,
 * and returns the days the answer was computed from — a forfeited holiday has
 * to be explainable to the person who lost it.
 */
exports.getEligibility = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.holidayId)) {
      return res.status(400).json({ message: 'Invalid holiday id' });
    }

    const holiday = await Holiday.findOne({
      _id: req.query.holidayId
    }).lean();
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

    const calendar = await HolidayCalendar.findOne({
      _id: holiday.calendarId
    }).lean();

    const rules = resolveRules(calendar?.state);
    if (!rules) {
      return res.status(409).json({
        message: `No rules are on file for ${calendar?.state || 'this state'}. The qualifying-days condition and the absent-either-side forfeiture differ between states, and both of them are deductions.`,
      });
    }

    const attendance = Array.isArray(req.body?.attendance)
      ? req.body.attendance
      : [];

    return res.json({
      holiday,
      eligibility: eligibility({ holiday, attendance, rules }),
      rules,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/holidays/position
 *
 * The establishment's whole position for a year.
 */
exports.getPosition = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);
    const year = Number(req.query.year) || new Date().getUTCFullYear();

    const calendar = await findCalendar({
      establishment,
      year
    });

    if (!calendar) {
      return res.json({
        establishment,
        year,
        calendar: null,
        // Not an error. A year with no calendar is exactly the year the list
        // obligation is about, and saying "not found" would hide it.
        note: `No calendar has been opened for ${year}. The list has to be settled and sent to the Inspector before the year begins, so a missing calendar for a coming year is the finding rather than the absence of one.`,
      });
    }

    const holidays = await Holiday.find({
      calendarId: calendar._id
    })
      .sort({ date: 1 })
      .lean();

    const substitutions = await HolidaySubstitution.find({
      holidayId: { $in: holidays.map((holiday) => holiday._id) }
    }).lean();

    const byId = new Map(
      holidays.map((holiday) => [String(holiday._id), holiday]),
    );

    const worked = await HolidayWorked.find({
      holidayDate: {
        $gte: new Date(Date.UTC(year, 0, 1)),
        $lte: new Date(Date.UTC(year, 11, 31)),
      }
    }).lean();

    const result = assessYear({
      state: calendar.state,
      year,
      holidays,
      substitutions: substitutions.map((row) => {
        const holiday = byId.get(String(row.holidayId));
        return {
          holidayDate: holiday?.date,
          kind: holiday?.kind,
          substitutedDate: row.substitutedDate,
          agreement: row.agreedOn ? { agreedOn: row.agreedOn } : null,
        };
      }),
      worked: worked.map((row) => ({
        employeeId: row.employeeId,
        holidayDate: row.holidayDate,
        dailyWage: row.dailyWage,
        hoursWorked: row.hoursWorked,
        paid: row.paid,
        substitutedHolidayGrantedOn: row.substitutedHolidayGrantedOn,
      })),
      listSettledOn: calendar.settledOn,
      asAt: new Date(),
    });

    return res.json({ establishment, year, calendar, result });
  } catch (error) {
    return next(error);
  }
};
