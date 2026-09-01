/**
 * PSU Controller - Issue #1598
 */
'use strict';

const PsuGrant = require('../models/psuGrant.model');
const { evaluateRelativeTsrVesting } = require('../services/psuValuation.service');
const logger = require('../utils/logger');

async function createGrant(req, res) {
  try {
    const {
      employeeId,
      grantNumber,
      grantDate,
      performancePeriod,
      targetShares,
      baselineCompanyStockPrice,
      peerTickers,
    } = req.body;

    if (!employeeId || !grantNumber || !targetShares || !baselineCompanyStockPrice) {
      return res.status(400).json({
        message: 'employeeId, grantNumber, targetShares, and baselineCompanyStockPrice are required.',
      });
    }

    const grant = await PsuGrant.create({
      employeeId,
      grantNumber,
      grantDate: grantDate || new Date(),

      performancePeriod: performancePeriod || {
        startDate: new Date(),
        endDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
      },

      targetShares: Number(targetShares),
      baselineCompanyStockPrice: Number(baselineCompanyStockPrice),
      peerTickers: Array.isArray(peerTickers) ? peerTickers : [],
      status: 'active'
    });

    return res.status(201).json({ message: 'PSU Grant registered successfully.', psuGrant: grant });
  } catch (err) {
    logger.error('createGrant PSU error', { error: err.message });
    return res.status(500).json({ message: 'Failed to create PSU grant.' });
  }
}

async function getGrants(req, res) {
  try {
    const filter = { ...{} };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.status) filter.status = req.query.status;

    const grants = await PsuGrant.find(filter)
      .populate('employeeId', 'fullName email department position')
      .sort('-createdAt')
      .lean();

    return res.json({ count: grants.length, grants });
  } catch (err) {
    logger.error('getGrants PSU error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch PSU grants.' });
  }
}

async function evaluateGrantVesting(req, res) {
  try {
    const { id } = req.params;
    const { finalCompanyPrice, peersFinalPrices } = req.body;

    const grant = await PsuGrant.findOne({ _id: id, ...{} });
    if (!grant) {
      return res.status(404).json({ message: 'PSU Grant not found.' });
    }

    // Merge peers final prices if provided
    let peers = grant.peerTickers.map((p) => {
      const match = Array.isArray(peersFinalPrices) ? peersFinalPrices.find((x) => x.ticker === p.ticker) : null;
      return {
        ticker: p.ticker,
        baselinePrice: p.baselinePrice,
        finalPrice: match && match.finalPrice !== undefined ? match.finalPrice : p.finalPrice,
        tsrPercent: p.tsrPercent,
      };
    });

    const result = evaluateRelativeTsrVesting({
      baselineCompanyPrice: grant.baselineCompanyStockPrice,
      finalCompanyPrice: Number(finalCompanyPrice),
      peers,
      targetShares: grant.targetShares,
    });

    grant.finalCompanyStockPrice = Number(finalCompanyPrice);
    grant.companyTsrPercent = result.companyTsrPercent;
    grant.peerTickers = result.evaluatedPeers;
    grant.calculatedPercentileRank = result.calculatedPercentileRank;
    grant.vestingMultiplier = result.vestingMultiplier;
    grant.finalSharesVested = result.finalSharesVested;
    grant.status = 'evaluated';
    await grant.save();

    return res.json({ message: 'PSU Vesting evaluated successfully.', psuGrant: grant, valuation: result });
  } catch (err) {
    logger.error('evaluateGrantVesting error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

module.exports = {
  createGrant,
  getGrants,
  evaluateGrantVesting,
};