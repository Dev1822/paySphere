const express = require('express');
const router = express.Router();
const probationController = require('../controllers/probation.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(requireAuth);

// Policies (HR Only)
router.post(
  '/policies',
  requireRole(['HR_ADMIN']),
  probationController.createPolicy,
);
router.get(
  '/policies',
  requireRole(['HR_ADMIN']),
  probationController.getPolicies,
);

// Dashboard (HR Only)
router.get(
  '/dashboard',
  requireRole(['HR_ADMIN']),
  probationController.getDashboardStats,
);

// Employee Tracker
router.get('/employee/:employeeId', probationController.getEmployeeTracker);

// Tracker Actions
router.post('/:trackerId/review', probationController.submitReview);
router.post(
  '/:trackerId/extend',
  requireRole(['HR_ADMIN', 'MANAGER']),
  probationController.extendProbation,
);
router.post(
  '/:trackerId/confirm',
  requireRole(['HR_ADMIN']),
  probationController.confirmProbation,
);

module.exports = router;
