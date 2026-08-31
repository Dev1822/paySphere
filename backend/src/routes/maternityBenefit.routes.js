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
const auth = require('../middlewares/auth.middleware');

router.post('/enroll', auth, enrollMaternityClaim);
router.get('/eligibility/:employeeId', auth, checkEligibility);
router.get('/disbursement-schedule/:employeeId', auth, getDisbursementSchedule);

module.exports = router;
