/**
 * @fileoverview Flexible Benefit Plan (FBP) API Routes
 * Issue: #1664
 */

const express = require('express');
const router = express.Router();
const {
  declareAllocation,
  submitClaim,
  getFbpSummary,
} = require('../controllers/fbp.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/declare-allocation', protect, declareAllocation);
router.post('/submit-claim', protect, submitClaim);
router.get('/summary/:employeeId', protect, getFbpSummary);

module.exports = router;
