/**
 * @fileoverview Cross-Border Contractor API Routes
 * Issue: #1648
 */

const express = require('express');
const router = express.Router();
const {
  calculateContractorPayout,
  generateCertificate,
  getCrossBorderSummary,
} = require('../controllers/crossBorderContractor.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-payout', protect, calculateContractorPayout);
router.post('/generate-certificate', protect, generateCertificate);
router.get('/cross-border-summary', protect, getCrossBorderSummary);

module.exports = router;
