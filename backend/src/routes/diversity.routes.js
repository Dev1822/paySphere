const express = require('express');
const diversityController = require('../controllers/diversity.controller');
const router = express.Router();

// Define robust routing architecture for the AI Diversity Model
router.get('/projections', diversityController.getPredictiveProjections);
router.get('/department-matrix', diversityController.getDepartmentMatrix);
router.get('/inclusion-trends', diversityController.getInclusionTrends);
router.post('/seed', diversityController.seedDemoData);

module.exports = router;
