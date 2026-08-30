/**
 * @fileoverview Overtime & Rest-Day Multiplier API Routes
 * Issue: #1762
 */

const express = require('express');
const router = express.Router();
const {
  calculateOt,
  claimCoff,
  getEmployeeOtSummary,
} = require('../controllers/overtimeMultiplier.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-ot', protect, calculateOt);
router.post('/claim-c-off', protect, claimCoff);
router.get('/summary/:employeeId', protect, getEmployeeOtSummary);

module.exports = router;
