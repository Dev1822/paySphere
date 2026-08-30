const express = require('express');
const esgController = require('../controllers/esg.controller');
const router = express.Router();

router.get('/carbon', esgController.getCarbonProjections);
router.get('/regions', esgController.getRegionalMatrix);
router.get('/logs', esgController.getLogFeeds);
router.post('/seed', esgController.seedDemoData);

module.exports = router;
