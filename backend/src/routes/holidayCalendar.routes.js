/**
 * @fileoverview Holiday Calendar Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');

const {
  createCalendar,
  getCalendars,
  getCalendarById,
  updateCalendar,
  deleteCalendar,
  addHoliday,
  removeHoliday,
  getUpcomingHolidays,
  getHolidaysInRange,
  getHolidayStats,
} = require('../controllers/holidayCalendar.controller');

// Admin: Calendar CRUD
router.post(
  '/',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  createCalendar,
);
router.get('/', auth, requirePermission('READ_SETTINGS'), getCalendars);
router.get('/stats', auth, requirePermission('READ_SETTINGS'), getHolidayStats);
router.get('/:id', auth, getCalendarById);
router.patch(
  '/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  updateCalendar,
);
router.delete(
  '/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  deleteCalendar,
);

// Admin: Holiday management within a calendar
router.post(
  '/:id/holidays',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  addHoliday,
);
router.delete(
  '/:id/holidays/:holidayId',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  removeHoliday,
);

// Employee: View holidays
router.get('/employee/upcoming', auth, getUpcomingHolidays);
router.get('/employee/range', auth, getHolidaysInRange);

module.exports = router;
