const express = require('express');

const {
  listContractors,
  createContractor,
  updateLicence,
  recordDeployment,
  getAssessment,
  recordReturn,
  exportRegister,
} = require('../controllers/contractLabour.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Contract Labour (Regulation and Abolition) Act, 1970 (#1700) ----------
//
// Kept apart from the vendor permissions, which is the natural place to look
// for it and the wrong one. MANAGE_VENDOR is about who the company pays;
// this is about the company's liability for people it does not employ, and
// the section 21 exposure figure is a contingent liability an auditor asks
// about. The read is also wider than the vendor ledger — it includes the
// establishment's own median wage per designation, which is the rule 25
// comparator.

router.get(
  '/contractors',
  auth,
  requirePermission(PERMISSIONS.READ_CONTRACT_LABOUR),
  listContractors,
);

router.post(
  '/contractors',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CONTRACT_LABOUR),
  writeRateLimiter,
  createContractor,
);

// Its own endpoint rather than a general update: the licence is the field the
// whole register turns on, and separating it means an audit line that says
// "the licence changed" rather than "something changed".
router.put(
  '/contractors/:id/licence',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CONTRACT_LABOUR),
  writeRateLimiter,
  updateLicence,
);

// Upserted on (contractor, month). Recording a month twice would double the
// section 21 exposure for it, which is the one figure here that has to be
// right.
router.put(
  '/deployments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CONTRACT_LABOUR),
  writeRateLimiter,
  recordDeployment,
);

// Writes nothing. The remittance evidence arrives piecemeal and the position
// changes with every challan that lands, so this is a live read rather than
// something committed.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_CONTRACT_LABOUR),
  getAssessment,
);

router.post(
  '/returns',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CONTRACT_LABOUR),
  writeRateLimiter,
  recordReturn,
);

// Forms XII, XIII and XVII. A read, and the document an inspection asks for,
// so it stays with the read permission rather than becoming a third name.
router.get(
  '/registers/:form',
  auth,
  requirePermission(PERMISSIONS.READ_CONTRACT_LABOUR),
  exportRegister,
);

module.exports = router;
