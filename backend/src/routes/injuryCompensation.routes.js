const express = require('express');

const {
  getSchedules,
  previewClaim,
  createClaim,
  listClaims,
  getClaim,
  updateStatus,
} = require('../controllers/injuryCompensation.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Employees' Compensation Act, 1923 (#1699) -----------------------------
//
// Two permissions, and neither of them is a payroll one. A claim reads an
// employee's date of birth and the circumstances of an injury — medical
// information about a named individual, which nothing else in the product
// holds — and admitting one commits the company to a payment that is not
// discretionary and accrues interest at twelve percent from the date of the
// accident. Neither half is "running a payroll month".

// The Schedule IV factors and the Schedule I injury list. Static reference
// data, still behind the read permission: the tables themselves are public,
// but serving them to an unauthenticated caller advertises which endpoints
// exist and on what shape.
router.get(
  '/schedules',
  auth,
  requirePermission(PERMISSIONS.READ_EC_CLAIM),
  getSchedules,
);

// Writes nothing. The loss of earning capacity is a medical opinion that gets
// revised, the wage is argued over, and the penalty share is not known until a
// Commissioner sets it — so a claim is computed many times before one is filed.
router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_EC_CLAIM),
  previewClaim,
);

router.get(
  '/claims',
  auth,
  requirePermission(PERMISSIONS.READ_EC_CLAIM),
  listClaims,
);

router.post(
  '/claims',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EC_CLAIM),
  writeRateLimiter,
  createClaim,
);

router.get(
  '/claims/:id',
  auth,
  requirePermission(PERMISSIONS.READ_EC_CLAIM),
  getClaim,
);

// Moving a claim to DEPOSITED or PAID discharges a statutory liability, and the
// transition to PAID is what settles the section 4A interest. Gated on the
// manage permission for that reason rather than because it is a PATCH.
router.patch(
  '/claims/:id/status',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EC_CLAIM),
  writeRateLimiter,
  updateStatus,
);

module.exports = router;
