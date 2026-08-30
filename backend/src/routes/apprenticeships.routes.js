const express = require('express');

const {
  getRules,
  updateRules,
  recordStrength,
  listStrength,
  listApprentices,
  createApprentice,
  registerApprentice,
  recordMonth,
  previewAssessment,
  commitAssessment,
  listAssessments,
} = require('../controllers/apprenticeship.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Apprentices Act, 1961 (#1771) -----------------------------------------
//
// Three permissions, and the middle one covers two things that look unrelated
// until you see what they have in common: the band's rules and the
// establishment's recorded strength are both *denominators*. Reducing total
// strength by ten lowers the floor and can make a shortfall disappear without a
// single apprentice being engaged, and lowering the floor percentage does the
// same thing more directly. Whoever can move either should not be the person
// certifying the establishment against the result.
//
// Deliberately not gated on the employee permissions. An apprentice is not an
// employee — that is the whole subject of the module — and putting the roll
// behind WRITE_EMPLOYEE would be the first place the distinction got lost.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_APPRENTICESHIP),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRENTICESHIP_RULES),
  writeRateLimiter,
  updateRules,
);

// The composition the band is measured against. Recorded rather than counted:
// section 8's base includes contract and casual workers, and the product tracks
// contractors by deployment rather than by head.
router.get(
  '/strength',
  auth,
  requirePermission(PERMISSIONS.READ_APPRENTICESHIP),
  listStrength,
);

router.put(
  '/strength',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRENTICESHIP_RULES),
  writeRateLimiter,
  recordStrength,
);

router.get(
  '/apprentices',
  auth,
  requirePermission(PERMISSIONS.READ_APPRENTICESHIP),
  listApprentices,
);

router.post(
  '/apprentices',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRENTICE),
  writeRateLimiter,
  createApprentice,
);

// Its own endpoint, because this single date decides whether the establishment
// owes provident fund, ESI, bonus and gratuity for the whole period — the
// largest consequence in the module.
router.post(
  '/apprentices/:id/register',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRENTICE),
  writeRateLimiter,
  registerApprentice,
);

router.put(
  '/apprentices/:id/months',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRENTICE),
  writeRateLimiter,
  recordMonth,
);

// Writes nothing. The band is a standing position and the roll changes under it.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_APPRENTICESHIP),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_APPRENTICESHIP),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRENTICESHIP_RULES),
  writeRateLimiter,
  commitAssessment,
);

module.exports = router;
