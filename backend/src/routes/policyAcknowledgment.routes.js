const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const {
  createPolicy,
  getPolicies,
  getPolicyById,
  updatePolicy,
  deletePolicy,
  getMyPolicies,
  acknowledgePolicy,
  getComplianceReport,
  getPolicyAcknowledgments,
} = require('../controllers/policyAcknowledgment.controller');

const router = express.Router();

// ─── Admin: Policy CRUD ──────────────────────────────────────────────────────

router.post(
  '/',
  auth,
  requireScope('employee:write'),
  createPolicy,
);

router.get(
  '/',
  auth,
  requireScope('employee:read'),
  getPolicies,
);

router.get(
  '/:id',
  auth,
  requireScope('employee:read'),
  getPolicyById,
);

router.patch(
  '/:id',
  auth,
  requireScope('employee:write'),
  updatePolicy,
);

router.delete(
  '/:id',
  auth,
  requireScope('employee:write'),
  deletePolicy,
);

// ─── Employee: Acknowledgment ────────────────────────────────────────────────

router.get(
  '/my/policies',
  auth,
  requireScope('employee:read'),
  getMyPolicies,
);

router.post(
  '/:policyId/acknowledge',
  auth,
  requireScope('employee:read'),
  acknowledgePolicy,
);

// ─── Admin: Compliance Reporting ─────────────────────────────────────────────

router.get(
  '/admin/compliance-report',
  auth,
  requireScope('report:read'),
  getComplianceReport,
);

router.get(
  '/:id/acknowledgments',
  auth,
  requireScope('report:read'),
  getPolicyAcknowledgments,
);

module.exports = router;
