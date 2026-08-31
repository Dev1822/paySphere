/**
 * @fileoverview Gratuity Fund API Routes
 * Issue: #1572
 */

const express = require('express');
const router = express.Router();
const {
  getGratuityLiabilityLedger,
  getEmployeeGratuityTimeline,
  runActuarialRevaluation,
} = require('../controllers/gratuityFund.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/liability-ledger', auth, getGratuityLiabilityLedger);
router.get('/employee/:employeeId', auth, getEmployeeGratuityTimeline);
router.post('/actuarial-revaluation', auth, runActuarialRevaluation);

module.exports = router;
