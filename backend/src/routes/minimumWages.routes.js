/**
 * @fileoverview Statutory Minimum Wages API Routes
 * Issue: #1962
 */

const express = require('express');
const router = express.Router();
const {
  auditPayroll,
  updateRates,
  getComplianceReport,
} = require('../controllers/minimumWages.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/audit-payroll', protect, auditPayroll);
router.post('/update-rates', protect, updateRates);
router.get('/compliance-report', protect, getComplianceReport);

module.exports = router;
