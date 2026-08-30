/**
 * @fileoverview Corporate Wellness Wallet Controller
 * @description Manages employee wellness wallet allocations, claim submissions,
 * Section 80D preventive health tax exemptions, and statements.
 * Issue: #1961
 */

const {
  evaluateWellnessClaim,
  calculateAnnualWellnessTaxSplit,
  WELLNESS_CATEGORIES,
} = require('../utils/wellnessWalletEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed stores
const employeeWellnessWallets = new Map();
const recordedWellnessClaims = [];

/**
 * POST /api/wellness-wallet/allocate
 * Initializes or renews employee wellness wallet.
 */
async function allocateWallet(req, res, next) {
  try {
    const { employeeId, annualQuota = 36000, monthlyLimit = 3000 } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    const walletRecord = {
      walletId: `WELL-WLT-${Date.now()}`,
      employeeId: String(employeeId),
      annualQuota: Number(annualQuota),
      monthlyLimit: Number(monthlyLimit),
      allocatedAt: new Date().toISOString(),
      categories: WELLNESS_CATEGORIES,
    };

    employeeWellnessWallets.set(String(employeeId), walletRecord);

    return res.status(201).json({
      success: true,
      message: 'Corporate wellness wallet initialized successfully',
      data: walletRecord,
    });
  } catch (error) {
    logger.error('Error allocating wellness wallet:', error);
    return next(error);
  }
}

/**
 * POST /api/wellness-wallet/submit-claim
 * Submits and processes a wellness reimbursement claim.
 */
async function submitClaim(req, res, next) {
  try {
    const {
      employeeId,
      category = 'GYM_FITNESS_MEMBERSHIP',
      amount,
      invoiceNumber,
      invoiceUrl,
      isReceiptVerified = true,
    } = req.body;

    if (!employeeId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and amount are required',
      });
    }

    const previousClaims = recordedWellnessClaims.filter(
      (c) => String(c.employeeId) === String(employeeId) && c.isApproved,
    );
    const ytdPreventive = previousClaims.reduce(
      (sum, c) => sum + (c.taxExempt80DAmount || 0),
      0,
    );

    const evaluation = evaluateWellnessClaim(
      category,
      Number(amount),
      ytdPreventive,
      Boolean(isReceiptVerified),
    );

    const claimRecord = {
      claimId: `WLM-CLM-${Date.now()}`,
      employeeId: String(employeeId),
      invoiceNumber: invoiceNumber || null,
      invoiceUrl: invoiceUrl || null,
      submittedAt: new Date().toISOString(),
      ...evaluation,
    };

    recordedWellnessClaims.push(claimRecord);

    return res.status(evaluation.isApproved ? 200 : 400).json({
      success: evaluation.isApproved,
      message: evaluation.isApproved
        ? 'Wellness claim approved and processed for payroll disbursement'
        : evaluation.auditNotes,
      data: claimRecord,
    });
  } catch (error) {
    logger.error('Error submitting wellness claim:', error);
    return next(error);
  }
}

/**
 * GET /api/wellness-wallet/statement/:employeeId
 * Retrieves employee wellness wallet balance and Section 80D tax credits.
 */
async function getWalletStatement(req, res, next) {
  try {
    const { employeeId } = req.params;
    const wallet = employeeWellnessWallets.get(String(employeeId)) || null;
    const employeeClaims = recordedWellnessClaims.filter(
      (c) => String(c.employeeId) === String(employeeId),
    );

    const taxSplit = calculateAnnualWellnessTaxSplit(employeeClaims);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        wallet,
        taxSplit,
        claims: employeeClaims,
      },
    });
  } catch (error) {
    logger.error('Error fetching wellness wallet statement:', error);
    return next(error);
  }
}

module.exports = {
  allocateWallet,
  submitClaim,
  getWalletStatement,
  employeeWellnessWallets,
  recordedWellnessClaims,
};
