/**
 * @fileoverview VPF API Routes
 * Issue: #1571
 */

const express = require('express');
const router = express.Router();
const {
  electVpf,
  getVpfSummary,
  getOrganizationVpfReport,
} = require('../controllers/vpf.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/elect', auth, electVpf);
router.get('/summary/:employeeId', auth, getVpfSummary);
router.get('/organization-report', auth, getOrganizationVpfReport);

module.exports = router;
