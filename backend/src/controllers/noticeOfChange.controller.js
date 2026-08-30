/**
 * @fileoverview Industrial Disputes Act section 9A — notice of change (#1973).
 *
 * Four decisions carry this controller.
 *
 * **It observes and never blocks.** Nothing here refuses a salary revision, a
 * roster change or a benefits change. Section 9A creates a notice obligation
 * with a section 31 penal consequence; it does not make the change void, and a
 * controller that returned 409 on a short notice would be asserting a remedy the
 * Act does not give. Every response is a position, not a permission.
 *
 * **It freezes the determination onto the notice.** `determinePopulation` writes
 * the capacity and the wages as they were when it ran, because a supervisor on
 * ₹9,800 is a workman and the same supervisor after a raise is not. Recomputing
 * from today's employee records would move people in and out of a population a
 * notice was already served on.
 *
 * **It moves the effective date rather than editing it.** `moveEffectiveDate`
 * appends to `effectiveDateHistory`, because the reason an effective date moves
 * is almost always that the notice came up short — and the original date is the
 * evidence of what the shortfall was.
 *
 * **It reports section 33 as its own answer.** Where a proceeding is pending,
 * `getPosition` and the queue return SECTION_33_PERMISSION_REQUIRED with no
 * notice window attached at all. A screen showing "21 days" against a pending
 * adjudication tells the employer to commit an offence on a date certain.
 *
 * Everything that decides an item, a window or a determination is in
 * `utils/noticeOfChange.js`.
 */

const mongoose = require('mongoose');

const {
  ProposedChange,
  WorkmanDetermination,
  ChangeNotice,
} = require('../models/noticeOfChange.model');
const Employee = require('../models/employee.model');
const {
  FOURTH_SCHEDULE,
  CHANGE_VERDICT,
  EXEMPTION_GROUND,
  WORKMAN_GROUND,
  DEFAULT_RULES,
  FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
  UNCLASSIFIED_IS_A_QUESTION,
  PENDING_PROCEEDING_IS_SECTION_33,
  NOTICE_DOES_NOT_INVALIDATE,
  determineWorkman,
  assessChange,
  orderQueue,
  formEFields,
} = require('../utils/noticeOfChange');
const eventBus = require('../services/event.service');

/**
 * @param {*} value
 * @returns {Date|null}
 */
function readDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The stored determinations for a change, shaped for the engine.
 *
 * Reads the frozen rows rather than the employee records. Where a change has no
 * determinations yet the caller gets an empty population and a verdict computed
 * without one — which is correct: the obligation is not known until somebody has
 * asked who it attaches to.
 *
 * @param {Array<object>} rows
 * @returns {Array<object>}
 */
function shapeDeterminations(rows) {
  return rows.map((row) => ({
    employeeId: row.employeeId,
    name: row.name || null,
    capacity: row.capacity,
    monthlyWages: row.monthlyWages,
  }));
}

/**
 * The engine's view of a stored change.
 *
 * @param {object} change
 * @returns {object}
 */
function shapeChange(change) {
  return {
    changeId: change._id,
    description: change.description,
    effectedBy: change.effectedBy,
    scheduleItem: change.scheduleItem,
    inAccordanceWithStandingOrders: change.inAccordanceWithStandingOrders,
    casualFluctuation: change.casualFluctuation,
    effectiveOn: change.effectiveOn,
    noticedOn: change.noticedOn || null,
    proceeding: change.proceeding,
    exemption: change.exemption,
  };
}

/**
 * The date of the notice that covers a change's current effective date.
 *
 * A change can be noticed more than once — an effective date moved after a short
 * notice needs a fresh one — so the relevant notice is the latest served against
 * an effective date that is not earlier than the one now proposed. A notice
 * served against an earlier date does not cover a date pushed back later, which
 * is the case a `noticedOn` field on the change itself would get wrong.
 *
 * @param {Array<object>} notices
 * @param {Date} effectiveOn
 * @returns {Date|null}
 */
