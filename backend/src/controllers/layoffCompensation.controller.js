/**
 * @fileoverview Industrial Disputes Act, 1947, Chapters VA and VB (#1830).
 *
 * Three decisions carry this controller.
 *
 * **The rolling ceiling is computed from the other spells, not from this one.**
 * `compensatedDaysInWindow` is the whole reason section 25C cannot be answered
 * from a single lay-off: forty-five days in *any* period of twelve months means
 * a spell in March consumes ceiling a spell in November needs. So
 * `consumedCeilingDays` walks the employee's other spells inside the window
 * before the engine is called, and the number it produces is the one thing here
 * that a per-spell view could never see.
 *
 * **Section 25B service is recorded, not derived.** There is an attendance
 * ledger in this product and it cannot answer this. A day of lay-off counts
 * toward the service that qualifies for lay-off compensation; a day of legal
 * strike counts; maternity leave counts only to twelve weeks. All three read as
 * absence to a present/absent ledger, and the first two would disqualify
 * exactly the workmen the chapter protects. `suggestServiceDays` will offer a
 * worked-days figure from attendance, marked `suggested`, and the rest has to
 * be stated.
 *
 * **The two liabilities never merge.** Where permission was required and absent
 * the workmen are deemed not to have been laid off and are owed full wages as
 * if they had continued — not compensation. The response carries both figures
 * under separate keys with `applicableLiability` saying which one this act
 * landed on, and no endpoint anywhere returns their sum.
 *
 * Everything that decides a day, a rate or a lawfulness is in
 * `utils/layoffCompensation.js`.
 */

const mongoose = require('mongoose');

const {
  LayoffRules,
  LayoffSpell,
  ChapterVBAction,
  SeniorityRecord,
  ReemploymentCandidate,
  LayoffAssessment,
} = require('../models/layoffCompensation.model');
const Employee = require('../models/employee.model');
const Attendance = require('../models/attendance.model');
const {
  LAYOFF_RULES,
  SERVICE_DAY,
  DISENTITLEMENT,
  ACTION,
  PERMISSION_STATE,
  NOT_UNAVOIDABLE,
  assessEstablishment,
  seniorityList,
  reemploymentPreference,
  closureCompensation,
} = require('../utils/layoffCompensation');
const eventBus = require('../services/event.service');

/**
 * The rules for an establishment.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId, establishment) {
  const stored = await LayoffRules.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  return stored ? { ...LAYOFF_RULES, ...stored } : { ...LAYOFF_RULES };
}

/**
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
 * Days already compensated for this employee inside the rolling window.
 *
 * The number a per-spell view cannot produce. Section 25C's ceiling is forty-five
 * days in *any* period of twelve months, so a spell in March consumes the
 * ceiling a spell in November needs — and the window is measured backwards from
 * the spell being assessed rather than from a financial year boundary.
 *
 * @param {Array<object>} spells every spell for the employee
 * @param {object} spell the one being assessed
 * @param {number} windowMonths
 * @returns {number}
 */
