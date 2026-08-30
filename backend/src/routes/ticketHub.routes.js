/**
 * @fileoverview Helpdesk & Ticketing Hub Routes
 * @description API routes for ticket management, SLA policies, categories,
 * assignment, and dashboard analytics.
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createCategory,
  getCategories,
  createSLAPolicy,
  getSLAPolicies,
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
  addComment,
  assignTicket,
  getDashboard,
} = require('../controllers/ticketHub.controller');

const router = express.Router();
router.use(auth);

// Dashboard
router.get('/dashboard', requirePermission('READ_EMPLOYEE'), getDashboard);

// Categories
router.post('/categories', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createCategory);
router.get('/categories', requirePermission('READ_EMPLOYEE'), getCategories);

// SLA Policies
router.post('/sla', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createSLAPolicy);
router.get('/sla', requirePermission('READ_EMPLOYEE'), getSLAPolicies);

// Tickets
router.post('/', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createTicket);
router.get('/', requirePermission('READ_EMPLOYEE'), getTickets);
router.get('/:ticketId', requirePermission('READ_EMPLOYEE'), getTicket);
router.patch('/:ticketId', requirePermission('WRITE_EMPLOYEE'), updateTicket);
router.post('/:ticketId/assign', requirePermission('WRITE_EMPLOYEE'), assignTicket);
router.post('/:ticketId/comments', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, addComment);

module.exports = router;
