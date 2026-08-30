const express = require('express');

const {
  getRules,
  updateRules,
  listProjects,
  createProject,
  getProject,
  updateProjectCost,
  recordBill,
  recordAssessmentOrder,
  listBeneficiaries,
  recordBeneficiary,
  previewAssessment,
  listAssessments,
  commitAssessment,
} = require('../controllers/constructionCess.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- BOCW Welfare Cess Act, 1996 (#1827) -----------------------------------
//
// Three permissions, split on the *base* rather than on read against write —
// which is the same principle as the other statutory routers here and lands in
// a different place, because this levy's base is not a wage.
//
// The cost of construction and its section 3 exclusions are the entire levy:
// moving the land line by a crore moves the cess by a lakh, and unlike a wage
// there is no payroll figure anywhere to check it against. So the project cost
// sits behind MANAGE_CESS_BASE with the rate and the section 7 registration,
// and whoever holds it does not also certify the establishment against the
// result.
//
// Recording a contractor bill and the cess withheld from it is register-keeping
// and sits under MANAGE_CESS_REGISTER with the beneficiary roll.
//
// Deliberately not the vendor permissions, though every bill here is a vendor
// bill. MANAGE_VENDOR answers what the company owes a counterparty; this
// answers what the company owes a welfare board on account of a job, and the
// deduction at source is money that never belonged to the contractor.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_CONSTRUCTION_CESS),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CESS_BASE),
  writeRateLimiter,
  updateRules,
);

router.get(
  '/projects',
  auth,
  requirePermission(PERMISSIONS.READ_CONSTRUCTION_CESS),
  listProjects,
);

router.post(
  '/projects',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CESS_BASE),
  writeRateLimiter,
  createProject,
);

router.get(
  '/projects/:id',
  auth,
  requirePermission(PERMISSIONS.READ_CONSTRUCTION_CESS),
  getProject,
);

// The sharpest lever in the module — see the note above.
router.put(
  '/projects/:id/cost',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CESS_BASE),
  writeRateLimiter,
  updateProjectCost,
);

router.post(
  '/projects/:id/bills',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CESS_REGISTER),
  writeRateLimiter,
  recordBill,
);

// Under MANAGE_CESS_BASE rather than the register permission: recording the
// order starts the rule 5 payment window and therefore the section 8 interest
// clock, so back-dating it makes accrued interest disappear.
router.post(
  '/projects/:id/assessment-order',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CESS_BASE),
  writeRateLimiter,
  recordAssessmentOrder,
);

router.get(
  '/beneficiaries',
  auth,
  requirePermission(PERMISSIONS.READ_CONSTRUCTION_CESS),
  listBeneficiaries,
);

router.put(
  '/beneficiaries',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CESS_REGISTER),
  writeRateLimiter,
  recordBeneficiary,
);

// Writes nothing.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_CONSTRUCTION_CESS),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_CONSTRUCTION_CESS),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CESS_BASE),
  writeRateLimiter,
  commitAssessment,
);

module.exports = router;
