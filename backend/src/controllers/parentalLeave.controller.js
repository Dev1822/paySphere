/**
 * Parental Leave Controller - Issue #1817
 */
'use strict';

const ParentalLeaveClaim = require('../models/parentalLeaveClaim.model');
const {
  calculateParentalLeaveTopUp,
  calculateReconciliationAdjustment,
} = require('../services/parentalLeaveCalculator.service');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

async function previewTopUp(req, res) {
  try {
    const { regularMonthlySalary, workingDaysOnLeave, statutoryDailyInsuranceRate } = req.body;
    if (!regularMonthlySalary || !workingDaysOnLeave) {
      return res.status(400).json({ message: 'regularMonthlySalary and workingDaysOnLeave are required.' });
    }

    const breakdown = calculateParentalLeaveTopUp({
      regularMonthlySalary: Number(regularMonthlySalary),
      workingDaysOnLeave: Number(workingDaysOnLeave),
      statutoryDailyInsuranceRate: Number(statutoryDailyInsuranceRate) || 0,
    });

    return res.json({ breakdown });
  } catch (err) {
    logger.error('previewTopUp error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function submitClaim(req, res) {
  try {
    const {
      employeeId,
      leaveType,
      startDate,
      endDate,
      totalWorkingDaysOnLeave,
      regularMonthlySalary,
      statutoryDailyInsuranceRate,
    } = req.body;

    if (!employeeId || !leaveType || !startDate || !endDate || !totalWorkingDaysOnLeave || !regularMonthlySalary) {
      return res.status(400).json({
        message: 'employeeId, leaveType, startDate, endDate, totalWorkingDaysOnLeave, and regularMonthlySalary are required.',
      });
    }

    const metrics = calculateParentalLeaveTopUp({
      regularMonthlySalary: Number(regularMonthlySalary),
      workingDaysOnLeave: Number(totalWorkingDaysOnLeave),
      statutoryDailyInsuranceRate: Number(statutoryDailyInsuranceRate) || 0,
    });

    const claim = await ParentalLeaveClaim.create({
      tenantId: req.tenantId,
      employeeId,
      leaveType,
      startDate,
      endDate,
      totalWorkingDaysOnLeave: Number(totalWorkingDaysOnLeave),
      regularMonthlySalary: Number(regularMonthlySalary),
      proRatedNormalSalary: metrics.proRatedNormalSalary,
      statutoryDailyInsuranceRate: Number(statutoryDailyInsuranceRate) || 0,
      totalStatutoryBenefitEstimated: metrics.totalStatutoryBenefitEstimated,
      employerTopUpAmount: metrics.employerTopUpAmount,
      status: 'submitted',
    });

    return res.status(201).json({ message: 'Parental leave claim submitted successfully.', claim });
  } catch (err) {
    logger.error('submitClaim parental leave error', { error: err.message });
    return res.status(500).json({ message: 'Failed to submit parental leave claim.' });
  }
}

async function getClaims(req, res) {
  try {
    const filter = { ...tenantFilter(req) };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.leaveType) filter.leaveType = req.query.leaveType;
    if (req.query.status) filter.status = req.query.status;

    const claims = await ParentalLeaveClaim.find(filter)
      .populate('employeeId', 'fullName email department position')
      .sort('-createdAt')
      .lean();

    return res.json({ count: claims.length, claims });
  } catch (err) {
    logger.error('getClaims parental leave error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch parental leave claims.' });
  }
}

async function reconcileClaim(req, res) {
  try {
    const { id } = req.params;
    const { actualStatutoryBenefitReceived } = req.body;

    if (actualStatutoryBenefitReceived === undefined) {
      return res.status(400).json({ message: 'actualStatutoryBenefitReceived is required.' });
    }

    const claim = await ParentalLeaveClaim.findOne({ _id: id, ...tenantFilter(req) });
    if (!claim) {
      return res.status(404).json({ message: 'Parental leave claim not found.' });
    }

    const adjustment = calculateReconciliationAdjustment(
      claim.totalStatutoryBenefitEstimated,
      Number(actualStatutoryBenefitReceived)
    );

    claim.actualStatutoryBenefitReceived = Number(actualStatutoryBenefitReceived);
    claim.reconciliationAdjustmentAmount = adjustment;
    claim.status = 'reconciled';
    claim.reconciledAt = new Date();
    await claim.save();

    return res.json({
      message: 'Claim reconciled successfully.',
      claim,
      reconciliationAdjustment: adjustment,
    });
  } catch (err) {
    logger.error('reconcileClaim error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

module.exports = {
  previewTopUp,
  submitClaim,
  getClaims,
  reconcileClaim,
};