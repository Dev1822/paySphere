const express = require('express');

const {
  getRules,
  createCalendar,
  settleCalendar,
  addHoliday,
  recordSubstitution,
  recordWorked,
  getEligibility,
  getPosition,
} = require('../controllers/nationalFestivalHolidays.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- National and Festival Holidays Acts (#1970) ----------------------------
//
// Three permissions, and the split is on which name can take a paid day away
// from somebody.
//
// MANAGE_HOLIDAY_CALENDAR opens the year, declares the festival holidays and
// settles the list with the Inspector. Clerical: the three national days are
// seeded rather than typed, the festival count is checked against the state's
// figure, and the settlement date is checkable against the Rules.
//
// MANAGE_HOLIDAY_SUBSTITUTION moves a festival holiday to another day. It is
// separate because it is the only power in the module that changes which day an
// employee gets off, and because the engine refuses it outright against the
// three national days — a permission that could do both would make that refusal
// look like a configuration somebody forgot to switch on.
//
// Recording a holiday worked sits with the calendar: it produces a payable and
// posts nothing, and the amount is fixed by the state rather than by whoever
// enters it.
//
// Deliberately not the leave permissions. Leave is applied for, approved and
// deducted from a balance. A holiday is none of those — it cannot be refused,
// and one of the three cannot even be moved.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_HOLIDAY_CALENDAR),
  getRules,
);

router.get(
  '/position',
  auth,
  requirePermission(PERMISSIONS.READ_HOLIDAY_CALENDAR),
  getPosition,
);

// Read-only. It computes and returns, and the days it computed from come back
// with it so a forfeited holiday can be explained to the person who lost it.
router.get(
  '/eligibility',
  auth,
  requirePermission(PERMISSIONS.READ_HOLIDAY_CALENDAR),
  getEligibility,
);

// Opens the year and seeds the three national days into it. They are fixed by
// date and are not the employer's to choose, so they are never typed in.
router.post(
  '/calendars',
  auth,
  requirePermission(PERMISSIONS.MANAGE_HOLIDAY_CALENDAR),
  writeRateLimiter,
  createCalendar,
);

// The date the list was settled, which is the obligation the Rules impose.
router.patch(
  '/calendars/:id/settle',
  auth,
  requirePermission(PERMISSIONS.MANAGE_HOLIDAY_CALENDAR),
  writeRateLimiter,
  settleCalendar,
);

router.post(
  '/calendars/:id/holidays',
  auth,
  requirePermission(PERMISSIONS.MANAGE_HOLIDAY_CALENDAR),
  writeRateLimiter,
  addHoliday,
);

// The only power that moves a day off, and the one the engine refuses against
// the national three — see the note above.
router.post(
  '/substitutions',
  auth,
  requirePermission(PERMISSIONS.MANAGE_HOLIDAY_SUBSTITUTION),
  writeRateLimiter,
  recordSubstitution,
);

// Produces a payable and posts nothing. Not the overtime path: the entitlement
// is a whole day however few hours were worked.
router.post(
  '/worked',
  auth,
  requirePermission(PERMISSIONS.MANAGE_HOLIDAY_CALENDAR),
  writeRateLimiter,
  recordWorked,
);

module.exports = router;
