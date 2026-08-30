/**
 * @fileoverview Maternity Benefit API Routes
 * Issue: #1665
 */

const express = require('express');
const router = express.Router();
const {
  enrollMaternityClaim,
  checkEligibility,
  getDisbursementSchedule,
} = require('../controllers/maternityBenefit.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/enroll', protect, enrollMaternityClaim);
router.get('/eligibility/:employeeId', protect, checkEligibility);
router.get('/disbursement-schedule/:employeeId', protect, getDisbursementSchedule);

module.exports = router;
