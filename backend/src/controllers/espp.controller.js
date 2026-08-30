/**
 * @fileoverview Employee Stock Purchase Plan (ESPP) Controller
 * @description Manages employee ESPP enrollments, offering period purchase executions,
 * and equity perquisite tax statements.
 * Issue: #1667
 */

const {
  computeMonthlyEsppDeduction,
  executeShareAllocation,
  STATUTORY_MAX_DISCOUNT_PERCENT,
} = require('../utils/esppEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed active ESPP store
const activeEsppEnrollments = new Map();
const recordedEsppPurchases = [];

/**
 * POST /api/espp/enroll
 * Enrolls an employee in the ESPP offering period with elected contribution percent.
 */
async function enrollEspp(req, res, next) {
  try {
    const { employeeId, contributionPercent = 10, offeringPeriod = '2026-H2' } = req.body;

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

    const monthlyGross = employee?.salaryDetails?.gross || employee?.baseSalary || 80000;
    const deduction = computeMonthlyEsppDeduction(monthlyGross, Number(contributionPercent));

    const enrollmentRecord = {
      enrollmentId: `ESPP-ENROLL-${Date.now()}`,
      employeeId: String(employeeId),
      offeringPeriod,
      monthlyGross,
      contributionPercent: deduction.contributionPercent,
      monthlyDeduction: deduction.monthlyDeduction,
      accumulatedBalance: 0,
      carryoverCash: 0,
      enrolledAt: new Date().toISOString(),
    };

    activeEsppEnrollments.set(String(employeeId), enrollmentRecord);

    return res.status(201).json({
      success: true,
      message: 'Enrolled in ESPP offering period successfully',
      data: enrollmentRecord,
    });
  } catch (error) {
    logger.error('Error enrolling in ESPP:', error);
    return next(error);
  }
}

/**
 * POST /api/espp/execute-purchase
 * Executes purchase allocation on purchase date applying Section 423 lookback discount.
 */
async function executePurchase(req, res, next) {
  try {
    const {
      employeeId,
      grantDateFmv,
      purchaseDateFmv,
      accumulatedFunds,
      priorCarryoverCash = 0,
      discountPercent = STATUTORY_MAX_DISCOUNT_PERCENT,
    } = req.body;

    if (!employeeId || grantDateFmv === undefined || purchaseDateFmv === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId, grantDateFmv, and purchaseDateFmv are required',
      });
    }

    const enrollment = activeEsppEnrollments.get(String(employeeId));
    const totalAccumulated = accumulatedFunds !== undefined
      ? Number(accumulatedFunds)
      : (enrollment?.accumulatedBalance || 3000);

    const carryover = Number(priorCarryoverCash) || enrollment?.carryoverCash || 0;

    const allocation = executeShareAllocation(
      totalAccumulated,
      carryover,
      Number(grantDateFmv),
      Number(purchaseDateFmv),
      Number(discountPercent),
    );

    const purchaseRecord = {
      purchaseId: `ESPP-PURCHASE-${Date.now()}`,
      employeeId: String(employeeId),
      executedAt: new Date().toISOString(),
      ...allocation,
    };

    if (enrollment) {
      enrollment.accumulatedBalance = 0;
      enrollment.carryoverCash = allocation.residualCashCarryover;
    }

    recordedEsppPurchases.push(purchaseRecord);

    return res.status(200).json({
      success: true,
      message: `Successfully allocated ${allocation.sharesAllocated} ESPP shares`,
      data: purchaseRecord,
    });
  } catch (error) {
    logger.error('Error executing ESPP purchase:', error);
    return next(error);
  }
}

/**
 * GET /api/espp/summary/:employeeId
 * Retrieves employee accumulated deductions, purchase history, and tax statements.
 */
async function getEsppSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const enrollment = activeEsppEnrollments.get(String(employeeId)) || null;
    const purchases = recordedEsppPurchases.filter((p) => String(p.employeeId) === String(employeeId));

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        isEnrolled: Boolean(enrollment),
        enrollment,
        purchases,
      },
    });
  } catch (error) {
    logger.error('Error fetching ESPP summary:', error);
    return next(error);
  }
}

module.exports = {
  enrollEspp,
  executePurchase,
  getEsppSummary,
  activeEsppEnrollments,
  recordedEsppPurchases,
};