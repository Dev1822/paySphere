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
const auth = require('../middlewares/auth.middleware');

router.post('/allocate', auth, allocateWallet);
router.post('/submit-claim', auth, submitClaim);
router.get('/statement/:employeeId', auth, getWalletStatement);

module.exports = router;
