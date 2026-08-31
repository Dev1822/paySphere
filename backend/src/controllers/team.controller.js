const teamManagementService = require('../services/teamManagement.service');
const TeamInvite = require('../models/teamInvite.model');
const User = require('../models/user.model');

exports.listInvites = async (req, res) => {
  try {
    const invites = await TeamInvite.find({}).populate('role', 'name').sort('-createdAt');
    res.json(invites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.listMembers = async (req, res) => {
  try {
    const members = await User.find({}).populate('role', 'name').select('-password -passwordHistory');
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendInvite = async (req, res) => {
  try {
    const { email, roleId } = req.body;
    const invite = await teamManagementService.generateInvite(req.tenantId, req.user._id, email, roleId);
    res.status(201).json(invite);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.revokeInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const invite = await teamManagementService.revokeInvite(req.tenantId, id, req.user._id);
    res.json(invite);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deactivateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await teamManagementService.deactivateMember(req.tenantId, id, req.user._id);
    res.json({ message: 'Member deactivated successfully', member });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.validateInviteToken = async (req, res) => {
  try {
    const { token } = req.query;
    const invite = await teamManagementService.validateToken(token);
    res.json({ email: invite.email, role: invite.role.name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.acceptInvite = async (req, res) => {
  try {
    const { token } = req.body;
    // Assuming the user is authenticated and req.user is set via auth middleware
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required to accept invite' });
    }
    const user = await teamManagementService.acceptInvite(token, req.user._id);
    res.json({ message: 'Invite accepted successfully', user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
