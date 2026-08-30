const express = require('express');

const {
  getRules,
  updateRules,
  previewAssessment,
  commitRegister,
  listRegisters,
  getRegister,
  listDeferred,
  writeOffDeferred,
} = require('../controllers/wageDeductionRegister.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Payment of Wages Act, 1936 (#1767) ------------------------------------
//
// Three permissions, and the split is the same one #1702 made for a different
// reason. The rules decide what counts as a breach: an establishment that
// raises its section 1(6) applicability ceiling takes employees out of the Act
// entirely, and every finding against them disappears with nothing in the
// register saying so. Whoever sets that figure should not be the person
// certifying the establishment against it.
//
// Deliberately not gated on READ_PAYROLL, though it is computed from the
// payroll rows. Payroll answers "what was this person paid"; this answers "was
// the employer allowed to take that much", which is a question about the
// employer — and the people who audit it are not the people who run payroll.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_WAGE_DEDUCTIONS),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_WAGE_DEDUCTION_RULES),
  writeRateLimiter,
  updateRules,
);

// Writes nothing, and is run repeatedly. Deductions are added to a payroll row
// up to the moment it is approved, so the answer moves until then and there is
// no point at which one run of it is the run.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_WAGE_DEDUCTIONS),
  previewAssessment,
);

router.get(
  '/registers',
  auth,
  requirePermission(PERMISSIONS.READ_WAGE_DEDUCTIONS),
  listRegisters,
);

router.post(
  '/registers',
  auth,
  requirePermission(PERMISSIONS.COMMIT_WAGE_DEDUCTION_REGISTER),
  writeRateLimiter,
  commitRegister,
);

router.get(
  '/registers/:id',
  auth,
  requirePermission(PERMISSIONS.READ_WAGE_DEDUCTIONS),
  getRegister,
);

// The deferrals the ceiling created. A read, because a deferred balance is a
// fact about what was already committed rather than a thing to be managed.
router.get(
  '/deferred',
  auth,
  requirePermission(PERMISSIONS.READ_WAGE_DEDUCTIONS),
  listDeferred,
);

// Writing one off is the employer forgiving a debt, so it sits behind the
// commit permission rather than the read one.
router.post(
  '/deferred/:id/write-off',
  auth,
  requirePermission(PERMISSIONS.COMMIT_WAGE_DEDUCTION_REGISTER),
  writeRateLimiter,
  writeOffDeferred,
);

module.exports = router;