function consumedCeilingDays(spells, spell, windowMonths) {
  const from = spell.fromDate ? new Date(spell.fromDate) : new Date();
  const windowStart = new Date(from);
  windowStart.setUTCMonth(windowStart.getUTCMonth() - windowMonths);

  return spells
    .filter((other) => String(other._id) !== String(spell._id))
    .filter((other) => {
      const at = other.fromDate ? new Date(other.fromDate) : null;
      return at && at >= windowStart && at < from;
    })
    .reduce((sum, other) => {
      const laidOff = Math.max(0, other.laidOffDays || 0);
      const holidays = Math.max(0, other.weeklyHolidays || 0);
      const disentitled = (other.disentitledDays || []).reduce(
        (total, row) => total + (row.days || 0),
        0,
      );

      // Only the days that actually drew compensation consume the ceiling. A
      // disentitled day was never paid and does not use it up.
      return sum + Math.max(0, laidOff - holidays - disentitled);
    }, 0);
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

  const spells = await LayoffSpell.find({
    tenantId,
    establishment: establishment || '',
    fromDate: { $lte: period.periodEnd },
    $or: [{ toDate: null }, { toDate: { $gte: period.periodStart } }],
  }).lean();

  // The ceiling window reaches back before the period, so the spells used to
  // compute it are fetched separately and are not themselves assessed.
  const windowStart = new Date(period.periodStart);
  windowStart.setUTCMonth(
    windowStart.getUTCMonth() - rules.ceilingWindowMonths,
  );

  const historic = await LayoffSpell.find({
    tenantId,
    establishment: establishment || '',
    employeeId: { $in: spells.map((spell) => spell.employeeId) },
    fromDate: { $gte: windowStart, $lte: period.periodEnd },
  }).lean();

  const byEmployee = new Map();
  for (const spell of historic) {
    const key = String(spell.employeeId);
    if (!byEmployee.has(key)) byEmployee.set(key, []);
    byEmployee.get(key).push(spell);
  }

  const action = mongoose.isValidObjectId(query?.actionId)
    ? await ChapterVBAction.findOne({
        _id: query.actionId,
        tenantId,
      }).lean()
    : await ChapterVBAction.findOne({
        tenantId,
        establishment: establishment || '',
      })
        .sort({ proposedOn: -1 })
        .lean();

  const workmen = await Employee.countDocuments(
    establishment ? { tenantId, department: establishment } : { tenantId },
  );

  const result = assessEstablishment({
    spells: spells.map((spell) => ({
      workmanId: spell._id,
      name: spell.name,
      category: spell.category,
      belowGroundInMine: spell.belowGroundInMine,
      laidOffDays: spell.laidOffDays,
      weeklyHolidays: spell.weeklyHolidays,
      disentitledDays: spell.disentitledDays,
      serviceDays: spell.serviceDays,
      compensatedDaysInWindow: consumedCeilingDays(
        byEmployee.get(String(spell.employeeId)) || [],
        spell,
        rules.ceilingWindowMonths,
      ),
      wages: {
        basic: spell.frozenWages?.basic,
        dearnessAllowance: spell.frozenWages?.dearnessAllowance,
      },
      benefitsPerDay: spell.frozenWages?.benefitsPerDay,
    })),
    chapterVB: {
      // The headcount as at the act where one was recorded, and today's
      // otherwise. The recorded figure is what the threshold was tested
      // against, and it should not move because somebody resigned since.
      workmen: action?.workmen || workmen,
      action: action?.action || ACTION.LAYOFF,
      permission: action?.permission,
      noticeMonths: action?.noticeMonths,
    },
    rules,
  });

  return { period, establishment, rules, action: action || null, result };
}

/**
 * A worked-days figure from attendance, as a *suggestion*.
 *
 * Deliberately not written. Section 25B counts lay-off days, legal-strike days
 * and maternity leave to twelve weeks as service, and all three read as absence
 * here — so a figure taken from this ledger is a floor rather than an answer,
 * and using it would disqualify exactly the workmen the chapter protects.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {mongoose.Types.ObjectId} employeeId
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<object>}
 */
async function suggestServiceDays(tenantId, employeeId, from, to) {
  const present = await Attendance.countDocuments({
    tenantId,
    employeeId,
    date: { $gte: from, $lte: to },
    status: { $in: ['Present', 'present', 'PRESENT'] },
  });

  return {
    kind: SERVICE_DAY.WORKED,
    days: present,
    suggested: true,
    note: 'Days marked present in the attendance ledger. Section 25B also counts lay-off days, legal-strike days and maternity leave to twelve weeks as service, and all three appear here as absence — so this is a floor rather than the answer.',
  };
}

/**
 * GET /api/layoffs/rules
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
 * PUT /api/layoffs/rules
 */
