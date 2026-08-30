const express = require('express');

const {
  getRules,
  recordStatus,
  recordCertificate,
  listExpiringCertificates,
  recordContribution,
  checkWithdrawal,
  fileIwOne,
  getPosition,
} = require('../controllers/internationalWorkerPf.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- EPF International Workers, paragraph 83 (#1971) ------------------------
//
// Three permissions, and the split is on which name can take the wage ceiling
// off — or put it back on.
//
// MANAGE_IW_DETERMINATION records the paragraph 83 status and the Certificate
// of Coverage. Both change the contribution by a factor of forty in opposite
// directions: a determination removes the ₹15,000 ceiling and a certificate
// stops the contribution altogether. Nothing else in the product moves a
// remittance that far on the strength of one field.
//
// MANAGE_IW_CONTRIBUTION computes a month's basis and files IW-1. Clerical
// against the determination: the basis follows the status and the pay, and the
// return is checkable against an acknowledgement.
//
// Deliberately not the EPF permissions. Those cover the domestic ECR, where the
// ceiling always applies; these cover the members it never applies to, and
// somebody trusted with the first is not automatically the person who should be
// deciding the second.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_INTERNATIONAL_WORKER),
  getRules,
);

router.get(
  '/position',
  auth,
  requirePermission(PERMISSIONS.READ_INTERNATIONAL_WORKER),
  getPosition,
);

// The query the module exists for, and the one that runs on a schedule rather
// than when somebody opens a record.
router.get(
  '/certificates/expiring',
  auth,
  requirePermission(PERMISSIONS.READ_INTERNATIONAL_WORKER),
  listExpiringCertificates,
);

// Read-only. It answers whether a withdrawal is available and why not, which is
// what stops a member applying again next month.
router.get(
  '/withdrawal',
  auth,
  requirePermission(PERMISSIONS.READ_INTERNATIONAL_WORKER),
  checkWithdrawal,
);

// The determination that removes the wage ceiling — see the note above.
router.post(
  '/status',
  auth,
  requirePermission(PERMISSIONS.MANAGE_IW_DETERMINATION),
  writeRateLimiter,
  recordStatus,
);

// The certificate that stops the contribution altogether, and the date on it
// that starts it again.
router.post(
  '/certificates',
  auth,
  requirePermission(PERMISSIONS.MANAGE_IW_DETERMINATION),
  writeRateLimiter,
  recordCertificate,
);

router.post(
  '/contributions',
  auth,
  requirePermission(PERMISSIONS.MANAGE_IW_CONTRIBUTION),
  writeRateLimiter,
  recordContribution,
);

router.post(
  '/iw-1',
  auth,
  requirePermission(PERMISSIONS.MANAGE_IW_CONTRIBUTION),
  writeRateLimiter,
  fileIwOne,
);

module.exports = router;
