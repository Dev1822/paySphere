const express = require('express');

const {
  getRules,
  listRateTables,
  recordRateTable,
  listAssessedYears,
  recordAssessedYear,
  recordClaim,
  recordFurnishing,
  applyRelief,
  getFormTenE,
  getPosition,
} = require('../controllers/sectionEightyNineRelief.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Section 89(1) relief (#1969) -------------------------------------------
//
// Three permissions, and the split is on which name can move a relief figure
// without touching a single claim.
//
// MANAGE_TAX_RATE_TABLE holds the dated slabs. It is the widest authority in
// the module by a distance: changing the 2022-23 table moves every relief ever
// computed against a relation year in it, for every employee, with no claim
// record changing and nothing on any screen saying why the number is different.
// It sits with the assessed years for the same reason — an assessed total
// income of six lakh rather than nine moves the marginal rate the relation-year
// term is priced at.
//
// MANAGE_RELIEF_CLAIM records the arrear and its year-wise spread, and applies
// the relief once Form 10E is on file. Clerical against documents: the arrear
// is a payroll figure and the furnishing is an acknowledgement.
//
// Deliberately not the payroll permissions. Payroll answers what was paid; this
// answers what the bunching of that payment cost in tax, and the second is
// checked by the people who sign the return rather than by the people who run
// the payroll.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_ARREAR_RELIEF),
  getRules,
);

router.get(
  '/rate-tables',
  auth,
  requirePermission(PERMISSIONS.READ_ARREAR_RELIEF),
  listRateTables,
);

// The widest authority in the module — see the note above.
router.post(
  '/rate-tables',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TAX_RATE_TABLE),
  writeRateLimiter,
  recordRateTable,
);

router.get(
  '/assessed-years',
  auth,
  requirePermission(PERMISSIONS.READ_ARREAR_RELIEF),
  listAssessedYears,
);

// The employee's assessed position for a past year, including the regime. Sits
// with the rate tables because it moves the relief the same way.
router.post(
  '/assessed-years',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TAX_RATE_TABLE),
  writeRateLimiter,
  recordAssessedYear,
);

router.post(
  '/claims',
  auth,
  requirePermission(PERMISSIONS.MANAGE_RELIEF_CLAIM),
  writeRateLimiter,
  recordClaim,
);

// The employee's act, recorded by the employer. This does not file anything.
router.post(
  '/claims/:id/form-10e',
  auth,
  requirePermission(PERMISSIONS.MANAGE_RELIEF_CLAIM),
  writeRateLimiter,
  recordFurnishing,
);

// The one place the module refuses: no Form 10E, no authority under section
// 192(2A), and the short deduction would be the employer's to carry.
router.patch(
  '/claims/:id/apply',
  auth,
  requirePermission(PERMISSIONS.MANAGE_RELIEF_CLAIM),
  writeRateLimiter,
  applyRelief,
);

// Read-only. Building the form computes and returns; it changes nothing.
router.get(
  '/claims/:id/form-10e',
  auth,
  requirePermission(PERMISSIONS.READ_ARREAR_RELIEF),
  getFormTenE,
);

router.get(
  '/position',
  auth,
  requirePermission(PERMISSIONS.READ_ARREAR_RELIEF),
  getPosition,
);

module.exports = router;
