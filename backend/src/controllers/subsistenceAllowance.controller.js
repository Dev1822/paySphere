/**
 * @fileoverview Section 10A of the Industrial Employment (Standing Orders) Act,
 * 1946 (#1828).
 *
 * The controller has two rules it holds to.
 *
 * **The attributability finding is recorded, never inferred.** It would be easy
 * to conclude that an enquiry which has run two hundred days without a hearing
 * was delayed by the employer, and to uplift on that basis. The module does not:
 * the uplift is conditional on a finding, and a finding is somebody's judgement
 * about whose conduct caused the delay. `recordAttributability` therefore takes
 * a reason and stamps who made it, and the rate is a *consequence* of that
 * record rather than something an operator can set. Making the rate editable
 * would let the stored number stop saying whether a finding was made — which is
 * the one thing an enquiry record has to evidence.
 *
 * **The wage base is frozen when the suspension is created.** It is copied from
 * the employee's salary at that moment and never re-read. Section 10A is on the
 * wages the workman was entitled to *immediately preceding* the suspension, and
 * pointing at the live salary would let a grade revision two years into a
 * suspension silently restate every month already paid.
 *
 * One thing the controller deliberately does not know: what the enquiry is
 * about. A suspension pending a POSH enquiry attracts section 10A exactly as
 * any other does, and the committee's proceedings are confidential to it — so
 * this module takes a suspension and a finding as inputs and stores a one-line
 * ground for identification, not an allegation.
 *
 * Everything that decides a rate, a tier or a set-off is in
 * `utils/subsistenceAllowance.js`.
 */

const mongoose = require('mongoose');

const {
  SubsistenceRules,
  Suspension,
  SubsistenceAssessment,
} = require('../models/subsistenceAllowance.model');
const Employee = require('../models/employee.model');
const {
  SUBSISTENCE_RULES,
  ATTRIBUTABILITY,
  OUTCOME,
  WAGE_BASIS,
  FINDING,
  assessSuspension,
  assessEstablishment,
} = require('../utils/subsistenceAllowance');
const eventBus = require('../services/event.service');

/**
 * The rules for an establishment.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId, establishment) {
  const stored = await SubsistenceRules.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  return stored
    ? { ...SUBSISTENCE_RULES, ...stored }
    : { ...SUBSISTENCE_RULES };
}

/**
 * The period being assessed, defaulting to the current financial year.
 *
 * @param {object} query
 * @returns {{periodStart: Date, periodEnd: Date, financialYear: number}}
 */
function resolvePeriod(query) {
  const now = new Date();

  const financialYear =
    Number(query?.financialYear) ||
    (now.getUTCMonth() + 1 >= 4
      ? now.getUTCFullYear()
      : now.getUTCFullYear() - 1);

  return {
    financialYear,
    periodStart: new Date(Date.UTC(financialYear, 3, 1)),
    periodEnd: new Date(Date.UTC(financialYear + 1, 2, 31)),
  };
}

/**
 * A suspension row in the shape the engine reads.
 *
 * @param {object} row
 * @param {Date} asAt
 * @returns {object}
 */
function toEngineSuspension(row, asAt) {
  return {
    suspensionId: row._id,
    employeeId: row.employeeId,
    name: row.name,
    suspendedOn: row.suspendedOn,
    concludedOn: row.concludedOn,
    asAt,
    wages: {
      basic: row.frozenWages?.basic,
      dearnessAllowance: row.frozenWages?.dearnessAllowance,
    },
    attributability:
      row.attributability?.finding || ATTRIBUTABILITY.NOT_DETERMINED,
    paid: (row.payments || []).reduce(
      (sum, payment) => sum + (payment.paid || 0),
      0,
    ),
    outcome: row.outcome || OUTCOME.PENDING,
    backWages: row.backWages,
  };
}

