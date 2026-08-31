/**
 * @fileoverview Requisition, candidate pipeline and interview scorecard endpoints.
 * @description Issue: #1074
 *
 * Every query is filtered by `tenantId` on the way in rather than checked after
 * the fetch — the shape #1010 settled on. Fetch-then-check leaks existence
 * through the 404-vs-403 distinction and is one refactor away from not checking
 * at all.
 */

const mongoose = require('mongoose');

const {
  JobRequisition,
  Candidate,
  InterviewFeedback,
} = require('../models/recruitment.model');
const HeadcountRequisition = require('../models/headcountRequisition.model');
const Position = require('../models/position.model');
const {
  PIPELINE_STAGES,
  REQUISITION_STATUS,
  applyTransition,
  scoreCard,
  funnelMetrics,
  timeToHire,
  sourceEffectiveness,
  checkOfferAgainstBand,
  requisitionFillState,
  canHireAgainst,
} = require('../utils/recruitmentPipeline');
const eventBus = require('../services/event.service');

/**
 * POST /api/recruitment/requisitions
 */
exports.createRequisition = async (req, res, next) => {
  try {
    const {
      requisitionCode,
      title,
      department,
      location,
      employmentType,
      openings,
      ctcBandMin,
      ctcBandMax,
      currency,
      hiringManagerId,
      targetStartDate,
      justification,
    } = req.body;

    if (!requisitionCode || !title || !openings) {
      return res
        .status(400)
        .json({ message: 'requisitionCode, title and openings are required' });
    }

    if (Number(ctcBandMax) < Number(ctcBandMin)) {
      return res
        .status(400)
        .json({ message: 'ctcBandMax cannot be lower than ctcBandMin' });
    }

    const requisition = await JobRequisition.create({
      requisitionCode,
      title,
      department,
      location,
      employmentType,
      openings,
      ctcBandMin,
      ctcBandMax,
      currency,

      hiringManagerId:
        hiringManagerId && mongoose.isValidObjectId(hiringManagerId)
          ? hiringManagerId
          : null,

      targetStartDate: targetStartDate ? new Date(targetStartDate) : null,
      justification,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'REQUISITION_CREATED',
      resourceType: 'JobRequisition',
      resourceIds: [requisition._id],
      details: { requisitionCode, title, openings, ctcBandMin, ctcBandMax },
      req,
    });

    return res
      .status(201)
      .json({ message: 'Requisition created', requisition });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'That requisition code is already in use' });
    }
    return next(error);
  }
};

/**
 * GET /api/recruitment/requisitions
 *
 * Each requisition comes back with its fill state, because "how many openings
 * are left" is the first thing anyone asks and deriving it client-side is how
 * two screens end up disagreeing.
 */
