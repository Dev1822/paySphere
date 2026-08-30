/**
 * @fileoverview Executive LTIP Phantom Stock API Routes
 * Issue: #1960
 */

const express = require('express');
const router = express.Router();
const {
  grantUnits,
  evaluateVesting,
  getLtipPortfolio,
} = require('../controllers/ltip.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/grant-units', protect, grantUnits);
router.post('/evaluate-vesting', protect, evaluateVesting);
router.get('/portfolio/:employeeId', protect, getLtipPortfolio);

module.exports = router;
