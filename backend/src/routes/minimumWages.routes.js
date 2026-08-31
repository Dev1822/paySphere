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
const auth = require('../middlewares/auth.middleware');

router.post('/audit-payroll', auth, auditPayroll);
router.post('/update-rates', auth, updateRates);
router.get('/compliance-report', auth, getComplianceReport);

module.exports = router;
