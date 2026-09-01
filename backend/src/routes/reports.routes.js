const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const cacheMiddleware = require('../middlewares/cache.middleware'); // Added for #722
const {
  getAnalytics,
  downloadPDFReport,
  exportExcelReport,
  downloadPayslipsZip,
  getTurnoverMetrics,
  generateCustomReport,
} = require('../controllers/reports.controller');

const router = express.Router();

// Heavy aggregation endpoints get 15-minute middleware cache (#722)
// Tags are generated dynamically per-request to support user-level invalidation
const analyticsCache = cacheMiddleware({
  ttl: 900,
  prefix: 'reports:analytics',
  tags: ['reports', 'analytics', 'dept:analytics'],
});

const turnoverCache = cacheMiddleware({
  ttl: 900,
  prefix: 'reports:turnover',
  tags: ['reports'],
});

// Preserved original READ_REPORT permission — do NOT change to READ_PAYROLL
router.get(
  '/analytics',
  auth,
  requirePermission('READ_REPORT'),
  analyticsCache,
  getAnalytics,
);
router.get(
  '/turnover',
  auth,
  requirePermission('READ_REPORT'),
  turnoverCache,
  getTurnoverMetrics,
);

// Custom reports are POST with dynamic bodies — not suitable for GET middleware caching
router.post(
  '/custom',
  auth,
  requirePermission('READ_REPORT'),
  generateCustomReport,
);

// Binary downloads stream buffers directly — never cache via middleware
router.get(
  '/download-pdf',
  auth,
  requirePermission('READ_REPORT'),
  downloadPDFReport,
);
router.get(
  '/export-xlsx',
  auth,
  requirePermission('READ_REPORT'),
  exportExcelReport,
);
router.get(
  '/download-zip',
  auth,
  requirePermission('READ_REPORT'),
  downloadPayslipsZip,
);

module.exports = router;
