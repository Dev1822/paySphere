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
const auth = require('../middlewares/auth.middleware');

router.post('/calculate-payout', auth, calculateContractorPayout);
router.post('/generate-certificate', auth, generateCertificate);
router.get('/cross-border-summary', auth, getCrossBorderSummary);

module.exports = router;
