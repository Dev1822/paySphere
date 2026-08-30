/**
 * @fileoverview Loss of Pay (LOP) Adjustment API Routes
 * Issue: #1647
 */

const express = require('express');
const router = express.Router();
const {
  calculateDelta,
  scheduleClawback,
  getEmployeeLopSummary,
} = require('../controllers/lopAdjustment.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/calculate-delta', auth, calculateDelta);
router.post('/schedule-clawback', auth, scheduleClawback);
router.get('/summary/:employeeId', auth, getEmployeeLopSummary);

module.exports = router;
