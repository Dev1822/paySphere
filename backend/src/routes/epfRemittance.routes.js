const express = require('express');

const {
  getRules,
  updateRules,
  listMonths,
  recordMonth,
  recordRemittance,
  listWaivers,
  recordWaiver,
  getPosition,
  listAssessments,
  commitAssessment,
  simulate,
  getSimulationStatus,
} = require('../controllers/epfRemittance.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- EPF belated remittance, sections 7Q and 14B (#1875) -------------------
//
// Three permissions, and the split follows what each one can make disappear
// rather than what it touches.
//
// Recording a wage month's dues and the payments against it is ledger-keeping
// and sits under MANAGE_EPF_REMITTANCE. Recording a paragraph 32B waiver is
// not: that one field can reduce the damages on a period to nil, and a reader
// looking at the resulting figure has no way to tell a waived liability from a
// liability that never arose. It sits behind MANAGE_EPF_WAIVER with the rules,
// and whoever holds it does not also keep the ledger it acts on.
//
// The rules are in the same bracket for the same reason. `graceDays` is the
// dangerous one: the five days that followed the fifteenth were withdrawn in
// 2016, and restoring them here turns a five-day default into a compliant
// remittance on paper without a rupee moving.
//
// Deliberately not the compliance permissions, though `compliance.routes.js` is
// the nearest neighbour. That router files what is owed; this one answers what
// the delay in paying it costs, and the second is a liability rather than a
// return.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_EPF_REMITTANCE),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPF_WAIVER),
  writeRateLimiter,
  updateRules,
);

router.get(
  '/months',
  auth,
  requirePermission(PERMISSIONS.READ_EPF_REMITTANCE),
  listMonths,
);

router.post(
  '/months',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPF_REMITTANCE),
  writeRateLimiter,
  recordMonth,
);

// Append-only on purpose. A part payment and its balance are two delays under
// paragraph 32A, and replacing the list would collapse them into one.
router.post(
  '/months/:id/remittances',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPF_REMITTANCE),
  writeRateLimiter,
  recordRemittance,
);

router.get(
  '/waivers',
  auth,
  requirePermission(PERMISSIONS.READ_EPF_REMITTANCE),
  listWaivers,
);

// The field that can take a period's damages to nil — see the note above.
router.post(
  '/waivers',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPF_WAIVER),
  writeRateLimiter,
  recordWaiver,
);

// Read-only, and under the read permission. It computes and returns; nothing
// about the ledger changes by looking at it.
router.get(
  '/position',
  auth,
  requirePermission(PERMISSIONS.READ_EPF_REMITTANCE),
  getPosition,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_EPF_REMITTANCE),
  listAssessments,
);

// Committing fixes a figure the establishment will provide for, so it sits with
// the waiver rather than with the ledger.
router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPF_WAIVER),
  writeRateLimiter,
  commitAssessment,
);

// Belated remittance interest & damages simulations
router.post(
  '/simulate',
  auth,
  requirePermission(PERMISSIONS.READ_EPF_REMITTANCE),
  writeRateLimiter,
  simulate,
);

router.get(
  '/simulate/status/:jobId',
  auth,
  requirePermission(PERMISSIONS.READ_EPF_REMITTANCE),
  getSimulationStatus,
);

module.exports = router;
