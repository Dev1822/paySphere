/**
 * Deferred Compensation Controller - Issue #1813
 */
'use strict';

const DeferredCompensation = require('../models/deferredCompensation.model');
const { calculateDeferralMetrics, compoundQuarterlyGrowth } = require('../services/deferredCompensation.service');
const logger = require('../utils/logger');

async function previewDeferral(req, res) {
  try {
    const { grossAmount, deferralPercentage, benchmarkRatePercent } = req.body;
    if (!grossAmount || !deferralPercentage) {
      return res.status(400).json({ message: 'grossAmount and deferralPercentage are required.' });
    }

    const metrics = calculateDeferralMetrics({
      grossAmount: Number(grossAmount),
      deferralPercentage: Number(deferralPercentage),
      benchmarkRatePercent: benchmarkRatePercent !== undefined ? Number(benchmarkRatePercent) : 6.5,
    });

    return res.json({ metrics });
  } catch (err) {
    logger.error('previewDeferral error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function createPlan(req, res) {
  try {
    const {
      employeeId,
      planYear,
      planType,
      grossAmount,
      deferralPercentage,
      phantomBenchmarkRatePercent,
      distributionTrigger,
      distributionSchedule,
    } = req.body;

    if (!employeeId || !planYear || !grossAmount || !deferralPercentage) {
      return res.status(400).json({
        message: 'employeeId, planYear, grossAmount, and deferralPercentage are required.',
      });
    }

    const metrics = calculateDeferralMetrics({
      grossAmount: Number(grossAmount),
      deferralPercentage: Number(deferralPercentage),
      benchmarkRatePercent: Number(phantomBenchmarkRatePercent) || 6.5,
    });

    const plan = await DeferredCompensation.create({
      employeeId,
      planYear: Number(planYear),
      planType: planType || 'elective_salary_deferral',
      deferralPercentage: metrics.deferralPercentage,
      initialPrincipalAmount: metrics.principalDeferred,
      accumulatedBalance: metrics.principalDeferred,
      phantomBenchmarkRatePercent: metrics.benchmarkRatePercent,
      ficaTaxPaidAtDeferral: metrics.ficaTaxDueAtDeferral,
      distributionTrigger: distributionTrigger || 'fixed_date',
      distributionSchedule: Array.isArray(distributionSchedule) ? distributionSchedule : [],
      status: 'active',
      createdBy: req.userId
    });

    return res.status(201).json({ message: 'Section 409A NQDC Plan recorded successfully.', plan });
  } catch (err) {
    logger.error('createPlan error', { error: err.message });
    return res.status(500).json({ message: 'Failed to create deferred compensation plan.' });
  }
}

async function getPlans(req, res) {
  try {
    const filter = { ...{} };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.planYear) filter.planYear = req.query.planYear;
    if (req.query.status) filter.status = req.query.status;

    const plans = await DeferredCompensation.find(filter)
      .populate('employeeId', 'fullName email department position')
      .sort('-planYear')
      .lean();

    return res.json({ count: plans.length, plans });
  } catch (err) {
    logger.error('getPlans error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch deferred compensation plans.' });
  }
}

async function accrueQuarterlyInterest(req, res) {
  try {
    const { id } = req.params;
    const plan = await DeferredCompensation.findOne({ _id: id, ...{} });
    if (!plan) {
      return res.status(404).json({ message: 'Deferred compensation plan not found.' });
    }

    const growth = compoundQuarterlyGrowth(plan.accumulatedBalance, plan.phantomBenchmarkRatePercent);

    plan.accumulatedBalance = growth.updatedBalance;
    plan.totalInterestCredited = Math.round((plan.totalInterestCredited + growth.interestEarned) * 100) / 100;
    await plan.save();

    return res.json({ message: 'Quarterly phantom interest credited successfully.', plan, growth });
  } catch (err) {
    logger.error('accrueQuarterlyInterest error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

module.exports = {
  previewDeferral,
  createPlan,
  getPlans,
  accrueQuarterlyInterest,
};