const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireICC = require('../middlewares/iccAuth.middleware');
const {
  fileGrievance,
  getCases,
  decryptCase,
  recordICCVote,
  resolveGrievance,
  getSLADashboard,
} = require('../controllers/grievance.controller');

const router = express.Router();

// Public / Authenticated endpoint for filing
router.post('/file', auth, fileGrievance);

// Strict ICC-only endpoints
router.get('/cases', auth, requireICC, getCases);
router.get('/sla-dashboard', auth, requireICC, getSLADashboard);
router.post('/:id/decrypt', auth, requireICC, decryptCase);
router.post('/:id/vote', auth, requireICC, recordICCVote);
router.post('/:id/resolve', auth, requireICC, resolveGrievance);

module.exports = router;
