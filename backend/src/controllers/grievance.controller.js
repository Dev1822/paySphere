/**
 * @fileoverview Grievance Controller (POSH & Ethics Committee)
 * @description Handles anonymous filing, ICC case management, encrypted note logging,
 * multi-member committee voting, statutory 90-day SLA dashboard monitoring,
 * and whistleblower reports with ethics committee management.
 */
const bcrypt = require('bcryptjs');
// `CaseNote` was imported here and never used, which the lint gate fails on —
// so the pre-commit hook rejected any change to this file. Dropped rather than
// worked around; the model is still exported and the note-logging endpoint that
// was presumably going to use it does not exist yet.
const {
  Grievance,
  ICCCommittee,
  ICCVote,
  GrievanceReport,
  EthicsCommittee,
} = require('../models/grievance.model');
const {
  encrypt,
  decrypt,
  generateCaseNumber,
  generateTrackingToken,
} = require('../utils/cryptoAnonymizer');
const {
  evaluateGrievanceSLA,
  tallyICCVotes,
} = require('../utils/slaCalculator');
const {
  resolveEscalationLevel,
  computeExtendedDeadline,
  validateCommitteeComposition,
  evaluateInterimRelief,
  buildCaseAgeingReport,
} = require('../utils/grievanceEscalation');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

// ============================================================================
// POSH Grievance Controllers
// ============================================================================

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
      filedAt: { $gte: new Date(`${currentYear}-01-01`) }
    });

    const caseNumber = generateCaseNumber(yearCount);
    const slaDeadline = new Date();
    slaDeadline.setDate(slaDeadline.getDate() + 90); // 90-day statutory limit

    // Encrypt the sensitive description
    const { encrypted, iv, authTag } = encrypt(description);

    const grievance = await Grievance.create({
      caseNumber,

      // Nullify if anonymous
      complainantId: isAnonymous ? null : req.userId,

      respondentId: respondentId || null,
      incidentDate: new Date(incidentDate),

      // Store auth tag with ciphertext
      encryptedDescription: `${encrypted}:${authTag}`,

      encryptionIV: iv,
      slaDeadline
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
      message:
        'Grievance filed securely. The ICC will review this within the statutory 90-day period.',
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
    const cases = await Grievance.find({})
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
        isSLABreached:
          c.status !== 'Resolved' && c.status !== 'Dismissed' && sla.isBreached,
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

    const grievance = await Grievance.findOne(
      { _id: req.params.id },
    );

    if (!grievance) return res.status(404).json({ message: 'Case not found' });

    const iccMember = await ICCCommittee.findOne(
      { userId: req.userId, isActive: true },
    );

    if (!iccMember) {
      logger.warn('POSH decryption attempted by a non-ICC account', {
        userId: req.userId,
        caseNumber: grievance.caseNumber,
      });

      return res.status(403).json({
        message:
          'Forbidden: Access restricted to Internal Complaints Committee (ICC) members only.',
      });
    }

    const pinAccepted =
      typeof pin === 'string' &&
      pin.length > 0 &&
      (await bcrypt.compare(pin, iccMember.decryptionPinHash));

    if (!pinAccepted) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'POSH_CASE_DECRYPT_DENIED',
        resourceType: 'Grievance',
        resourceIds: [grievance._id],
        details: {
          caseNumber: grievance.caseNumber,
          iccRole: req.iccRole,
          reason: 'invalid_pin',
        },
        req,
      });

      return res.status(403).json({ message: 'Invalid decryption PIN' });
    }

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

    res
      .status(200)
      .json({ caseNumber: grievance.caseNumber, description: decryptedText });
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
    const grievance = await Grievance.findOne(
      { _id: req.params.id },
    );

    if (!grievance)
      return res.status(404).json({ message: 'Grievance case not found' });
    if (grievance.status === 'Resolved' || grievance.status === 'Dismissed') {
      return res
        .status(400)
        .json({ message: 'Cannot vote on an already closed grievance case' });
    }

    const vote = await ICCVote.findOneAndUpdate(
      {
        grievanceId: grievance._id,
        voterId: req.userId
      },
      { verdict, comments, votedAt: new Date() },
      { upsert: true, new: true },
    );

    const allVotes = await ICCVote.find({
      grievanceId: grievance._id
    }).lean();
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
    const grievance = await Grievance.findOne(
      { _id: req.params.id },
    );

    if (!grievance)
      return res.status(404).json({ message: 'Grievance case not found' });

    // A verdict returned by an improperly constituted ICC is void, and
    // discovering that after it has been communicated to both parties is the
    // worst possible moment. Checked here rather than only at voting time
    // (#1157).
    const committee = await ICCCommittee.find(
      { isActive: true },
    );

    const composition = validateCommitteeComposition(committee);

    if (!composition.isValid) {
      return res.status(409).json({
        message:
          'The Internal Complaints Committee is not lawfully constituted, so a verdict cannot be recorded.',
        composition,
      });
    }

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
    const openCases = await Grievance.find(
      { status: { $in: ['Filed', 'Under Inquiry'] } },
    ).lean();

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

