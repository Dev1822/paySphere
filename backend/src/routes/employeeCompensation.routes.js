const express = require('express');
const auth = require('../middlewares/auth.middleware');
const employeeCompensationController = require('../controllers/employeeCompensation.controller');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

router.get('/:employeeId/timeline', employeeCompensationController.getTimeline);

router.get('/:employeeId/ytd', employeeCompensationController.getYTD);

router.get(
  '/:employeeId/statement',
  employeeCompensationController.downloadStatement,
);

module.exports = router;
