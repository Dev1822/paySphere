const express = require('express');
const router = express.Router();
const timelineController = require('../controllers/timeline.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.use(requireAuth);

router.get('/employees/:id/timeline', timelineController.getEmployeeTimeline);
router.post('/timeline/backfill', timelineController.backfillTimeline);

module.exports = router;
