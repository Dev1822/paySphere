/**
 * @fileoverview Per Diem & Travel Allowance API Routes
 * Issue: #1668
 */

const express = require('express');
const router = express.Router();
const {
  calculateItinerary,
  getPerDiemRates,
  getTravelTaxSummary,
} = require('../controllers/perDiem.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/calculate-itinerary', auth, calculateItinerary);
router.get('/rates', auth, getPerDiemRates);
router.get('/travel-tax-summary/:employeeId', auth, getTravelTaxSummary);

module.exports = router;
