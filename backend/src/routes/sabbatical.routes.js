/**
 * @fileoverview Corporate Milestone Sabbatical API Routes
 * Issue: #2066
 */

const express = require('express');
const router = express.Router();
const {
  accrueMilestone,
  requestLeave,
  getSabbaticalStatus,
} = require('../controllers/sabbatical.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/accrue-milestone', protect, accrueMilestone);
router.post('/request-leave', protect, requestLeave);
router.get('/status/:employeeId', protect, getSabbaticalStatus);

module.exports = router;
