/**
 * @fileoverview Employment Exchanges (CNV) Act, 1959 (#1879).
 *
 * Three decisions carry this controller.
 *
 * **It owns nothing in the recruitment pipeline.** It reads a requisition's
 * category, its intended fill date and its expected duration and writes nothing
 * back. Where a requisition is filled without a notification it records the
 * default; it does **not** block the hire, because the Act does not make the
 * appointment invalid and a product that blocked it would be asserting a
 * consequence the statute does not create.
 *
 * **The section 5 statement travels with every notification.** Notifying a
 * vacancy creates no obligation to recruit through the exchange and none to
 * consider the candidates it sends. It is a stored field on the notification and
 * a `note` on every response, because a compliance flag without it reads as a
 * hiring instruction — and employers who read it that way either stop notifying
 * or hold roles open for nothing.
 *
 * **Nothing is defaulted to notifiable.** A determination is recorded or it is
 * not, and an undetermined requisition is reported as a question rather than as
 * a deadline. The section 3 grounds cover a large share of real requisitions,
 * and a queue that flagged all of them would be cleared without being read.
 *
 * Everything that decides a threshold, a window or a return date is in
 * `utils/vacancyNotification.js`.
 */

const mongoose = require('mongoose');

const {
  EstablishmentHeadcount,
  VacancyNotifiability,
  ExchangeNotification,
  EmploymentExchangeReturn,
} = require('../models/vacancyNotification.model');
const Employee = require('../models/employee.model');
const {
  CNV_RULES,
  SECTOR,
  NOTIFIABILITY,
  EXCLUSION,
  RETURN_KIND,
  NO_OBLIGATION_TO_RECRUIT,
  quarterEndFor,
  addDays,
  assessEstablishment,
} = require('../utils/vacancyNotification');
const eventBus = require('../services/event.service');

/**
 * @param {*} value
 * @returns {string}
 */
