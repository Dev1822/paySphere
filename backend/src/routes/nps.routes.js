/**
 * @fileoverview Corporate NPS API Routes
 * Issue: #1574
 */

const express = require('express');
const router = express.Router();
const {
  enrollCorporateNps,
  simulateNpsTaxImpact,
  getMonthlyContributionStatement,
} = require('../controllers/nps.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/corporate-enrollment', auth, enrollCorporateNps);
router.get('/tax-impact-simulator', auth, simulateNpsTaxImpact);
router.get('/monthly-contribution-statement', auth, getMonthlyContributionStatement);

module.exports = router;