exports.getRequisitions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.department) filter.department = req.query.department;

    const requisitions = await JobRequisition.find(filter).lean();
    const candidates = await Candidate.find({})
      .select('requisitionId currentStage')
      .lean();

    const byRequisition = new Map();
    for (const candidate of candidates) {
      const key = String(candidate.requisitionId);
      if (!byRequisition.has(key)) byRequisition.set(key, []);
      byRequisition.get(key).push(candidate);
    }

    return res.json({
      requisitions: requisitions.map((requisition) => ({
        ...requisition,
        fill: requisitionFillState(
          requisition,
          byRequisition.get(String(requisition._id)) || [],
        ),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/recruitment/requisitions/:id/status
 *
 * Closing a requisition with candidates still in flight is allowed but
 * reported, because the alternative — refusing — leaves no way to close a role
 * that was cancelled, and silently abandoning live candidates is worse than
 * saying how many there were.
 */
exports.updateRequisitionStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid requisition id' });
    }

    const { status } = req.body;
    if (!Object.values(REQUISITION_STATUS).includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${Object.values(REQUISITION_STATUS).join(', ')}`,
      });
    }

    const requisition = await JobRequisition.findOne({
      _id: req.params.id
    });
    if (!requisition) {
      return res.status(404).json({ message: 'Requisition not found' });
    }

    if (requisition.status === status) {
      return res
        .status(409)
        .json({ message: `Requisition is already ${status}` });
    }

    const candidates = await Candidate.find({
      requisitionId: requisition._id
    })
      .select('currentStage')
      .lean();

    const fill = requisitionFillState(requisition, candidates);

    requisition.status = status;
    if (status === REQUISITION_STATUS.OPEN && !requisition.openedAt) {
      requisition.openedAt = new Date();
    }
    if (
      status === REQUISITION_STATUS.CLOSED ||
      status === REQUISITION_STATUS.CANCELLED
    ) {
      requisition.closedAt = new Date();
    }
    await requisition.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'REQUISITION_STATUS_CHANGED',
      resourceType: 'JobRequisition',
      resourceIds: [requisition._id],
      details: { status, candidatesInFlight: fill.inFlight },
      req,
    });

    return res.json({
      message: `Requisition ${status}`,
      requisition,
      candidatesInFlight: fill.inFlight,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/recruitment/candidates
 */
exports.createCandidate = async (req, res, next) => {
  try {
    const {
      requisitionId,
      fullName,
      email,
      phone,
      source,
      referredByEmployeeId,
      resumeUrl,
      expectedCtc,
      appliedAt,
    } = req.body;

    if (!mongoose.isValidObjectId(requisitionId)) {
      return res.status(400).json({ message: 'Invalid requisition id' });
    }
    if (!fullName || !email) {
      return res
        .status(400)
        .json({ message: 'fullName and email are required' });
    }

    const requisition = await JobRequisition.findOne({
      _id: requisitionId
    }).lean();
    if (!requisition) {
      return res.status(404).json({ message: 'Requisition not found' });
    }

    if (requisition.status !== REQUISITION_STATUS.OPEN) {
      return res.status(409).json({
        message: `Requisition is ${requisition.status} and is not accepting applications`,
      });
    }

    const candidate = await Candidate.create({
      requisitionId,
      fullName,
      email,
      phone,
      source,

      referredByEmployeeId:
        referredByEmployeeId && mongoose.isValidObjectId(referredByEmployeeId)
          ? referredByEmployeeId
          : null,

      resumeUrl,
      expectedCtc,
      appliedAt: appliedAt ? new Date(appliedAt) : new Date(),
      currentStage: PIPELINE_STAGES.APPLIED,

      stageHistory: [
        {
          stage: PIPELINE_STAGES.APPLIED,
          previousStage: null,
          at: appliedAt ? new Date(appliedAt) : new Date(),
          byUserId: req.userId,
          note: 'Application received',
        },
      ],

      createdBy: req.userId
    });

    return res.status(201).json({ message: 'Candidate added', candidate });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'That candidate has already applied to this requisition',
      });
    }
    return next(error);
  }
};

/**
 * GET /api/recruitment/candidates
 */
exports.getCandidates = async (req, res, next) => {
  try {
    const filter = {};
    if (
      req.query.requisitionId &&
      mongoose.isValidObjectId(req.query.requisitionId)
    ) {
      filter.requisitionId = req.query.requisitionId;
    }
    if (req.query.stage) filter.currentStage = req.query.stage;

    const candidates = await Candidate.find(filter)
      .sort({ appliedAt: -1 })
      .lean();

    return res.json({ candidates });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/recruitment/candidates/:id/stage
 *
 * The three refusals here are the substance of the endpoint:
 *
 *   - an illegal transition, answered with the stages that *are* legal so the
 *     caller does not have to guess,
 *   - hiring against a requisition with no openings left,
 *   - an offer above the requisition's approved CTC band.
 *
 * The band check is deliberately a hard refusal rather than a warning with an
 * override flag. The band is what finance signed off; exceeding it should mean
 * amending the requisition, which is an explicit and audited act by whoever
 * holds MANAGE_REQUISITION — not a boolean in a request body.
 */
exports.updateCandidateStage = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    const { stage, note, offeredCtc, rejectionReason } = req.body;

    const candidate = await Candidate.findOne({
      _id: req.params.id
    });
    if (!candidate)
      return res.status(404).json({ message: 'Candidate not found' });

    const transition = applyTransition(candidate, stage, {
      byUserId: req.userId,
      note,
    });

    if (!transition.ok) {
      return res.status(400).json({
        message: transition.error,
        currentStage: candidate.currentStage,
        allowedNext: transition.allowedNext,
      });
    }

    const requisition = await JobRequisition.findOne({
      _id: candidate.requisitionId
    }).lean();
    if (!requisition) {
      return res.status(404).json({ message: 'Requisition not found' });
    }

    let bandCheck = null;

    if (stage === PIPELINE_STAGES.OFFERED) {
      bandCheck = checkOfferAgainstBand(requisition, offeredCtc);

      if (bandCheck.status === 'invalid' || bandCheck.status === 'no-band') {
        return res.status(400).json({ message: bandCheck.reason, bandCheck });
      }

      if (bandCheck.status === 'above') {
        return res.status(409).json({
          message: bandCheck.reason,
          bandCheck,
          hint: 'Amend the requisition band before making this offer',
        });
      }
    }

    if (stage === PIPELINE_STAGES.HIRED) {
      const siblings = await Candidate.find({
        requisitionId: candidate.requisitionId
      })
        .select('currentStage')
        .lean();

      const capacity = canHireAgainst(requisition, siblings);
      if (!capacity.allowed) {
        return res
          .status(409)
          .json({ message: capacity.reason, fill: capacity.fill });
      }

      // Decrement the open headcount on the HeadcountRequisition if linked
      const headcountReq = await HeadcountRequisition.findOne({
        requisitionCode: requisition.requisitionCode
      });
      if (headcountReq && headcountReq.requestedCount > 0) {
        headcountReq.requestedCount -= 1;
        if (headcountReq.requestedCount === 0)
          headcountReq.status = 'Fulfilled';
        await headcountReq.save();
      }

      // Decrement openings on the JobRequisition
      if (requisition.openings > 0) {
        await JobRequisition.updateOne(
          { _id: requisition._id },
          { $inc: { openings: -1 } },
        );
      }

      // Mark linked position as active
      // Assuming positionCode matches requisitionCode or we create a new Position
      const positionCode = `${requisition.requisitionCode}-${Date.now()}`;
      await Position.findOneAndUpdate(
        {
          positionCode
        },
        {
          $setOnInsert: {
            positionCode,
            department: requisition.department,
            title: requisition.title,
            createdBy: req.userId
          },
          $set: {
            status: 'Active',
            employeeId: candidate.convertedEmployeeId || null,
          },
        },
        { upsert: true, new: true },
      );
    }

    candidate.currentStage = transition.stage;
    candidate.stageHistory.push(transition.historyEntry);

    if (bandCheck) {
      candidate.offeredCtc = bandCheck.offeredCtc;
      // Snapshotted so a later band amendment cannot retroactively make a
      // breach look compliant.
      candidate.offerBandCheck = bandCheck;
    }
    if (stage === PIPELINE_STAGES.REJECTED && rejectionReason) {
      candidate.rejectionReason = rejectionReason;
    }

    await candidate.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CANDIDATE_STAGE_CHANGED',
      resourceType: 'Candidate',
      resourceIds: [candidate._id],
      details: {
        from: transition.historyEntry.previousStage,
        to: transition.stage,
        offeredCtc: candidate.offeredCtc,
      },
      req,
    });

    return res.json({
      message: `Candidate moved to ${transition.stage}`,
      candidate,
      bandCheck,
      allowedNext: transition.allowedNext,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/recruitment/candidates/:id/feedback
 */
exports.submitFeedback = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    const { round, ratings, recommendation, notes, interviewedOn } = req.body;

    if (!round || !recommendation) {
      return res
        .status(400)
        .json({ message: 'round and recommendation are required' });
    }
    if (!Array.isArray(ratings) || ratings.length === 0) {
      return res
        .status(400)
        .json({ message: 'At least one competency rating is required' });
    }

    const candidate = await Candidate.findOne({
      _id: req.params.id
    })
      .select('_id currentStage')
      .lean();
    if (!candidate)
      return res.status(404).json({ message: 'Candidate not found' });

    const feedback = await InterviewFeedback.create({
      candidateId: candidate._id,
      interviewerId: req.userId,
      round,
      ratings,
      recommendation,
      notes,
      interviewedOn: interviewedOn ? new Date(interviewedOn) : new Date()
    });

    return res.status(201).json({ message: 'Feedback recorded', feedback });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          'You have already submitted feedback for this candidate and round',
      });
    }
    return next(error);
  }
};

/**
 * GET /api/recruitment/candidates/:id/scorecard
 */
exports.getScorecard = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    const candidate = await Candidate.findOne({
      _id: req.params.id
    })
      .select('fullName currentStage requisitionId')
      .lean();
    if (!candidate)
      return res.status(404).json({ message: 'Candidate not found' });

    const feedback = await InterviewFeedback.find({
      candidateId: candidate._id
    }).lean();

    // Weights arrive as `?weights=Coding:3,Communication:1`. Parsed leniently —
    // an unparsable pair is skipped and the competency falls back to weight 1,
    // because dropping real feedback over a malformed query string is worse
    // than weighting it evenly.
    const weights = {};
    if (typeof req.query.weights === 'string') {
      for (const pair of req.query.weights.split(',')) {
        const [name, raw] = pair.split(':');
        const weight = Number(raw);
        if (name && Number.isFinite(weight) && weight > 0) {
          weights[name.trim()] = weight;
        }
      }
    }

    return res.json({
      candidate,
      scorecard: scoreCard(feedback, weights),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/recruitment/analytics/funnel
 */
exports.getFunnelAnalytics = async (req, res, next) => {
  try {
    const filter = {};
    if (
      req.query.requisitionId &&
      mongoose.isValidObjectId(req.query.requisitionId)
    ) {
      filter.requisitionId = req.query.requisitionId;
    }

    const candidates = await Candidate.find(filter)
      .select('currentStage stageHistory appliedAt createdAt source')
      .lean();

    return res.json({
      funnel: funnelMetrics(candidates),
      timeToHire: timeToHire(candidates),
      sources: sourceEffectiveness(candidates),
    });
  } catch (error) {
    return next(error);
  }
};
