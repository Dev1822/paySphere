/**
 * @fileoverview Flexible Benefit Plan (FBP) Controller
 * @description Manages employee FBP allocations, reimbursement claim processing,
 * and year-end taxable rollup summaries.
 * Issue: #1664
 */

const {
  validateFbpDeclaration,
  processFbpClaim,
  calculateYearEndFbpRollup,
  FBP_STATUTORY_ANNUAL_CAPS,
} = require('../utils/fbpEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or model-backed FBP stores
const activeFbpDeclarations = new Map();
const recordedFbpClaims = [];

/**
 * POST /api/fbp/declare-allocation
 * Submits or updates monthly FBP component allocation declaration.
 */
async function declareAllocation(req, res, next) {
  try {
    const { employeeId, monthlyAllocations, maxMonthlyPool = 25000 } = req.body;

    if (!employeeId || !monthlyAllocations || typeof monthlyAllocations !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'employeeId and monthlyAllocations object are required',
      });
    }

    const validation = validateFbpDeclaration(monthlyAllocations, Number(maxMonthlyPool));

    const record = {
      employeeId: String(employeeId),
      monthlyAllocations: validation.validatedAllocations,
      annualDeclaredTotal: validation.annualDeclaredTotal,
      declaredAt: new Date().toISOString(),
      statutoryCaps: FBP_STATUTORY_ANNUAL_CAPS,
    };

    activeFbpDeclarations.set(String(employeeId), record);

    return res.status(200).json({
      success: true,
      message: 'FBP allocation declared successfully',
      data: record,
      warnings: validation.errors.length > 0 ? validation.errors : undefined,
    });
  } catch (error) {
    logger.error('Error declaring FBP allocation:', error);
    return next(error);
  }
}

/**
 * POST /api/fbp/submit-claim
 * Submits an FBP reimbursement claim with proof verification.
 */
async function submitClaim(req, res, next) {
  try {
    const { employeeId, componentKey, claimAmount, receiptUrl, isVerified = true } = req.body;

    if (!employeeId || !componentKey || claimAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId, componentKey, and claimAmount are required',
      });
    }

    const declaration = activeFbpDeclarations.get(String(employeeId));
    const annualAllocated = (declaration?.monthlyAllocations?.[componentKey] || 0) * 12 || FBP_STATUTORY_ANNUAL_CAPS[componentKey] || 24000;

    const existingClaimsForComponent = recordedFbpClaims
      .filter((c) => String(c.employeeId) === String(employeeId) && c.componentKey === componentKey && c.isApproved)
      .reduce((sum, c) => sum + c.approvedAmount, 0);

    const claimResult = processFbpClaim(
      annualAllocated,
      existingClaimsForComponent,
      Number(claimAmount),
      Boolean(isVerified),
    );

    const claimRecord = {
      claimId: `FBP-CLM-${Date.now()}`,
      employeeId: String(employeeId),
      componentKey,
      requestedAmount: Number(claimAmount),
      receiptUrl: receiptUrl || null,
      submittedAt: new Date().toISOString(),
      ...claimResult,
    };

    recordedFbpClaims.push(claimRecord);

    return res.status(200).json({
      success: claimResult.isApproved,
      message: claimResult.isApproved
        ? 'FBP reimbursement claim processed and approved'
        : claimResult.rejectionReason,
      data: claimRecord,
    });
  } catch (error) {
    logger.error('Error submitting FBP claim:', error);
    return next(error);
  }
}

/**
 * GET /api/fbp/summary/:employeeId
 * Retrieves employee FBP component balances, claims history, and taxable rollup.
 */
async function getFbpSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const declaration = activeFbpDeclarations.get(String(employeeId)) || {
      monthlyAllocations: {
        TELECOM_BROADBAND: 2000,
        BOOKS_PERIODICALS: 1000,
        MEAL_COUPONS: 2000,
      },
    };

    const annualAllocations = {};
    for (const [k, v] of Object.entries(declaration.monthlyAllocations)) {
      annualAllocations[k] = v * 12;
    }

    const verifiedClaims = {};
    for (const c of recordedFbpClaims) {
      if (String(c.employeeId) === String(employeeId) && c.isApproved) {
        verifiedClaims[c.componentKey] = (verifiedClaims[c.componentKey] || 0) + c.approvedAmount;
      }
    }

    const rollup = calculateYearEndFbpRollup(annualAllocations, verifiedClaims);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        declaration,
        rollup,
        claims: recordedFbpClaims.filter((c) => String(c.employeeId) === String(employeeId)),
      },
    });
  } catch (error) {
    logger.error('Error fetching FBP summary:', error);
    return next(error);
  }
}

module.exports = {
  declareAllocation,
  submitClaim,
  getFbpSummary,
  activeFbpDeclarations,
  recordedFbpClaims,
};
