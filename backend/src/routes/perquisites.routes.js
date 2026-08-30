const express = require('express');

const {
  getRules,
  updateRules,
  listGrants,
  createGrant,
  deleteGrant,
  previewStatement,
  commitStatement,
  listStatements,
  getEmployeeStatement,
} = require('../controllers/perquisite.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Perquisite valuation under Rule 3 (#1770) -----------------------------
//
// Three permissions, and the split here is between two different kinds of write
// rather than between reading and writing.
//
// Recording a grant is HR work: somebody is given a flat, a car, a loan. Setting
// the rules is not, and the State Bank of India rate is why — it is frozen for
// the whole year and applied to every concessional loan in the establishment, so
// a figure recorded a point too low understates the perquisite for every
// borrower and nothing in a payslip would show it.
//
// Reading is separated from both because a perquisite statement is one person's
// complete tax position, in the same class as the Form 16 that READ_COMPLIANCE
// guards and for the same reason.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_PERQUISITE),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PERQUISITE_RULES),
  writeRateLimiter,
  updateRules,
);

// What employees actually have. A collection rather than fields on the employee
// because Rule 3 values a perquisite for the months it was provided, and an
// employee can carry several of the same kind at once.
router.get(
  '/grants',
  auth,
  requirePermission(PERMISSIONS.READ_PERQUISITE),
  listGrants,
);

router.post(
  '/grants',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PERQUISITE_GRANT),
  writeRateLimiter,
  createGrant,
);

router.delete(
  '/grants/:id',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PERQUISITE_GRANT),
  writeRateLimiter,
  deleteGrant,
);

// Writes nothing. Run repeatedly through the year as grants are recorded and
// options are exercised, because the answer moves until 31 March.
router.get(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_PERQUISITE),
  previewStatement,
);

router.get(
  '/statements',
  auth,
  requirePermission(PERMISSIONS.READ_PERQUISITE),
  listStatements,
);

// Committing fixes the Form 12BA position for the year, which is what reaches
// the employee's Form 16 — so it sits with the rules permission rather than the
// grant one.
router.post(
  '/statements',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PERQUISITE_RULES),
  writeRateLimiter,
  commitStatement,
);

// One employee's Form 12BA lines, with the basis of each. The form asks for the
// value *and* the basis, so a bare total would not answer it.
router.get(
  '/employees/:employeeId',
  auth,
  requirePermission(PERMISSIONS.READ_PERQUISITE),
  getEmployeeStatement,
);

module.exports = router;