exports.updateRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const update = {};
    const numeric = [
      'continuousServiceDays',
      'mineContinuousServiceDays',
      'lookbackMonths',
      'layoffPercent',
      'layoffCeilingDays',
      'ceilingWindowMonths',
      'chapterVBThreshold',
      'chapterVBNoticeMonths',
      'retrenchmentDaysPerYear',
      'closureCapMonths',
      'maternityLeaveWeeksCounted',
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

    const before = await LayoffRules.findOne({
      establishment
    }).lean();

    const rules = await LayoffRules.findOneAndUpdate(
      {
        establishment
      },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LAYOFF_RULES_UPDATED',
      resourceType: 'LayoffRules',
      resourceIds: [rules._id],
      details: {
        establishment: establishment || '(default)',
        // Called out by name in the audit line: raising this threshold turns an
        // illegal act into a compensable one on paper.
        chapterVBThresholdFrom:
          before?.chapterVBThreshold ?? LAYOFF_RULES.chapterVBThreshold,
        chapterVBThresholdTo: rules.chapterVBThreshold,
        layoffCeilingDays: rules.layoffCeilingDays,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/layoffs/spells
 */
exports.listSpells = async (req, res, next) => {
  try {
    const filter = {};

    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }
    if (mongoose.isValidObjectId(req.query.employeeId)) {
      filter.employeeId = req.query.employeeId;
    }

    const spells = await LayoffSpell.find(filter)
      .sort({ fromDate: -1 })
      .limit(500)
      .lean();

    return res.json({ spells });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/layoffs/spells
 *
 * Audited. A lay-off stops somebody's work at half pay against a ceiling they
 * cannot see, and the days recorded here consume the ceiling for every later
 * spell in the rolling year.
 */
exports.createSpell = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res
        .status(400)
        .json({ message: 'A valid employeeId is required' });
    }

    const employee = await Employee.findOne({
      _id: req.body.employeeId
    }).lean();

    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    const fromDate = req.body.fromDate
      ? new Date(req.body.fromDate)
      : new Date();

    const basic = Number(
      req.body.basic ?? employee?.salary?.basic ?? employee?.salary ?? 0,
    );
    const dearnessAllowance = Number(
      req.body.dearnessAllowance ?? employee?.salary?.da ?? 0,
    );

    const spell = await LayoffSpell.create({
      establishment:
        typeof req.body.establishment === 'string'
          ? req.body.establishment.trim()
          : employee.department || '',

      employeeId: employee._id,
      name: employee.name || '',

      category:
        typeof req.body.category === 'string'
          ? req.body.category.trim()
          : employee.designation || '',

      belowGroundInMine: req.body.belowGroundInMine === true,
      fromDate,
      toDate: req.body.toDate ? new Date(req.body.toDate) : undefined,
      laidOffDays: Math.max(0, Number(req.body.laidOffDays) || 0),
      weeklyHolidays: Math.max(0, Number(req.body.weeklyHolidays) || 0),
      disentitledDays: sanitiseDisentitlements(req.body.disentitledDays),
      serviceDays: sanitiseServiceDays(req.body.serviceDays),

      frozenWages: {
        basic: Number.isFinite(basic) ? Math.max(0, basic) : 0,
        dearnessAllowance: Number.isFinite(dearnessAllowance)
          ? Math.max(0, dearnessAllowance)
          : 0,
        benefitsPerDay: Math.max(0, Number(req.body.benefitsPerDay) || 0),
        frozenOn: fromDate,
      },

      chapterVBActionId: mongoose.isValidObjectId(req.body.chapterVBActionId)
        ? req.body.chapterVBActionId
        : undefined,

      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LAYOFF_SPELL_RECORDED',
      resourceType: 'LayoffSpell',
      resourceIds: [spell._id],
      details: {
        name: spell.name,
        fromDate: spell.fromDate,
        laidOffDays: spell.laidOffDays,
        category: spell.category,
      },
      req,
    });

    return res.status(201).json({ spell });
  } catch (error) {
    return next(error);
  }
};

/**
 * Only the section 25E reasons.
 *
 * An unrecognised reason would sit in the array and never reduce anything,
 * which reads as a silent no-op — the establishment would believe it had
 * disentitled days it is still paying for.
 *
 * @param {*} raw
 * @returns {Array<object>}
 */
function sanitiseDisentitlements(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry) => Object.hasOwn(DISENTITLEMENT, entry?.reason))
    .map((entry) => ({
      reason: entry.reason,
      days: Math.max(0, Math.floor(Number(entry.days) || 0)),
      note: typeof entry.note === 'string' ? entry.note.trim() : '',
    }));
}

