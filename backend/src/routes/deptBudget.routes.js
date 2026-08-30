/**
 * @fileoverview Department Budget Routes
 * @description REST endpoints for cost centers, budget categories, department
 *   budgets, line items, transactions, alerts, variance analysis, and reporting.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const ctrl = require('../controllers/deptBudget.controller');

const router = express.Router();

// ─── Cost Center Management ─────────────────────────────────────────────────

router.post(
  '/cost-centers',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.createCostCenter,
);

router.get(
  '/cost-centers',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getCostCenters,
);

router.put(
  '/cost-centers/:id',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.updateCostCenter,
);

// ─── Budget Category Management ─────────────────────────────────────────────

router.post(
  '/categories',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.createCategory,
);

router.get(
  '/categories',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getCategories,
);

// ─── Department Budget CRUD ─────────────────────────────────────────────────

router.post(
  '/',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.createBudget,
);

router.get(
  '/',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getBudgets,
);

router.get(
  '/:budgetId',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getBudget,
);

router.put(
  '/:budgetId',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.updateBudget,
);

// ─── Budget Approval Workflow ───────────────────────────────────────────────

router.put(
  '/:budgetId/submit',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.submitBudget,
);

router.put(
  '/:budgetId/approve',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.approveBudget,
);

router.put(
  '/:budgetId/reject',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.rejectBudget,
);

router.put(
  '/:budgetId/close',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.closeBudget,
);

// ─── Line Item Management ───────────────────────────────────────────────────

router.post(
  '/:budgetId/line-items',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.addLineItem,
);

router.get(
  '/:budgetId/line-items',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getLineItems,
);

router.put(
  '/line-items/:lineItemId',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.updateLineItem,
);

router.delete(
  '/line-items/:lineItemId',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.removeLineItem,
);

// ─── Transaction Recording ──────────────────────────────────────────────────

router.post(
  '/:budgetId/transactions',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.recordTransaction,
);

router.get(
  '/:budgetId/line-items/:lineItemId/transactions',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getTransactions,
);

router.put(
  '/:budgetId/bulk-update',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.bulkUpdateActuals,
);

// ─── Alert Management ───────────────────────────────────────────────────────

router.get(
  '/alerts',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getAlerts,
);

router.put(
  '/alerts/:alertId/acknowledge',
  auth,
  writeRateLimiter,
  ctrl.acknowledgeAlert,
);

// ─── Reports & Dashboard ────────────────────────────────────────────────────

router.get(
  '/reports/variance',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getVarianceReport,
);

router.get(
  '/reports/dashboard',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getDashboard,
);

router.get(
  '/reports/comparison',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getComparison,
);

module.exports = router;
