/**
 * Tuition Assistance Controller - Issue #1816
 */
'use strict';

const TuitionReimbursement = require('../models/tuitionReimbursement.model');
const { calculateTuitionExemption } = require('../services/tuitionAssistance.service');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

async function previewClaim(req, res) {
  try {
    const { claimedAmount, cumulativePriorDisbursements, statutoryCap } = req.body;
    if (!claimedAmount) {
      return res.status(400).json({ message: 'claimedAmount is required.' });
    }

    const breakdown = calculateTuitionExemption({
      claimedAmount: Number(claimedAmount),
      cumulativePriorDisbursements: Number(cumulativePriorDisbursements) || 0,
      statutoryCap: statutoryCap !== undefined ? Number(statutoryCap) : 5250,
    });

    return res.json({ breakdown });
  } catch (err) {
    logger.error('previewClaim error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function submitClaim(req, res) {
  try {
    const {
      employeeId,
      claimNumber,
      fiscalYear,
      courseName,
      institutionName,
      isAccredited,
      completionDate,
      gradeOrCertification,
      claimedAmount,
      statutoryAnnualExemptionCap,
    } = req.body;

    if (!employeeId || !claimNumber || !fiscalYear || !courseName || !institutionName || !claimedAmount) {
      return res.status(400).json({
        message: 'employeeId, claimNumber, fiscalYear, courseName, institutionName, and claimedAmount are required.',
      });
    }

    // Aggregate cumulative prior disbursements for employee in fiscal year
    const priorClaims = await TuitionReimbursement.find({
      tenantId: req.tenantId,
      employeeId,
      fiscalYear: Number(fiscalYear),
      status: { $in: ['approved', 'disbursed'] },
    }).lean();

    const cumulativePrior = priorClaims.reduce((sum, c) => sum + (c.claimedAmount || 0), 0);

    const calculation = calculateTuitionExemption({
      claimedAmount: Number(claimedAmount),
      cumulativePriorDisbursements: cumulativePrior,
      statutoryCap: statutoryAnnualExemptionCap !== undefined ? Number(statutoryAnnualExemptionCap) : 5250,
    });

    const claim = await TuitionReimbursement.create({
      tenantId: req.tenantId,
      employeeId,
      claimNumber,
      fiscalYear: Number(fiscalYear),
      courseName,
      institutionName,
      isAccredited: isAccredited !== undefined ? isAccredited : true,
      completionDate: completionDate || new Date(),
      gradeOrCertification: gradeOrCertification || 'Pass',
      claimedAmount: Number(claimedAmount),
      cumulativePriorDisbursementsInFiscalYear: cumulativePrior,
      statutoryAnnualExemptionCap: calculation.statutoryCap,
      exemptReimbursementAmount: calculation.exemptReimbursementAmount,
      taxableSpilloverPerquisiteAmount: calculation.taxableSpilloverPerquisiteAmount,
      status: 'pending_review',
    });

    return res.status(201).json({ message: 'Tuition assistance claim submitted successfully.', claim });
  } catch (err) {
    logger.error('submitClaim error', { error: err.message });
    return res.status(500).json({ message: 'Failed to submit tuition assistance claim.' });
  }
}

async function getClaims(req, res) {
  try {
    const filter = { ...tenantFilter(req) };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.fiscalYear) filter.fiscalYear = req.query.fiscalYear;
    if (req.query.status) filter.status = req.query.status;

    const claims = await TuitionReimbursement.find(filter)
      .populate('employeeId', 'fullName email department position')
      .sort('-createdAt')
      .lean();

    return res.json({ count: claims.length, claims });
  } catch (err) {
    logger.error('getClaims error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch tuition claims.' });
  }
}

async function approveClaim(req, res) {
  try {
    const { id } = req.params;
    const claim = await TuitionReimbursement.findOne({ _id: id, ...tenantFilter(req) });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found.' });
    }

    claim.status = 'approved';
    claim.approvedBy = req.userId;
    await claim.save();

    return res.json({ message: 'Tuition assistance claim approved.', claim });
  } catch (err) {
    logger.error('approveClaim error', { error: err.message });
    return res.status(500).json({ message: 'Failed to approve tuition claim.' });
  }
}

module.exports = {
  previewClaim,
  submitClaim,
  getClaims,
  approveClaim,
};