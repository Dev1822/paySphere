'use strict';
const IpWhitelist = require('../models/ipWhitelist.model');
const logger = require('../utils/logger');

async function getIpWhitelist(req, res) {
  try {
    const whitelists = await IpWhitelist.find({});
    return res.json({ whitelists });
  } catch (err) {
    logger.error('getIpWhitelist error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch IP whitelist configuration.' });
  }
}

async function upsertIpWhitelist(req, res) {
  try {
    const { role, cidrBlocks, description } = req.body;
    if (!role) return res.status(400).json({ message: 'Role is required.' });

    const whitelist = await IpWhitelist.findOneAndUpdate(
      {
        role
      },
      { cidrBlocks: cidrBlocks || [], description: description || '', createdBy: req.userId },
      { upsert: true, new: true }
    );

    return res.json({ message: 'IP whitelist updated successfully.', whitelist });
  } catch (err) {
    logger.error('upsertIpWhitelist error', { error: err.message });
    return res.status(500).json({ message: 'Failed to save IP whitelist configuration.' });
  }
}

module.exports = { getIpWhitelist, upsertIpWhitelist };