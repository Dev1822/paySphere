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
const auth = require('../middlewares/auth.middleware');

router.post('/calculate-ot', auth, calculateOt);
router.post('/claim-c-off', auth, claimCoff);
router.get('/summary/:employeeId', auth, getEmployeeOtSummary);

module.exports = router;
