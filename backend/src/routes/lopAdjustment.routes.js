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
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-delta', protect, calculateDelta);
router.post('/schedule-clawback', protect, scheduleClawback);
router.get('/summary/:employeeId', protect, getEmployeeLopSummary);

module.exports = router;
