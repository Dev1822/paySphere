/**
 * @fileoverview EPF belated remittance — section 7Q and section 14B (#1875).
 *
 * Three decisions carry this controller.
 *
 * **It never recomputes what was due.** `ecrGenerator.utils.js` is the single
 * place that decides the contribution for a wage month. This controller reads
 * the figure onto a ledger row and asks only when it was paid. Where the two
 * would disagree the ECR is right and this ledger is stale, and saying so is
 * cheaper than having two contribution engines.
 *
 * **The waiver is resolved per month from a period order.** A paragraph 32B
 * order covers a stretch of months, so `waiversFor` expands the orders into a
 * per-month map before the engine runs. That expansion is the reason the waiver
 * is its own collection: recording the order once and expanding it here means
 * the copies cannot disagree, which they would if the state lived on each
 * month.
 *
 * **No endpoint returns the two liabilities added together.** Not the preview,
 * not the assessment, not the export. Interest under section 7Q is mandatory
 * and unwaivable; damages under 14B can be waived to nil by the Board. A caller
 * that wants one number has to write the addition itself, and whoever reviews
 * that line has to decide whether provisioning for damages under a pending
 * application is right — which is the decision this shape exists to force.
 *
 * Everything that decides a day, a rate or a slab is in
 * `utils/epfBelatedRemittance.js`.
 */

const mongoose = require('mongoose');

const {
  EpfRemittanceRules,
  EpfRemittanceMonth,
  EpfDamagesWaiver,
  EpfRemittanceAssessment,
} = require('../models/epfRemittance.model');
const {
  EPF_REMITTANCE_RULES,
  COMPONENT,
  WAIVER_STATE,
  DUE_BASIS,
  wageMonthKey,
  dueDateFor,
  resolveRules,
  assessEstablishment,
} = require('../utils/epfBelatedRemittance');
const eventBus = require('../services/event.service');
const {
  computePosition,
  loadRules,
  ordinalOf,
  waiversFor,
  epfRemittanceQueue,
} = require('../services/epfRemittance.service');
const { getSimulationCacheKey } = require('../workers/epfRemittance.worker');
const cacheService = require('../services/cache.service');
const { acquireLock, releaseLock } = require('../utils/lockManager');

/** Rule fields a caller may set. Anything else on the body is ignored. */
const NUMERIC_RULE_FIELDS = [
  'dueDayOfNextMonth',
  'graceDays',
  'interestRatePercent',
  'damagesCapPercentOfArrears',
];

/**
 * @param {*} value
 * @returns {string}
 */
