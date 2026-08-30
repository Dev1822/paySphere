/**
 * @fileoverview Corporate Wellness Wallet API Routes
 * Issue: #1961
 */

const express = require('express');
const router = express.Router();
const {
  allocateWallet,
  submitClaim,
  getWalletStatement,
} = require('../controllers/wellnessWallet.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/allocate', protect, allocateWallet);
router.post('/submit-claim', protect, submitClaim);
router.get('/statement/:employeeId', protect, getWalletStatement);

module.exports = router;
