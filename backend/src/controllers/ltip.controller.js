/**
 * @fileoverview Executive LTIP Phantom Stock Controller
 * @description Manages phantom unit grants, KPI achievement evaluations,
 * and cash settlement payroll perquisite disbursements.
 * Issue: #1960
 */

const {
  evaluateTrancheVesting,
  aggregateLtipPortfolio,
  calculatePerformanceMultiplier,
} = require('../utils/ltipEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed LTIP grants
const recordedLtipGrants = [];

/**
 * POST /api/ltip/grant-units
 * Issues new Phantom Stock Units grant to an executive.
 */
async function grantUnits(req, res, next) {
  try {
    const {
      employeeId,
      targetUnits = 1000,
      grantFmv = 250,
      grantDate,
      vestingCliffYears = 3,
      performanceMetric = 'EBITDA_GROWTH',
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    const grantRecord = {
      grantId: `LTIP-GRT-${Date.now()}`,
      employeeId: String(employeeId),
      targetUnits: Number(targetUnits),
      grantFmv: Number(grantFmv),
      grantDate: grantDate || new Date().toISOString(),
      vestingCliffYears: Number(vestingCliffYears),
      performanceMetric,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    recordedLtipGrants.push(grantRecord);

    return res.status(201).json({
      success: true,
      message: `Successfully granted ${targetUnits} LTIP Phantom Stock Units`,
      data: grantRecord,
    });
  } catch (error) {
    logger.error('Error granting LTIP units:', error);
    return next(error);
  }
}

/**
 * POST /api/ltip/evaluate-vesting
 * Evaluates vesting tranche with KPI milestone performance multiplier.
 */
async function evaluateVesting(req, res, next) {
  try {
    const {
      grantId,
      kpiAchievementPercent = 100,
      currentVestingFmv,
    } = req.body;

    if (!grantId) {
      return res.status(400).json({
        success: false,
        message: 'grantId is required',
      });
    }

    const grant = recordedLtipGrants.find((g) => g.grantId === String(grantId));
    const targetUnits = grant ? grant.targetUnits : 1000;
    const grantFmv = grant ? grant.grantFmv : 200;
    const vestingFmv = currentVestingFmv !== undefined ? Number(currentVestingFmv) : (grantFmv * 1.5);

    const evaluation = evaluateTrancheVesting(
      targetUnits,
      grantFmv,
      vestingFmv,
      Number(kpiAchievementPercent),
    );

    const settlementRecord = {
      settlementId: `LTIP-SET-${Date.now()}`,
      grantId: String(grantId),
      settledAt: new Date().toISOString(),
      ...evaluation,
    };

    if (grant) {
      grant.status = evaluation.status;
      grant.settlement = settlementRecord;
    }

    return res.status(200).json({
      success: true,
      message: 'Vesting tranche evaluated successfully',
      data: settlementRecord,
    });
  } catch (error) {
    logger.error('Error evaluating LTIP vesting:', error);
    return next(error);
  }
}

/**
 * GET /api/ltip/portfolio/:employeeId
 * Retrieves executive LTIP portfolio and vesting schedule.
 */
async function getLtipPortfolio(req, res, next) {
  try {
    const { employeeId } = req.params;
    const employeeGrants = recordedLtipGrants.filter(
      (g) => String(g.employeeId) === String(employeeId),
    );

    const portfolioSummary = aggregateLtipPortfolio(employeeGrants);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        totalGrants: employeeGrants.length,
        portfolioSummary,
        grants: employeeGrants,
      },
    });
  } catch (error) {
    logger.error('Error fetching LTIP portfolio:', error);
    return next(error);
  }
}

module.exports = {
  grantUnits,
  evaluateVesting,
  getLtipPortfolio,
  recordedLtipGrants,
};
