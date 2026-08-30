/**
 * @fileoverview Cross-Border Contractor Controller
 * @description Manages dual-currency contractor retainer payouts, withholding certificates,
 * and foreign exposure analytics.
 * Issue: #1648
 */

const {
  computeContractorPayoutWithholding,
  generateWithholdingCertificate,
  aggregateCrossBorderExposure,
} = require('../utils/crossBorderContractorEngine.utils');
const logger = require('../utils/logger');

// In-memory or database-backed contractor payment settlements
const recordedContractorPayouts = [];

/**
 * POST /api/contractor-retainer/calculate-payout
 * Calculates cross-border payout with FX conversion and withholding tax.
 */
async function calculateContractorPayout(req, res, next) {
  try {
    const {
      contractorId,
      invoiceAmount,
      invoiceCurrency = 'USD',
      payoutCurrency = 'INR',
      fxRate = 83.5,
      taxStatus = 'W8BEN_CERTIFIED',
      customTreatyRate = null,
    } = req.body;

    if (!contractorId || invoiceAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'contractorId and invoiceAmount are required',
      });
    }

    const calculation = computeContractorPayoutWithholding(
      Number(invoiceAmount),
      invoiceCurrency,
      payoutCurrency,
      Number(fxRate),
      taxStatus,
      customTreatyRate,
    );

    const payoutRecord = {
      payoutId: `PAYOUT-XB-${Date.now()}`,
      contractorId: String(contractorId),
      createdAt: new Date().toISOString(),
      ...calculation,
    };

    recordedContractorPayouts.push(payoutRecord);

    return res.status(200).json({
      success: true,
      data: payoutRecord,
    });
  } catch (error) {
    logger.error('Error calculating contractor payout:', error);
    return next(error);
  }
}

/**
 * POST /api/contractor-retainer/generate-certificate
 * Generates standardized digital tax withholding certificate.
 */
async function generateCertificate(req, res, next) {
  try {
    const { contractorId, contractorName, taxIdentifier, taxFormType, grossPaidUSD, taxWithheldUSD, periodYear } = req.body;

    if (!contractorId || grossPaidUSD === undefined) {
      return res.status(400).json({
        success: false,
        message: 'contractorId and grossPaidUSD are required',
      });
    }

    const certificate = generateWithholdingCertificate(
      String(contractorId),
      contractorName,
      taxIdentifier,
      taxFormType,
      Number(grossPaidUSD),
      Number(taxWithheldUSD || 0),
      periodYear ? Number(periodYear) : new Date().getFullYear(),
    );

    return res.status(201).json({
      success: true,
      message: 'Digital tax withholding certificate generated successfully',
      data: certificate,
    });
  } catch (error) {
    logger.error('Error generating tax certificate:', error);
    return next(error);
  }
}

/**
 * GET /api/contractor-retainer/cross-border-summary
 * Fetches organization-wide foreign contractor tax withholdings and exposure.
 */
async function getCrossBorderSummary(req, res, next) {
  try {
    const summary = aggregateCrossBorderExposure(recordedContractorPayouts);

    return res.status(200).json({
      success: true,
      data: {
        ...summary,
        recentPayouts: recordedContractorPayouts.slice(-5),
      },
    });
  } catch (error) {
    logger.error('Error fetching cross-border summary:', error);
    return next(error);
  }
}

module.exports = {
  calculateContractorPayout,
  generateCertificate,
  getCrossBorderSummary,
  recordedContractorPayouts,
};
