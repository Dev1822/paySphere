/**
 * @fileoverview Loss of Pay (LOP) Adjustment Controller
 * @description Manages retroactive LOP deltas, installment clawback scheduling,
 * and employee historical adjustment summaries.
 * Issue: #1647
 */

const {
  computeRetroactiveLopDelta,
  generateClawbackInstallmentPlan,
  buildLopAdjustmentJournalEntry,
} = require('../utils/lopClawbackEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed active clawback plans
const activeClawbackPlans = new Map();
const historicalAdjustmentLedger = [];

/**
 * POST /api/lop-adjustments/calculate-delta
 * Calculates retroactive LOP clawback or positive arrear payout.
 */
async function calculateDelta(req, res, next) {
  try {
    const { employeeId, unapprovedLopDays = 0, retroactivePaidLeaveDays = 0, totalDaysInCycle = 30 } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    let employee = null;
    try {
      employee = await Employee.findById(employeeId);
    } catch {
      // Mock fallback
    }

    const monthlyGross = employee?.salaryDetails?.gross || employee?.baseSalary || 60000;
    const deltaResult = computeRetroactiveLopDelta(
      monthlyGross,
      Number(totalDaysInCycle),
      Number(unapprovedLopDays),
      Number(retroactivePaidLeaveDays),
    );

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        monthlyGross,
        ...deltaResult,
      },
    });
  } catch (error) {
    logger.error('Error calculating LOP delta:', error);
    return next(error);
  }
}

/**
 * POST /api/lop-adjustments/schedule-clawback
 * Creates a compliant multi-month installment clawback plan.
 */
async function scheduleClawback(req, res, next) {
  try {
    const { employeeId, totalClawbackAmount, preferredInstallments = 2 } = req.body;

    if (!employeeId || totalClawbackAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and totalClawbackAmount are required',
      });
    }

    let employee = null;
    try {
      employee = await Employee.findById(employeeId);
    } catch {
      // Mock fallback
    }

    const monthlyGross = employee?.salaryDetails?.gross || employee?.baseSalary || 60000;
    const plan = generateClawbackInstallmentPlan(
      Number(totalClawbackAmount),
      monthlyGross,
      Number(preferredInstallments),
    );

    const record = {
      planId: `LOP-PLAN-${Date.now()}`,
      employeeId: String(employeeId),
      monthlyGross,
      createdAt: new Date().toISOString(),
      ...plan,
    };

    activeClawbackPlans.set(String(employeeId), record);
    historicalAdjustmentLedger.push(record);

    const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const journalEntry = buildLopAdjustmentJournalEntry(period, -Number(totalClawbackAmount), Number(totalClawbackAmount), 0);

    return res.status(201).json({
      success: true,
      message: 'Clawback installment plan scheduled successfully',
      data: {
        plan: record,
        journalEntry,
      },
    });
  } catch (error) {
    logger.error('Error scheduling clawback plan:', error);
    return next(error);
  }
}

/**
 * GET /api/lop-adjustments/summary/:employeeId
 * Fetches active clawback balance, installment schedule, and history.
 */
async function getEmployeeLopSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const activePlan = activeClawbackPlans.get(String(employeeId)) || null;

    const history = historicalAdjustmentLedger.filter(
      (h) => String(h.employeeId) === String(employeeId),
    );

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        hasActiveClawback: Boolean(activePlan),
        activePlan,
        historicalAdjustments: history,
      },
    });
  } catch (error) {
    logger.error('Error fetching employee LOP summary:', error);
    return next(error);
  }
}

module.exports = {
  calculateDelta,
  scheduleClawback,
  getEmployeeLopSummary,
  activeClawbackPlans,
  historicalAdjustmentLedger,
};
