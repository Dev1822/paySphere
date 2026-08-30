const express = require('express');

const {
  getRules,
  updateRules,
  listSuspensions,
  createSuspension,
  getSuspension,
  recordAttributability,
  recordPayment,
  recordOutcome,
  previewAssessment,
  listAssessments,
  commitAssessment,
} = require('../controllers/subsistenceAllowance.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Section 10A, Standing Orders Act, 1946 (#1828) ------------------------
//
// Three permissions, and the middle one is the whole subject of the module.
//
// The attributability finding decides whether a suspended workman is on fifty
// per cent or seventy-five from day ninety-one. It is a judgement about whose
// conduct delayed the enquiry, and it is worth real money — so it sits behind
// its own name rather than travelling with the suspension record. Whoever
// orders a suspension should not also be the person who decides that the delay
// in enquiring into it was nobody's fault.
//
// There is deliberately no route that sets the *rate*. The rate is a
// consequence of the finding, and an overridable rate would let the stored
// number stop saying whether a finding was made at all.
//
// Deliberately not gated on the leave permissions. A suspension is not leave —
// leave pays nothing and this pays on a rising statutory scale — and putting it
// behind a leave permission is the first place that distinction would be lost.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_SUSPENSION),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.DETERMINE_SUSPENSION_DELAY),
  writeRateLimiter,
  updateRules,
);

// Before `/:id`, so a suspension can never be created with the id "assessment".
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_SUSPENSION),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_SUSPENSION),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.DETERMINE_SUSPENSION_DELAY),
  writeRateLimiter,
  commitAssessment,
);

router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.READ_SUSPENSION),
  listSuspensions,
);

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.MANAGE_SUSPENSION),
  writeRateLimiter,
  createSuspension,
);

router.get(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.READ_SUSPENSION),
  getSuspension,
);

// The finding the uplift turns on — see the note above.
router.put(
  '/:id/attributability',
  auth,
  requirePermission(PERMISSIONS.DETERMINE_SUSPENSION_DELAY),
  writeRateLimiter,
  recordAttributability,
);

router.put(
  '/:id/payments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_SUSPENSION),
  writeRateLimiter,
  recordPayment,
);

// Under MANAGE_SUSPENSION rather than the finding permission: concluding is the
// enquiry's result being written down, and the conversion of the drawn
// allowance into a set-off follows from it arithmetically.
router.post(
  '/:id/outcome',
  auth,
  requirePermission(PERMISSIONS.MANAGE_SUSPENSION),
  writeRateLimiter,
  recordOutcome,
);

module.exports = router;
