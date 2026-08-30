/**
 * @fileoverview Employee Relocation Controller
 * @description Manages relocation package head allocations, reimbursement claims,
 * and Section 10(14) tax exemption vs taxable perquisite accounting.
 * Issue: #1765
 */

const {
  classifyRelocationExpense,
  calculateRelocationPackageTaxSplit,
  RELOCATION_CATEGORIES,
} = require('../utils/relocationEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed relocation stores
const activeRelocationPackages = new Map();
const recordedRelocationClaims = [];

/**
 * POST /api/relocation/create-package
 * Allocates a relocation budget package for an employee transfer.
 */
async function createPackage(req, res, next) {
  try {
    const {
      employeeId,
      transferFromCity = 'MUMBAI',
      transferToCity = 'BANGALORE',
      effectiveDate,
      allocatedBudget = 150000,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    const packageRecord = {
      packageId: `RELOC-PKG-${Date.now()}`,
      employeeId: String(employeeId),
      transferFromCity,
      transferToCity,
      effectiveDate: effectiveDate || new Date().toISOString(),
      allocatedBudget: Number(allocatedBudget),
      createdAt: new Date().toISOString(),
      categories: RELOCATION_CATEGORIES,
    };

    activeRelocationPackages.set(String(employeeId), packageRecord);

    return res.status(201).json({
      success: true,
      message: 'Relocation package initialized successfully',
      data: packageRecord,
    });
  } catch (error) {
    logger.error('Error creating relocation package:', error);
    return next(error);
  }
}

/**
 * POST /api/relocation/submit-claim
 * Submits a relocation expense voucher with GST invoice audit.
 */
async function submitClaim(req, res, next) {
  try {
    const {
      employeeId,
      category = 'GOODS_PACKING_TRANSIT',
      amount,
      stayDurationDays = 0,
      gstNumber,
      invoiceUrl,
      isGstVerified = true,
    } = req.body;

    if (!employeeId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and amount are required',
      });
    }

    const classification = classifyRelocationExpense(
      category,
      Number(amount),
      Number(stayDurationDays),
      Boolean(isGstVerified),
    );

    const claimRecord = {
      claimId: `RELOC-CLM-${Date.now()}`,
      employeeId: String(employeeId),
      gstNumber: gstNumber || null,
      invoiceUrl: invoiceUrl || null,
      submittedAt: new Date().toISOString(),
      ...classification,
    };

    recordedRelocationClaims.push(claimRecord);

    return res.status(200).json({
      success: true,
      message: 'Relocation expense claim processed and categorized',
      data: claimRecord,
    });
  } catch (error) {
    logger.error('Error submitting relocation claim:', error);
    return next(error);
  }
}

/**
 * GET /api/relocation/tax-summary/:employeeId
 * Retrieves tax-exempt reimbursements and taxable perquisite splits.
 */
async function getRelocationTaxSummary(req, res, next) {
  try {
    const { employeeId } = req.params;
    const pkg = activeRelocationPackages.get(String(employeeId)) || null;
    const employeeClaims = recordedRelocationClaims.filter(
      (c) => String(c.employeeId) === String(employeeId),
    );

    const summary = calculateRelocationPackageTaxSplit(employeeClaims);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        package: pkg,
        summary,
      },
    });
  } catch (error) {
    logger.error('Error fetching relocation tax summary:', error);
    return next(error);
  }
}

module.exports = {
  createPackage,
  submitClaim,
  getRelocationTaxSummary,
  activeRelocationPackages,
  recordedRelocationClaims,
};
