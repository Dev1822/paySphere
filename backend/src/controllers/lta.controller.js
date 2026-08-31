/**
 * @fileoverview LTA claims and the section 10(5) exemption (#1345).
 *
 * The shape follows `taxProof.controller.js` on purpose — an employee files,
 * HR verifies — because it is the same act from the user's point of view and
 * inventing a second workflow for it would be gratuitous. What is different is
 * everything behind the assessment: the entitlement is a four-year block, not a
 * financial year, so filing a claim needs the employee's *history* and not just
 * the claim in front of it.
 *
 * Every number is decided in `utils/ltaExemption.js`, which touches no
 * database. This file fetches the history, hands it over, and writes down what
 * came back.
 */

const mongoose = require('mongoose');

const { LtaClaim, CLAIM_STATUS } = require('../models/ltaClaim.model');
const Employee = require('../models/employee.model');
const {
  JOURNEYS_PER_BLOCK,
  blockForYear,
  blockPosition,
  blockSummary,
  assessClaim,
} = require('../utils/ltaExemption');
const eventBus = require('../services/event.service');

/**
 * The employee record behind the calling account.
 *
 * @param {import('express').Request} req
 * @returns {Promise<object|null>}
 */
async function callerEmployee(req) {
  return Employee.findOne({
    userId: req.userId
  }).lean();
}

/**
 * Every journey this employee has on record, in the form the engine wants.
 *
 * All of them, not just the ones in the block being claimed against: the
 * carry-forward rule needs the *previous* block too, and fetching only the
 * current one is the shortcut that makes carry-forward silently unavailable
 * for everybody.
 *
 * @param {string} tenantId
 * @param {string} employeeId
 * @returns {Promise<Array<object>>}
 */
async function claimHistory(tenantId, employeeId) {
  return LtaClaim.find({ tenantId, employeeId })
    .select('journeyDate status exemptAmount blockLabel')
    .sort({ journeyDate: 1 })
    .lean();
}

/**
 * The LTA paid in the employee's salary structure, if the product knows it.
 *
 * Returns `null` rather than 0 when it is unknown, and the distinction matters:
 * 0 means "no LTA is paid, so nothing can be exempt", while null means "we do
 * not know, so do not restrict on it". Collapsing the two would refuse every
 * claim for a tenant that has not modelled its salary structure.
 *
 * @param {object} body
 * @returns {number|null}
 */
function resolveLtaComponent(body) {
  const supplied = Number(body.ltaComponentPaid);
  return Number.isFinite(supplied) && supplied >= 0 ? supplied : null;
}

/**
 * POST /api/lta/claims
 *
 * An employee files a journey. HR may file on somebody's behalf by sending
 * `employeeId`; without one the claim is filed against the caller's own record,
 * so holding SUBMIT_LTA_CLAIM does not let one employee claim in another's name.
 */
