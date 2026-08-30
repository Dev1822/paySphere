/**
 * @fileoverview Employee Relocation API Routes
 * Issue: #1765
 */

const express = require('express');
const router = express.Router();
const {
  createPackage,
  submitClaim,
  getRelocationTaxSummary,
} = require('../controllers/relocation.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/create-package', protect, createPackage);
router.post('/submit-claim', protect, submitClaim);
router.get('/tax-summary/:employeeId', protect, getRelocationTaxSummary);

module.exports = router;
