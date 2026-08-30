const express = require('express');

const {
  getLimits,
  updateLimits,
  previewAssessment,
  commitAssessment,
  listAssessments,
  getAssessment,
} = require('../controllers/workingHoursCompliance.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Working hours compliance (#1702) --------------------------------------
//
// Three permissions, and the middle one is the reason for the split. The limits
// decide what counts as a breach: an establishment that raises its spread-over
// to thirteen hours makes every existing finding disappear, and nothing in the
// assessment would say it had. Whoever sets the limits should not be the same
// person certifying the establishment against them.
//
// The read is not gated on READ_ATTENDANCE either, though it is computed from
// the attendance ledger. Attendance answers "was this person here"; this
// answers "is this shift pattern lawful", which is a question about the
// employer rather than about the employee.

router.get(
  '/limits',
  auth,
  requirePermission(PERMISSIONS.READ_WORKING_HOURS),
  getLimits,
);

router.put(
  '/limits',
  auth,
  requirePermission(PERMISSIONS.MANAGE_WORKING_HOURS_LIMITS),
  writeRateLimiter,
  updateLimits,
);

// Writes nothing, and is run repeatedly. Four of the six limits cannot be
// checked at the point of entry — a weekly total is not knowable on Tuesday and
// the quarterly overtime ceiling is not knowable in week three — so an
// assessment is run over a period as the attendance for it settles.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_WORKING_HOURS),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_WORKING_HOURS),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.RUN_WORKING_HOURS_ASSESSMENT),
  writeRateLimiter,
  commitAssessment,
);

router.get(
  '/assessments/:id',
  auth,
  requirePermission(PERMISSIONS.READ_WORKING_HOURS),
  getAssessment,
);

module.exports = router;
