/**
 * Severance Controller - Issue #1597
 */
'use strict';

const SeverancePackage = require('../models/severancePackage.model');
const { calculateSeveranceBreakdown } = require('../services/severanceCalculator.service');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

async function calculatePreview(req, res) {
  try {
    const { lastDrawnMonthlySalary, tenureYears, noticePeriodDays, voluntaryExGratia, leaveEncashment } = req.body;

    if (!lastDrawnMonthlySalary || tenureYears === undefined) {
      return res.status(400).json({ message: 'lastDrawnMonthlySalary and tenureYears are required.' });
    }

    const breakdown = calculateSeveranceBreakdown({
      lastDrawnMonthlySalary: Number(lastDrawnMonthlySalary),
      tenureYears: Number(tenureYears),
      noticePeriodDays: noticePeriodDays !== undefined ? Number(noticePeriodDays) : 30,
      voluntaryExGratia: Number(voluntaryExGratia) || 0,
      leaveEncashment: Number(leaveEncashment) || 0,
    });

    return res.json({ breakdown });
  } catch (err) {
    logger.error('calculatePreview severance error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function createSeverancePackage(req, res) {
  try {
    const {
      employeeId,
      separationType,
      tenureYears,
      lastDrawnMonthlySalary,
      noticePeriodDays,
      voluntaryExGratia,
      leaveEncashment,
    } = req.body;

    if (!employeeId || !separationType || !lastDrawnMonthlySalary || tenureYears === undefined) {
      return res.status(400).json({
        message: 'employeeId, separationType, lastDrawnMonthlySalary, and tenureYears are required.',
      });
    }

    const breakdown = calculateSeveranceBreakdown({
      lastDrawnMonthlySalary: Number(lastDrawnMonthlySalary),
      tenureYears: Number(tenureYears),
      noticePeriodDays: noticePeriodDays !== undefined ? Number(noticePeriodDays) : 30,
      voluntaryExGratia: Number(voluntaryExGratia) || 0,
      leaveEncashment: Number(leaveEncashment) || 0,
    });

    const pkg = await SeverancePackage.create({
      tenantId: req.tenantId,
      employeeId,
      separationType,
      tenureYears: Number(tenureYears),
      lastDrawnMonthlySalary: Number(lastDrawnMonthlySalary),
      noticePeriodDays: noticePeriodDays !== undefined ? Number(noticePeriodDays) : 30,
      noticePayAmount: breakdown.noticePayAmount,
      statutoryRetrenchmentAmount: breakdown.statutoryRetrenchmentAmount,
      voluntaryExGratiaAmount: Number(voluntaryExGratia) || 0,
      leaveEncashmentAmount: Number(leaveEncashment) || 0,
      grossSeveranceAmount: breakdown.grossSeveranceAmount,
      taxableSeveranceAmount: breakdown.taxableSeveranceAmount,
      section89ReliefAmount: breakdown.section89ReliefAmount,
      netDisbursementAmount: breakdown.netDisbursementAmount,
      status: 'draft',
    });

    return res.status(201).json({ message: 'Severance package draft created successfully.', severancePackage: pkg });
  } catch (err) {
    logger.error('createSeverancePackage error', { error: err.message });
    return res.status(500).json({ message: 'Failed to create severance package.' });
  }
}

async function getSeverancePackages(req, res) {
  try {
    const filter = { ...tenantFilter(req) };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.status) filter.status = req.query.status;

    const packages = await SeverancePackage.find(filter)
      .populate('employeeId', 'fullName email department position')
      .populate('approvedBy', 'fullName email')
      .sort('-createdAt')
      .lean();

    return res.json({ count: packages.length, packages });
  } catch (err) {
    logger.error('getSeverancePackages error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch severance packages.' });
  }
}

async function approveSeverancePackage(req, res) {
  try {
    const { id } = req.params;
    const pkg = await SeverancePackage.findOne({ _id: id, ...tenantFilter(req) });
    if (!pkg) {
      return res.status(404).json({ message: 'Severance package not found.' });
    }

    pkg.status = 'approved';
    pkg.approvedBy = req.userId;
    await pkg.save();

    return res.json({ message: 'Severance package approved successfully.', severancePackage: pkg });
  } catch (err) {
    logger.error('approveSeverancePackage error', { error: err.message });
    return res.status(500).json({ message: 'Failed to approve severance package.' });
  }
}

async function disburseSeverancePackage(req, res) {
  try {
    const { id } = req.params;
    const pkg = await SeverancePackage.findOne({ _id: id, ...tenantFilter(req) });
    if (!pkg) {
      return res.status(404).json({ message: 'Severance package not found.' });
    }

    if (pkg.status !== 'approved') {
      return res.status(400).json({ message: 'Severance package must be approved before disbursement.' });
    }

    pkg.status = 'disbursed';
    pkg.disbursedAt = new Date();
    await pkg.save();

    return res.json({ message: 'Severance package disbursed and posted to settlement.', severancePackage: pkg });
  } catch (err) {
    logger.error('disburseSeverancePackage error', { error: err.message });
    return res.status(500).json({ message: 'Failed to disburse severance package.' });
  }
}

module.exports = {
  calculatePreview,
  createSeverancePackage,
  getSeverancePackages,
  approveSeverancePackage,
  disburseSeverancePackage,
};