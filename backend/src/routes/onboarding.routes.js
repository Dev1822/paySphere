/**
 * @fileoverview Employee Onboarding Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');

const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  addTaskToPlan,
  deletePlan,
  startOnboarding,
  getEmployeeTasks,
  updateTaskStatus,
  getOnboardingProgress,
  getActiveOnboardings,
  uploadDocument,
  verifyDocument,
  getEmployeeDocuments,
} = require('../controllers/onboarding.controller');

// Admin: Plan management
router.post(
  '/plans',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  createPlan,
);
router.get('/plans', auth, requirePermission('READ_SETTINGS'), getPlans);
router.get('/plans/:id', auth, requirePermission('READ_SETTINGS'), getPlanById);
router.patch(
  '/plans/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  updatePlan,
);
router.post(
  '/plans/:id/tasks',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  addTaskToPlan,
);
router.delete(
  '/plans/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  deletePlan,
);

// Admin: Start onboarding for employee
router.post(
  '/start',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  startOnboarding,
);

// Employee/Manager: Task management
router.get('/employee/:employeeId/tasks', auth, getEmployeeTasks);
router.patch('/tasks/:taskId/status', auth, writeRateLimiter, updateTaskStatus);
router.get('/employee/:employeeId/progress', auth, getOnboardingProgress);

// Admin: Active onboardings overview
router.get(
  '/active',
  auth,
  requirePermission('READ_SETTINGS'),
  getActiveOnboardings,
);

// Document management
router.post(
  '/documents',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  uploadDocument,
);
router.patch(
  '/documents/:documentId/verify',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  verifyDocument,
);
router.get('/employee/:employeeId/documents', auth, getEmployeeDocuments);

module.exports = router;