function noticeCovering(notices, effectiveOn) {
  const target = effectiveOn ? new Date(effectiveOn).getTime() : null;
  if (!target) return null;

  const covering = notices
    .filter(
      (notice) => new Date(notice.effectiveDateNoticed).getTime() <= target,
    )
    .sort((a, b) => new Date(a.servedOn) - new Date(b.servedOn));

  return covering.length > 0 ? covering[0].servedOn : null;
}

/**
 * GET /api/notice-of-change/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      rules: DEFAULT_RULES,
      fourthSchedule: FOURTH_SCHEDULE,
      verdicts: CHANGE_VERDICT,
      exemptionGrounds: EXEMPTION_GROUND,
      workmanGrounds: WORKMAN_GROUND,
      notes: {
        favourableChangeStillNeedsNotice: FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
        unclassifiedIsAQuestion: UNCLASSIFIED_IS_A_QUESTION,
        pendingProceedingIsSection33: PENDING_PROCEEDING_IS_SECTION_33,
        noticeDoesNotInvalidate: NOTICE_DOES_NOT_INVALIDATE,
      },
      note: 'The Act is central. The appropriate government differs by industry and the prescribed manner of the notice is rule-made, so the twenty-one days and the section 2(s) wage threshold are defaults here and overridable per establishment.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/notice-of-change/changes
 *
 * Records a change another module is about to make. `effectiveOn` is required
 * because the twenty-one days run backwards from it — a change with no proposed
 * effective date has no window at all, and defaulting one to today would report
 * every change as already in default.
 */