exports.submitClaim = async (req, res, next) => {
  try {
    let employee;

    if (req.body.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(req.body.employeeId)) {
        return res.status(400).json({ message: 'Invalid employee id' });
      }

      employee = await Employee.findOne({
        _id: req.body.employeeId
      }).lean();
    } else {
      employee = await callerEmployee(req);
    }

    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const history = await claimHistory(req.tenantId, employee._id);

    const assessment = assessClaim(req.body, {
      history,
      ltaComponentPaid: resolveLtaComponent(req.body),
    });

    // A refused claim is not a 400. The employee filed a well-formed journey
    // and the statute says no — that answer belongs in the record, so they can
    // see why, and so HR is not asked to adjudicate it a second time. The one
    // exception is a claim the engine could not read at all.
    if (
      assessment.refusals.some((refusal) => refusal.code === 'INVALID_JOURNEY')
    ) {
      return res.status(400).json({
        message: assessment.refusals[0].message,
        refusals: assessment.refusals,
      });
    }

    const claim = await LtaClaim.create({
      employeeId: employee._id,
      journeyDate: req.body.journeyDate,
      returnDate: req.body.returnDate || null,
      origin: req.body.origin,
      destination: req.body.destination,
      mode: req.body.mode,
      travelClass: req.body.travelClass || '',
      international: Boolean(req.body.international),
      claimedFare: Number(req.body.claimedFare) || 0,
      fareCeilings: req.body.fareCeilings || {},
      travellers: Array.isArray(req.body.travellers) ? req.body.travellers : [],

      documentUrls: Array.isArray(req.body.documentUrls)
        ? req.body.documentUrls
        : [],

      blockLabel: assessment.block.label,
      blockStartYear: assessment.block.startYear,
      blockEndYear: assessment.block.endYear,
      usesCarryForward: assessment.usesCarryForward,
      exemptAmount: assessment.exemptAmount,
      taxableBalance: assessment.taxableBalance,
      ltaComponentPaid: resolveLtaComponent(req.body),
      refusals: assessment.refusals,
      notes: assessment.notes,

      // A claim the engine has already refused goes straight to rejected. There
      // is nothing for HR to decide and leaving it in the queue would be a
      // queue of decisions nobody can make differently.
      status: assessment.allowed ? CLAIM_STATUS.PENDING : CLAIM_STATUS.REJECTED,

      reviewedAt: assessment.allowed ? null : new Date(),

      reviewNote: assessment.allowed
        ? ''
        : assessment.refusals.map((refusal) => refusal.message).join('; '),

      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LTA_CLAIM_SUBMITTED',
      resourceType: 'LtaClaim',
      resourceIds: [claim._id],
      details: {
        block: assessment.block.label,
        exemptAmount: assessment.exemptAmount,
        allowed: assessment.allowed,
      },
      req,
    });

    return res.status(201).json({
      message: assessment.allowed
        ? 'Claim filed'
        : 'Claim recorded, and not allowable — see the refusals',
      claim,
      assessment,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/lta/preview
 *
 * Assess a journey without filing it.
 *
 * Worth having for the same reason the loan module previews an instalment: an
 * employee about to book business class should be able to find out that only
 * the economy fare is exempt *before* they book, not after.
 */
exports.previewClaim = async (req, res, next) => {
  try {
    const employee = req.body.employeeId
      ? await Employee.findOne({
      _id: mongoose.Types.ObjectId.isValid(req.body.employeeId)
        ? req.body.employeeId
        : null
    }).lean()
      : await callerEmployee(req);

    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const history = await claimHistory(req.tenantId, employee._id);

    const assessment = assessClaim(req.body, {
      history,
      ltaComponentPaid: resolveLtaComponent(req.body),
    });

    return res.json({ preview: true, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/lta/entitlement
 *
 * What the calling employee has left, and whether a journey is carried forward.
 *
 * This is the question the portal opens with, and it has to be answerable
 * before the employee has entered anything — which is why it is its own
 * endpoint rather than a field on the claim response.
 */
exports.getEntitlement = async (req, res, next) => {
  try {
    const employee = await callerEmployee(req);

    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const block = blockForYear(year);
    const history = await claimHistory(req.tenantId, employee._id);
    const position = blockPosition(history, block);

    return res.json({
      year,
      journeysPerBlock: JOURNEYS_PER_BLOCK,
      ...position,
      /**
       * Stated explicitly because the rule is the one employees are most often
       * surprised by: a journey carried forward is available in the first year
       * of the block and in no other.
       */
      carryForwardExpiresAfter: block.startYear,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/lta/my-claims
 */
exports.getMyClaims = async (req, res, next) => {
  try {
    const employee = await callerEmployee(req);

    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const claims = await LtaClaim.find({
      employeeId: employee._id
    })
      .sort({ journeyDate: -1 })
      .lean();

    return res.json({ count: claims.length, claims });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/lta/queue
 *
 * The verification queue, oldest first.
 */
exports.getQueue = async (req, res, next) => {
  try {
    const status = Object.values(CLAIM_STATUS).includes(req.query.status)
      ? req.query.status
      : CLAIM_STATUS.PENDING;

    const claims = await LtaClaim.find({
      status
    })
      .populate('employeeId', 'fullName department role email')
      .sort({ createdAt: 1 })
      .limit(Math.min(Number(req.query.limit) || 100, 200))
      .lean();

    return res.json({ count: claims.length, status, claims });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/lta/claims/:id/verify
 *
 * The claim is re-assessed at verification time rather than trusting what was
 * stored at submission. The employee may have had a second journey approved in
 * between, which would make this one the third; approving on the figures the
 * engine produced weeks ago would let both through.
 */
exports.verifyClaim = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const decision = req.body.decision;

    if (![CLAIM_STATUS.APPROVED, CLAIM_STATUS.REJECTED].includes(decision)) {
      return res
        .status(400)
        .json({ message: 'decision must be "approved" or "rejected"' });
    }

    const claim = await LtaClaim.findOne({
      _id: req.params.id
    });

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.status !== CLAIM_STATUS.PENDING) {
      return res
        .status(409)
        .json({ message: `This claim is already ${claim.status}` });
    }

    if (decision === CLAIM_STATUS.REJECTED) {
      claim.status = CLAIM_STATUS.REJECTED;
      claim.reviewedBy = req.userId;
      claim.reviewedAt = new Date();
      claim.reviewNote = req.body.reviewNote || '';
      await claim.save();

      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'LTA_CLAIM_REJECTED',
        resourceType: 'LtaClaim',
        resourceIds: [claim._id],
        details: { reviewNote: claim.reviewNote },
        req,
      });

      return res.json({ message: 'Claim rejected', claim });
    }

    // The claim being verified must not count itself, so it is excluded from
    // the history the entitlement is measured against.
    const history = (await claimHistory(req.tenantId, claim.employeeId)).filter(
      (entry) => String(entry._id) !== String(claim._id),
    );

    const assessment = assessClaim(
      {
        journeyDate: claim.journeyDate,
        mode: claim.mode,
        claimedFare: claim.claimedFare,
        fareCeilings: claim.fareCeilings,
        travellers: claim.travellers,
        international: claim.international,
      },
      {
        history,
        ltaComponentPaid:
          req.body.ltaComponentPaid === undefined
            ? claim.ltaComponentPaid
            : Number(req.body.ltaComponentPaid),
      },
    );

    if (!assessment.allowed) {
      claim.status = CLAIM_STATUS.REJECTED;
      claim.refusals = assessment.refusals;
      claim.notes = assessment.notes;
      claim.exemptAmount = 0;
      claim.reviewedBy = req.userId;
      claim.reviewedAt = new Date();
      claim.reviewNote = assessment.refusals
        .map((refusal) => refusal.message)
        .join('; ');
      await claim.save();

      return res.status(409).json({
        message:
          'This claim is no longer allowable — the entitlement changed since it was filed',
        claim,
        assessment,
      });
    }

    claim.status = CLAIM_STATUS.APPROVED;
    claim.exemptAmount = assessment.exemptAmount;
    claim.taxableBalance = assessment.taxableBalance;
    claim.usesCarryForward = assessment.usesCarryForward;
    claim.refusals = [];
    claim.notes = assessment.notes;
    claim.reviewedBy = req.userId;
    claim.reviewedAt = new Date();
    claim.reviewNote = req.body.reviewNote || '';
    await claim.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LTA_CLAIM_APPROVED',
      resourceType: 'LtaClaim',
      resourceIds: [claim._id],
      details: {
        exemptAmount: claim.exemptAmount,
        block: claim.blockLabel,
        usesCarryForward: claim.usesCarryForward,
      },
      req,
    });

    return res.json({ message: 'Claim approved', claim, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/lta/summary/:employeeId
 *
 * The block position and total exemption, which is what Form 16 Part B needs.
 */
exports.getBlockSummary = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const employee = await Employee.findOne({
      _id: req.params.employeeId
    })
      .select('fullName department')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const year = Number(req.query.year) || new Date().getUTCFullYear();

    const claims = await LtaClaim.find({
      employeeId: employee._id,
      status: CLAIM_STATUS.APPROVED
    })
      .select('journeyDate exemptAmount origin destination mode blockLabel')
      .lean();

    return res.json({
      employee: { _id: employee._id, fullName: employee.fullName },
      ...blockSummary(claims, year),
    });
  } catch (error) {
    return next(error);
  }
};
