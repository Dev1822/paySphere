/**
 * @fileoverview Employees' Compensation Act, 1923 — workplace injury claims
 * (#1699).
 *
 * Named for the injury rather than for the Act, because
 * `employeeCompensation.controller.js` already exists and is about something
 * else entirely: what somebody has been *paid over time*. Two controllers whose
 * names differ by a plural is how an import ends up pointing at the wrong one.
 *
 * The controller does three things the engine deliberately cannot: it resolves
 * the monthly wages, it decides which transitions in the claim lifecycle are
 * legal, and it recomputes the section 4A charges when a payment date arrives.
 *
 * Wages come from the salary structure in force **on the date of the accident**,
 * not from the employee's current package. A claim assessed a year later would
 * otherwise be computed on a salary the employee was never earning when they
 * were injured — and since the wage is capped at ₹15,000 for most claimants,
 * the error hides itself on every well-paid employee and shows up only on the
 * low-paid ones, which is the worst possible distribution for it.
 *
 * Everything that decides a number is in `utils/employeesCompensation.js`.
 */

const mongoose = require('mongoose');

const {
  InjuryCompensationClaim,
  CLAIM_STATUS,
} = require('../models/injuryCompensationClaim.model');
const Employee = require('../models/employee.model');
const SalaryStructure = require('../models/salaryStructure.model');
const { COMPONENT_TYPE } = require('../config/salaryComponents');
const {
  resolveStructureOnDate,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const {
  INJURY,
  BAR,
  SCHEDULE_I_INJURIES,
  RELEVANT_FACTORS,
  MONTHLY_WAGE_CAP,
  assessClaim,
  latePaymentCharges,
} = require('../utils/employeesCompensation');
const eventBus = require('../services/event.service');

/**
 * The transitions a claim is allowed to make.
 *
 * A table rather than a chain of ifs, because two of the edges are the whole
 * point of having a lifecycle at all: a death claim reaches `PAID` through
 * `DEPOSITED` under section 8, and a `CONTESTED` claim can come back to
 * `COMPUTED` when the contest is resolved. An implicit lifecycle would allow a
 * death claim to be marked paid without a deposit, which does not discharge the
 * liability — the employer can be made to pay twice.
 */
const ALLOWED_TRANSITIONS = {
  [CLAIM_STATUS.REPORTED]: [
    CLAIM_STATUS.UNDER_ASSESSMENT,
    CLAIM_STATUS.REJECTED,
  ],
  [CLAIM_STATUS.UNDER_ASSESSMENT]: [
    CLAIM_STATUS.COMPUTED,
    CLAIM_STATUS.REJECTED,
    CLAIM_STATUS.CONTESTED,
  ],
  [CLAIM_STATUS.COMPUTED]: [
    CLAIM_STATUS.DEPOSITED,
    CLAIM_STATUS.PAID,
    CLAIM_STATUS.CONTESTED,
  ],
  [CLAIM_STATUS.DEPOSITED]: [CLAIM_STATUS.PAID, CLAIM_STATUS.CONTESTED],
  [CLAIM_STATUS.CONTESTED]: [
    CLAIM_STATUS.COMPUTED,
    CLAIM_STATUS.REJECTED,
    CLAIM_STATUS.PAID,
  ],
  [CLAIM_STATUS.PAID]: [],
  [CLAIM_STATUS.REJECTED]: [CLAIM_STATUS.CONTESTED],
};

/**
 * Components excluded from "wages" by section 2(1)(m).
 *
 * A travelling allowance, the employer's provident fund contribution, and a sum
 * paid to cover special expenses of the employment. That is a *narrower*
 * exclusion list than the Minimum Wages Act's section 2(h) — house rent
 * allowance is not excluded here, and treating the two definitions as the same
 * would understate every claim.
 */
const NOT_WAGES = /convey|travel|lta|employer.*(pf|provident)|reimburse/i;

/**
 * The monthly wages for the Act's purposes, as at the accident.
 *
 * @param {Array<object>} structures
 * @param {Date} accidentDate
 * @param {number} fallback the employee's `monthlySalary`
 * @returns {number}
 */
function wagesAtAccident(structures, accidentDate, fallback) {
  const structure = resolveStructureOnDate(structures, accidentDate);
  if (!structure) return Number(fallback) || 0;

  return computeComponentAmounts(structure)
    .components.filter(
      (component) =>
        component.type === COMPONENT_TYPE.EARNING &&
        !NOT_WAGES.test(component.label || component.code || ''),
    )
    .reduce((sum, component) => sum + (Number(component.amount) || 0), 0);
}

/**
 * Read a claim's inputs off a request body, in the shape the engine wants.
 *
 * @param {object} body
 * @returns {object}
 */
function claimInputs(body) {
  return {
    injuryType: body.injuryType,
    bars: Array.isArray(body.assertedBars)
      ? body.assertedBars.filter((code) => BAR[code])
      : [],
    disablementDays: Number(body.disablementDays) || 0,
    scheduleInjury: SCHEDULE_I_INJURIES[body.scheduleInjury]
      ? body.scheduleInjury
      : undefined,
    lossOfEarningCapacityPercent:
      Number(body.lossOfEarningCapacityPercent) || 0,
    funeralExpensesIncurred: Boolean(body.funeralExpensesIncurred),
    penaltyShare: Number(body.penaltyShare) || 0,
  };
}

/**
 * Assemble and assess, without writing.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{status: number, body: object}>}
 */
async function computeForRequest(req) {
  const { employeeId, accidentDate } = req.body;

  if (!mongoose.isValidObjectId(employeeId)) {
    return { status: 400, body: { message: 'Invalid employee id' } };
  }

  const accident = new Date(accidentDate);
  if (Number.isNaN(accident.getTime())) {
    return {
      status: 400,
      body: { message: 'accidentDate must be a valid date' },
    };
  }

  const employee = await Employee.findOne(
    { _id: employeeId, tenantId: req.tenantId },
    'fullName role dateOfBirth monthlySalary',
  ).lean();

  if (!employee) {
    return { status: 404, body: { message: 'Employee not found' } };
  }

  const structures = await SalaryStructure.find(
    { tenantId: req.tenantId, employeeId },
    'effectiveFrom grossMonthly components',
  ).lean();

  // An explicit figure on the request wins. The structure is a reconstruction,
  // and the accident report may carry the wage the parties have agreed — which
  // is the one a Commissioner will work from.
  const monthlyWages =
    Number(req.body.monthlyWages) ||
    wagesAtAccident(structures, accident, employee.monthlySalary);

  const assessment = assessClaim({
    ...claimInputs(req.body),
    monthlyWages,
    dateOfBirth: employee.dateOfBirth,
    accidentDate: accident,
    paymentDate: req.body.paidOn,
    asAt: req.body.asAt,
  });

  if (!assessment.valid) {
    return { status: 422, body: { message: assessment.message } };
  }

  return {
    status: 200,
    body: { employee, monthlyWages, accidentDate: accident, assessment },
  };
}

/**
 * GET /api/injury-compensation/schedules
 *
 * The Schedule IV factors and the Schedule I injury list. Static, and served
 * from the API rather than duplicated in the frontend so a revision to either
 * table changes one file — the alternative is a page that shows one set of
 * factors while the claims are computed on another.
 */
exports.getSchedules = async (req, res, next) => {
  try {
    return res.json({
      relevantFactors: RELEVANT_FACTORS,
      scheduleInjuries: SCHEDULE_I_INJURIES,
      injuryTypes: Object.values(INJURY),
      bars: Object.values(BAR),
      monthlyWageCap: MONTHLY_WAGE_CAP,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/injury-compensation/preview
 *
 * Writes nothing. The loss of earning capacity is a medical opinion that gets
 * revised, the wage is argued over, and the penalty share is not known until a
 * Commissioner sets it — so a claim is computed many times before one is filed.
 */
exports.previewClaim = async (req, res, next) => {
  try {
    const { status, body } = await computeForRequest(req);

    return res
      .status(status)
      .json(status === 200 ? { preview: true, ...body } : body);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/injury-compensation/claims
 */
exports.createClaim = async (req, res, next) => {
  try {
    const { status, body } = await computeForRequest(req);
    if (status !== 200) return res.status(status).json(body);

    const { employee, monthlyWages, accidentDate, assessment } = body;

    const claim = await InjuryCompensationClaim.create({
      tenantId: req.tenantId,
      employeeId: employee._id,
      employeeName: employee.fullName || '',
      designation: employee.role || '',
      dateOfBirth: employee.dateOfBirth || null,

      accidentDate,
      place: req.body.place || '',
      circumstances: req.body.circumstances || '',
      injuryType: assessment.injuryType,

      assertedBars: assessment.bars.applied.concat(assessment.bars.disapplied),
      appliedBars: assessment.bars.applied,
      disappliedBars: assessment.bars.disapplied,
      barReasons: assessment.bars.reasons,
      payable: assessment.payable,

      monthlyWages,
      ageAtAccident: assessment.age,
      ageWarning: assessment.ageWarning || '',

      head: assessment.head,
      funeralExpenses: assessment.funeralExpenses,
      compensation: assessment.compensation,
      charges: assessment.charges,
      totalPayable: assessment.totalPayable,

      penaltyShare: Number(req.body.penaltyShare) || 0,
      status: CLAIM_STATUS.COMPUTED,
      notes: req.body.notes || '',

      createdBy: req.userId,
      updatedBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'INJURY_CLAIM_COMPUTED',
      resourceType: 'InjuryCompensationClaim',
      resourceIds: [claim._id],
      details: {
        employeeId: String(employee._id),
        injuryType: claim.injuryType,
        compensation: claim.compensation,
        payable: claim.payable,
      },
      req,
    });

    return res.status(201).json({ claim });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

/**
 * GET /api/injury-compensation/claims
 */
exports.listClaims = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };

    if (req.query.status && CLAIM_STATUS[req.query.status]) {
      filter.status = req.query.status;
    }
    if (mongoose.isValidObjectId(req.query.employeeId)) {
      filter.employeeId = req.query.employeeId;
    }

    const claims = await InjuryCompensationClaim.find(filter)
      .sort({ accidentDate: -1 })
      .limit(Math.min(Number(req.query.limit) || 50, 200))
      .lean();

    // The register's headline: what is still owed, and how much of it is
    // section 4A charges rather than compensation. An employer looking at this
    // page is deciding what to settle first, and interest running at twelve
    // percent on an admitted claim is the reason to settle it.
    const outstanding = claims.filter(
      (claim) =>
        claim.payable &&
        claim.status !== CLAIM_STATUS.PAID &&
        claim.status !== CLAIM_STATUS.REJECTED,
    );

    return res.json({
      claims,
      summary: {
        total: claims.length,
        outstanding: outstanding.length,
        outstandingCompensation: outstanding.reduce(
          (sum, claim) => sum + (claim.compensation || 0),
          0,
        ),
        outstandingInterest: outstanding.reduce(
          (sum, claim) =>
            sum + ((claim.charges && claim.charges.interest) || 0),
          0,
        ),
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/injury-compensation/claims/:id
 *
 * Section 4A interest is recomputed to today on the way out for an unpaid
 * claim, and returned beside the stored figure rather than instead of it. The
 * stored one is what was computed when the claim was filed; the live one is
 * what it costs to keep not paying, and a register showing only the first makes
 * an ageing liability look static.
 */
exports.getClaim = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const claim = await InjuryCompensationClaim.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const settled =
      claim.status === CLAIM_STATUS.PAID ||
      claim.status === CLAIM_STATUS.REJECTED;

    const chargesToday =
      claim.payable && !settled
        ? latePaymentCharges({
            compensation: claim.compensation,
            accidentDate: claim.accidentDate,
            penaltyShare: claim.penaltyShare,
          })
        : null;

    return res.json({ claim, chargesToday });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/injury-compensation/claims/:id/status
 *
 * The transition to PAID also carries the recomputation: a payment date settles
 * the section 4A interest, and until it exists the interest is an estimate.
 */
exports.updateStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const requested = req.body.status;
    if (!CLAIM_STATUS[requested]) {
      return res
        .status(400)
        .json({ message: `Unknown status: ${String(requested)}` });
    }

    const claim = await InjuryCompensationClaim.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const allowed = ALLOWED_TRANSITIONS[claim.status] || [];
    if (!allowed.includes(requested)) {
      return res.status(422).json({
        message: `A claim that is ${claim.status} cannot move to ${requested}`,
        allowed,
      });
    }

    // Section 8: compensation for death is payable only by deposit with the
    // Commissioner. Marking such a claim paid without one records a discharge
    // that has not happened, and the employer can be made to pay twice.
    if (
      requested === CLAIM_STATUS.PAID &&
      claim.injuryType === INJURY.DEATH &&
      !claim.depositedOn
    ) {
      return res.status(422).json({
        message:
          'Compensation for death must be deposited with the Commissioner under section 8 before it can be recorded as paid',
      });
    }

    claim.status = requested;
    claim.updatedBy = req.userId;

    if (requested === CLAIM_STATUS.DEPOSITED) {
      claim.depositedOn = req.body.depositedOn
        ? new Date(req.body.depositedOn)
        : new Date();
      claim.commissionerReference = req.body.commissionerReference || '';
    }

    if (requested === CLAIM_STATUS.PAID) {
      claim.paidOn = req.body.paidOn ? new Date(req.body.paidOn) : new Date();

      if (typeof req.body.penaltyShare !== 'undefined') {
        claim.penaltyShare = Math.min(
          0.5,
          Math.max(0, Number(req.body.penaltyShare) || 0),
        );
      }

      // The interest is only knowable now, so this is where it stops being an
      // estimate. Recomputed rather than carried, because the claim may have
      // sat at COMPUTED for months.
      claim.charges = latePaymentCharges({
        compensation: claim.compensation,
        accidentDate: claim.accidentDate,
        paymentDate: claim.paidOn,
        penaltyShare: claim.penaltyShare,
      });

      claim.totalPayable =
        Math.round((claim.charges.total + claim.funeralExpenses) * 100) / 100;
    }

    await claim.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action:
        requested === CLAIM_STATUS.DEPOSITED
          ? 'INJURY_CLAIM_DEPOSITED'
          : 'INJURY_CLAIM_STATUS_CHANGED',
      resourceType: 'InjuryCompensationClaim',
      resourceIds: [claim._id],
      details: {
        status: requested,
        totalPayable: claim.totalPayable,
        commissionerReference: claim.commissionerReference || undefined,
      },
      req,
    });

    return res.json({ claim });
  } catch (error) {
    return next(error);
  }
};