function readEstablishment(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The period to assess over, defaulting to the current financial year to date.
 *
 * @param {object} query
 * @returns {{from: Date, to: Date}}
 */
function resolvePeriod(query) {
  const now = new Date();
  const financialYear =
    now.getUTCMonth() + 1 >= 4
      ? now.getUTCFullYear()
      : now.getUTCFullYear() - 1;

  const from = query?.from
    ? new Date(query.from)
    : new Date(Date.UTC(financialYear, 3, 1));
  const to = query?.to ? new Date(query.to) : now;

  return { from, to };
}

/**
 * Compute the establishment's position.
 *
 * @param {object} input
 * @returns {Promise<object>}
 */
async function computePosition({ tenantId, establishment, period, asAt }) {
  const headcounts = await EstablishmentHeadcount.find({
    tenantId,
    establishment,
  })
    .sort({ asOn: 1 })
    .lean();

  const sector = headcounts.length
    ? headcounts[headcounts.length - 1].sector
    : SECTOR.PRIVATE;

  const determinations = await VacancyNotifiability.find({
    tenantId,
    establishment,
    openedOn: { $gte: period.from, $lte: period.to },
  })
    .sort({ openedOn: 1 })
    .lean();

  const notifications = await ExchangeNotification.find({
    tenantId,
    establishment,
  }).lean();

  // The earliest notification per requisition wins, because the fifteen-day
  // window is about when the exchange was first told. A second notification
  // correcting a detail does not move the obligation's clock.
  const earliest = new Map();
  for (const notification of notifications) {
    const key = String(notification.requisitionId);
    const current = earliest.get(key);
    if (!current || notification.notifiedOn < current) {
      earliest.set(key, notification.notifiedOn);
    }
  }

  const filings = await EmploymentExchangeReturn.find({
    tenantId,
    establishment,
    filedOn: { $ne: null },
  }).lean();

  return assessEstablishment({
    sector,
    headcounts: headcounts.map((row) => ({
      asOn: row.asOn,
      headcount: row.headcount,
    })),
    requisitions: determinations.map((row) => ({
      requisitionId: row.requisitionId,
      title: row.title,
      category: row.category,
      openedOn: row.openedOn,
      intendedFillDate: row.intendedFillDate,
      durationMonths: row.durationMonths,
      actualDurationMonths: row.actualDurationMonths,
      exclusionGround: row.exclusionGround,
      determinedOn: row.determinedOn,
      notifiedOn: earliest.get(String(row.requisitionId)) || null,
      filledOn: row.filledOn,
      retrenchedPreferenceInCategory: row.retrenchedPreferenceInCategory,
    })),
    filings: filings.map((row) => ({
      kind: row.kind,
      asOn: row.asOn,
      filedOn: row.filedOn,
    })),
    period,
    erTwoAnchor: headcounts[0]?.asOn,
    asAt,
  });
}

/**
 * GET /api/vacancy-notification/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      rules: CNV_RULES,
      exclusions: EXCLUSION,
      noObligationToRecruit: NO_OBLIGATION_TO_RECRUIT,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/vacancy-notification/headcounts
 */
exports.listHeadcounts = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const headcounts = await EstablishmentHeadcount.find({
      tenantId: req.tenantId,
      establishment,
    })
      .sort({ asOn: -1 })
      .limit(200)
      .lean();

    return res.json({
      establishment,
      headcounts,
      note: 'Dated, because the threshold is evaluated as at the date a requisition opened. An establishment crosses twenty-five during a year and the obligation starts then, not retrospectively.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/vacancy-notification/headcounts
 *
 * Offers today's employee count as a starting figure, and does not write it
 * without being told to. Section 2(f) counts persons employed, which is a wider
 * class than the payroll — the count has to be somebody's determination.
 */
exports.recordHeadcount = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);

    const asOn = new Date(req.body.asOn);
    if (Number.isNaN(asOn.getTime())) {
      return res.status(400).json({ message: 'asOn must be a valid date' });
    }

    const headcount = Number(req.body.headcount);
    if (!Number.isInteger(headcount) || headcount < 0) {
      return res
        .status(400)
        .json({ message: 'headcount must be a non-negative integer' });
    }

    const sector = Object.values(SECTOR).includes(req.body.sector)
      ? req.body.sector
      : SECTOR.PRIVATE;

    const record = await EstablishmentHeadcount.findOneAndUpdate(
      { tenantId: req.tenantId, establishment, asOn },
      {
        $set: {
          sector,
          headcount,
          basis: String(req.body.basis || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CNV_HEADCOUNT_RECORDED',
      resourceType: 'EstablishmentHeadcount',
      resourceIds: [record._id],
      details: {
        establishment: establishment || '(default)',
        asOn,
        headcount,
        // Named because this figure decides whether the Act reached every
        // requisition opened after this date.
        threshold: CNV_RULES.privateSectorThreshold,
        sector,
      },
      req,
    });

    return res.status(201).json({ headcount: record });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/vacancy-notification/headcounts/suggestion
 *
 * Today's employee count, offered and not written. Deliberately a suggestion:
 * section 2(f) counts persons employed, which reaches contract and casual
 * workers that `Employee` does not hold.
 */
exports.suggestHeadcount = async (req, res, next) => {
  try {
    const count = await Employee.countDocuments({ tenantId: req.tenantId });

    return res.json({
      suggested: count,
      asOn: new Date(),
      note: 'Employees on the rolls today. Section 2(f) counts persons employed, which reaches contract and casual workers this figure does not include — so this is a floor rather than the answer.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/vacancy-notification/determinations
 */
exports.listDeterminations = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const determinations = await VacancyNotifiability.find({
      tenantId: req.tenantId,
      establishment,
    })
      .sort({ openedOn: -1 })
      .limit(500)
      .lean();

    return res.json({ establishment, determinations });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/vacancy-notification/determinations
 *
 * Records whether a requisition is notifiable, and on what ground where it is
 * not. Nothing is defaulted to notifiable — see the header.
 */
exports.recordDetermination = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.requisitionId)) {
      return res.status(400).json({ message: 'Invalid requisition id' });
    }

    const openedOn = new Date(req.body.openedOn);
    if (Number.isNaN(openedOn.getTime())) {
      return res.status(400).json({ message: 'openedOn must be a valid date' });
    }

    const intendedFillDate = new Date(req.body.intendedFillDate);
    if (Number.isNaN(intendedFillDate.getTime())) {
      return res.status(422).json({
        message:
          'intendedFillDate is required. The fifteen-day window runs backwards from it, and without it the obligation has no deadline and can only be reported after the fact.',
      });
    }

    const ground = EXCLUSION[req.body.exclusionGround]
      ? req.body.exclusionGround
      : null;

    const status = ground ? NOTIFIABILITY.EXCLUDED : NOTIFIABILITY.NOTIFIABLE;

    // An exclusion is a determination somebody stands behind, so the ground
    // needs a note. "Filled by promotion" with nothing else recorded is the
    // entry an inspection asks the most about.
    if (ground && !String(req.body.exclusionNote || '').trim()) {
      return res.status(422).json({
        message:
          'An exclusion needs a note saying why the ground applies. The section 3 grounds are determinations somebody stands behind, and a bare ground is what an inspection asks about.',
      });
    }

    const determination = await VacancyNotifiability.findOneAndUpdate(
      { tenantId: req.tenantId, requisitionId: req.body.requisitionId },
      {
        $set: {
          establishment: readEstablishment(req.body.establishment),
          title: String(req.body.title || '').trim(),
          category: String(req.body.category || '').trim(),
          openedOn,
          intendedFillDate,
          durationMonths:
            req.body.durationMonths === undefined
              ? null
              : Number(req.body.durationMonths),
          status,
          exclusionGround: ground,
          exclusionNote: String(req.body.exclusionNote || '').trim(),
          determinedOn: new Date(),
          determinedBy: req.userId,
          retrenchedPreferenceInCategory: Boolean(
            req.body.retrenchedPreferenceInCategory,
          ),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CNV_DETERMINATION_RECORDED',
      resourceType: 'VacancyNotifiability',
      resourceIds: [determination._id],
      details: {
        requisitionId: req.body.requisitionId,
        title: determination.title,
        status,
        // The ground is on the line because it is what takes the vacancy out of
        // the Act, and a ground later contradicted by the engagement's length
        // is the record this audit trail exists for.
        exclusionGround: ground,
        intendedFillDate,
      },
      req,
    });

    return res.status(201).json({
      determination,
      noObligationToRecruit: NO_OBLIGATION_TO_RECRUIT,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/vacancy-notification/determinations/:id/outcome
 *
 * Records how the vacancy actually turned out. This is what lets a "less than
 * three months" exclusion be contradicted by a twelve-month engagement, which is
 * the finding the stored ground exists to make possible.
 */
exports.recordOutcome = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid determination id' });
    }

    const update = {};

    if (req.body.filledOn !== undefined) {
      const filledOn = new Date(req.body.filledOn);
      if (Number.isNaN(filledOn.getTime())) {
        return res
          .status(400)
          .json({ message: 'filledOn must be a valid date' });
      }
      update.filledOn = filledOn;
    }

    if (req.body.actualDurationMonths !== undefined) {
      const months = Number(req.body.actualDurationMonths);
      if (!Number.isFinite(months) || months < 0) {
        return res
          .status(400)
          .json({ message: 'actualDurationMonths must be a number' });
      }
      update.actualDurationMonths = months;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Nothing to record' });
    }

    const determination = await VacancyNotifiability.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: update },
      { new: true },
    );

    if (!determination) {
      return res.status(404).json({ message: 'Determination not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CNV_OUTCOME_RECORDED',
      resourceType: 'VacancyNotifiability',
      resourceIds: [determination._id],
      details: {
        title: determination.title,
        filledOn: determination.filledOn,
        actualDurationMonths: determination.actualDurationMonths,
        exclusionGround: determination.exclusionGround,
      },
      req,
    });

    return res.json({ determination });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/vacancy-notification/notifications
 *
 * Records that the exchange was told. The section 5 statement is written onto
 * the record by default and returned with it.
 */
exports.recordNotification = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.requisitionId)) {
      return res.status(400).json({ message: 'Invalid requisition id' });
    }

    const exchange = String(req.body.exchange || '').trim();
    if (!exchange) {
      return res.status(400).json({
        message:
          'The exchange is required. It is notified at state level and the return has to say which one was told.',
      });
    }

    const notifiedOn = new Date(req.body.notifiedOn);
    if (Number.isNaN(notifiedOn.getTime())) {
      return res
        .status(400)
        .json({ message: 'notifiedOn must be a valid date' });
    }

    const notification = await ExchangeNotification.create({
      tenantId: req.tenantId,
      establishment: readEstablishment(req.body.establishment),
      requisitionId: req.body.requisitionId,
      exchange,
      notifiedOn,
      reference: String(req.body.reference || '').trim(),
      vacancyCount: Math.max(1, Number(req.body.vacancyCount) || 1),
      recordedBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CNV_VACANCY_NOTIFIED',
      resourceType: 'ExchangeNotification',
      resourceIds: [notification._id],
      details: {
        requisitionId: req.body.requisitionId,
        exchange,
        notifiedOn,
        vacancyCount: notification.vacancyCount,
      },
      req,
    });

    return res.status(201).json({
      notification,
      note: NO_OBLIGATION_TO_RECRUIT,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/vacancy-notification/returns
 */
exports.listReturns = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const returns = await EmploymentExchangeReturn.find({
      tenantId: req.tenantId,
      establishment,
    })
      .sort({ asOn: -1 })
      .limit(120)
      .lean();

    return res.json({
      establishment,
      returns,
      note: 'ER-I is a return about the establishment’s employment, not about its vacancies. It is owed for a quarter in which no vacancy arose at all.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/vacancy-notification/returns
 */
exports.recordReturn = async (req, res, next) => {
  try {
    const kind = Object.values(RETURN_KIND).includes(req.body.kind)
      ? req.body.kind
      : null;

    if (!kind) {
      return res.status(400).json({ message: 'kind must be ER_I or ER_II' });
    }

    const asOn = new Date(req.body.asOn);
    if (Number.isNaN(asOn.getTime())) {
      return res.status(400).json({ message: 'asOn must be a valid date' });
    }

    // ER-I's reference date is the last day of a quarter. Accepting any date
    // would let a return be filed against a period the Rules do not recognise,
    // and it would then look filed while the real quarter stayed open.
    if (kind === RETURN_KIND.ER_I) {
      const quarterEnd = quarterEndFor(asOn);
      if (quarterEnd.getTime() !== asOn.getTime()) {
        return res.status(422).json({
          message: `ER-I is made up as on the last day of a quarter. The nearest is ${quarterEnd.toISOString().slice(0, 10)}.`,
        });
      }
    }

    const dueOn =
      kind === RETURN_KIND.ER_I
        ? addDays(asOn, CNV_RULES.erOneDueDays)
        : addDays(asOn, CNV_RULES.erTwoDueDays);

    const record = await EmploymentExchangeReturn.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        establishment: readEstablishment(req.body.establishment),
        kind,
        asOn,
      },
      {
        $set: {
          dueOn,
          headcount: Math.max(0, Number(req.body.headcount) || 0),
          vacanciesNotified: Math.max(
            0,
            Number(req.body.vacanciesNotified) || 0,
          ),
          occupational: Array.isArray(req.body.occupational)
            ? req.body.occupational
            : [],
          filedOn: req.body.filedOn ? new Date(req.body.filedOn) : undefined,
          acknowledgement: String(req.body.acknowledgement || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CNV_RETURN_FILED',
      resourceType: 'EmploymentExchangeReturn',
      resourceIds: [record._id],
      details: {
        kind,
        asOn,
        dueOn,
        filedOn: record.filedOn,
        headcount: record.headcount,
      },
      req,
    });

    return res.status(201).json({ return: record });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/vacancy-notification/position
 */
exports.getPosition = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);
    const period = resolvePeriod(req.query);

    if (
      Number.isNaN(period.from.getTime()) ||
      Number.isNaN(period.to.getTime())
    ) {
      return res
        .status(400)
        .json({ message: 'from and to must be valid dates' });
    }

    const result = await computePosition({
      tenantId: req.tenantId,
      establishment,
      period,
      asAt: new Date(),
    });

    return res.json({
      establishment,
      period,
      result,
      note: NO_OBLIGATION_TO_RECRUIT,
    });
  } catch (error) {
    return next(error);
  }
};