exports.recordChange = async (req, res, next) => {
  try {
    const establishment = String(req.body.establishment || '').trim();
    if (!establishment) {
      return res.status(400).json({ message: 'establishment is required' });
    }

    const description = String(req.body.description || '').trim();
    if (!description) {
      return res.status(400).json({
        message:
          'description is required. It is the "nature of the change" a Form E has to state, and a notice that does not state it is not a notice.',
      });
    }

    const effectedBy = String(req.body.effectedBy || '').trim();
    if (!effectedBy) {
      return res.status(400).json({
        message:
          'effectedBy is required — the module actually making the change. This module observes and owns nothing, so without it there is no way back to the record that changed.',
      });
    }

    const effectiveOn = readDate(req.body.effectiveOn);
    if (!effectiveOn) {
      return res.status(400).json({
        message:
          'effectiveOn must be a valid date. The twenty-one days run backwards from the proposed effective date, so a change without one has no window to compute.',
      });
    }

    const scheduleItem = req.body.scheduleItem
      ? String(req.body.scheduleItem).trim().toUpperCase()
      : null;
    if (scheduleItem && !FOURTH_SCHEDULE[scheduleItem]) {
      return res.status(400).json({
        message: `${scheduleItem} is not a Fourth Schedule item. Leave it unset rather than choosing the nearest one — an unclassified change is reported as undetermined, which is a question, and a wrong item is an answer.`,
        items: Object.keys(FOURTH_SCHEDULE),
      });
    }

    const change = await ProposedChange.create({
      tenantId: req.tenantId,
      establishment,
      description,
      effectedBy,
      sourceRef: String(req.body.sourceRef || '').trim(),
      scheduleItem,
      inAccordanceWithStandingOrders: Boolean(
        req.body.inAccordanceWithStandingOrders,
      ),
      casualFluctuation: Boolean(req.body.casualFluctuation),
      direction: req.body.direction || 'NEUTRAL',
      effectiveOn,
      recordedBy: req.userId,
    });

    const assessment = assessChange(shapeChange(change), [], {
      asOf: new Date(),
    });
    change.lastKnownVerdict = assessment.verdict;
    await change.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SECTION_9A_CHANGE_RECORDED',
      resourceType: 'ProposedChange',
      resourceIds: [change._id],
      details: {
        establishment,
        effectedBy,
        // The item is named because it is the finding, and because a change
        // recorded with none is the case most likely to be a real obligation.
        scheduleItem: scheduleItem || null,
        effectiveOn,
        // Recorded and never acted on. It is here so that an audit trail shows
        // a favourable change sitting in the notice queue, which is the fact
        // users disbelieve.
        direction: change.direction,
        verdict: assessment.verdict,
      },
      req,
    });

    return res.status(201).json({
      change,
      assessment,
      note: scheduleItem ? null : UNCLASSIFIED_IS_A_QUESTION,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notice-of-change/changes/:id/classification
 *
 * Records or corrects the Fourth Schedule item. Separate from `recordChange`
 * because the module that makes a change usually cannot classify it — the
 * classification is a legal question answered by a person, and the change is
 * recorded before that person has looked at it.
 */
exports.classify = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid change id' });
    }

    const scheduleItem = req.body.scheduleItem
      ? String(req.body.scheduleItem).trim().toUpperCase()
      : null;
    if (scheduleItem && !FOURTH_SCHEDULE[scheduleItem]) {
      return res.status(400).json({
        message: `${scheduleItem} is not a Fourth Schedule item.`,
        items: Object.keys(FOURTH_SCHEDULE),
      });
    }

    const change = await ProposedChange.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }

    const previous = change.scheduleItem;
    change.scheduleItem = scheduleItem;
    if (req.body.inAccordanceWithStandingOrders !== undefined) {
      change.inAccordanceWithStandingOrders = Boolean(
        req.body.inAccordanceWithStandingOrders,
      );
    }
    if (req.body.casualFluctuation !== undefined) {
      change.casualFluctuation = Boolean(req.body.casualFluctuation);
    }
    await change.save();

    const determinations = await WorkmanDetermination.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();
    const notices = await ChangeNotice.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();

    const assessment = assessChange(
      {
        ...shapeChange(change),
        noticedOn: noticeCovering(notices, change.effectiveOn),
      },
      shapeDeterminations(determinations),
      { asOf: new Date() },
    );
    change.lastKnownVerdict = assessment.verdict;
    await change.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SECTION_9A_CHANGE_CLASSIFIED',
      resourceType: 'ProposedChange',
      resourceIds: [change._id],
      details: {
        establishment: change.establishment,
        // Both, because a reclassification from an item to null is how an
        // obligation gets cleared without being discharged, and the previous
        // value is the only thing that shows it happened.
        from: previous || null,
        to: scheduleItem || null,
        inAccordanceWithStandingOrders: change.inAccordanceWithStandingOrders,
        casualFluctuation: change.casualFluctuation,
        verdict: assessment.verdict,
      },
      req,
    });

    return res.json({ change, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/notice-of-change/changes/:id/population
 *
 * Determines, per person, who the change obliges notice to. Writes the capacity
 * and the wages onto each row — see the model header on why the determination is
 * frozen rather than referenced.
 */
exports.determinePopulation = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid change id' });
    }

    const change = await ProposedChange.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }

    const employeeIds = Array.isArray(req.body.employeeIds)
      ? req.body.employeeIds.filter((id) => mongoose.isValidObjectId(id))
      : [];
    if (employeeIds.length === 0) {
      return res.status(400).json({
        message:
          'employeeIds is required. The determination is per person — an establishment-wide change touches managers and workmen alike and obliges notice only to the second — so there is no headcount this endpoint can take instead.',
      });
    }

    const employees = await Employee.find({
      _id: { $in: employeeIds },
      tenantId: req.tenantId,
    })
      .select('_id name capacity employmentCapacity monthlyWages salary')
      .lean();

    const rulesOverride = req.body.rules || undefined;
    const rows = [];

    for (const employee of employees) {
      const capacity = String(
        employee.capacity || employee.employmentCapacity || 'OPERATIONAL',
      ).toUpperCase();
      const monthlyWages = Number(
        employee.monthlyWages ?? employee.salary ?? 0,
      );
      const determination = determineWorkman(
        { capacity, monthlyWages },
        rulesOverride,
      );

      const row = await WorkmanDetermination.findOneAndUpdate(
        {
          tenantId: req.tenantId,
          changeId: change._id,
          employeeId: employee._id,
        },
        {
          $set: {
            capacity,
            monthlyWages,
            isWorkman: determination.isWorkman,
            ground: determination.ground,
            reason: determination.reason,
            determinedOn: new Date(),
            determinedBy: req.userId,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      rows.push({ ...row.toObject(), name: employee.name });
    }

    const notices = await ChangeNotice.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();

    const assessment = assessChange(
      {
        ...shapeChange(change),
        noticedOn: noticeCovering(notices, change.effectiveOn),
      },
      shapeDeterminations(rows),
      { asOf: new Date(), rules: rulesOverride },
    );
    change.lastKnownVerdict = assessment.verdict;
    await change.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SECTION_9A_POPULATION_DETERMINED',
      resourceType: 'ProposedChange',
      resourceIds: [change._id],
      details: {
        establishment: change.establishment,
        // Both numbers, because the gap between them is the finding. A change
        // that touched forty people and obliged notice to six is a different
        // record from one that obliged notice to all forty, and a single count
        // cannot say which happened.
        affected: assessment.population.affected,
        obliged: assessment.population.obliged,
        verdict: assessment.verdict,
      },
      req,
    });

    return res.json({
      determinations: rows,
      population: assessment.population,
      assessment,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/notice-of-change/changes/:id/notices
 *
 * Records a notice as **served**, not as drafted or approved. The twenty-one
 * days run from service, and the gap between a notice dated the 1st and served
 * on the 9th is eight days the employer does not have.
 */
exports.serveNotice = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid change id' });
    }

    const servedOn = readDate(req.body.servedOn);
    if (!servedOn) {
      return res.status(400).json({
        message:
          'servedOn must be a valid date, and it is the date of service on the workmen — not the date the notice was drafted, dated or approved.',
      });
    }

    const change = await ProposedChange.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }

    const determinations = await WorkmanDetermination.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();

    const preliminary = assessChange(
      shapeChange(change),
      shapeDeterminations(determinations),
      { asOf: new Date() },
    );

    const fields = formEFields(preliminary);
    if (!fields.ready) {
      return res.status(400).json({
        message:
          'The notice cannot be recorded because it would state less than a Form E has to. Generating one anyway would let a default be papered over with a document.',
        missing: fields.missing,
      });
    }

    const notice = await ChangeNotice.create({
      tenantId: req.tenantId,
      changeId: change._id,
      form: String(req.body.form || DEFAULT_RULES.noticeForm).trim(),
      servedOn,
      effectiveDateNoticed: change.effectiveOn,
      scheduleItems: preliminary.scheduleItems.map((item) => item.item),
      workmenServed: Number(
        req.body.workmenServed ?? preliminary.population.obliged,
      ),
      manner: req.body.manner || 'NOTICE_BOARD',
      documentRef: String(req.body.documentRef || '').trim(),
      servedBy: req.userId,
    });

    const notices = await ChangeNotice.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();

    const assessment = assessChange(
      {
        ...shapeChange(change),
        noticedOn: noticeCovering(notices, change.effectiveOn),
      },
      shapeDeterminations(determinations),
      { asOf: new Date() },
    );
    change.lastKnownVerdict = assessment.verdict;
    await change.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SECTION_9A_NOTICE_SERVED',
      resourceType: 'ChangeNotice',
      resourceIds: [notice._id],
      details: {
        establishment: change.establishment,
        servedOn,
        // Both dates, because the whole finding is the distance between them,
        // and a notice that came up short is the reason an effective date is
        // about to move.
        effectiveDateNoticed: change.effectiveOn,
        daysGiven: assessment.window ? assessment.window.daysGiven : null,
        workmenServed: notice.workmenServed,
        verdict: assessment.verdict,
      },
      req,
    });

    return res.status(201).json({ notice, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notice-of-change/changes/:id/effective-date
 *
 * Moves the proposed effective date. Appends to the history rather than
 * overwriting, because the reason a date moves is almost always that the notice
 * came up short and the original date is the evidence of by how much.
 */
exports.moveEffectiveDate = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid change id' });
    }

    const to = readDate(req.body.effectiveOn);
    if (!to) {
      return res
        .status(400)
        .json({ message: 'effectiveOn must be a valid date' });
    }

    const change = await ProposedChange.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }

    const from = change.effectiveOn;
    change.effectiveDateHistory.push({
      from,
      to,
      movedOn: new Date(),
      reason: String(req.body.reason || '').trim(),
    });
    change.effectiveOn = to;
    await change.save();

    const determinations = await WorkmanDetermination.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();
    const notices = await ChangeNotice.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();

    const assessment = assessChange(
      {
        ...shapeChange(change),
        noticedOn: noticeCovering(notices, to),
      },
      shapeDeterminations(determinations),
      { asOf: new Date() },
    );
    change.lastKnownVerdict = assessment.verdict;
    await change.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SECTION_9A_EFFECTIVE_DATE_MOVED',
      resourceType: 'ProposedChange',
      resourceIds: [change._id],
      details: {
        establishment: change.establishment,
        from,
        to,
        reason: change.effectiveDateHistory.slice(-1)[0].reason,
        verdict: assessment.verdict,
      },
      req,
    });

    return res.json({ change, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notice-of-change/changes/:id/proceeding
 *
 * Records a pending conciliation or adjudication, or the express permission
 * obtained under section 33. Its own endpoint and its own permission: this is
 * the field that decides whether the obligation is a notice period at all.
 */
exports.recordProceeding = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid change id' });
    }

    const change = await ProposedChange.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }

    change.proceeding = {
      pending: Boolean(req.body.pending),
      forum: String(req.body.forum || '').trim(),
      reference: String(req.body.reference || '').trim(),
      expressPermissionReference: String(
        req.body.expressPermissionReference || '',
      ).trim(),
    };
    await change.save();

    const determinations = await WorkmanDetermination.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();
    const notices = await ChangeNotice.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();

    const assessment = assessChange(
      {
        ...shapeChange(change),
        noticedOn: noticeCovering(notices, change.effectiveOn),
      },
      shapeDeterminations(determinations),
      { asOf: new Date() },
    );
    change.lastKnownVerdict = assessment.verdict;
    await change.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SECTION_9A_PROCEEDING_RECORDED',
      resourceType: 'ProposedChange',
      resourceIds: [change._id],
      details: {
        establishment: change.establishment,
        pending: change.proceeding.pending,
        forum: change.proceeding.forum,
        // Audited because clearing this string is how a section 33 requirement
        // is made to look like a twenty-one-day wait, and because "permission
        // granted" with nothing to point at is the state this module exists to
        // stop being recorded.
        expressPermissionReference:
          change.proceeding.expressPermissionReference || null,
        verdict: assessment.verdict,
      },
      req,
    });

    return res.json({
      change,
      assessment,
      note: change.proceeding.pending ? PENDING_PROCEEDING_IS_SECTION_33 : null,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notice-of-change/changes/:id/exemption
 *
 * Records a section 9B notification, a settlement or award, or government
 * service rules — with the authority relied on. An exemption with no authority
 * is refused rather than stored, because "we thought it was covered by the
 * settlement" is the position section 9A defaults are argued from.
 */
exports.recordExemption = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid change id' });
    }

    const ground = req.body.ground
      ? String(req.body.ground).trim().toUpperCase()
      : null;
    if (ground && !EXEMPTION_GROUND[ground]) {
      return res.status(400).json({
        message: `${ground} is not a ground on which section 9A yields. It yields to a section 9B notification, to a change effected in pursuance of a settlement or award, and to workmen governed by government service rules — and to nothing else.`,
        grounds: Object.values(EXEMPTION_GROUND),
      });
    }

    const authority = String(req.body.authority || '').trim();
    if (ground && !authority) {
      return res.status(400).json({
        message:
          'authority is required with a ground. An exemption is a document — a notification number, a settlement reference, the rules relied on — and one recorded without it is a belief.',
      });
    }

    const change = await ProposedChange.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }

    change.exemption = {
      ground,
      authority,
      expiresOn: readDate(req.body.expiresOn),
    };
    await change.save();

    const determinations = await WorkmanDetermination.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();
    const notices = await ChangeNotice.find({
      tenantId: req.tenantId,
      changeId: change._id,
    }).lean();

    const assessment = assessChange(
      {
        ...shapeChange(change),
        noticedOn: noticeCovering(notices, change.effectiveOn),
      },
      shapeDeterminations(determinations),
      { asOf: new Date() },
    );
    change.lastKnownVerdict = assessment.verdict;
    await change.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SECTION_9A_EXEMPTION_RECORDED',
      resourceType: 'ProposedChange',
      resourceIds: [change._id],
      details: {
        establishment: change.establishment,
        ground,
        // The authority is audited rather than just the ground, because the
        // ground alone is the claim and the authority is the thing that can be
        // checked against a register.
        authority: authority || null,
        expiresOn: change.exemption.expiresOn,
        verdict: assessment.verdict,
      },
      req,
    });

    return res.json({ change, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/notice-of-change/queue
 *
 * The queue, ordered by how soon something has to happen. Defaults first — a
 * change effected without notice is a section 31 offence already committed —
 * then section 33, then short notice, then the ones still inside their window.
 * Undetermined changes are last but never dropped: an unclassified change is a
 * question, and this is where it gets asked.
 */
exports.getQueue = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.establishment) {
      filter.establishment = String(req.query.establishment).trim();
    }

    const changes = await ProposedChange.find(filter).lean();
    const changeIds = changes.map((change) => change._id);

    const [determinations, notices] = await Promise.all([
      WorkmanDetermination.find({
        tenantId: req.tenantId,
        changeId: { $in: changeIds },
      }).lean(),
      ChangeNotice.find({
        tenantId: req.tenantId,
        changeId: { $in: changeIds },
      }).lean(),
    ]);

    const byChange = new Map();
    for (const row of determinations) {
      const key = String(row.changeId);
      if (!byChange.has(key)) byChange.set(key, []);
      byChange.get(key).push(row);
    }

    const noticesByChange = new Map();
    for (const notice of notices) {
      const key = String(notice.changeId);
      if (!noticesByChange.has(key)) noticesByChange.set(key, []);
      noticesByChange.get(key).push(notice);
    }

    const asOf = readDate(req.query.asOf) || new Date();

    const assessments = changes.map((change) => {
      const key = String(change._id);
      return assessChange(
        {
          ...shapeChange(change),
          noticedOn: noticeCovering(
            noticesByChange.get(key) || [],
            change.effectiveOn,
          ),
        },
        shapeDeterminations(byChange.get(key) || []),
        { asOf },
      );
    });

    const ordered = orderQueue(assessments);

    return res.json({
      asOf,
      queue: ordered,
      counts: ordered.reduce((acc, row) => {
        acc[row.verdict] = (acc[row.verdict] || 0) + 1;
        return acc;
      }, {}),
      notes: {
        favourableChangeStillNeedsNotice: FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
        pendingProceedingIsSection33: PENDING_PROCEEDING_IS_SECTION_33,
        noticeDoesNotInvalidate: NOTICE_DOES_NOT_INVALIDATE,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/notice-of-change/changes/:id
 */
exports.getPosition = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid change id' });
    }

    const change = await ProposedChange.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }

    const [determinations, notices] = await Promise.all([
      WorkmanDetermination.find({
        tenantId: req.tenantId,
        changeId: change._id,
      }).lean(),
      ChangeNotice.find({ tenantId: req.tenantId, changeId: change._id })
        .sort({ servedOn: -1 })
        .lean(),
    ]);

    const assessment = assessChange(
      {
        ...shapeChange(change),
        noticedOn: noticeCovering(notices, change.effectiveOn),
      },
      shapeDeterminations(determinations),
      { asOf: readDate(req.query.asOf) || new Date() },
    );

    return res.json({
      change,
      determinations,
      notices,
      assessment,
      formE: formEFields(assessment),
    });
  } catch (error) {
    return next(error);
  }
};
