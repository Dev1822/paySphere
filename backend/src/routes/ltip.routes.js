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
const auth = require('../middlewares/auth.middleware');

router.post('/grant-units', auth, grantUnits);
router.post('/evaluate-vesting', auth, evaluateVesting);
router.get('/portfolio/:employeeId', auth, getLtipPortfolio);

module.exports = router;