/**
 * Run the assessment for a period without writing anything.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
async function buildAssessment({ tenantId, establishment, query }) {
  const period = resolvePeriod(query || {});
  const rules = await resolveRules(tenantId, establishment);
  const asAt = query?.asAt ? new Date(query.asAt) : new Date();

  const rows = await Suspension.find({
    tenantId,
    establishment: establishment || '',
    suspendedOn: { $lte: period.periodEnd },
    $or: [
      { concludedOn: null },
      { concludedOn: { $gte: period.periodStart } },
      // An open suspension that began before the period is still here. It is
      // the one accruing at the highest rate and the one nobody is watching,
      // so dropping it from the year's view would hide the largest liability.
      { outcome: OUTCOME.PENDING },
    ],
  }).lean();

  const workmen = await Employee.countDocuments(
    establishment ? { tenantId, department: establishment } : { tenantId },
  );

  const result = assessEstablishment({
    suspensions: rows.map((row) => toEngineSuspension(row, asAt)),
    applicability: {
      workmen,
      standingOrdersCertified: rules.standingOrdersCertified === true,
    },
    rules,
  });

  return { period, establishment, rules, workmen, result };
}

/**
 * GET /api/suspensions/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '';

    return res.json({ rules: await resolveRules(req.tenantId, establishment) });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/suspensions/rules
 */
exports.updateRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const update = {};
    const numeric = [
      'firstTierDays',
      'firstTierPercent',
      'secondTierDays',
      'secondTierPercent',
      'thirdTierPercent',
      'standingOrdersThreshold',
      'daysPerMonth',
    ];

    for (const field of numeric) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ message: `${field} must be a number` });
        }
        update[field] = value;
      }
    }

    for (const flag of [
      'standingOrdersCertified',
      'countsForProvidentFund',
      'countsForEsi',
      'countsForBonus',
      'countsForTds',
    ]) {
      if (req.body[flag] !== undefined) update[flag] = req.body[flag] === true;
    }

    const rules = await SubsistenceRules.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SUBSISTENCE_RULES_UPDATED',
      resourceType: 'SubsistenceRules',
      resourceIds: [rules._id],
      details: {
        establishment: establishment || '(default)',
        firstTierPercent: rules.firstTierPercent,
        secondTierPercent: rules.secondTierPercent,
        countsForProvidentFund: rules.countsForProvidentFund,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/suspensions
 */
exports.listSuspensions = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };

    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }
    if (req.query.open === 'true') filter.outcome = OUTCOME.PENDING;

    const suspensions = await Suspension.find(filter)
      .sort({ suspendedOn: -1 })
      .limit(300)
      .lean();

    return res.json({ suspensions });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/suspensions
 *
 * Audited. A suspension stops somebody's pay at half rate and starts a clock
 * that non-payment makes an offence under section 10A(4).
 */
exports.createSuspension = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res
        .status(400)
        .json({ message: 'A valid employeeId is required' });
    }

    const employee = await Employee.findOne({
      _id: req.body.employeeId,
      tenantId: req.tenantId,
    }).lean();

    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    const open = await Suspension.findOne({
      tenantId: req.tenantId,
      employeeId: employee._id,
      outcome: OUTCOME.PENDING,
    }).lean();

    if (open) {
      // Two open suspensions would double the entitlement for one person, and
      // the tier arithmetic would run from two different start dates at once.
      return res.status(409).json({
        message: 'This employee already has an open suspension',
        suspensionId: open._id,
      });
    }

    const suspendedOn = req.body.suspendedOn
      ? new Date(req.body.suspendedOn)
      : new Date();

    // Frozen here, and never re-read. Section 10A is on the wages immediately
    // preceding the suspension, so a revision granted during it moves nothing.
    const basic = Number(
      req.body.basic ?? employee?.salary?.basic ?? employee?.salary ?? 0,
    );
    const dearnessAllowance = Number(
      req.body.dearnessAllowance ?? employee?.salary?.da ?? 0,
    );

    const suspension = await Suspension.create({
      tenantId: req.tenantId,
      establishment:
        typeof req.body.establishment === 'string'
          ? req.body.establishment.trim()
          : employee.department || '',
      employeeId: employee._id,
      name: employee.name || '',
      suspendedOn,
      orderReference:
        typeof req.body.orderReference === 'string'
          ? req.body.orderReference.trim()
          : '',
      // A one-line identifier, not an allegation — see this file's header.
      groundSummary:
        typeof req.body.groundSummary === 'string'
          ? req.body.groundSummary.trim().slice(0, 200)
          : '',
      frozenWages: {
        basis: WAGE_BASIS.BASIC_PLUS_DA,
        basic: Number.isFinite(basic) ? Math.max(0, basic) : 0,
        dearnessAllowance: Number.isFinite(dearnessAllowance)
          ? Math.max(0, dearnessAllowance)
          : 0,
        frozenOn: suspendedOn,
      },
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SUSPENSION_ORDERED',
      resourceType: 'Suspension',
      resourceIds: [suspension._id],
      details: {
        name: suspension.name,
        suspendedOn: suspension.suspendedOn,
        orderReference: suspension.orderReference,
        frozenBasic: suspension.frozenWages.basic,
      },
      req,
    });

    return res.status(201).json({ suspension });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/suspensions/:id/attributability
 *
 * Its own endpoint, and audited, because this finding — not a rate — is what
 * decides whether the workman is on fifty per cent or seventy-five from day
 * ninety-one, and it is the fact an enquiry record has to evidence.
 *
 * There is no endpoint that sets the rate. That is the point: an overridable
 * rate would let the stored number stop saying whether a finding was made.
 */
