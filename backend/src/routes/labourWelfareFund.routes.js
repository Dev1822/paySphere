const express = require('express');

const {
  listRules,
  createRule,
  previewPeriod,
  getCalendar,
  commitContribution,
  listContributions,
  recordRemittance,
  exportRegister,
} = require('../controllers/labourWelfareFund.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Labour Welfare Fund (#1701) -------------------------------------------
//
// Three permissions, for the same reason the minimum wage router has three:
// transcribing a state's notified amounts and committing the contribution that
// is measured against them are different acts. The rule decides what every
// employee in that state owes for the next several years, and whoever maintains
// it should not also be the one certifying the remittance.
//
// The deduction itself is small. The authority is not: a rule with the wrong
// periodicity silently under-remits for a whole workforce in that state, and
// nothing in the payroll run objects.

router.get('/rules', auth, requirePermission(PERMISSIONS.READ_LWF), listRules);

router.post(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_LWF_RULES),
  writeRateLimiter,
  createRule,
);

// Writes nothing. Opened before the payroll run to see what is due — which is
// the point, since LWF is missed because nobody schedules it rather than
// because anybody computes it wrongly.
router.get(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_LWF),
  previewPeriod,
);

// What is coming, per state, for a year. A different question from the preview:
// that one says what is due this month, this one says when the next one lands.
router.get(
  '/calendar',
  auth,
  requirePermission(PERMISSIONS.READ_LWF),
  getCalendar,
);

router.get(
  '/contributions',
  auth,
  requirePermission(PERMISSIONS.READ_LWF),
  listContributions,
);

router.post(
  '/contributions',
  auth,
  requirePermission(PERMISSIONS.MANAGE_LWF_CONTRIBUTION),
  writeRateLimiter,
  commitContribution,
);

// Recording the challan is what settles the lateness, so it is gated with the
// commit rather than with the read.
router.patch(
  '/contributions/:id/remittance',
  auth,
  requirePermission(PERMISSIONS.MANAGE_LWF_CONTRIBUTION),
  writeRateLimiter,
  recordRemittance,
);

// Every employee's wages and contribution in one file. Sensitive, and still a
// read — it is the document a welfare board inspection asks for.
router.get(
  '/contributions/:id/register',
  auth,
  requirePermission(PERMISSIONS.READ_LWF),
  exportRegister,
);

module.exports = router;
