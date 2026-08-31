/**
 * @fileoverview Corporate Milestone Sabbatical Controller
 * @description Manages tenurial milestone accruals, sabbatical leave requests,
 * pro-rata wage disbursements, and exit encashments.
 * Issue: #2066
 */

const {
  evaluateSabbaticalMilestoneAccrual,
  calculateSabbaticalLeaveDisbursement,
  calculateExitSabbaticalEncashment,
  SABBATICAL_MILESTONES,
} = require('../utils/sabbaticalEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed stores
const employeeSabbaticalLedgers = new Map();

/**
 * POST /api/sabbatical/accrue-milestone
 * Checks employee tenure and credits sabbatical milestone balance.
 */
async function accrueMilestone(req, res, next) {
  try {
    const { employeeId, tenureYears = 5 } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    const accrual = evaluateSabbaticalMilestoneAccrual(Number(tenureYears));

    const record = {
      employeeId: String(employeeId),
      tenureYears: Number(tenureYears),
      accruedDays: accrual.accruedDays,
      currentBalanceDays: accrual.accruedDays,
      milestoneTier: accrual.milestoneTier,
      isEligible: accrual.isEligible,
      accruedAt: new Date().toISOString(),
    };

    employeeSabbaticalLedgers.set(String(employeeId), record);

    return res.status(200).json({
      success: true,
      message: accrual.isEligible
        ? `Accrued ${accrual.accruedDays} sabbatical days under ${accrual.milestoneTier}`
        : 'Employee has not reached minimum 5-year tenure milestone',
      data: record,
    });
  } catch (error) {
    logger.error('Error accruing sabbatical milestone:', error);
    return next(error);
  }
}

/**
 * POST /api/sabbatical/request-leave
 * Requests paid sabbatical leave and schedules wage disbursement.
 */
async function requestLeave(req, res, next) {
  try {
    const { employeeId, daysRequested = 30, monthlyBasic } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    let record = employeeSabbaticalLedgers.get(String(employeeId));
    if (!record) {
      record = {
        employeeId: String(employeeId),
        tenureYears: 5,
        accruedDays: 30,
        currentBalanceDays: 30,
        milestoneTier: 'SILVER_FIVE_YEAR_TIER',
        isEligible: true,
        accruedAt: new Date().toISOString(),
      };
      employeeSabbaticalLedgers.set(String(employeeId), record);
    }

    let basic = monthlyBasic !== undefined ? Number(monthlyBasic) : 60000;
    try {
      const emp = await Employee.findById(employeeId);
      if (emp) {
        basic = emp.salaryDetails?.basic || basic;
      }
    } catch {
      // Fallback
    }

    const disbursement = calculateSabbaticalLeaveDisbursement(
      basic,
      Number(daysRequested),
      record.currentBalanceDays,
    );

    if (disbursement.isApproved) {
      record.currentBalanceDays = disbursement.remainingBalance;
    }

    return res.status(disbursement.isApproved ? 200 : 400).json({
      success: disbursement.isApproved,
      message: disbursement.auditNotes,
      data: {
        employeeId,
        ...disbursement,
      },
    });
  } catch (error) {
    logger.error('Error requesting sabbatical leave:', error);
    return next(error);
  }
}

/**
 * GET /api/sabbatical/status/:employeeId
 * Retrieves employee sabbatical balance and exit encashment projection.
 */
async function getSabbaticalStatus(req, res, next) {
  try {
    const { employeeId } = req.params;
    const record = employeeSabbaticalLedgers.get(String(employeeId)) || {
      employeeId: String(employeeId),
      tenureYears: 0,
      accruedDays: 0,
      currentBalanceDays: 0,
      milestoneTier: 'BELOW_MILESTONE_THRESHOLD',
      isEligible: false,
    };

    const encashment = calculateExitSabbaticalEncashment(60000, record.currentBalanceDays);

    return res.status(200).json({
      success: true,
      data: {
        record,
        encashmentProjection: encashment,
        availableMilestones: SABBATICAL_MILESTONES,
      },
    });
  } catch (error) {
    logger.error('Error fetching sabbatical status:', error);
    return next(error);
  }
}

module.exports = {
  accrueMilestone,
  requestLeave,
  getSabbaticalStatus,
  employeeSabbaticalLedgers,
};
