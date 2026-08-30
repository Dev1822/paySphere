const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const {
  getAuditLogs,
  exportAuditLogsCSV,
  verifyCryptographicChain,
} = require('../controllers/audit.controller');

router.get('/verify/:modelName/:id', auth, verifyCryptographicChain);
router.get('/export', auth, exportAuditLogsCSV);
router.get('/', auth, getAuditLogs);

module.exports = router;