exports.recordAttributability = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid suspension id' });
    }

    const { finding: verdict } = req.body;

    if (!Object.prototype.hasOwnProperty.call(ATTRIBUTABILITY, verdict)) {
      return res.status(400).json({
        message: `finding must be one of ${Object.keys(ATTRIBUTABILITY).join(', ')}`,
      });
    }

    const reason =
      typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (verdict !== ATTRIBUTABILITY.NOT_DETERMINED && !reason) {
      // A finding without a reason is a rate change wearing a finding's name.
      return res
        .status(400)
        .json({ message: 'A finding needs a reason recorded with it' });
    }

    const before = await Suspension.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!before)
      return res.status(404).json({ message: 'Suspension not found' });

    const suspension = await Suspension.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        $set: {
          attributability: {
            finding: verdict,
            determinedBy: req.userId,
            determinedOn: new Date(),
            reason,
          },
        },
      },
      { new: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SUSPENSION_ATTRIBUTABILITY_RECORDED',
      resourceType: 'Suspension',
      resourceIds: [suspension._id],
      details: {
        name: suspension.name,
        from: before.attributability?.finding || ATTRIBUTABILITY.NOT_DETERMINED,
        to: suspension.attributability.finding,
        reason,
      },
      req,
    });

    return res.json({ suspension });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/suspensions/:id
 *
 * The suspension with its schedule, so an operator can see which tier a month
 * fell in rather than reading a single figure.
 */
exports.getSuspension = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid suspension id' });
    }

    const suspension = await Suspension.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!suspension) {
      return res.status(404).json({ message: 'Suspension not found' });
    }

    const rules = await resolveRules(req.tenantId, suspension.establishment);

    return res.json({
      suspension,
      assessment: assessSuspension(
        toEngineSuspension(suspension, new Date()),
        rules,
      ),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/suspensions/:id/payments
 *
 * Records what was actually paid for a month.
 *
 * A month at a time, on the ordinary payroll cycle, because section 10A is a
 * subsistence allowance — money to live on while the enquiry runs. Paying it as
 * a lump at the end would defeat the provision even where the total was right.
 */
exports.recordPayment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid suspension id' });
    }

    const month = Number(req.body.month);
    const year = Number(req.body.year);

    if (!(month >= 1 && month <= 12) || !Number.isFinite(year)) {
      return res
        .status(400)
        .json({ message: 'A valid month and year are required' });
    }

    const paid = Number(req.body.paid);
    if (!Number.isFinite(paid) || paid < 0) {
      return res.status(400).json({ message: 'paid must be a number' });
    }

    const suspension = await Suspension.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!suspension) {
      return res.status(404).json({ message: 'Suspension not found' });
    }

    const payments = (suspension.payments || []).filter(
      (payment) => !(payment.month === month && payment.year === year),
    );

    payments.push({
      month,
      year,
      due: Math.max(0, Number(req.body.due) || 0),
      paid,
      paidOn: req.body.paidOn ? new Date(req.body.paidOn) : new Date(),
      tier: Math.min(3, Math.max(1, Number(req.body.tier) || 1)),
      percent: Math.min(100, Math.max(0, Number(req.body.percent) || 0)),
    });

    payments.sort((a, b) => a.year - b.year || a.month - b.month);
    suspension.payments = payments;
    await suspension.save();

    return res.json({ suspension });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/suspensions/:id/outcome
 *
 * Concludes the suspension, and converts what has already been drawn.
 *
 * Audited: on a reinstatement the drawn allowance becomes a set-off against
 * back wages, and on a dismissal it becomes unrecoverable — the same ledger
 * rows, meaning different things, decided here.
 */
