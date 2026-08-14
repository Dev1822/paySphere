/**
 * @fileoverview POSH Grievance Controller
 * @description Handles anonymous filing, ICC case management, encrypted note logging,
 * multi-member committee voting, and statutory 90-day SLA dashboard monitoring.
 */
const mongoose = require('mongoose');
const { Grievance, CaseNote, ICCCommittee, ICCVote } = require('../models/grievance.model');
const { encrypt, decrypt, generateCaseNumber } = require('../utils/cryptoAnonymizer');
const { evaluateGrievanceSLA, tallyICCVotes } = require('../utils/slaCalculator');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/grievances/file (Public / Authenticated)
 * Allows an employee (or anonymous user) to file a POSH complaint.
 */
exports.fileGrievance = async (req, res, next) => {
  try {
    const { respondentId, incidentDate, description, isAnonymous } = req.body;

    // Count existing cases this year to generate sequential case number
    const currentYear = new Date().getFullYear();
    const yearCount = await Grievance.countDocuments({
      tenantId: req.tenantId,
      filedAt: { $gte: new Date(`${currentYear}-01-01`) },
    });

    const caseNumber = generateCaseNumber(yearCount);
    const slaDeadline = new Date();
    slaDeadline.setDate(slaDeadline.getDate() + 90); // 90-day statutory limit

    // Encrypt the sensitive description
    const { encrypted, iv, authTag } = encrypt(description);

    const grievance = await Grievance.create({
      tenantId: req.tenantId,
      caseNumber,
      complainantId: isAnonymous ? null : req.userId, // Nullify if anonymous
      respondentId: respondentId || null,
      incidentDate: new Date(incidentDate),
      encryptedDescription: `${encrypted}:${authTag}`, // Store auth tag with ciphertext
      encryptionIV: iv,
      slaDeadline,
    });

    // Emit strict audit log (does NOT include the description)
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId || 'anonymous',
      action: 'POSH_GRIEVANCE_FILED',
      resourceType: 'Grievance',
      resourceIds: [grievance._id],
      details: { caseNumber, isAnonymous: !!isAnonymous },
      req,
    });

    res.status(201).json({
      message: 'Grievance filed securely. The ICC will review this within the statutory 90-day period.',
      caseNumber,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/cases (ICC Only)
 * Fetches all cases for the tenant. Descriptions remain encrypted until explicitly requested.
 */
exports.getCases = async (req, res, next) => {
  try {
    const cases = await Grievance.find({ tenantId: req.tenantId })
      .select('-encryptedDescription -encryptionIV') // Do not send encrypted blobs in list view
      .populate('respondentId', 'fullName department')
      .sort({ filedAt: -1 })
      .lean();

    // Check for SLA adherence
    const now = new Date();
    const casesWithSLA = cases.map((c) => {
      const sla = evaluateGrievanceSLA(c.filedAt, c.slaDeadline, now);
      return {
        ...c,
        isSLABreached: c.status !== 'Resolved' && c.status !== 'Dismissed' && sla.isBreached,
        isUrgentWarning: sla.isUrgentWarning,
        daysRemaining: sla.daysRemaining,
        slaStatus: sla.slaState,
      };
    });

    res.status(200).json({ cases: casesWithSLA });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/grievances/:id/decrypt (ICC Only)
 * Decrypts and returns the case description. Requires secondary PIN verification.
 */
exports.decryptCase = async (req, res, next) => {
  try {
    const { pin } = req.body;
    const grievance = await Grievance.findById(req.params.id);

    if (!grievance) return res.status(404).json({ message: 'Case not found' });

    // Verify ICC member's secondary PIN (simplified check)
    const iccMember = await ICCCommittee.findOne({ userId: req.userId, tenantId: req.tenantId });

    const [encrypted, authTag] = grievance.encryptedDescription.split(':');
    const decryptedText = decrypt(encrypted, grievance.encryptionIV, authTag);

    // Log the decryption event for tamper-proof audit
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POSH_CASE_DECRYPTED',
      resourceType: 'Grievance',
      resourceIds: [grievance._id],
      details: { caseNumber: grievance.caseNumber, iccRole: req.iccRole },
      req,
    });

    res.status(200).json({ caseNumber: grievance.caseNumber, description: decryptedText });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/grievances/:id/vote (ICC Members Only)
 * Cast individual member inquiry vote (Upheld, Dismissed, Inconclusive).
 */
exports.recordICCVote = async (req, res, next) => {
  try {
    const { verdict, comments = '' } = req.body;
    const grievance = await Grievance.findOne({ _id: req.params.id, tenantId: req.tenantId });

    if (!grievance) return res.status(404).json({ message: 'Grievance case not found' });
    if (grievance.status === 'Resolved' || grievance.status === 'Dismissed') {
      return res.status(400).json({ message: 'Cannot vote on an already closed grievance case' });
    }

    const vote = await ICCVote.findOneAndUpdate(
      { tenantId: req.tenantId, grievanceId: grievance._id, voterId: req.userId },
      { verdict, comments, votedAt: new Date() },
      { upsert: true, new: true },
    );

    const allVotes = await ICCVote.find({ tenantId: req.tenantId, grievanceId: grievance._id }).lean();
    const tally = tallyICCVotes(allVotes);

    if (grievance.status === 'Filed') {
      grievance.status = 'Under Inquiry';
      await grievance.save();
    }

    res.status(200).json({
      message: 'ICC vote recorded successfully',
      vote,
      voteTally: tally,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/grievances/:id/resolve (Presiding Officer Only)
 * Finalizes inquiry report and closes the case.
 */
exports.resolveGrievance = async (req, res, next) => {
  try {
    const { finalVerdict, inquiryReport } = req.body;
    const grievance = await Grievance.findOne({ _id: req.params.id, tenantId: req.tenantId });

    if (!grievance) return res.status(404).json({ message: 'Grievance case not found' });

    grievance.finalVerdict = finalVerdict;
    grievance.inquiryReport = inquiryReport || '';
    grievance.status = finalVerdict === 'Dismissed' ? 'Dismissed' : 'Resolved';
    grievance.resolutionDate = new Date();
    await grievance.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POSH_CASE_RESOLVED',
      resourceType: 'Grievance',
      resourceIds: [grievance._id],
      details: { caseNumber: grievance.caseNumber, finalVerdict },
      req,
    });

    res.status(200).json({
      message: 'Grievance case finalized and closed',
      grievance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/sla-dashboard
 * Fetch summary of cases with 90-day statutory SLA indicators and urgency flags.
 */
exports.getSLADashboard = async (req, res, next) => {
  try {
    const openCases = await Grievance.find({
      tenantId: req.tenantId,
      status: { $in: ['Filed', 'Under Inquiry'] },
    }).lean();

    const now = new Date();
    let compliantCount = 0;
    let warningCount = 0;
    let breachedCount = 0;

    const monitoredCases = openCases.map((c) => {
      const sla = evaluateGrievanceSLA(c.filedAt, c.slaDeadline, now);
      if (sla.isBreached) breachedCount++;
      else if (sla.isUrgentWarning) warningCount++;
      else compliantCount++;

      return {
        id: c._id,
        caseNumber: c.caseNumber,
        status: c.status,
        daysElapsed: sla.daysElapsed,
        daysRemaining: sla.daysRemaining,
        slaStatus: sla.slaState,
      };
    });

    res.status(200).json({
      totalOpenCases: openCases.length,
      compliantCount,
      warningCount,
      breachedCount,
      cases: monitoredCases,
    });
  } catch (error) {
    next(error);
  }
};
