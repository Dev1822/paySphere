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
const { protect } = require('../middlewares/auth.middleware');

router.post('/calculate-itinerary', protect, calculateItinerary);
router.get('/rates', protect, getPerDiemRates);
router.get('/travel-tax-summary/:employeeId', protect, getTravelTaxSummary);

module.exports = router;
