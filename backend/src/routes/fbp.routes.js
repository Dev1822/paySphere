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
const auth = require('../middlewares/auth.middleware');

router.post('/declare-allocation', auth, declareAllocation);
router.post('/submit-claim', auth, submitClaim);
router.get('/summary/:employeeId', auth, getFbpSummary);

module.exports = router;
