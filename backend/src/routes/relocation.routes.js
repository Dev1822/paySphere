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
const auth = require('../middlewares/auth.middleware');

router.post('/create-package', auth, createPackage);
router.post('/submit-claim', auth, submitClaim);
router.get('/tax-summary/:employeeId', auth, getRelocationTaxSummary);

module.exports = router;
