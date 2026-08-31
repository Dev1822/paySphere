/**
 * Labor Allocation Controller - Issue #1599
 */
'use strict';

const LaborAllocationRule = require('../models/laborAllocationRule.model');
const LaborCostJournal = require('../models/laborCostJournal.model');
const { distributeLaborCost } = require('../services/laborAllocation.service');
const logger = require('../utils/logger');

async function createRule(req, res) {
  try {
    const { employeeId, effectiveFrom, allocationMethod, splits } = req.body;
    if (!employeeId || !effectiveFrom || !Array.isArray(splits) || !splits.length) {
      return res.status(400).json({ message: 'employeeId, effectiveFrom, and splits array are required.' });
    }

    const rule = await LaborAllocationRule.create({
      employeeId,
      effectiveFrom,
      allocationMethod: allocationMethod || 'timesheet_hours',
      splits
    });

    return res.status(201).json({ message: 'Labor allocation rule created successfully.', rule });
  } catch (err) {
    logger.error('createRule labor allocation error', { error: err.message });
    return res.status(500).json({ message: 'Failed to create labor allocation rule.' });
  }
}

async function getRules(req, res) {
  try {
    const filter = { ...{} };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;

    const rules = await LaborAllocationRule.find(filter)
      .populate('employeeId', 'fullName email department position')
      .sort('-createdAt')
      .lean();

    return res.json({ count: rules.length, rules });
  } catch (err) {
    logger.error('getRules labor allocation error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch allocation rules.' });
  }
}

async function postCostDistribution(req, res) {
  try {
    const { employeeId, payrollRunId, grossSalary, overtime, employerTaxes, benefitsCost, timesheetEntries } = req.body;

    if (!employeeId || !payrollRunId || !grossSalary || !timesheetEntries) {
      return res.status(400).json({
        message: 'employeeId, payrollRunId, grossSalary, and timesheetEntries are required.',
      });
    }

    const result = distributeLaborCost({
      employeeId,
      payrollRunId,
      grossSalary: Number(grossSalary),
      overtime: Number(overtime) || 0,
      employerTaxes: Number(employerTaxes) || 0,
      benefitsCost: Number(benefitsCost) || 0,
      timesheetEntries,
    });

    const createdEntries = [];
    for (const entry of result.journalEntries) {
      const doc = await LaborCostJournal.create({
        ...entry
      });
      createdEntries.push(doc);
    }

    return res.status(201).json({
      message: 'Labor cost distributed and journal lines posted successfully.',
      count: createdEntries.length,
      entries: createdEntries,
    });
  } catch (err) {
    logger.error('postCostDistribution error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function getJournalEntries(req, res) {
  try {
    const filter = { ...{} };
    if (req.query.projectCode) filter.projectCode = req.query.projectCode;
    if (req.query.payrollRunId) filter.payrollRunId = req.query.payrollRunId;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;

    const entries = await LaborCostJournal.find(filter)
      .populate('employeeId', 'fullName email')
      .sort('-postedAt')
      .lean();

    return res.json({ count: entries.length, entries });
  } catch (err) {
    logger.error('getJournalEntries error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch journal entries.' });
  }
}

module.exports = {
  createRule,
  getRules,
  postCostDistribution,
  getJournalEntries,
};