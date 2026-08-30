/**
 * @fileoverview Company Event & Social Calendar Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');

const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  rsvp,
  checkIn,
  getMyRSVPs,
  getEventAttendees,
  getEventAnalytics,
} = require('../controllers/companyEvent.controller');

// Admin: Event management
router.post(
  '/',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  createEvent,
);
router.get('/', auth, getEvents);
router.get('/my-rsvps', auth, getMyRSVPs);
router.get('/:id', auth, getEventById);
router.patch(
  '/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  updateEvent,
);
router.delete(
  '/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  deleteEvent,
);

// Employee: RSVP and check-in
router.post('/:id/rsvp', auth, writeRateLimiter, rsvp);
router.post('/:id/check-in', auth, writeRateLimiter, checkIn);

// Admin: Attendee management and analytics
router.get(
  '/:id/attendees',
  auth,
  requirePermission('READ_SETTINGS'),
  getEventAttendees,
);
router.get(
  '/:id/analytics',
  auth,
  requirePermission('READ_SETTINGS'),
  getEventAnalytics,
);

module.exports = router;
