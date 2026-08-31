/**
 * @fileoverview Corporate Broadband & Telecommuting Controller
 * @description Manages telecommuting claims, broadband invoice verification,
 * Rule 3(7)(ix) tax-free classification, and statements.
 * Issue: #2065
 */

const {
  classifyTelecommutingClaim,
  calculateAnnualTelecommutingTaxSplit,
  TELECOMMUTING_HEADS,
} = require('../utils/telecommutingEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed stores
const corporateTelecommutingPolicies = new Map();
const recordedTelecommutingClaims = [];

/**
 * POST /api/telecommuting/submit-broadband-claim
 * Submits broadband/telephone claim with GST invoice audit.
 */
async function submitBroadbandClaim(req, res, next) {
  try {
    const {
      employeeId,
      expenseHead = 'BROADBAND_INTERNET',
      amount,
      serviceProvider,
      invoiceNumber,
      invoiceUrl,
      isGstInvoiceAttached = true,
      policyCap,
    } = req.body;

    if (!employeeId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and amount are required',
      });
    }

    const evaluation = classifyTelecommutingClaim(
      expenseHead,
      Number(amount),
      Boolean(isGstInvoiceAttached),
      policyCap ? Number(policyCap) : 2500,
    );

    const claimRecord = {
      claimId: `TEL-CLM-${Date.now()}`,
      employeeId: String(employeeId),
      serviceProvider: serviceProvider || 'Telecom Provider',
      invoiceNumber: invoiceNumber || null,
      invoiceUrl: invoiceUrl || null,
      submittedAt: new Date().toISOString(),
      ...evaluation,
    };

    recordedTelecommutingClaims.push(claimRecord);

    return res.status(evaluation.isApproved ? 200 : 400).json({
      success: evaluation.isApproved,
      message: evaluation.isApproved
        ? 'Telecommuting claim approved and registered for payroll disbursement'
        : evaluation.auditNotes,
      data: claimRecord,
    });
  } catch (error) {
    logger.error('Error submitting telecommuting claim:', error);
    return next(error);
  }
}

/**
 * POST /api/telecommuting/configure-policy
 * Configures corporate monthly telecommuting limits.
 */
async function configurePolicy(req, res, next) {
  try {
    const { policyName = 'DEFAULT_REMOTE_POLICY', monthlyBroadbandCap = 2500, monthlyMobileCap = 1500 } = req.body;

    const policyRecord = {
      policyId: `TEL-POL-${Date.now()}`,
      policyName,
      monthlyBroadbandCap: Number(monthlyBroadbandCap),
      monthlyMobileCap: Number(monthlyMobileCap),
      configuredHeads: TELECOMMUTING_HEADS,
      updatedAt: new Date().toISOString(),
    };

    corporateTelecommutingPolicies.set(policyName, policyRecord);

    return res.status(201).json({
      success: true,
      message: 'Telecommuting reimbursement policy configured successfully',
      data: policyRecord,
    });
  } catch (error) {
    logger.error('Error configuring telecommuting policy:', error);
    return next(error);
  }
}

/**
 * GET /api/telecommuting/statement/:employeeId
 * Retrieves employee telecommuting reimbursements and tax-free summary.
 */
async function getTelecommutingStatement(req, res, next) {
  try {
    const { employeeId } = req.params;
    const employeeClaims = recordedTelecommutingClaims.filter(
      (c) => String(c.employeeId) === String(employeeId),
    );

    const taxSplit = calculateAnnualTelecommutingTaxSplit(employeeClaims);

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        taxSplit,
        claims: employeeClaims,
      },
    });
  } catch (error) {
    logger.error('Error fetching telecommuting statement:', error);
    return next(error);
  }
}

module.exports = {
  submitBroadbandClaim,
  configurePolicy,
  getTelecommutingStatement,
  corporateTelecommutingPolicies,
  recordedTelecommutingClaims,
};
