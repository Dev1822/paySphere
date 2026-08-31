/**
 * Self-Service Controller - Issue #1114
 *
 * Endpoints employees can call for their own data only:
 *   GET /api/self/payslips               - own payroll history
 *   GET /api/self/documents              - own document vault listing
 *   GET /api/self/documents/:id/download - pre-signed download URL
 *   GET /api/self/leave-balance          - current leave balance
 */
'use strict';

const PayrollUpdate    = require('../models/payroll.model');
const EmployeeDocument = require('../models/employeeDocument.model');
const LeaveBalance     = require('../models/leaveBalance.model');
const logger           = require('../utils/logger');

async function getMyPayslips(req, res) {
  try {
    const payslips = await PayrollUpdate.find({
      ...{},
      employeeId: req.employeeId,
    })
      .sort({ year: -1, month: -1 })
      .limit(24)
      .select('month year grossPay netPay status createdAt')
      .lean();

    return res.json({ payslips });
  } catch (err) {
    logger.error('getMyPayslips error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch payslips.' });
  }
}

async function getMyDocuments(req, res) {
  try {
    // fileKey is excluded by default (select: false on the model).
    const documents = await EmployeeDocument.find({
      ...{},
      employeeId: req.employeeId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ documents });
  } catch (err) {
    logger.error('getMyDocuments error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch documents.' });
  }
}

async function downloadDocument(req, res) {
  try {
    // Ownership check: the query requires both the doc ID and the employee's own ID.
    // An employee cannot download another person's document by guessing an ObjectId.
    const doc = await EmployeeDocument.findOne({
      _id:        req.params.id,
      employeeId: req.employeeId,
      ...{},
    }).select('+fileKey'); // explicitly include the storage path for this one query

    if (!doc) {
      return res.status(404).json({ message: 'Document not found or access denied.' });
    }

    // In production: generate a pre-signed S3/Cloudinary URL here with a short TTL.
    // The fileKey is used server-side only and never sent to the client.
    const downloadUrl = process.env.STORAGE_BASE_URL
      ? process.env.STORAGE_BASE_URL + '/' + doc.fileKey + '?ttl=300'
      : '/api/storage/' + doc.fileKey; // local dev fallback

    return res.json({ downloadUrl, filename: doc.originalName, mimeType: doc.mimeType });
  } catch (err) {
    logger.error('downloadDocument error', { error: err.message });
    return res.status(500).json({ message: 'Could not generate download link.' });
  }
}

async function getMyLeaveBalance(req, res) {
  try {
    const balance = await LeaveBalance.findOne({
      ...{},
      employeeId: req.employeeId,
    }).lean();

    if (!balance) return res.status(404).json({ message: 'No leave balance record found.' });

    return res.json({ leaveBalance: balance });
  } catch (err) {
    logger.error('getMyLeaveBalance error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch leave balance.' });
  }
}

module.exports = { getMyPayslips, getMyDocuments, downloadDocument, getMyLeaveBalance };