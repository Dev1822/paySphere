/**
 * @fileoverview International assignments and tax equalization (#1348).
 *
 * Every figure comes out of `utils/taxEqualization.js`, which touches no
 * database. What is left here is the part that needs one: which entities an
 * assignment runs between, which trips have been logged against it, and what a
 * settlement was agreed at.
 *
 * The one design decision worth stating up front is that the tax tables are
 * *inputs* rather than something this module owns. Home and host rate tables
 * change every year, differ by country and by filing status, and any table
 * shipped in this repo would be wrong for most tenants and stale for the rest.
 * They arrive with the request and are snapshotted onto the settlement, which
 * also makes a settled year reconstructable — the same reasoning as the
 * gratuity assumptions.
 */

const mongoose = require('mongoose');

const {
  Assignment,
  EqualizationSettlement,
} = require('../models/assignment.model');
const Employee = require('../models/employee.model');
const {
  TAX_APPROACH,
  buildAssignmentAssessment,
  countPresenceDays,
  assessTreatyExposure,
  projectAssignmentCost,
  grossUp,
} = require('../utils/taxEqualization');
const eventBus = require('../services/event.service');

/**
 * The rolling window a treaty day count is measured over.
 *
 * A rolling twelve months ending today is the most common measurement and is
 * the default on the model. A calendar-year or tax-year treaty gets its window
 * from the caller, because which one applies is a property of the treaty and
 * not something this code can infer from two country names.
 *
 * @param {object} assignment
 * @param {object} query
 * @returns {{from: Date|null, to: Date|null}}
 */
function measurementWindow(assignment, query = {}) {
  if (query.from || query.to) {
    return {
      from: query.from ? new Date(query.from) : null,
      to: query.to ? new Date(query.to) : null,
    };
  }

  if (assignment.measurementPeriod === 'calendar_year') {
    const year = Number(query.year) || new Date().getUTCFullYear();
    return {
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year, 11, 31)),
    };
  }

  const to = new Date();
  const from = new Date(to.getTime());
  from.setUTCFullYear(from.getUTCFullYear() - 1);

  return { from, to };
}

/**
 * Everything the engine needs about an assignment, as a plain object.
 *
 * @param {object} doc
 * @returns {object}
 */
function toEngineShape(doc) {
  return {
    homeBaseSalary: doc.homeBaseSalary,
    homeBonus: doc.homeBonus,
    otherHomeCompensation: doc.otherHomeCompensation,
    taxApproach: doc.taxApproach,
    allowances: doc.allowances
      ? typeof doc.allowances.toObject === 'function'
        ? doc.allowances.toObject()
        : doc.allowances
      : {},
  };
}

/**
 * POST /api/assignments
 */
