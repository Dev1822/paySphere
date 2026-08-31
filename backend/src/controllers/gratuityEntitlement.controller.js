/**
 * @fileoverview Payment of Gratuity Act, 1972 — the entitlement (#2031).
 *
 * Four decisions carry this controller.
 *
 * **It opens the claim from the last working day, not from a form.** Section
 * 7(2) requires the employer to determine and give notice as soon as gratuity
 * becomes payable, whether or not an application has been made, and section 7(3)
 * runs thirty days from that date. `openClaim` therefore takes `payableFrom` as
 * required and `applicationReceivedOn` as optional — the Form I is recorded and
 * is a precondition to nothing.
 *
 * **It does not recompute the amount.** `statutoryAmount` and `completedYears`
 * come from `settlement.js`, which owns the five-year gate, the 15/26 formula,
 * the ≥6-month rounding and the ceiling. A second computation here would be a
 * second answer to a question that already has one, and the two would drift.
 * What this module adds is everything the amount does not say.
 *
 * **It reports interest whether or not anybody asked for it.** `getQueue` and
 * `getPosition` both return the accrued 7(3A) figure as at the date requested,
 * because a liability that grows every day at a statutory rate from a date the
 * system already knows is exactly the thing a payroll product should be
 * surfacing rather than waiting to be asked about.
 *
 * **It stores a forfeiture at what the sub-section permitted, and keeps what was
 * claimed.** The engine caps; the record keeps both figures, because a ₹6,00,000
 * forfeiture claimed against ₹4,000 of damage is a finding and overwriting it
 * with the capped number erases it.
 *
 * Everything that decides payability, a cap or an interest figure is in
 * `utils/gratuityEntitlement.js`.
 */

const mongoose = require('mongoose');

const {
  GratuityNomination,
  GratuityClaim,
  GratuityForfeiture,
} = require('../models/gratuityEntitlement.model');
const {
  CESSATION_GROUND,
  PAYABILITY,
  OBLIGATION_STATE,
  FORFEITURE_GROUND,
  FORFEITURE_VERDICT,
  DEFAULT_RULES,
  CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
  INTEREST_IS_NOT_DISCRETIONARY,
  FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
  FORFEITURE_IS_TWO_RULES,
  STATUTORY_FIGURE_MAY_BE_A_FLOOR,
  assessNomination,
  assessForfeiture,
  assessClaim,
  orderQueue,
} = require('../utils/gratuityEntitlement');
const eventBus = require('../services/event.service');

function readDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The nomination that stood, shaped for the engine.
 *
 * Takes the latest un-superseded nomination rather than the latest full stop,
 * because a nomination that was superseded is a record of who *was* nominated
 * and not of who is.
 *
 * @param {Array<object>} rows
 * @returns {object|null}
 */
function standingNomination(rows) {
  const live = (rows || [])
    .filter((row) => !row.supersededOn)
    .sort((a, b) => new Date(b.madeOn) - new Date(a.madeOn));
  return live[0] || null;
}

/**
 * A stored claim and its forfeiture, shaped for the engine.
 *
 * @param {object} claim
 * @param {object|null} nomination
 * @param {object|null} forfeiture
 * @returns {object}
 */
function shapeClaim(claim, nomination, forfeiture) {
  return {
    employeeId: claim.employeeId,
    ground: claim.ground,
    completedYears: claim.completedYears,
    statutoryAmount: claim.statutoryAmount,
    contractualAmount: claim.contractualAmount,
    payableFrom: claim.payableFrom,
    paidOn: claim.paidOn,
    noticeToPayeeOn: claim.noticeToPayeeOn,
    noticeToControllingAuthorityOn: claim.noticeToControllingAuthorityOn,
    relief: claim.relief,
    nomination,
    forfeiture: forfeiture
      ? {
          ground: forfeiture.ground,
          damageAmount: forfeiture.damageAmount,
          terminatedForTheAct: forfeiture.terminatedForTheAct,
          inCourseOfEmployment: forfeiture.inCourseOfEmployment,
          amount: forfeiture.amountClaimed,
        }
      : null,
  };
}

