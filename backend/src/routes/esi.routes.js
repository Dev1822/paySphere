const express = require('express');

const {
  getRules,
  updateRules,
  previewAssessment,
  fileReturn,
  listReturns,
  getReturn,
  getCoverage,
} = require('../controllers/esiContribution.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Employees' State Insurance Act, 1948 (#1768) --------------------------
//
// Three permissions. The middle one is separated for a reason particular to
// this Act: the wage ceiling decides who is in the scheme, and somebody removed
// from it keeps drawing benefit for three months, because the benefit period
// lags the contribution period. A ceiling lowered quietly is therefore a change
// nobody notices until a claim is rejected — by which time the contribution that
// would have supported it was never remitted and cannot be.
//
// Not gated on READ_PAYROLL. The coverage register carries a disability flag
// against named employees, which is the kind of personal data the payroll role
// has no reason to hold.

router.get('/rules', auth, requirePermission(PERMISSIONS.READ_ESI), getRules);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESI_RULES),
  writeRateLimiter,
  updateRules,
);

// Writes nothing, and runs the whole contribution period rather than the month:
// a month's coverage is not knowable from that month, which is the reason this
// module exists.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_ESI),
  previewAssessment,
);

// The period register — who is being carried by the Rule 50 proviso and since
// when, and how the 78-day counts stand. Its own path rather than a field on a
// return, because the question spans the period and a return is one month.
router.get(
  '/coverage',
  auth,
  requirePermission(PERMISSIONS.READ_ESI),
  getCoverage,
);

router.get(
  '/returns',
  auth,
  requirePermission(PERMISSIONS.READ_ESI),
  listReturns,
);

// Filing writes the coverage state as well as the return, which is what makes
// the next month computable at all.
router.post(
  '/returns',
  auth,
  requirePermission(PERMISSIONS.FILE_ESI_RETURN),
  writeRateLimiter,
  fileReturn,
);

router.get(
  '/returns/:id',
  auth,
  requirePermission(PERMISSIONS.READ_ESI),
  getReturn,
);

module.exports = router;