exports.createAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const employee = await Employee.findOne({
      _id: req.body.employeeId
    })
      .select('_id fullName')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // An employee on two live assignments at once is not a scenario the tax
    // arrangement can express — there is one hypo tax position and one host
    // country — so it is refused rather than producing two settlements that
    // each think they are the whole picture.
    const live = await Assignment.findOne({
      employeeId: employee._id,
      status: { $in: ['approved', 'active'] }
    }).lean();

    if (live) {
      return res.status(409).json({
        message:
          'This employee already has a live assignment. Complete or cancel it before opening another.',
        assignmentId: live._id,
      });
    }

    const assignment = await Assignment.create({
      ...req.body,
      employeeId: employee._id,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ASSIGNMENT_CREATED',
      resourceType: 'Assignment',
      resourceIds: [assignment._id],
      details: {
        employee: employee.fullName,
        homeCountry: assignment.homeCountry,
        hostCountry: assignment.hostCountry,
        taxApproach: assignment.taxApproach,
      },
      req,
    });

    return res.status(201).json({ message: 'Assignment created', assignment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/assignments
 */
exports.listAssignments = async (req, res, next) => {
  try {
    const query = {};

    if (req.query.status) query.status = req.query.status;

    const assignments = await Assignment.find(query)
      .populate('employeeId', 'fullName department role')
      .sort({ startDate: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 200))
      .lean();

    // The day count is what the roster is read for — "who is close to 183" is
    // the question — so it is computed here rather than leaving every row to be
    // fetched individually.
    const rows = assignments.map((assignment) => {
      const window = measurementWindow(assignment, req.query);
      const presence = countPresenceDays(assignment.presencePeriods, window);

      return {
        ...assignment,
        presenceDays: presence.days,
        exposure: assessTreatyExposure(presence.days, {
          threshold: assignment.treatyDayThreshold,
          period: assignment.measurementPeriod,
        }),
      };
    });

    return res.json({ count: rows.length, assignments: rows });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/assignments/:id
 */
exports.getAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment id' });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id
    })
      .populate('employeeId', 'fullName department role')
      .lean();

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const window = measurementWindow(assignment, req.query);
    const presence = countPresenceDays(assignment.presencePeriods, window);

    const settlements = await EqualizationSettlement.find({
      assignmentId: assignment._id
    })
      .sort({ taxYear: -1 })
      .lean();

    return res.json({
      assignment,
      presence,
      exposure: assessTreatyExposure(presence.days, {
        threshold: assignment.treatyDayThreshold,
        period: assignment.measurementPeriod,
      }),
      settlements,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/assignments/:id
 */
exports.updateAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment id' });
    }

    // `tenantId`, `employeeId`, `createdBy` and `approvedCost` are stripped
    // rather than trusted. A PATCH that could move an assignment to another
    // tenant is the shape #1010 found leaking records, and `approvedCost` is
    // written by the cost-projection route after somebody has actually approved
    // a figure — letting a general update set it would let an assignment claim
    // an approval that never happened.
    //
    // Allow-listed by deletion rather than by destructuring, so a reviewer sees
    // the field names next to the reason instead of four discarded bindings.
    const updates = { ...req.body };
    for (const field of [
      'tenantId',
      'employeeId',
      'createdBy',
      'approvedCost',
    ]) {
      delete updates[field];
    }

    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id
      },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ASSIGNMENT_UPDATED',
      resourceType: 'Assignment',
      resourceIds: [assignment._id],
      details: { fields: Object.keys(updates) },
      req,
    });

    return res.json({ message: 'Assignment updated', assignment });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/assignments/:id/presence
 *
 * Log a period of physical presence in the host country.
 *
 * Pushed rather than replaced, because the day count is cumulative and a client
 * that sends the whole array back would lose whatever another client added in
 * between — on a commuter assignment, where trips are logged monthly by
 * different people, that is a real race and not a theoretical one.
 */
exports.addPresencePeriod = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment id' });
    }

    const arrival = new Date(req.body.arrival);

    if (Number.isNaN(arrival.getTime())) {
      return res
        .status(400)
        .json({ message: 'A valid arrival date is required' });
    }

    const departure = req.body.departure ? new Date(req.body.departure) : null;

    if (departure && Number.isNaN(departure.getTime())) {
      return res.status(400).json({ message: 'Invalid departure date' });
    }

    if (departure && departure < arrival) {
      return res
        .status(400)
        .json({
          message: 'The departure date cannot be before the arrival date',
        });
    }

    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id
      },
      {
        $push: {
          presencePeriods: {
            arrival,
            departure,
            purpose: req.body.purpose || '',
          },
        },
      },
      { new: true, runValidators: true },
    );

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const window = measurementWindow(assignment, req.query);
    const presence = countPresenceDays(assignment.presencePeriods, window);
    const exposure = assessTreatyExposure(presence.days, {
      threshold: assignment.treatyDayThreshold,
      period: assignment.measurementPeriod,
    });

    // Emitted on the way *up* to the threshold, not after it. Once it is
    // crossed the filing obligation exists and there is nothing left to decide.
    if (exposure.status !== 'within') {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action:
          exposure.status === 'exceeded'
            ? 'ASSIGNMENT_TREATY_THRESHOLD_EXCEEDED'
            : 'ASSIGNMENT_TREATY_THRESHOLD_APPROACHING',
        resourceType: 'Assignment',
        resourceIds: [assignment._id],
        details: { days: presence.days, threshold: exposure.threshold },
        req,
      });
    }

    return res.status(201).json({
      message: 'Presence recorded',
      presenceDays: presence.days,
      exposure,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/assignments/:id/cost-projection
 *
 * The number that goes in front of whoever approves the move. Writes nothing
 * unless `approve` is set, because the package is reshaped several times before
 * anybody signs off on it.
 */
exports.projectCost = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment id' });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const projection = projectAssignmentCost(toEngineShape(assignment), {
      homeTaxTable: req.body.homeTaxTable,
      hypoDeductions: req.body.hypoDeductions,
      estimatedHomeTax: req.body.estimatedHomeTax,
      estimatedHostTax: req.body.estimatedHostTax,
      socialSecurity: req.body.socialSecurity,
      relocationOneOff: req.body.relocationOneOff,
      repatriation: req.body.repatriation,
    });

    if (req.body.approve === true) {
      assignment.approvedCost = {
        totalCost: projection.totalCost,
        costMultiple: projection.costMultiple,
        hypotheticalTaxCredit: projection.hypotheticalTaxCredit,
        employerBorneTax: projection.employerBorneTax,
        approvedAt: new Date(),
        approvedBy: req.userId,
      };

      if (assignment.status === 'proposed') assignment.status = 'approved';

      await assignment.save();

      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'ASSIGNMENT_COST_APPROVED',
        resourceType: 'Assignment',
        resourceIds: [assignment._id],
        details: {
          totalCost: projection.totalCost,
          costMultiple: projection.costMultiple,
        },
        req,
      });
    }

    return res.json({
      approved: req.body.approve === true,
      projection,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/assignments/:id/gross-up
 *
 * Gross up an employer-borne benefit. Writes nothing — this is a calculator,
 * and it is used while a package is being negotiated rather than after.
 */
exports.calculateGrossUp = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment id' });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id
    }).lean();

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const netBenefit = Number(req.body.netBenefit);

    if (!Number.isFinite(netBenefit) || netBenefit < 0) {
      return res
        .status(400)
        .json({ message: 'A net benefit amount is required' });
    }

    const result = grossUp(netBenefit, {
      taxTable: req.body.taxTable,
      baseIncome:
        req.body.baseIncome === undefined
          ? assignment.homeBaseSalary
          : Number(req.body.baseIncome),
    });

    if (!result.converged) {
      // Not a 500. The arithmetic did what it was asked; the rate table it was
      // given has no fixed point, which is a caller problem and should read as
      // one.
      return res.status(422).json({
        message:
          'The gross-up did not converge — a marginal rate at or above 100% has no solution',
        result,
      });
    }

    return res.json({ result });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/assignments/:id/settlements
 *
 * The year-end equalization settlement.
 *
 * Upserted on (assignment, tax year) so a corrected host tax assessment
 * restates the year rather than producing a second settlement — two answers to
 * "what did the employee owe" is the one thing a settlement must never be.
 */
