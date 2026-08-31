const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const payrollComparisonController = require('../controllers/payrollComparison.controller');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

router.get(
  '/compare',
  requireScope('payroll:read'),
  payrollComparisonController.comparePayrolls
);

module.exports = router;
