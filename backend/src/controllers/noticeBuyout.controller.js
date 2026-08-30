/**
 * @fileoverview Employee Notice Period Buyout & Shortfall Controller
 * @description Manages notice shortfall calculations, discretionary waiver workflows,
 * and employer buyout reimbursement disbursements.
 * Issue: #1959
 */

const {
  computeNoticeShortfallRecovery,
  processEmployerBuyoutReimbursement,
  generateNoticeSettlementLedger,
} = require('../utils/noticeBuyoutEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed stores
const recordedNoticeRecoveries = new Map();
const recordedBuyoutClaims = [];

/**
 * POST /api/notice-buyout/calculate-recovery
 * Calculates notice period shortfall deduction.
 */
async function calculateRecovery(req, res, next) {
  try {
    const {
      employeeId,
      monthlyBasic,
      monthlyDa = 0,
      contractualNoticeDays = 60,
      servedNoticeDays = 0,
      waivedDays = 0,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    let basic = monthlyBasic !== undefined ? Number(monthlyBasic) : 45000;
    let da = monthlyDa !== undefined ? Number(monthlyDa) : 0;

    try {
      const emp = await Employee.findById(employeeId);
      if (emp) {
        basic = emp.salaryDetails?.basic || basic;
        da = emp.salaryDetails?.da || da;
      }
    } catch {
      // Fallback
    }

    const calculation = computeNoticeShortfallRecovery(
      basic,
      da,
      Number(contractualNoticeDays),
      Number(servedNoticeDays),
      Number(waivedDays),
    );

    const record = {
      recordId: `NOTICE-REC-${Date.now()}`,
      employeeId: String(employeeId),
      calculatedAt: new Date().toISOString(),
      ...calculation,
    };

    recordedNoticeRecoveries.set(String(employeeId), record);

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.error('Error calculating notice recovery:', error);
    return next(error);
  }
}

/**
 * POST /api/notice-buyout/submit-waiver
 * Submits and approves management waiver for notice shortfall.
 */
async function submitWaiver(req, res, next) {
  try {
    const { employeeId, waivedDays, waiverReason, approvedBy } = req.body;

    if (!employeeId || waivedDays === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and waivedDays are required',
      });
    }

    const current = recordedNoticeRecoveries.get(String(employeeId));
    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'No active notice recovery calculation found for employee',
      });
    }

    const updated = computeNoticeShortfallRecovery(
      current.monthlyWageBasis,
      0,
      current.contractualDays,
      current.servedDays,
      Number(waivedDays),
    );

    const updatedRecord = {
      ...current,
      ...updated,
      waiverReason: waiverReason || 'Management Approval',
      approvedBy: approvedBy || req.user?.id || 'HR Admin',
      waiverAppliedAt: new Date().toISOString(),
    };

    recordedNoticeRecoveries.set(String(employeeId), updatedRecord);

    return res.status(200).json({
      success: true,
      message: `Successfully applied ${waivedDays} days notice waiver`,
      data: updatedRecord,
    });
  } catch (error) {
    logger.error('Error submitting notice waiver:', error);
    return next(error);
  }
}

/**
 * GET /api/notice-buyout/summary/:employeeId
 * Retrieves employee notice shortfall and buyout summary.
 */
async function getNoticeSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const recoveryRecord = recordedNoticeRecoveries.get(String(employeeId)) || null;
    const buyoutClaims = recordedBuyoutClaims.filter((b) => String(b.employeeId) === String(employeeId));

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        hasRecoveryRecord: Boolean(recoveryRecord),
        recoveryRecord,
        buyoutClaims,
      },
    });
  } catch (error) {
    logger.error('Error fetching notice summary:', error);
    return next(error);
  }
}

module.exports = {
  calculateRecovery,
  submitWaiver,
  getNoticeSummary,
  recordedNoticeRecoveries,
  recordedBuyoutClaims,
};