exports.settleYear = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment id' });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id
    }).lean();

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const taxYear = Number(req.body.taxYear);

    if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
      return res.status(400).json({ message: 'A valid tax year is required' });
    }

    if (assignment.taxApproach === TAX_APPROACH.LAISSEZ_FAIRE) {
      return res.status(422).json({
        message:
          'This assignment has no tax arrangement, so there is nothing to settle. The employee carries their actual tax.',
      });
    }

    const window = measurementWindow(assignment, { year: taxYear });

    const assessment = buildAssignmentAssessment(toEngineShape(assignment), {
      homeTaxTable: req.body.homeTaxTable,
      hostTaxTable: req.body.hostTaxTable,
      hypoDeductions: req.body.hypoDeductions,
      hypoTaxWithheld: req.body.hypoTaxWithheld,
      actualHomeTax: req.body.actualHomeTax,
      actualHostTax: req.body.actualHostTax,
      trips: assignment.presencePeriods,
      window,
    });

    const settlement = await EqualizationSettlement.findOneAndUpdate(
      {
        assignmentId: assignment._id,
        taxYear
      },
      {
        $set: {
          assignmentId: assignment._id,
          employeeId: assignment.employeeId,
          taxYear,
          stayAtHomeCompensation: assessment.hypo.stayAtHome.total,
          hypoTaxableIncome: assessment.hypo.hypoTaxableIncome,
          hypotheticalTax: assessment.hypo.hypotheticalTax,
          hypoTaxWithheld: assessment.settlement.hypoTaxWithheld,
          actualHomeTax: assessment.settlement.actualHomeTax,
          actualHostTax: assessment.settlement.actualHostTax,
          actualTotalTax: assessment.settlement.actualTotalTax,
          employeeBears: assessment.settlement.employeeBears,
          employerBears: assessment.settlement.employerBears,
          settlement: assessment.settlement.settlement,
          settlementDirection: assessment.settlement.settlementDirection,
          approach: assessment.settlement.approach,
          note: assessment.settlement.note,
          homeTaxTable: req.body.homeTaxTable || [],
          hostTaxTable: req.body.hostTaxTable || [],
          presenceDays: assessment.presence.days,
          treatyStatus: assessment.exposure.status,

          settledOn: req.body.settledOn
            ? new Date(req.body.settledOn)
            : new Date(),

          createdBy: req.userId
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ASSIGNMENT_SETTLEMENT_RECORDED',
      resourceType: 'EqualizationSettlement',
      resourceIds: [settlement._id],
      details: {
        taxYear,
        settlement: settlement.settlement,
        direction: settlement.settlementDirection,
      },
      req,
    });

    return res
      .status(201)
      .json({ message: `Settled for ${taxYear}`, settlement, assessment });
  } catch (error) {
    return next(error);
  }
};
