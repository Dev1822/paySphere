/**
 * @fileoverview Timesheet Controller
 * @description Manages start/stop timers, manual entries, milestone approvals,
 * consolidated billing rollups, and client invoice generation.
 */
const mongoose = require('mongoose');
const { TimesheetEntry, ProjectMilestone } = require('../models/timesheet.model');
const Vendor = require('../models/vendor.model').Vendor;
const { Client, ClientInvoice } = require('../models/clientInvoice.model');
const {
  calculateDurationMinutes,
  calculateBillableAmount,
  aggregateTimesheetsForBilling,
  detectIdleOrFraud,
  buildInvoicePayloadFromTimesheets,
} = require('../utils/timesheetAggregator');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/timesheets/start
 * Starts a new timer for a gig-worker.
 */
exports.startTimer = async (req, res, next) => {
  try {
    const { projectId, description } = req.body;
    const contractorId = req.vendorId || req.body.contractorId;
    if (!contractorId) return res.status(400).json({ message: 'Contractor identification required' });

    const vendor = await Vendor.findOne({
      _id: contractorId
    });
    if (!vendor) return res.status(404).json({ message: 'Contractor not found' });

    const runningTimer = await TimesheetEntry.findOne({
      contractorId,
      status: 'In Progress',
      endTime: null
    });

    if (runningTimer) {
      return res.status(409).json({
        message: 'You already have a running timer. Please stop it before starting a new one.',
        activeTimer: runningTimer,
      });
    }

    const hourlyRate = vendor.hourlyRate || 0;

    const entry = await TimesheetEntry.create({
      contractorId,
      projectId,
      startTime: new Date(),
      hourlyRate,
      description,
      entryType: 'Timer',
      deviceIp: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ message: 'Timer started', entry });
  } catch (error) { next(error); }
};

/**
 * POST /api/timesheets/stop
 * Stops the active timer and calculates billable amount.
 */
exports.stopTimer = async (req, res, next) => {
  try {
    const contractorId = req.vendorId || req.body.contractorId;

    const entry = await TimesheetEntry.findOne({
      contractorId,
      status: 'In Progress',
      endTime: null
    });

    if (!entry) return res.status(404).json({ message: 'No active timer found' });

    entry.endTime = new Date();
    entry.durationMinutes = calculateDurationMinutes(entry.startTime, entry.endTime);

    const fraudCheck = detectIdleOrFraud(entry.durationMinutes);
    entry.isFlagged = fraudCheck.isFlagged;
    entry.flagReason = fraudCheck.reason;

    entry.billableAmount = calculateBillableAmount(entry.durationMinutes, entry.hourlyRate);
    entry.status = 'Pending Approval';

    await entry.save();

    res.status(200).json({ message: 'Timer stopped and logged', entry });
  } catch (error) { next(error); }
};

/**
 * PATCH /api/timesheets/:id/approve
 * Manager approves a timesheet entry (or milestone) for billing.
 */
exports.approveEntry = async (req, res, next) => {
  try {
    const { action, rejectionReason } = req.body;
    const entry = await TimesheetEntry.findOne({
      _id: req.params.id
    });

    if (!entry) return res.status(404).json({ message: 'Timesheet entry not found' });
    if (entry.status !== 'Pending Approval') {
      return res.status(400).json({ message: 'Entry is not pending approval' });
    }

    if (action === 'approve') {
      entry.status = 'Approved';
      entry.approvedBy = req.userId;
      entry.approvedAt = new Date();
      entry.isFlagged = false;
    } else {
      entry.status = 'Rejected';
      entry.rejectionReason = rejectionReason || 'Rejected by manager';
    }

    await entry.save();
    res.status(200).json({ message: `Entry ${action}d`, entry });
  } catch (error) { next(error); }
};

/**
 * GET /api/timesheets/summary
 * Aggregates approved & billable timesheets by project/contractor across date range.
 */
exports.getTimesheetSummary = async (req, res, next) => {
  try {
    const { projectId, contractorId, status = 'Approved' } = req.query;

    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (contractorId) filter.contractorId = contractorId;
    if (status && status !== 'ALL') filter.status = status;

    const entries = await TimesheetEntry.find(filter)
      .populate('contractorId', 'name vendorType')
      .sort({ startTime: -1 })
      .lean();

    const summary = aggregateTimesheetsForBilling(entries);

    res.status(200).json({
      success: true,
      filter: { projectId, contractorId, status },
      summary,
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/timesheets/generate-invoice
 * Converts approved timesheet entries into a draft client invoice.
 */
exports.generateInvoiceFromTimesheets = async (req, res, next) => {
  try {
    const { clientId, timesheetIds = [], invoiceNumber } = req.body;

    if (!clientId) return res.status(400).json({ message: 'Client ID is required' });
    if (!timesheetIds.length) return res.status(400).json({ message: 'At least one timesheet entry required' });

    const client = await Client.findOne({
      _id: clientId
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const entries = await TimesheetEntry.find({
      _id: { $in: timesheetIds },
      status: 'Approved'
    }).lean();

    if (entries.length === 0) {
      return res.status(400).json({ message: 'No approved timesheet entries found for the provided IDs' });
    }

    const payload = buildInvoicePayloadFromTimesheets(entries, client, invoiceNumber);

    const invoice = await ClientInvoice.create({
      clientId: client._id,
      invoiceNumber: payload.invoiceNumber,
      invoiceDate: payload.invoiceDate,
      foreignAmount: payload.foreignAmount,
      foreignCurrency: payload.foreignCurrency,
      exchangeRateAtInvoice: 1.0,
      inrEquivalent: payload.foreignAmount
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TIMESHEET_INVOICE_GENERATED',
      resourceType: 'ClientInvoice',
      resourceIds: [invoice._id],
      details: {
        invoiceNumber: invoice.invoiceNumber,
        timesheetCount: entries.length,
        totalAmount: payload.foreignAmount,
      },
      req,
    });

    res.status(201).json({
      message: 'Client invoice generated successfully from timesheets',
      invoice,
      billingSummary: payload.billingSummary,
    });
  } catch (error) { next(error); }
};