function readEstablishment(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A `YYYY-MM` bound from a query string, or null.
 *
 * @param {*} value
 * @returns {{year: number, month: number}|null}
 */
function parseWageMonth(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return { year, month };
}

/**
 * GET /api/epf-remittance/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);
    const rules = await loadRules(req.tenantId, establishment);

    return res.json({
      establishment,
      rules,
      note: 'The five-day grace period that followed the fifteenth was withdrawn with effect from January 2016. A non-zero grace here is a local rule and not the statute.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/epf-remittance/rules
 */
exports.updateRules = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);
    const update = {};

    for (const field of NUMERIC_RULE_FIELDS) {
      if (req.body[field] === undefined) continue;

      const value = Number(req.body[field]);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ message: `${field} must be a number` });
      }
      update[field] = value;
    }

    if (req.body.damageSlabs !== undefined) {
      if (
        !Array.isArray(req.body.damageSlabs) ||
        req.body.damageSlabs.length === 0
      ) {
        return res.status(400).json({
          message:
            'damageSlabs must be the whole table. The paragraph 32A bands have to tile the range, so a partial table is not a rule that can be applied.',
        });
      }

      const slabs = req.body.damageSlabs.map((slab) => ({
        code: String(slab?.code || '').trim(),
        upToMonths:
          slab?.upToMonths === null || slab?.upToMonths === undefined
            ? null
            : Number(slab.upToMonths),
        ratePercent: Number(slab?.ratePercent),
      }));

      if (
        slabs.some(
          (slab) =>
            !slab.code ||
            !Number.isFinite(slab.ratePercent) ||
            slab.ratePercent < 0,
        )
      ) {
        return res
          .status(400)
          .json({ message: 'Each slab needs a code and a numeric rate' });
      }

      // The last band has to be open-ended or a long default falls off the end
      // of the table and gets no rate at all.
      if (slabs[slabs.length - 1].upToMonths !== null) {
        return res.status(400).json({
          message:
            'The last band must be open-ended (upToMonths null), or a default beyond it would attract no damages at all',
        });
      }

      update.damageSlabs = slabs;
    }

    const before = await EpfRemittanceRules.findOne({
      establishment
    }).lean();

    const rules = await EpfRemittanceRules.findOneAndUpdate(
      {
        establishment
      },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPF_REMITTANCE_RULES_UPDATED',
      resourceType: 'EpfRemittanceRules',
      resourceIds: [rules._id],
      details: {
        establishment: establishment || '(default)',
        // Named in the audit line because a non-zero grace turns a five-day
        // default into a compliant remittance on paper.
        graceDaysFrom: before?.graceDays ?? EPF_REMITTANCE_RULES.graceDays,
        graceDaysTo: rules.graceDays,
        interestRatePercent: rules.interestRatePercent,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/epf-remittance/months
 */
exports.listMonths = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const months = await EpfRemittanceMonth.find({
      establishment
    })
      .sort({ year: -1, month: -1 })
      .limit(240)
      .lean();

    return res.json({
      establishment,
      months: months.map((month) => ({
        ...month,
        key: wageMonthKey(month),
        dueDate: dueDateFor(month),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/epf-remittance/months
 *
 * Upserts what was due for a wage month. The remittances are not touched here —
 * restating the dues after a section 7A determination must not erase the
 * payments already recorded against the month.
 */
exports.recordMonth = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);
    const year = Number(req.body.year);
    const month = Number(req.body.month);

    if (!Number.isInteger(year) || year < 1952) {
      return res.status(400).json({ message: 'year must be a valid year' });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'month must be 1-12' });
    }

    const basis = Object.values(DUE_BASIS).includes(req.body.basis)
      ? req.body.basis
      : DUE_BASIS.ECR;

    const amountsDue = [];
    const dues = req.body.amountsDue || {};
    for (const component of Object.values(COMPONENT)) {
      if (dues[component] === undefined) continue;

      const amount = Number(dues[component]);
      if (!Number.isFinite(amount) || amount < 0) {
        return res
          .status(400)
          .json({ message: `amountsDue.${component} must be a number` });
      }
      amountsDue.push({ component, amount });
    }

    if (amountsDue.length === 0) {
      return res.status(400).json({
        message:
          'At least one component must carry an amount. The accounts are kept apart because a challan can clear A/c 1 and leave A/c 10 short.',
      });
    }

    // A determination has to say which one. The row is otherwise identical to
    // an ordinary month and the difference decides how a reader treats it.
    if (basis === DUE_BASIS.SECTION_7A && !req.body.determinationReference) {
      return res.status(422).json({
        message:
          'A section 7A basis needs the order reference. Interest and damages on a determined amount run from the original due date, not from the date of the order, and the row is otherwise indistinguishable from an ordinary month.',
      });
    }

    const record = await EpfRemittanceMonth.findOneAndUpdate(
      {
        establishment,
        year,
        month
      },
      {
        $set: {
          basis,
          amountsDue,
          memberCount: Math.max(0, Number(req.body.memberCount) || 0),
          determinationReference: String(
            req.body.determinationReference || '',
          ).trim(),
          determinedOn: req.body.determinedOn
            ? new Date(req.body.determinedOn)
            : undefined,
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPF_REMITTANCE_MONTH_RECORDED',
      resourceType: 'EpfRemittanceMonth',
      resourceIds: [record._id],
      details: {
        establishment: establishment || '(default)',
        wageMonth: wageMonthKey({ year, month }),
        basis,
        total: amountsDue.reduce((sum, row) => sum + row.amount, 0),
      },
      req,
    });

    return res.status(201).json({
      month: { ...record.toObject(), dueDate: dueDateFor({ year, month }) },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/epf-remittance/months/:id/remittances
 *
 * Appends a payment. Deliberately append-only: a part payment on the fifteenth
 * and the balance four months later is one arrear with two different delays,
 * and the graded damages in paragraph 32A attach to each separately. Replacing
 * the list would collapse that into whichever date was entered last.
 */
exports.recordRemittance = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid month id' });
    }

    const component = req.body.component;
    if (!Object.values(COMPONENT).includes(component)) {
      return res.status(400).json({ message: 'Unknown component' });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ message: 'amount must be a positive number' });
    }

    const paidOn = new Date(req.body.paidOn);
    if (Number.isNaN(paidOn.getTime())) {
      return res.status(400).json({ message: 'paidOn must be a valid date' });
    }

    const record = await EpfRemittanceMonth.findOne({
      _id: req.params.id
    });

    if (!record) {
      return res.status(404).json({ message: 'Wage month not found' });
    }

    record.remittances.push({
      component,
      paidOn,
      amount,
      reference: String(req.body.reference || '').trim(),
      recordedBy: req.userId,
    });

    await record.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPF_REMITTANCE_RECORDED',
      resourceType: 'EpfRemittanceMonth',
      resourceIds: [record._id],
      details: {
        wageMonth: wageMonthKey(record),
        component,
        amount,
        paidOn,
        reference: req.body.reference || '',
      },
      req,
    });

    return res.status(201).json({ month: record });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/epf-remittance/waivers
 */
exports.listWaivers = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const waivers = await EpfDamagesWaiver.find({
      establishment
    })
      .sort({ fromYear: -1, fromMonth: -1 })
      .lean();

    return res.json({ establishment, waivers });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/epf-remittance/waivers
 */
exports.recordWaiver = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);

    const bounds = {
      fromYear: Number(req.body.fromYear),
      fromMonth: Number(req.body.fromMonth),
      toYear: Number(req.body.toYear),
      toMonth: Number(req.body.toMonth),
    };

    for (const [field, value] of Object.entries(bounds)) {
      if (!Number.isInteger(value)) {
        return res.status(400).json({ message: `${field} must be a number` });
      }
    }

    if (
      ordinalOf(bounds.toYear, bounds.toMonth) <
      ordinalOf(bounds.fromYear, bounds.fromMonth)
    ) {
      return res
        .status(400)
        .json({ message: 'The period ends before it starts' });
    }

    const state = Object.values(WAIVER_STATE).includes(req.body.state)
      ? req.body.state
      : WAIVER_STATE.NONE;

    const waivedPercent =
      state === WAIVER_STATE.GRANTED_IN_PART
        ? Number(req.body.waivedPercent)
        : 0;

    if (
      state === WAIVER_STATE.GRANTED_IN_PART &&
      (!Number.isFinite(waivedPercent) ||
        waivedPercent <= 0 ||
        waivedPercent >= 100)
    ) {
      return res.status(422).json({
        message:
          'A partial waiver needs a percentage strictly between 0 and 100. Nought is a refusal and a hundred is a full waiver, and both have their own state.',
      });
    }

    // The ground is required on anything that has actually been decided.
    // Paragraph 32B is available to an establishment declared sick with a
    // sanctioned scheme, so a decided order without a ground is a record that
    // cannot be defended on inspection.
    if (
      (state === WAIVER_STATE.GRANTED ||
        state === WAIVER_STATE.GRANTED_IN_PART) &&
      !String(req.body.ground || '').trim()
    ) {
      return res.status(422).json({
        message:
          'A granted waiver needs the ground it was granted on. Paragraph 32B is available only in defined circumstances and the record has to say which applied.',
      });
    }

    const waiver = await EpfDamagesWaiver.create({
      establishment,
      ...bounds,
      state,
      waivedPercent,
      ground: String(req.body.ground || '').trim(),
      orderReference: String(req.body.orderReference || '').trim(),
      appliedOn: req.body.appliedOn ? new Date(req.body.appliedOn) : undefined,
      decidedOn: req.body.decidedOn ? new Date(req.body.decidedOn) : undefined,
      recordedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPF_DAMAGES_WAIVER_RECORDED',
      resourceType: 'EpfDamagesWaiver',
      resourceIds: [waiver._id],
      details: {
        establishment: establishment || '(default)',
        period: `${wageMonthKey({ year: bounds.fromYear, month: bounds.fromMonth })} to ${wageMonthKey({ year: bounds.toYear, month: bounds.toMonth })}`,
        state,
        waivedPercent,
        orderReference: waiver.orderReference,
      },
      req,
    });

    return res.status(201).json({ waiver });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/epf-remittance/position
 *
 * The two liabilities, side by side and not summed. See the header.
 */
exports.getPosition = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);
    const asAt = req.query.asAt ? new Date(req.query.asAt) : new Date();

    if (Number.isNaN(asAt.getTime())) {
      return res.status(400).json({ message: 'asAt must be a valid date' });
    }

    const { rules, result, monthCount } = await computePosition({
      establishment,

      range: {
        from: parseWageMonth(req.query.from),
        to: parseWageMonth(req.query.to),
      },

      asAt
    });

    return res.json({
      establishment,
      monthCount,
      rules,
      result,
      note: 'Section 7Q interest and section 14B damages are separate liabilities and are not added anywhere in this response. Interest cannot be waived by any authority under the Act; damages can be waived to nil under paragraph 32B.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/epf-remittance/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const assessments = await EpfRemittanceAssessment.find({
      establishment
    })
      .sort({ asAt: -1 })
      .limit(60)
      .lean();

    return res.json({ establishment, assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/epf-remittance/assessments
 *
 * Commits a position as at a date, with the rules it was computed under
 * snapshotted onto it. An assessment that reproduces a different number when
 * reopened next year is worse than no assessment.
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);
    const asAt = req.body.asAt ? new Date(req.body.asAt) : new Date();

    if (Number.isNaN(asAt.getTime())) {
      return res.status(400).json({ message: 'asAt must be a valid date' });
    }

    const range = {
      from: parseWageMonth(req.body.from),
      to: parseWageMonth(req.body.to),
    };

    const { result, monthCount } = await computePosition({
      establishment,
      range,
      asAt
    });

    if (monthCount === 0) {
      return res.status(422).json({
        message:
          'There are no wage months in the ledger for this period. An assessment over nothing would read as a nil liability rather than as an empty ledger.',
      });
    }

    const assessment = await EpfRemittanceAssessment.create({
      establishment,
      asAt,
      periodFrom: range.from ? wageMonthKey(range.from) : '',
      periodTo: range.to ? wageMonthKey(range.to) : '',
      rulesSnapshot: result.rules,
      interestUnderSection7Q: result.interestUnderSection7Q,
      damagesAssessedUnderSection14B: result.damagesAssessedUnderSection14B,
      damagesPayableUnderSection14B: result.damagesPayableUnderSection14B,
      damagesContingentOnWaiver: result.damagesContingentOnWaiver,
      arrears: result.arrears,
      heldInTrust: result.heldInTrust,
      findings: result.findings,
      committedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPF_REMITTANCE_ASSESSMENT_COMMITTED',
      resourceType: 'EpfRemittanceAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: establishment || '(default)',
        asAt,
        monthCount,
        // The three figures are listed separately here for the same reason they
        // are stored separately: an audit line carrying their sum would be the
        // combined number this feature exists to avoid.
        interestUnderSection7Q: assessment.interestUnderSection7Q,
        damagesPayableUnderSection14B: assessment.damagesPayableUnderSection14B,
        heldInTrust: assessment.heldInTrust,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/epf-remittance/simulate
 *
 * Enqueues an asynchronous simulation job to compute interest and damages.
 */
exports.simulate = async (req, res, next) => {
  try {
    const { establishment, from, to, asAt } = req.body;
    const tenantId = req.tenantId;

    const fromMonth = parseWageMonth(from);
    const toMonth = parseWageMonth(to);

    if (!fromMonth || !toMonth) {
      return res.status(400).json({ message: 'from and to must be valid YYYY-MM wage months' });
    }

    const cacheKey = getSimulationCacheKey(tenantId, establishment, { from: fromMonth, to: toMonth }, asAt);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      return res.json({
        cached: true,
        result: JSON.parse(cached),
      });
    }

    // Determine financial year for lock check
    const month = fromMonth.month;
    const year = fromMonth.year;
    const financialYear = month >= 4 ? year : year - 1;

    const lockKey = `epf_lock:${tenantId}:${financialYear}`;
    
    // Check lock
    const acquired = await acquireLock(lockKey, 10000);
    if (!acquired) {
      return res.status(409).json({ message: 'Simulation or computation is already in progress for this financial year' });
    }
    await releaseLock(lockKey);

    if (typeof epfRemittanceQueue.add !== 'function') {
      return res.status(400).json({ message: 'Redis is disabled. Async simulations are not available.' });
    }

    const job = await epfRemittanceQueue.add('simulate-remittance', {
      tenantId,
      establishment: readEstablishment(establishment),
      range: { from: fromMonth, to: toMonth },
      asAt: asAt || new Date().toISOString(),
    });

    return res.status(202).json({
      message: 'Simulation job enqueued',
      jobId: job.id,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/epf-remittance/simulate/status/:jobId
 *
 * Fetches calculation progress and results.
 */
exports.getSimulationStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    if (typeof epfRemittanceQueue.getJob !== 'function') {
      return res.status(400).json({ message: 'Redis is disabled. Async simulations are not available.' });
    }

    const job = await epfRemittanceQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Simulation job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;

    if (state === 'completed') {
      return res.json({
        status: 'completed',
        progress,
        result: job.returnvalue,
      });
    }

    if (state === 'failed') {
      return res.json({
        status: 'failed',
        progress,
        error: job.failedReason,
      });
    }

    return res.json({
      status: state,
      progress,
    });
  } catch (error) {
    return next(error);
  }
};