/**
 * Only the section 25B day kinds.
 *
 * @param {*} raw
 * @returns {Array<object>}
 */
function sanitiseServiceDays(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry) => Object.hasOwn(SERVICE_DAY, entry?.kind))
    .map((entry) => ({
      kind: entry.kind,
      days: Math.max(0, Math.floor(Number(entry.days) || 0)),
    }));
}

/**
 * GET /api/layoffs/spells/:id/service-suggestion
 */
exports.getServiceSuggestion = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid spell id' });
    }

    const spell = await LayoffSpell.findOne({
      _id: req.params.id
    }).lean();

    if (!spell) return res.status(404).json({ message: 'Spell not found' });

    const rules = await resolveRules(req.tenantId, spell.establishment);

    const to = spell.fromDate ? new Date(spell.fromDate) : new Date();
    const from = new Date(to);
    from.setUTCMonth(from.getUTCMonth() - rules.lookbackMonths);

    return res.json({
      lookback: { from, to },
      suggestion: await suggestServiceDays(
        req.tenantId,
        spell.employeeId,
        from,
        to,
      ),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/layoffs/actions
 */
exports.listActions = async (req, res, next) => {
  try {
    const actions = await ChapterVBAction.find({})
      .sort({ proposedOn: -1 })
      .limit(100)
      .lean();

    return res.json({ actions });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/layoffs/actions
 *
 * Records a Chapter VB act and where its permission stands.
 *
 * Audited, because this record decides which of two liabilities the
 * establishment is under — compensation, or full wages as if the workmen had
 * continued — and those differ by several times.
 */
exports.recordAction = async (req, res, next) => {
  try {
    const { action } = req.body;

    if (!Object.prototype.hasOwnProperty.call(ACTION, action)) {
      return res.status(400).json({
        message: `action must be one of ${Object.keys(ACTION).join(', ')}`,
      });
    }

    const permission = Object.prototype.hasOwnProperty.call(
      PERMISSION_STATE,
      req.body.permission,
    )
      ? req.body.permission
      : PERMISSION_STATE.NOT_SOUGHT;

    const record = await ChapterVBAction.create({
      establishment:
        typeof req.body.establishment === 'string'
          ? req.body.establishment.trim()
          : '',

      action,
      workmen: Math.max(0, Number(req.body.workmen) || 0),

      proposedOn: req.body.proposedOn
        ? new Date(req.body.proposedOn)
        : new Date(),

      effectiveOn: req.body.effectiveOn
        ? new Date(req.body.effectiveOn)
        : undefined,

      permission,

      permissionApplicationNumber:
        typeof req.body.permissionApplicationNumber === 'string'
          ? req.body.permissionApplicationNumber.trim()
          : '',

      permissionAppliedOn: req.body.permissionAppliedOn
        ? new Date(req.body.permissionAppliedOn)
        : undefined,

      permissionDecidedOn: req.body.permissionDecidedOn
        ? new Date(req.body.permissionDecidedOn)
        : undefined,

      noticeMonths: Math.max(0, Number(req.body.noticeMonths) || 0),
      unavoidable: req.body.unavoidable === true,

      grounds: Array.isArray(req.body.grounds)
        ? req.body.grounds.filter((ground) =>
            Object.prototype.hasOwnProperty.call(NOT_UNAVOIDABLE, ground),
          )
        : [],

      groundsNote:
        typeof req.body.groundsNote === 'string'
          ? req.body.groundsNote.trim()
          : '',

      recordedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CHAPTER_VB_ACTION_RECORDED',
      resourceType: 'ChapterVBAction',
      resourceIds: [record._id],
      details: {
        action: record.action,
        workmen: record.workmen,
        permission: record.permission,
        noticeMonths: record.noticeMonths,
      },
      req,
    });

    return res.status(201).json({ action: record });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/layoffs/actions/:id/permission
 *
 * Its own endpoint, and audited. This single field decides whether the act was
 * lawful, and therefore whether the establishment owes half pay for forty-five
 * days or full wages for the whole period.
 */
exports.recordPermission = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid action id' });
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        PERMISSION_STATE,
        req.body.permission,
      )
    ) {
      return res.status(400).json({
        message: `permission must be one of ${Object.keys(PERMISSION_STATE).join(', ')}`,
      });
    }

    const before = await ChapterVBAction.findOne({
      _id: req.params.id
    }).lean();

    if (!before) return res.status(404).json({ message: 'Action not found' });

    const record = await ChapterVBAction.findOneAndUpdate(
      {
        _id: req.params.id
      },
      {
        $set: {
          permission: req.body.permission,
          permissionApplicationNumber:
            typeof req.body.permissionApplicationNumber === 'string'
              ? req.body.permissionApplicationNumber.trim()
              : before.permissionApplicationNumber,
          permissionDecidedOn: req.body.permissionDecidedOn
            ? new Date(req.body.permissionDecidedOn)
            : new Date(),
        },
      },
      { new: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CHAPTER_VB_PERMISSION_RECORDED',
      resourceType: 'ChapterVBAction',
      resourceIds: [record._id],
      details: {
        action: record.action,
        from: before.permission,
        to: record.permission,
        applicationNumber: record.permissionApplicationNumber,
      },
      req,
    });

    return res.json({ action: record });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/layoffs/actions/:id/seniority
 *
 * The section 25G order, with the proposed selection compared against it.
 */
exports.getSeniority = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid action id' });
    }

    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : '';

    const records = await SeniorityRecord.find({
      chapterVBActionId: req.params.id,
      ...(category ? { category } : {})
    }).lean();

    const reasons = {};
    for (const row of records) {
      if (row.departureReason)
        reasons[String(row.employeeId)] = row.departureReason;
    }

    return res.json({
      seniority: seniorityList({
        workmen: records.map((row) => ({
          workmanId: row.employeeId,
          name: row.name,
          category: row.category,
          serviceDays: row.serviceDays,
        })),
        category,
        proposed: records
          .filter((row) => row.proposed)
          .map((row) => row.employeeId),
        reasons,
      }),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/layoffs/actions/:id/seniority
 *
 * Records the category's roll and which of them are proposed.
 */
exports.recordSeniority = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid action id' });
    }

    const rows = Array.isArray(req.body.workmen) ? req.body.workmen : [];

    await SeniorityRecord.deleteMany({
      chapterVBActionId: req.params.id,

      ...(typeof req.body.category === 'string' && req.body.category.trim()
        ? { category: req.body.category.trim() }
        : {})
    });

    const created = await SeniorityRecord.insertMany(
      rows
        .filter((row) => mongoose.isValidObjectId(row?.employeeId))
        .map((row) => ({
        chapterVBActionId: req.params.id,

        category:
          typeof row.category === 'string'
            ? row.category.trim()
            : String(req.body.category || '').trim(),

        employeeId: row.employeeId,
        name: typeof row.name === 'string' ? row.name.trim() : '',
        serviceDays: Math.max(0, Number(row.serviceDays) || 0),
        proposed: row.proposed === true,

        departureReason:
          typeof row.departureReason === 'string'
            ? row.departureReason.trim()
            : '',

        recordedBy: req.userId
      })),
    );

    return res.status(201).json({ recorded: created.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/layoffs/reemployment
 *
 * The section 25H preference for a category, meant to be called when a vacancy
 * is opened. `recruitmentPipeline.js` hires without knowing that a retrenched
 * workman has a statutory claim on it, which is the gap this closes.
 */
exports.getReemploymentPreference = async (req, res, next) => {
  try {
    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : '';

    const candidates = await ReemploymentCandidate.find({
      ...(category ? { category } : {})
    })
      .sort({ serviceDays: -1 })
      .lean();

    return res.json({
      preference: reemploymentPreference({
        retrenched: candidates.map((row) => ({
          workmanId: row.employeeId,
          name: row.name,
          category: row.category,
          serviceDays: row.serviceDays,
          retrenchedOn: row.retrenchedOn,
          offeredOn: row.offeredOn,
          reemployedOn: row.reemployedOn,
        })),
        category,
      }),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/layoffs/reemployment
 */
exports.recordReemploymentCandidate = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res
        .status(400)
        .json({ message: 'A valid employeeId is required' });
    }

    const candidate = await ReemploymentCandidate.findOneAndUpdate(
      {
        employeeId: req.body.employeeId
      },
      {
        $set: {
          establishment:
            typeof req.body.establishment === 'string'
              ? req.body.establishment.trim()
              : '',
          name: typeof req.body.name === 'string' ? req.body.name.trim() : '',
          category:
            typeof req.body.category === 'string'
              ? req.body.category.trim()
              : '',
          serviceDays: Math.max(0, Number(req.body.serviceDays) || 0),
          retrenchedOn: req.body.retrenchedOn
            ? new Date(req.body.retrenchedOn)
            : new Date(),
          ...(req.body.offeredOn
            ? { offeredOn: new Date(req.body.offeredOn) }
            : {}),
          ...(req.body.reemployedOn
            ? { reemployedOn: new Date(req.body.reemployedOn) }
            : {}),
          ...(req.body.declinedOn
            ? { declinedOn: new Date(req.body.declinedOn) }
            : {}),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    if (req.body.offeredOn) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'REEMPLOYMENT_PREFERENCE_OFFERED',
        resourceType: 'ReemploymentCandidate',
        resourceIds: [candidate._id],
        details: {
          name: candidate.name,
          category: candidate.category,
          offeredOn: candidate.offeredOn,
        },
        req,
      });
    }

    return res.json({ candidate });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/layoffs/closure-quote
 *
 * Section 25FFF, computed rather than stored: it is a quote for an act that has
 * not happened, and the grounds decide whether the three-month cap is available
 * at all.
 */
exports.getClosureQuote = async (req, res, next) => {
  try {
    const rules = await resolveRules(
      req.tenantId,
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '',
    );

    const grounds =
      typeof req.query.grounds === 'string'
        ? req.query.grounds
            .split(',')
            .map((ground) => ground.trim())
            .filter((ground) =>
              Object.prototype.hasOwnProperty.call(NOT_UNAVOIDABLE, ground),
            )
        : [];

    return res.json({
      quote: closureCompensation(
        {
          completedYears: Number(req.query.completedYears) || 0,
          wages: {
            basic: Number(req.query.basic) || 0,
            dearnessAllowance: Number(req.query.dearnessAllowance) || 0,
          },
          unavoidable: req.query.unavoidable === 'true',
          grounds,
        },
        rules,
      ),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/layoffs/assessment
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
        establishment,
        query: req.query
      }),
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/layoffs/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await LayoffAssessment.find({})
      .sort({ periodStart: -1 })
      .limit(50)
      .select('-findings')
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/layoffs/assessments
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const { period, rules, result } = await buildAssessment({
      establishment,
      query: req.body
    });

    const assessment = await LayoffAssessment.findOneAndUpdate(
      {
        establishment,
        periodStart: period.periodStart
      },
      {
        $set: {
          periodEnd: period.periodEnd,
          rules,
          action: result.chapterVB.action,
          workmen: result.chapterVB.workmen,
          permissionRequired: result.chapterVB.permissionRequired,
          permission: result.chapterVB.permission,
          lawful: result.lawful,
          spellCount: result.spellCount,
          qualifiedCount: result.qualifiedCount,
          payableDays: result.payableDays,
          beyondCeilingDays: result.beyondCeilingDays,
          // Two fields, never one. See the model's header.
          compensation: result.compensation,
          illegalityExposure: result.illegalityExposure,
          applicableLiability: result.applicableLiability,
          summary: result.summary,
          findings: result.findings,
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LAYOFF_ASSESSMENT_COMMITTED',
      resourceType: 'LayoffAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: establishment || '(default)',
        financialYear: period.financialYear,
        lawful: assessment.lawful,
        // Both, and which one applies — a single figure in the audit line would
        // reproduce exactly the ambiguity the two fields exist to prevent.
        compensation: assessment.compensation,
        illegalityExposure: assessment.illegalityExposure,
        applicableLiability: assessment.applicableLiability,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};

// Exported for the controller's own suite: the rolling ceiling is the only
// non-trivial derivation here and it is easier to test directly.
exports._consumedCeilingDays = consumedCeilingDays;