exports.recordOutcome = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid suspension id' });
    }

    const { outcome } = req.body;

    if (
      !Object.prototype.hasOwnProperty.call(OUTCOME, outcome) ||
      outcome === OUTCOME.PENDING
    ) {
      return res.status(400).json({
        message: `outcome must be one of ${Object.keys(OUTCOME)
          .filter((key) => key !== OUTCOME.PENDING)
          .join(', ')}`,
      });
    }

    const suspension = await Suspension.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!suspension) {
      return res.status(404).json({ message: 'Suspension not found' });
    }

    const backWages =
      outcome === OUTCOME.REINSTATED_WITH_BACK_WAGES
        ? Math.max(0, Number(req.body.backWages) || 0)
        : 0;

    const drawn = (suspension.payments || []).reduce(
      (sum, payment) => sum + (payment.paid || 0),
      0,
    );

    suspension.outcome = outcome;
    suspension.concludedOn = req.body.concludedOn
      ? new Date(req.body.concludedOn)
      : new Date();
    suspension.backWages = backWages;
    // Capped at the back wages: a set-off never becomes a recovery, which is
    // what the difference would be if the allowance drawn exceeded the order.
    suspension.setOff = Math.min(drawn, backWages);

    await suspension.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SUSPENSION_CONCLUDED',
      resourceType: 'Suspension',
      resourceIds: [suspension._id],
      details: {
        name: suspension.name,
        outcome: suspension.outcome,
        concludedOn: suspension.concludedOn,
        drawn,
        backWages: suspension.backWages,
        setOff: suspension.setOff,
      },
      req,
    });

    return res.json({ suspension });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/suspensions/assessment
 *
 * Writes nothing.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const establishment =
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '';

    return res.json(
      await buildAssessment({
        tenantId: req.tenantId,
        establishment,
        query: req.query,
      }),
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/suspensions/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await SubsistenceAssessment.find({
      tenantId: req.tenantId,
    })
      .sort({ periodStart: -1 })
      .limit(50)
      .select('-findings -suspensions')
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/suspensions/assessments
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const { period, rules, workmen, result } = await buildAssessment({
      tenantId: req.tenantId,
      establishment,
      query: req.body,
    });

    const assessment = await SubsistenceAssessment.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        establishment,
        periodStart: period.periodStart,
      },
      {
        $set: {
          periodEnd: period.periodEnd,
          rules,
          applicable: result.applicable,
          workmen,
          standingOrdersCertified: result.applicability.standingOrdersCertified,
          suspensionCount: result.suspensionCount,
          openCount: result.openCount,
          due: result.due,
          paid: result.paid,
          shortfall: result.shortfall,
          awaitingFindingCount: result.awaitingFindingCount,
          exposureIfAttributed: result.exposureIfAttributed,
          setOffOnReinstatement: result.setOffOnReinstatement,
          summary: result.summary,
          findings: result.findings,
          suspensions: result.suspensions.map((row) => {
            const bands = row.schedule.bands;
            const current = bands[bands.length - 1];
            const gap = row.findings.find(
              (entry) => entry.code === FINDING.ATTRIBUTABILITY_NOT_DETERMINED,
            );

            return {
              suspensionId: row.suspensionId,
              employeeId: row.employeeId,
              name: row.name,
              suspendedOn: row.schedule.suspendedOn,
              days: row.schedule.days,
              attributability: row.attributability,
              currentTier: current?.tier || 1,
              currentPercent: current?.percent || 0,
              due: row.due,
              paid: row.paid,
              shortfall: row.shortfall,
              excess: row.excess,
              differenceIfAttributed: gap?.differenceIfFound || 0,
              nextTransitionOn: row.schedule.nextTransition?.onDate || null,
              outcome: row.outcome.outcome,
            };
          }),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SUBSISTENCE_ASSESSMENT_COMMITTED',
      resourceType: 'SubsistenceAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: establishment || '(default)',
        financialYear: period.financialYear,
        openCount: assessment.openCount,
        shortfall: assessment.shortfall,
        awaitingFindingCount: assessment.awaitingFindingCount,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};
