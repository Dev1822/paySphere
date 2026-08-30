/**
 * Fringe Benefits Controller - Issue #1600
 */
'use strict';

const FringeBenefitRecord = require('../models/fringeBenefitRecord.model');
const { calculateFbtMetrics } = require('../services/fbtCalculator.service');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

async function calculatePreview(req, res) {
  try {
    const { rawBenefitValue, employeeContribution, grossUpFactorType, fbtRatePercent } = req.body;

    if (rawBenefitValue === undefined) {
      return res.status(400).json({ message: 'rawBenefitValue is required.' });
    }

    const metrics = calculateFbtMetrics({
      rawBenefitValue: Number(rawBenefitValue),
      employeeContribution: Number(employeeContribution) || 0,
      grossUpFactorType: grossUpFactorType || 'type_1_gst_credited',
      fbtRatePercent: fbtRatePercent !== undefined ? Number(fbtRatePercent) : 47,
    });

    return res.json({ metrics });
  } catch (err) {
    logger.error('calculatePreview FBT error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function recordBenefit(req, res) {
  try {
    const {
      employeeId,
      benefitCategory,
      quarter,
      rawBenefitValue,
      employeeContribution,
      grossUpFactorType,
    } = req.body;

    if (!employeeId || !benefitCategory || !quarter || rawBenefitValue === undefined) {
      return res.status(400).json({
        message: 'employeeId, benefitCategory, quarter, and rawBenefitValue are required.',
      });
    }

    const metrics = calculateFbtMetrics({
      rawBenefitValue: Number(rawBenefitValue),
      employeeContribution: Number(employeeContribution) || 0,
      grossUpFactorType: grossUpFactorType || 'type_1_gst_credited',
    });

    const record = await FringeBenefitRecord.create({
      tenantId: req.tenantId,
      employeeId,
      benefitCategory,
      quarter,
      rawBenefitValue: metrics.rawBenefitValue,
      employeeContribution: metrics.employeeContribution,
      netTaxableBenefitValue: metrics.netTaxableBenefitValue,
      grossUpFactorType: metrics.grossUpFactorType,
      grossUpMultiplier: metrics.grossUpMultiplier,
      grossedUpTaxableValue: metrics.grossedUpTaxableValue,
      fbtRatePercent: metrics.fbtRatePercent,
      employerFbtLiability: metrics.employerFbtLiability,
      recordedBy: req.userId,
    });

    return res.status(201).json({ message: 'Fringe benefit recorded successfully.', record });
  } catch (err) {
    logger.error('recordBenefit error', { error: err.message });
    return res.status(500).json({ message: 'Failed to record fringe benefit.' });
  }
}

async function getRecords(req, res) {
  try {
    const filter = { ...tenantFilter(req) };
    if (req.query.quarter) filter.quarter = req.query.quarter;
    if (req.query.benefitCategory) filter.benefitCategory = req.query.benefitCategory;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;

    const records = await FringeBenefitRecord.find(filter)
      .populate('employeeId', 'fullName email department position')
      .sort('-createdAt')
      .lean();

    return res.json({ count: records.length, records });
  } catch (err) {
    logger.error('getRecords FBT error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch fringe benefit records.' });
  }
}

async function getQuarterlySummaryReport(req, res) {
  try {
    const { quarter } = req.query;
    if (!quarter) {
      return res.status(400).json({ message: 'quarter parameter is required (e.g. 2026-Q1).' });
    }

    const records = await FringeBenefitRecord.find({
      ...tenantFilter(req),
      quarter,
    }).lean();

    const summary = {
      quarter,
      totalRecords: records.length,
      totalRawBenefitValue: 0,
      totalEmployeeContributions: 0,
      totalNetTaxableValue: 0,
      totalGrossedUpValue: 0,
      totalEmployerFbtLiability: 0,
      byCategory: {},
    };

    for (const r of records) {
      summary.totalRawBenefitValue += r.rawBenefitValue;
      summary.totalEmployeeContributions += r.employeeContribution;
      summary.totalNetTaxableValue += r.netTaxableBenefitValue;
      summary.totalGrossedUpValue += r.grossedUpTaxableValue;
      summary.totalEmployerFbtLiability += r.employerFbtLiability;

      if (!summary.byCategory[r.benefitCategory]) {
        summary.byCategory[r.benefitCategory] = { count: 0, totalLiability: 0 };
      }
      summary.byCategory[r.benefitCategory].count += 1;
      summary.byCategory[r.benefitCategory].totalLiability += r.employerFbtLiability;
    }

    summary.totalRawBenefitValue = Math.round(summary.totalRawBenefitValue * 100) / 100;
    summary.totalGrossedUpValue = Math.round(summary.totalGrossedUpValue * 100) / 100;
    summary.totalEmployerFbtLiability = Math.round(summary.totalEmployerFbtLiability * 100) / 100;

    return res.json({ summary });
  } catch (err) {
    logger.error('getQuarterlySummaryReport error', { error: err.message });
    return res.status(500).json({ message: 'Failed to generate quarterly FBT summary report.' });
  }
}

module.exports = {
  calculatePreview,
  recordBenefit,
  getRecords,
  getQuarterlySummaryReport,
};