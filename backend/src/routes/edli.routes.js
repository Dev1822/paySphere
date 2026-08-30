const express = require('express');

const {
  getRules,
  listNominations,
  upsertNomination,
  getExemption,
  upsertExemption,
  recordPriorService,
  previewClaim,
  listClaims,
  commitClaim,
} = require('../controllers/edliAssurance.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- EDLI paragraph 22 (#1878) ---------------------------------------------
//
// Three permissions, and the split is on what each name decides for a family.
//
// Recording a Form 2 nomination is MANAGE_EPF_NOMINATION. It decides **who**
// receives the assurance, and it is the one thing here a member states for
// themselves — so it sits apart from everything that decides how much.
//
// MANAGE_EDLI_CLAIM commits the figure a family is quoted, and holds the two
// inputs that move it most: the section 17(2A) exemption, which decides whether
// the group policy or the scheme is the measure, and the prior service at
// another establishment, which decides whether the ₹2,50,000 floor applies at
// all. Those two are together on purpose — an account that could record
// fourteen months of unverified prior service and then commit the resulting
// claim is the whole risk in this feature.
//
// Deliberately not the settlement permissions, though a death in service also
// triggers a full and final. That answers what the employer owes; this answers
// what the *scheme* pays out of contributions already remitted, and the
// employer's role is to file the claim rather than to fund it.

router.get('/rules', auth, requirePermission(PERMISSIONS.READ_EDLI), getRules);

router.get(
  '/nominations',
  auth,
  requirePermission(PERMISSIONS.READ_EDLI),
  listNominations,
);

// Who receives it — see the note above.
router.put(
  '/nominations/:employeeId',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPF_NOMINATION),
  writeRateLimiter,
  upsertNomination,
);

router.get(
  '/exemption',
  auth,
  requirePermission(PERMISSIONS.READ_EDLI),
  getExemption,
);

// Decides whether the group policy or paragraph 22 is the measure.
router.put(
  '/exemption',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EDLI_CLAIM),
  writeRateLimiter,
  upsertExemption,
);

// Decides whether the ₹2,50,000 floor applies at all.
router.post(
  '/prior-service',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EDLI_CLAIM),
  writeRateLimiter,
  recordPriorService,
);

// Read-only. Computes and returns; nothing is written by looking at it.
router.get(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_EDLI),
  previewClaim,
);

router.get(
  '/claims',
  auth,
  requirePermission(PERMISSIONS.READ_EDLI),
  listClaims,
);

// Fixes the figure a family is quoted, so it sits with the inputs that move it.
router.post(
  '/claims',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EDLI_CLAIM),
  writeRateLimiter,
  commitClaim,
);

module.exports = router;
