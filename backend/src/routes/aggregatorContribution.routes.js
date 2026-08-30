const express = require('express');

const {
  getRules,
  updateRules,
  listTurnover,
  recordTurnover,
  listWorkers,
  recordWorker,
  previewAssessment,
  listAssessments,
  commitAssessment,
} = require('../controllers/aggregatorContribution.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Code on Social Security, 2020, section 114 (#1829) --------------------
//
// Three permissions, and the split follows the two axes the module keeps apart.
//
// Turnover is the base of the levy. It is stated rather than derived — nothing
// in this product produces an aggregator's revenue — so there is no figure
// anywhere to check it against, which is exactly the shape of authority
// MANAGE_COMPLIANCE has. It sits behind MANAGE_AGGREGATOR_TURNOVER with the
// rate band and the ceiling, and whoever holds it does not also certify the
// platform against the result.
//
// The worker register is on the other axis. It is keyed on the person and
// records engagements across platforms the tenant does not own, which is
// register-keeping rather than an accounting act — so it sits under
// MANAGE_GIG_WORKER_REGISTER.
//
// Deliberately not the employee permissions. A gig worker is not an employee
// under section 2(35), and gating this on WRITE_EMPLOYEE is the first place
// that would be lost — which is the failure #1771 spent a module avoiding.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_AGGREGATOR_TURNOVER),
  writeRateLimiter,
  updateRules,
);

router.get(
  '/turnover',
  auth,
  requirePermission(PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION),
  listTurnover,
);

// The base of the levy — see the note above.
router.put(
  '/turnover',
  auth,
  requirePermission(PERMISSIONS.MANAGE_AGGREGATOR_TURNOVER),
  writeRateLimiter,
  recordTurnover,
);

router.get(
  '/workers',
  auth,
  requirePermission(PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION),
  listWorkers,
);

router.put(
  '/workers',
  auth,
  requirePermission(PERMISSIONS.MANAGE_GIG_WORKER_REGISTER),
  writeRateLimiter,
  recordWorker,
);

// Writes nothing.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_AGGREGATOR_CONTRIBUTION),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_AGGREGATOR_TURNOVER),
  writeRateLimiter,
  commitAssessment,
);

module.exports = router;
