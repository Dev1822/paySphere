/**
 * @fileoverview Corporate Broadband & Telecommuting API Routes
 * Issue: #2065
 */

const express = require('express');
const router = express.Router();
const {
  submitBroadbandClaim,
  configurePolicy,
  getTelecommutingStatement,
} = require('../controllers/telecommuting.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/submit-broadband-claim', protect, submitBroadbandClaim);
router.post('/configure-policy', protect, configurePolicy);
router.get('/statement/:employeeId', protect, getTelecommutingStatement);

module.exports = router;
