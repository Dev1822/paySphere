const express = require('express');

const {
  getRules,
  updateRules,
  listWorkmen,
  createWorkman,
  recordComparator,
  getComparatorSuggestion,
  recordAllowances,
  accrueReturnJourney,
  listFacilities,
  recordFacility,
  previewAssessment,
  listAssessments,
  commitAssessment,
} = require('../controllers/interStateMigrant.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Inter-State Migrant Workmen Act, 1979 (#1826) -------------------------
//
// Three permissions, and the split is on the *denominators of the comparison*
// rather than on read against write.
//
// The section 13(1)(b) comparator is the sharpest lever in the module: lowering
// the rate a comparable local workman is said to earn makes a parity breach
// disappear without a rupee changing hands, and unlike a wage floor there is no
// notification anywhere to check it against. So the comparator sits behind
// MANAGE_MIGRANT_WAGE_BASIS alongside the thresholds and the section 4
// registration flag, and whoever holds it does not also certify the
// establishment against the result.
//
// Recording an allowance that was actually paid is ordinary register-keeping
// and sits under MANAGE_MIGRANT_WORKMAN with the roll.
//
// Deliberately not gated on the contract-labour permissions, though a migrant
// workman is very often also a contract workman. #1700 answers what the
// principal employer owes for a contractor's workmen; this answers what the
// workman is owed for having been recruited in another state, and the two
// populations are not the same set.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_MIGRANT_WORKMEN),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MIGRANT_WAGE_BASIS),
  writeRateLimiter,
  updateRules,
);

router.get(
  '/workmen',
  auth,
  requirePermission(PERMISSIONS.READ_MIGRANT_WORKMEN),
  listWorkmen,
);

router.post(
  '/workmen',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MIGRANT_WORKMAN),
  writeRateLimiter,
  createWorkman,
);

// Read-only, and under the read permission: it computes a median across a
// designation and says in its own payload that a median is not a section
// 13(1)(b) comparator. Looking at it changes nothing.
router.get(
  '/workmen/:id/comparator-suggestion',
  auth,
  requirePermission(PERMISSIONS.READ_MIGRANT_WORKMEN),
  getComparatorSuggestion,
);

// The sharpest lever in the module — see the note above.
router.put(
  '/workmen/:id/comparator',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MIGRANT_WAGE_BASIS),
  writeRateLimiter,
  recordComparator,
);

router.post(
  '/workmen/:id/allowances',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MIGRANT_WORKMAN),
  writeRateLimiter,
  recordAllowances,
);

// Its own endpoint because the liability arises at recruitment rather than at
// termination, and an accrual inferred from the recruitment record would make
// the finding unfalsifiable.
router.post(
  '/workmen/:id/return-accrual',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MIGRANT_WORKMAN),
  writeRateLimiter,
  accrueReturnJourney,
);

router.get(
  '/facilities',
  auth,
  requirePermission(PERMISSIONS.READ_MIGRANT_WORKMEN),
  listFacilities,
);

router.put(
  '/facilities',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MIGRANT_WORKMAN),
  writeRateLimiter,
  recordFacility,
);

// Writes nothing.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_MIGRANT_WORKMEN),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_MIGRANT_WORKMEN),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MIGRANT_WAGE_BASIS),
  writeRateLimiter,
  commitAssessment,
);

module.exports = router;
