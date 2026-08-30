/**
 * @fileoverview Health Challenge Routes
 * @description API endpoints for employee health challenges and wellness tracking.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createChallenge,
  getChallenges,
  getChallengeById,
  updateChallenge,
  joinChallenge,
  leaveChallenge,
  getMyParticipations,
  submitCheckIn,
  getMyCheckIns,
  getLeaderboard,
  allocateChallengeRewards,
  getChallengeAnalytics,
  getDashboard,
} = require('../controllers/healthChallenge.controller');

const router = express.Router();

// ─── Challenge CRUD ───────────────────────────────────────────────────────

router.get('/challenges', auth, getChallenges);
router.get('/challenges/:id', auth, getChallengeById);
router.post(
  '/challenges',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createChallenge,
);
router.patch(
  '/challenges/:id',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  updateChallenge,
);

// ─── Participation ────────────────────────────────────────────────────────

router.post('/challenges/:id/join', auth, writeRateLimiter, joinChallenge);
router.post('/challenges/:id/leave', auth, writeRateLimiter, leaveChallenge);
router.get('/my-participations', auth, getMyParticipations);

// ─── Check-Ins ────────────────────────────────────────────────────────────

router.post('/challenges/:id/check-in', auth, writeRateLimiter, submitCheckIn);
router.get('/challenges/:id/check-ins', auth, getMyCheckIns);

// ─── Leaderboard ──────────────────────────────────────────────────────────

router.get('/challenges/:id/leaderboard', auth, getLeaderboard);

// ─── Admin ────────────────────────────────────────────────────────────────

router.post(
  '/challenges/:id/allocate-rewards',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  allocateChallengeRewards,
);
router.get(
  '/challenges/:id/analytics',
  auth,
  requirePermission('READ_PAYROLL'),
  getChallengeAnalytics,
);
router.get('/dashboard', auth, getDashboard);

module.exports = router;