/**
 * GET /api/gratuity-entitlement/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      rules: DEFAULT_RULES,
      grounds: CESSATION_GROUND,
      payability: PAYABILITY,
      obligationStates: OBLIGATION_STATE,
      forfeitureGrounds: FORFEITURE_GROUND,
      forfeitureVerdicts: FORFEITURE_VERDICT,
      notes: {
        clockDoesNotWaitForAnApplication:
          CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
        interestIsNotDiscretionary: INTEREST_IS_NOT_DISCRETIONARY,
        fiveYearsDoesNotApplyOnDeath: FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
        forfeitureIsTwoRules: FORFEITURE_IS_TWO_RULES,
        statutoryFigureMayBeAFloor: STATUTORY_FIGURE_MAY_BE_A_FLOOR,
      },
      note: 'The amount comes from settlement.js and is not recomputed here. The section 7(3A) rate is notified by the Central Government and has moved, so it is a default and overridable rather than a constant.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/gratuity-entitlement/nominations
 *
 * Records a Form F. Deliberately not the EPF Form 2 nomination — separate
 * instruments, and an employee may name different people on each.
 */
exports.recordNomination = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'employeeId is required' });
    }

    const madeOn = readDate(req.body.madeOn);
    if (!madeOn) {
      return res.status(400).json({
        message:
          'madeOn must be a valid date. Rule 6(4) turns on whether the employee acquired a family after the nomination was made, so a nomination with no date cannot be tested against it.',
      });
    }

    if (req.body.hadFamilyWhenMade === undefined) {
      return res.status(400).json({
        message:
          'hadFamilyWhenMade is required. Rule 6(3) voids a nomination in favour of a non-family member where the employee had a family at the time — and that is a fact about a past date which cannot be derived from the employee record now.',
      });
    }

    const nominees = Array.isArray(req.body.nominees) ? req.body.nominees : [];
    const candidate = {
      nominees,
      hadFamilyWhenMade: Boolean(req.body.hadFamilyWhenMade),
      madeOn,
      acquiredFamilyOn: readDate(req.body.acquiredFamilyOn),
      freshNominationMade: Boolean(req.body.freshNominationMade),
    };

    const assessment = assessNomination(candidate);
    if (!assessment.valid) {
      return res.status(400).json({
        message: 'The nomination does not stand and is not recorded as one.',
        reason: assessment.reason,
        assessment,
      });
    }

    // A superseding nomination does not delete the one before it. Which
    // nomination stood on the date of death is the question, and it is asked
    // years after both were filed.
    await GratuityNomination.updateMany(
      {
        employeeId: req.body.employeeId,
        supersededOn: null
      },
      { $set: { supersededOn: madeOn } },
    );

    const nomination = await GratuityNomination.create({
      employeeId: req.body.employeeId,
      madeOn,
      nominees,
      hadFamilyWhenMade: Boolean(req.body.hadFamilyWhenMade),
      acquiredFamilyOn: readDate(req.body.acquiredFamilyOn),
      freshNominationMade: Boolean(req.body.freshNominationMade),
      documentRef: String(req.body.documentRef || '').trim(),
      recordedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'GRATUITY_NOMINATION_RECORDED',
      resourceType: 'GratuityNomination',
      resourceIds: [nomination._id],
      details: {
        employeeId: req.body.employeeId,
        madeOn,
        // The shares are audited because a nomination is what decides who
        // receives the money on death, and a share edited afterwards moves an
        // amount between two named people with nothing else on the record
        // changing.
        nominees: nominees.map((nominee) => ({
          name: nominee.name,
          sharePercent: nominee.sharePercent,
          isFamily: Boolean(nominee.isFamily),
        })),
        hadFamilyWhenMade: Boolean(req.body.hadFamilyWhenMade),
      },
      req,
    });

    return res.status(201).json({ nomination, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/gratuity-entitlement/claims
 *
 * Opens the obligation. `payableFrom` is the last working day and is required;
 * the Form I is optional and gates nothing.
 */
exports.openClaim = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'employeeId is required' });
    }

    const ground = String(req.body.ground || '')
      .trim()
      .toUpperCase();
    if (!CESSATION_GROUND[ground]) {
      return res.status(400).json({
        message: `${ground || '(none)'} is not a recognised ground of cessation. Gratuity turns on why the employment ended — five years is not required on death or disablement — so the ground cannot be left to a default.`,
        grounds: Object.keys(CESSATION_GROUND),
      });
    }

    const payableFrom = readDate(req.body.payableFrom);
    if (!payableFrom) {
      return res.status(400).json({
        message:
          'payableFrom must be a valid date — the last working day. The thirty days under section 7(3) and the interest under section 7(3A) both run from it, and defaulting it to today would report every unpaid gratuity as being in time.',
      });
    }

    const statutoryAmount = Number(req.body.statutoryAmount);
    if (!Number.isFinite(statutoryAmount) || statutoryAmount < 0) {
      return res.status(400).json({
        message:
          'statutoryAmount is required and comes from settlement.js. This module does not recompute it — a second computation would be a second answer to a question that already has one.',
      });
    }

    const completedYears = Number(req.body.completedYears);
    if (!Number.isFinite(completedYears) || completedYears < 0) {
      return res.status(400).json({
        message:
          'completedYears is required and comes from settlement.js — actual completed service, before the ≥6-month rounding used in the formula.',
      });
    }

    const claim = await GratuityClaim.findOneAndUpdate(
      {
        employeeId: req.body.employeeId
      },
      {
        $set: {
          ground,
          payableFrom,
          completedYears,
          statutoryAmount,
          contractualAmount:
            req.body.contractualAmount === undefined ||
            req.body.contractualAmount === null
              ? null
              : Number(req.body.contractualAmount),
          applicationReceivedOn: readDate(req.body.applicationReceivedOn),
          section4A: {
            insured: Boolean((req.body.section4A || {}).insured),
            insurerOrFund: String(
              (req.body.section4A || {}).insurerOrFund || '',
            ).trim(),
            registrationNumber: String(
              (req.body.section4A || {}).registrationNumber || '',
            ).trim(),
          },
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const nominations = await GratuityNomination.find({
      employeeId: req.body.employeeId
    }).lean();

    const assessment = assessClaim(
      shapeClaim(claim, standingNomination(nominations), null),
      { asOf: new Date() },
    );
    claim.lastKnownPayability = assessment.payability.verdict;
    claim.lastKnownState = assessment.obligation
      ? assessment.obligation.state
      : null;
    await claim.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'GRATUITY_CLAIM_OPENED',
      resourceType: 'GratuityClaim',
      resourceIds: [claim._id],
      details: {
        employeeId: req.body.employeeId,
        ground,
        // The date the clock starts from, named because moving it is the one
        // edit that makes an overdue gratuity look current and reduces the
        // 7(3A) interest with nothing else on the record changing.
        payableFrom,
        dueBy: assessment.obligation ? assessment.obligation.dueBy : null,
        statutoryAmount,
        payability: assessment.payability.verdict,
        // Named because it is the answer settlement.js gets wrong: an employee
        // who died before five years is payable and the module says so.
        gateWaived: Boolean(assessment.payability.gateWaived),
      },
      req,
    });

    return res.status(201).json({
      claim,
      assessment,
      note: assessment.payability.gateWaived
        ? FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH
        : null,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/gratuity-entitlement/claims/:id/notices
 *
 * The two notices under section 7(2), recorded separately because they are two
 * obligations and the one to the controlling authority is the one nobody does.
 */
exports.recordNotices = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const claim = await GratuityClaim.findOne({
      _id: req.params.id
    });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (req.body.noticeToPayeeOn !== undefined) {
      claim.noticeToPayeeOn = readDate(req.body.noticeToPayeeOn);
    }
    if (req.body.noticeToControllingAuthorityOn !== undefined) {
      claim.noticeToControllingAuthorityOn = readDate(
        req.body.noticeToControllingAuthorityOn,
      );
    }
    await claim.save();

    const assessment = await assess(req, claim);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'GRATUITY_NOTICE_RECORDED',
      resourceType: 'GratuityClaim',
      resourceIds: [claim._id],
      details: {
        employeeId: claim.employeeId,
        // Both, because a notice to the payee with nothing sent to the
        // controlling authority is a half-discharged obligation and a single
        // flag cannot say which half.
        noticeToPayeeOn: claim.noticeToPayeeOn,
        noticeToControllingAuthorityOn: claim.noticeToControllingAuthorityOn,
        outstanding: assessment.notice ? assessment.notice.outstanding : null,
      },
      req,
    });

    return res.json({ claim, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/gratuity-entitlement/claims/:id/forfeiture
 *
 * Records a forfeiture at what the sub-section permitted, keeping what was
 * claimed. The gap between the two is a finding and overwriting it erases it.
 */
exports.recordForfeiture = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const ground = String(req.body.ground || '')
      .trim()
      .toUpperCase();
    if (!FORFEITURE_GROUND[ground]) {
      return res.status(400).json({
        message: `${ground || '(none)'} is not a ground under section 4(6). Gratuity is forfeitable only for damage or loss to employer property, for riotous or disorderly conduct or an act of violence, or for an offence involving moral turpitude committed in the course of employment.`,
        grounds: Object.values(FORFEITURE_GROUND),
      });
    }

    const claim = await GratuityClaim.findOne({
      _id: req.params.id
    });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    const nominations = await GratuityNomination.find({
      employeeId: claim.employeeId
    }).lean();

    const before = assessClaim(
      shapeClaim(claim, standingNomination(nominations), null),
      { asOf: new Date() },
    );
    if (!before.terms) {
      return res.status(400).json({
        message:
          'There is no gratuity to forfeit — the claim is not payable. Section 4(6) forfeits an entitlement, and where none arises there is nothing for it to operate on.',
        payability: before.payability,
      });
    }

    const candidate = {
      ground,
      damageAmount:
        req.body.damageAmount === undefined || req.body.damageAmount === null
          ? null
          : Number(req.body.damageAmount),
      terminatedForTheAct: Boolean(req.body.terminatedForTheAct),
      inCourseOfEmployment:
        req.body.inCourseOfEmployment === undefined
          ? null
          : Boolean(req.body.inCourseOfEmployment),
      amount: Number(req.body.amountClaimed || 0),
    };

    const verdict = assessForfeiture(candidate, before.terms.amount);

    const forfeiture = await GratuityForfeiture.findOneAndUpdate(
      {
        claimId: claim._id
      },
      {
        $set: {
          ground,
          damageAmount: candidate.damageAmount,
          terminatedForTheAct: candidate.terminatedForTheAct,
          inCourseOfEmployment: candidate.inCourseOfEmployment,
          amountClaimed: candidate.amount,
          amountPermitted: verdict.permitted,
          amountForfeited: verdict.forfeited,
          verdict: verdict.verdict,
          orderRef: String(req.body.orderRef || '').trim(),
          decidedOn: readDate(req.body.decidedOn),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const assessment = await assess(req, claim);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'GRATUITY_FORFEITURE_RECORDED',
      resourceType: 'GratuityForfeiture',
      resourceIds: [forfeiture._id],
      details: {
        employeeId: claim.employeeId,
        ground,
        // Claimed beside permitted, because the gap is the finding — a
        // ₹6,00,000 forfeiture claimed against ₹4,000 of damage is the case
        // this record exists to keep visible, and storing only the capped
        // figure would erase that it was attempted.
        amountClaimed: forfeiture.amountClaimed,
        amountPermitted: forfeiture.amountPermitted,
        amountForfeited: forfeiture.amountForfeited,
        damageAmount: forfeiture.damageAmount,
        // The requirement a flag hides: 4(6)(b) needs the termination to have
        // been for the act, not merely that the act occurred.
        terminatedForTheAct: forfeiture.terminatedForTheAct,
        verdict: verdict.verdict,
      },
      req,
    });

    return res.status(201).json({ forfeiture, verdict, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/gratuity-entitlement/claims/:id/payment
 *
 * Records payment and, where it was late, the interest actually paid beside the
 * interest the engine says was owed. The two differing is the finding.
 */
exports.recordPayment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const paidOn = readDate(req.body.paidOn);
    if (!paidOn) {
      return res.status(400).json({ message: 'paidOn must be a valid date' });
    }

    const claim = await GratuityClaim.findOne({
      _id: req.params.id
    });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    claim.paidOn = paidOn;
    claim.paidAmount =
      req.body.paidAmount === undefined ? null : Number(req.body.paidAmount);
    claim.interestPaid =
      req.body.interestPaid === undefined
        ? null
        : Number(req.body.interestPaid);

    if (req.body.relief) {
      claim.relief = {
        delayDueToEmployeeFault: Boolean(
          req.body.relief.delayDueToEmployeeFault,
        ),
        controllingAuthorityPermission: String(
          req.body.relief.controllingAuthorityPermission || '',
        ).trim(),
      };
    }
    await claim.save();

    const assessment = await assess(req, claim);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'GRATUITY_PAYMENT_RECORDED',
      resourceType: 'GratuityClaim',
      resourceIds: [claim._id],
      details: {
        employeeId: claim.employeeId,
        paidOn,
        paidAmount: claim.paidAmount,
        daysLate: assessment.obligation ? assessment.obligation.daysLate : null,
        // The owed figure beside the paid one. A late payment discharged
        // without the 7(3A) interest is a live liability, and the pair is the
        // only thing that shows it.
        interestOwed: assessment.obligation
          ? assessment.obligation.interest
          : 0,
        interestPaid: claim.interestPaid,
        reliefApplied: assessment.obligation
          ? Boolean(assessment.obligation.reliefApplied)
          : false,
      },
      req,
    });

    return res.json({ claim, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * The current position for a stored claim.
 *
 * @param {object} req
 * @param {object} claim
 * @returns {Promise<object>}
 */
async function assess(req, claim) {
  const [nominations, forfeiture] = await Promise.all([
    GratuityNomination.find({
      employeeId: claim.employeeId
    }).lean(),
    GratuityForfeiture.findOne({
      claimId: claim._id
    }).lean(),
  ]);

  const assessment = assessClaim(
    shapeClaim(claim, standingNomination(nominations), forfeiture),
    { asOf: readDate(req.query && req.query.asOf) || new Date() },
  );

  claim.lastKnownPayability = assessment.payability.verdict;
  claim.lastKnownState = assessment.obligation
    ? assessment.obligation.state
    : null;
  await claim.save();

  return assessment;
}

/**
 * GET /api/gratuity-entitlement/queue
 *
 * Overdue and unpaid first, ordered by the interest already accrued. Nothing
 * else in the product raises a section 7(3) breach, and the interest is running
 * whether or not anybody is looking at it.
 */
exports.getQueue = async (req, res, next) => {
  try {
    const claims = await GratuityClaim.find({}).lean();
    const claimIds = claims.map((claim) => claim._id);
    const employeeIds = claims.map((claim) => claim.employeeId);

    const [nominations, forfeitures] = await Promise.all([
      GratuityNomination.find({
        employeeId: { $in: employeeIds }
      }).lean(),
      GratuityForfeiture.find({
        claimId: { $in: claimIds }
      }).lean(),
    ]);

    const nominationsByEmployee = new Map();
    for (const row of nominations) {
      const key = String(row.employeeId);
      if (!nominationsByEmployee.has(key)) nominationsByEmployee.set(key, []);
      nominationsByEmployee.get(key).push(row);
    }

    const forfeitureByClaim = new Map(
      forfeitures.map((row) => [String(row.claimId), row]),
    );

    const asOf = readDate(req.query.asOf) || new Date();

    const assessments = claims.map((claim) =>
      assessClaim(
        shapeClaim(
          claim,
          standingNomination(
            nominationsByEmployee.get(String(claim.employeeId)),
          ),
          forfeitureByClaim.get(String(claim._id)) || null,
        ),
        { asOf },
      ),
    );

    const ordered = orderQueue(assessments);

    return res.json({
      asOf,
      queue: ordered,
      // The total is the number that makes the queue act on itself. A list of
      // overdue claims is a list; the interest already accrued across them is a
      // liability on the balance sheet nobody has booked.
      interestAccrued: ordered.reduce(
        (sum, row) => sum + ((row.obligation && row.obligation.interest) || 0),
        0,
      ),
      overdue: ordered.filter(
        (row) =>
          row.obligation && row.obligation.state === OBLIGATION_STATE.OVERDUE,
      ).length,
      notes: {
        clockDoesNotWaitForAnApplication:
          CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
        interestIsNotDiscretionary: INTEREST_IS_NOT_DISCRETIONARY,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/gratuity-entitlement/claims/:id
 */
exports.getPosition = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const claim = await GratuityClaim.findOne({
      _id: req.params.id
    });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    const [nominations, forfeiture] = await Promise.all([
      GratuityNomination.find({
        employeeId: claim.employeeId
      })
        .sort({ madeOn: -1 })
        .lean(),
      GratuityForfeiture.findOne({
        claimId: claim._id
      }).lean(),
    ]);

    const assessment = assessClaim(
      shapeClaim(claim, standingNomination(nominations), forfeiture),
      { asOf: readDate(req.query.asOf) || new Date() },
    );

    return res.json({
      claim,
      nominations,
      forfeiture,
      assessment,
    });
  } catch (error) {
    return next(error);
  }
};
