const express = require('express');
const router = express.Router();
const teamController = require('../controllers/team.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { requireFeatureFlag } = require('../middlewares/featureFlag.middleware');

// Routes for accepting/validating (might need special auth handling, but auth requires a valid token)
// Usually, accepting an invite is done after the user logs in or signs up.
router.get('/invites/validate', teamController.validateInviteToken);
router.post('/invites/accept', auth, teamController.acceptInvite);

// Routes requiring tenant ownership/admin privileges
router.use(auth);
// Assuming there's a permission like 'manage_team' or 'admin'
router.get('/members', requirePermission('view_team'), teamController.listMembers);
router.get('/invites', requirePermission('view_team'), teamController.listInvites);
router.post('/invites', requirePermission('manage_team'), teamController.sendInvite);
router.post('/invites/:id/revoke', requirePermission('manage_team'), teamController.revokeInvite);
router.post('/members/:id/deactivate', requirePermission('manage_team'), teamController.deactivateMember);

module.exports = router;
