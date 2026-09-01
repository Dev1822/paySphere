/**
 * @fileoverview Multi-State Labour Welfare Fund (LWF) API Routes
 * Issue: #2063
 */

const express = require('express');
const router = express.Router();
const {
  calculateDeduction,
  configureStateRule,
  getRemittanceReport,
} = require('../controllers/lwf.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-deduction', protect, calculateDeduction);
router.post('/configure-state-rule', protect, configureStateRule);
router.get('/remittance-report/:state', protect, getRemittanceReport);

module.exports = router;
