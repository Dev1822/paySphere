const express = require('express');
const router = express.Router();
const compensationCycleController = require('../controllers/compensationCycle.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.post(
  '/proposals',
  authorize('SUBMIT_REVISION_PROPOSAL'),
  compensationCycleController.createProposal,
);
router.patch(
  '/proposals/:id/approve',
  authorize('MANAGE_COMPENSATION_CYCLE'),
  compensationCycleController.approveProposal,
);
router.post(
  '/:id/close',
  authorize('MANAGE_COMPENSATION_CYCLE'),
  compensationCycleController.closeCycle,
);

module.exports = router;