/**
 * GET /api/grievances/:id/escalation (ICC Only)
 * Where a case sits on the escalation ladder, and what trips the next rung.
 *
 * Raising a rung is a side effect of asking, and deliberately so: the ladder
 * exists to make sure somebody is told, and a rung that is only raised when a
 * human remembers to press a button is a rung that does not get raised. The
 * ledger keeps it idempotent — a rung already recorded is not raised again.
 */
exports.getEscalationStatus = async (req, res, next) => {
  try {
    const grievance = await Grievance.findOne(
      { _id: req.params.id },
    );

    if (!grievance) {
      return res.status(404).json({ message: 'Grievance case not found' });
    }

    const escalation = resolveEscalationLevel(grievance, new Date());

    if (!escalation.ok) {
      return res
        .status(422)
        .json({
          message: 'Escalation cannot be evaluated',
          errors: escalation.errors,
        });
    }

    if (escalation.pendingEscalations.length) {
      const now = new Date();

      grievance.escalations.push(
        ...escalation.pendingEscalations.map((level) => ({
          levelKey: level.levelKey,
          level: level.level,
          notify: level.notify,
          raisedAt: now,
          raisedBy: req.userId,
        })),
      );

      await grievance.save();

      for (const level of escalation.pendingEscalations) {
        eventBus.emit('AUDIT_LOG', {
          userId: req.userId,
          action: 'POSH_CASE_ESCALATED',
          resourceType: 'Grievance',
          resourceIds: [grievance._id],
          details: {
            caseNumber: grievance.caseNumber,
            levelKey: level.levelKey,
            notify: level.notify,
            daysElapsed: escalation.daysElapsed,
          },
          req,
        });
      }

      logger.warn('POSH case escalated', {
        caseNumber: grievance.caseNumber,
        levels: escalation.pendingEscalations.map((l) => l.levelKey),
        daysElapsed: escalation.daysElapsed,
      });
    }

    res.status(200).json({
      caseNumber: grievance.caseNumber,
      status: grievance.status,
      daysElapsed: escalation.daysElapsed,
      daysRemaining: escalation.daysRemaining,
      effectiveDeadline: escalation.effectiveDeadline,
      extensionDaysGranted: escalation.extensionDaysGranted,
      isBreached: escalation.isBreached,
      currentLevel: escalation.currentLevel,
      nextLevel: escalation.nextLevel,
      nextTriggerDate: escalation.nextTriggerDate,
      raisedNow: escalation.pendingEscalations,
      ledger: grievance.escalations,
      interimRelief: evaluateInterimRelief(grievance, new Date()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/grievances/:id/extend (Presiding Officer Only)
 * Extend the statutory inquiry period, in writing and with reasons.
 */
exports.extendInquiry = async (req, res, next) => {
  try {
    // The Act gives the Presiding Officer this decision. Every other ICC member
    // can read the case; extending the statutory clock is not theirs to do.
    if (req.iccRole !== 'Presiding Officer') {
      return res.status(403).json({
        message: 'Only the Presiding Officer may extend a statutory inquiry',
      });
    }

    const grievance = await Grievance.findOne(
      { _id: req.params.id },
    );

    if (!grievance) {
      return res.status(404).json({ message: 'Grievance case not found' });
    }

    const result = computeExtendedDeadline(grievance, req.body?.days, {
      reason: req.body?.reason,
    });

    if (!result.ok) {
      return res
        .status(400)
        .json({
          message: 'Inquiry could not be extended',
          errors: result.errors,
        });
    }

    grievance.extensions.push({
      days: result.extensionDays,
      reason: result.reason,
      previousDeadline: result.previousDeadline,
      revisedDeadline: result.revisedDeadline,
      approvedBy: req.userId,
      approvedAt: new Date(),
    });

    grievance.slaDeadline = result.revisedDeadline;
    await grievance.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POSH_INQUIRY_EXTENDED',
      resourceType: 'Grievance',
      resourceIds: [grievance._id],
      details: {
        caseNumber: grievance.caseNumber,
        days: result.extensionDays,
        // The reason is recorded on the case and in the audit trail. It is not
        // case content — it is the justification for the extension — so it does
        // not go through the encrypted-note path.
        reason: result.reason,
        previousDeadline: result.previousDeadline,
        revisedDeadline: result.revisedDeadline,
        totalInquiryDays: result.totalInquiryDays,
      },
      req,
    });

    res.status(200).json({
      message: `Inquiry extended by ${result.extensionDays} days`,
      caseNumber: grievance.caseNumber,
      previousDeadline: result.previousDeadline,
      revisedDeadline: result.revisedDeadline,
      totalExtensionDays: result.totalExtensionDays,
      totalInquiryDays: result.totalInquiryDays,
      remainingExtensionAllowance: result.remainingExtensionAllowance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/grievances/:id/interim-relief (ICC Only)
 * Record a request for interim relief, or a decision on one.
 */
exports.recordInterimRelief = async (req, res, next) => {
  try {
    const grievance = await Grievance.findOne(
      { _id: req.params.id },
    );

    if (!grievance) {
      return res.status(404).json({ message: 'Grievance case not found' });
    }

    const { action, granted, note } = req.body || {};

    if (action === 'request') {
      if (grievance.interimReliefRequestedAt) {
        return res.status(409).json({
          message: 'Interim relief has already been requested on this case',
          requestedAt: grievance.interimReliefRequestedAt,
        });
      }

      grievance.interimReliefRequestedAt = new Date();
      grievance.interimReliefNote = String(note || '').slice(0, 1000);
    } else if (action === 'decide') {
      if (!grievance.interimReliefRequestedAt) {
        // Deciding a request nobody made would start the clock and stop it in
        // the same instant, and the case would report as compliant on a relief
        // question that was never asked.
        return res.status(409).json({
          message: 'No interim relief has been requested on this case',
        });
      }

      if (grievance.interimReliefDecidedAt) {
        return res.status(409).json({
          message: 'Interim relief has already been decided on this case',
          decidedAt: grievance.interimReliefDecidedAt,
        });
      }

      grievance.interimReliefDecidedAt = new Date();
      grievance.interimReliefGranted = granted === true;
      grievance.interimReliefNote = String(
        note || grievance.interimReliefNote || '',
      ).slice(0, 1000);
    } else {
      return res
        .status(400)
        .json({ message: "action must be either 'request' or 'decide'" });
    }

    await grievance.save();

    const relief = evaluateInterimRelief(grievance, new Date());

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action:
        action === 'request'
          ? 'POSH_INTERIM_RELIEF_REQUESTED'
          : 'POSH_INTERIM_RELIEF_DECIDED',
      resourceType: 'Grievance',
      resourceIds: [grievance._id],
      details: {
        caseNumber: grievance.caseNumber,
        state: relief.state,
        isBreached: relief.isBreached,
      },
      req,
    });

    res.status(200).json({
      message:
        action === 'request'
          ? 'Interim relief request recorded'
          : `Interim relief ${grievance.interimReliefGranted ? 'granted' : 'declined'}`,
      caseNumber: grievance.caseNumber,
      interimRelief: relief,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/committee/validate (ICC Only)
 * Whether the committee is lawfully constituted, with every failure at once.
 */
exports.validateCommittee = async (req, res, next) => {
  try {
    const members = await ICCCommittee.find(
      { isActive: true },
    ).populate('userId', 'name email');

    const composition = validateCommitteeComposition(members);

    if (!composition.isValid) {
      logger.warn('ICC is not lawfully constituted', {
        tenantId: String(req.tenantId),
        failures: composition.failures.map((f) => f.rule),
      });
    }

    res.status(200).json({
      ...composition,
      members: members.map((m) => ({
        id: String(m._id),
        role: m.role,
        isWoman: m.isWoman,
        // The member's identity, not the case content — this endpoint says who
        // sits on the committee, which is not confidential, rather than
        // anything about a complaint.
        user: m.userId || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/ageing-report (ICC Only)
 * The open caseload by age, with escalation counts and what escalates next.
 */
exports.getCaseAgeingReport = async (req, res, next) => {
  try {
    const openCases = await Grievance.find(
      { status: { $in: ['Filed', 'Under Inquiry'] } },
    ).lean();

    res.status(200).json(buildCaseAgeingReport(openCases, new Date()));
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Ethics Committee & Whistleblower Controllers (Issue #1207)
// ============================================================================

/**
 * POST /api/grievances/submit
 * Public endpoint (no auth required) for anonymous whistleblowers.
 */
exports.submitAnonymous = async (req, res, next) => {
  try {
    const { tenantId, title, body } = req.body;

    if (!tenantId || !title || !body) {
      return res
        .status(400)
        .json({ message: 'Tenant ID, title, and body are required.' });
    }

    const trackingToken = generateTrackingToken();

    // Encrypt the sensitive payload
    const titleEnc = encrypt(title);
    const bodyEnc = encrypt(body);

    const report = await GrievanceReport.create({
      tenantId,
      trackingToken,
      encryptedTitle: titleEnc.encrypted,
      encryptedBody: bodyEnc.encrypted,
      iv: titleEnc.iv, // Using same IV for simplicity in this demo, ideally unique per field
      authTag: titleEnc.authTag,
      status: 'Submitted',
    });

    res.status(201).json({
      message:
        'Report submitted securely. Please save your tracking token to check status.',
      trackingToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/status/:token
 * Public endpoint for reporters to check the status of their submission.
 */
exports.getStatus = async (req, res, next) => {
  try {
    const report = await GrievanceReport.findOne({
      trackingToken: req.params.token,
    });
    if (!report)
      return res.status(404).json({ message: 'Invalid tracking token.' });

    res.status(200).json({ status: report.status, createdAt: report.createdAt });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/committee
 * Protected endpoint for Ethics Committee members to view and decrypt reports.
 */
exports.getCommitteeQueue = async (req, res, next) => {
  try {
    // Verify caller is on the ethics committee
    const isMember = await EthicsCommittee.findOne({
      userId: req.userId,
      isActive: true
    });
    if (!isMember)
      return res
        .status(403)
        .json({ message: 'Access denied. Not an Ethics Committee member.' });

    const reports = await GrievanceReport.find({}).sort(
      { createdAt: -1 },
    );

    // Decrypt titles for the queue view (body remains encrypted until explicitly opened)
    const queue = reports.map((r) => {
      try {
        const decryptedTitle = decrypt(r.encryptedTitle, r.iv, r.authTag);
        return {
          _id: r._id,
          title: decryptedTitle,
          status: r.status,
          createdAt: r.createdAt,
        };
      } catch (err) {
        return {
          _id: r._id,
          title: '[Decryption Error]',
          status: r.status,
          createdAt: r.createdAt,
        };
      }
    });

    res.status(200).json({ queue });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/:id/decrypt
 * Decrypts the full report body and logs the access event.
 */
exports.decryptReport = async (req, res, next) => {
  try {
    const isMember = await EthicsCommittee.findOne({
      userId: req.userId,
      isActive: true
    });
    if (!isMember)
      return res.status(403).json({ message: 'Access denied.' });

    const report = await GrievanceReport.findById(req.params.id);
    if (!report)
      return res.status(404).json({ message: 'Report not found.' });

    const decryptedTitle = decrypt(report.encryptedTitle, report.iv, report.authTag);
    const decryptedBody = decrypt(report.encryptedBody, report.iv, report.authTag);

    // Log access
    report.accessLogs.push({
      accessedBy: req.userId,
      action: 'Decrypted',
    });
    await report.save();

    logger.info(`[Grievance] User ${req.userId} decrypted report ${report._id}`);

    res.status(200).json({
      _id: report._id,
      title: decryptedTitle,
      body: decryptedBody,
      status: report.status,
      accessLogs: report.accessLogs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/grievances/:id/status
 * Updates the resolution state of a grievance.
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, resolutionNotes } = req.body;
    const report = await GrievanceReport.findById(req.params.id);
    if (!report)
      return res.status(404).json({ message: 'Report not found.' });

    report.status = status;
    if (status === 'Resolved' || status === 'Dismissed') {
      report.resolvedAt = new Date();
    }

    report.accessLogs.push({
      accessedBy: req.userId,
      action: 'Status Updated',
    });

    await report.save();
    res.status(200).json({ message: 'Status updated', report });
  } catch (error) {
    next(error);
  }
};
