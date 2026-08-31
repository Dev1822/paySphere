/**
 * @fileoverview Child and Adolescent Labour Act, 1986 (#1877).
 *
 * Three decisions carry this controller.
 *
 * **No endpoint returns a monetary figure.** Not the assessment, not the
 * register, not the export. An underage engagement has no compensable amount:
 * section 14's punishment is imprisonment and a fine on conviction, which is a
 * criminal penalty and not a liability that accrues. Every response here is
 * counts of people and occurrences, and `assertNoAmounts` from the engine is
 * run over the payload in the assessment path so that a future field cannot
 * slip a price in.
 *
 * **This module takes precedence over the working-hours engine for anybody
 * under eighteen, and says so in its own response.** `workingHoursCompliance`
 * answers an excess hour by computing the section 59 double rate. Section 7(4)
 * prohibits overtime for a young person outright, so there is no rate that
 * makes the hour lawful — `overtime` is carried on every person in the payload
 * rather than left for a caller to remember.
 *
 * **It does not block a hire and it does not delete a person.** The register is
 * a record of what happened. Removing a row because the engagement should not
 * have occurred destroys the only evidence that it did, which is the opposite
 * of what section 11 is for — so a finding is resolved with a stated action and
 * never cleared.
 *
 * Everything that decides an age, a Schedule match or a section 7 limit is in
 * `utils/adolescentEmployment.js`.
 */

const mongoose = require('mongoose');

const {
  AgeRecord,
  YoungPersonRegister,
  EmploymentFinding,
  EmploymentAssessment,
} = require('../models/adolescentEmployment.model');
const {
  EMPLOYMENT_RULES,
  CLASSIFICATION,
  AGE_BASIS,
  CHILD_EXCEPTION,
  HAZARDOUS_SCHEDULE,
  SEVERITY,
  classifyOn,
  attainsAgeOn,
  overtimeTreatment,
  assertNoAmounts,
  assessPerson,
  assessEstablishment,
} = require('../utils/adolescentEmployment');
const eventBus = require('../services/event.service');

/**
 * @param {*} value
 * @returns {string}
 */
function readEstablishment(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Load the register and compute the position.
 *
 * @param {object} input
 * @param {mongoose.Types.ObjectId} input.tenantId
 * @param {string} input.establishment
 * @returns {Promise<object>}
 */
async function computePosition({ tenantId, establishment }) {
  const entries = await YoungPersonRegister.find({
    tenantId,
    establishment,
    active: true,
  })
    .populate('ageRecordId')
    .lean();

  const ageRecords = await AgeRecord.find({ tenantId }).lean();

  // Load all active registers for multiple establishment checks
  const allEntries = await YoungPersonRegister.find({
    tenantId,
    active: true,
  })
    .populate('ageRecordId')
    .lean();

  const personWorkDates = new Map();
  for (const entry of allEntries) {
    const personIdStr = String(entry.ageRecordId?._id);
    const est = entry.establishment || '';
    for (const day of entry.days || []) {
      if (!day.worked || !day.shifts || day.shifts.length === 0) continue;
      const dateStr = new Date(day.date).toISOString().split('T')[0];
      if (!personWorkDates.has(personIdStr)) {
        personWorkDates.set(personIdStr, new Map());
      }
      const dateMap = personWorkDates.get(personIdStr);
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, new Set());
      }
      dateMap.get(dateStr).add(est);
    }
  }

  const registered = new Map(
    entries.map((entry) => [String(entry.ageRecordId?._id), entry]),
  );

  const people = ageRecords.map((record) => {
    const entry = registered.get(String(record._id));

    return {
      person: {
        personId: record._id,
        name: record.name,
        dateOfBirth: record.dateOfBirth,
        ageBasis: record.ageBasis,
      },
      engagement: entry?.engagement || {
        engagedOn: record.createdAt,
        occupation: '',
        processes: [],
      },
      days: entry?.days || [],
      dayOffChanges: entry?.dayOffChanges || [],
      inRegister: Boolean(entry),
      personWorkDates,
    };
  });

  return assessEstablishment({ people });
}

/**
 * GET /api/young-persons/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      rules: EMPLOYMENT_RULES,
      schedule: HAZARDOUS_SCHEDULE,
      note: 'Section 7 caps the day at six hours *including* the interval and any waiting time, and prohibits overtime outright. These are not the Factories Act limits and the section 59 double rate does not apply to anybody under eighteen.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/young-persons/age-records
 */
exports.listAgeRecords = async (req, res, next) => {
  try {
    const records = await AgeRecord.find({})
      .sort({ dateOfBirth: -1 })
      .limit(500)
      .lean();

    const asAt = new Date();

    return res.json({
      // Classification is computed here rather than stored, because somebody
      // engaged lawfully as an adolescent turns eighteen during their
      // employment and the limits fall away on that day.
      records: records.map((record) => ({
        ...record,
        ...classifyOn({ dateOfBirth: record.dateOfBirth, on: asAt }),
        attainsEighteenOn: attainsAgeOn(record.dateOfBirth, 18),
      })),
      asAt,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/young-persons/age-records
 */
exports.recordAge = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.subjectId)) {
      return res.status(400).json({ message: 'Invalid subject id' });
    }

    const dateOfBirth = new Date(req.body.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime())) {
      return res
        .status(400)
        .json({ message: 'dateOfBirth must be a valid date' });
    }

    if (dateOfBirth.getTime() > Date.now()) {
      return res.status(422).json({
        message: 'A date of birth in the future is not a date of birth',
      });
    }

    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }

    const ageBasis = Object.values(AGE_BASIS).includes(req.body.ageBasis)
      ? req.body.ageBasis
      : AGE_BASIS.SELF_DECLARED;

    // A medical certificate is the thing section 10 says settles a dispute, so
    // claiming one without saying who issued it makes the record weaker than
    // the self-declaration it replaced.
    if (
      ageBasis === AGE_BASIS.MEDICAL_CERTIFICATE &&
      !String(req.body.medicalAuthority || '').trim()
    ) {
      return res.status(422).json({
        message:
          'A section 10 medical certificate needs the prescribed authority that issued it. Without that, the record is weaker than the declaration it replaces.',
      });
    }

    const record = await AgeRecord.findOneAndUpdate(
      {
        subjectType: req.body.subjectType || 'EMPLOYEE',
        subjectId: req.body.subjectId
      },
      {
        $set: {
          name,
          dateOfBirth,
          ageBasis,
          ageDocumentReference: String(
            req.body.ageDocumentReference || '',
          ).trim(),
          medicalCertificateOn: req.body.medicalCertificateOn
            ? new Date(req.body.medicalCertificateOn)
            : undefined,
          medicalAuthority: String(req.body.medicalAuthority || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const classification = classifyOn({ dateOfBirth, on: new Date() });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'YOUNG_PERSON_AGE_RECORDED',
      resourceType: 'AgeRecord',
      resourceIds: [record._id],
      details: {
        name,
        dateOfBirth,
        // The basis is in the audit line rather than only the date. Changing a
        // self-declaration to a birth certificate is a strengthening of the
        // record; changing the date itself can move somebody across the
        // fourteen or eighteen boundary, and both need to be visible.
        ageBasis,
        classification: classification.classification,
      },
      req,
    });

    return res.status(201).json({
      record,
      ...classification,
      attainsEighteenOn: attainsAgeOn(dateOfBirth, 18),
      overtime: overtimeTreatment(classification.classification),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/young-persons/register
 */
exports.getRegister = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const entries = await YoungPersonRegister.find({
      establishment
    })
      .populate('ageRecordId')
      .sort({ createdAt: -1 })
      .lean();

    const asAt = new Date();

    return res.json({
      establishment,
      asAt,
      entries: entries.map((entry) => ({
        ...entry,
        ...classifyOn({
          dateOfBirth: entry.ageRecordId?.dateOfBirth,
          on: asAt,
        }),
      })),
      note: 'Section 11. The register’s subject is who these people are — name, date of birth, the nature of the work, the hours and the intervals. The attendance ledger records whether somebody came in, which is a different question.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/young-persons/register
 */
exports.upsertRegisterEntry = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.ageRecordId)) {
      return res.status(400).json({ message: 'Invalid age record id' });
    }

    const record = await AgeRecord.findOne({
      _id: req.body.ageRecordId
    }).lean();

    if (!record) {
      return res.status(404).json({ message: 'Age record not found' });
    }

    const establishment = readEstablishment(req.body.establishment);
    const engagement = req.body.engagement || {};

    const engagedOn = new Date(engagement.engagedOn);
    if (Number.isNaN(engagedOn.getTime())) {
      return res
        .status(400)
        .json({ message: 'engagement.engagedOn must be a valid date' });
    }

    const { classification } = classifyOn({
      dateOfBirth: record.dateOfBirth,
      on: engagedOn,
    });

    const childException = Object.values(CHILD_EXCEPTION).includes(
      engagement.childException,
    )
      ? engagement.childException
      : null;

    // Both provisos are claims about a relationship and about schooling rather
    // than job titles, and an unevidenced claim is not a permission. Refused
    // here rather than recorded and flagged, because the register is the
    // document an inspector reads and a claim with nothing behind it in it is
    // worse than an honest gap.
    if (
      classification === CLASSIFICATION.CHILD &&
      childException &&
      !String(engagement.exceptionEvidence || '').trim()
    ) {
      return res.status(422).json({
        message:
          'A section 3 exception needs the evidence it rests on. Helping in a family enterprise is a claim about the relationship, the hours and the schooling; an audio-visual engagement requires the prescribed safeguards.',
      });
    }

    const entry = await YoungPersonRegister.findOneAndUpdate(
      {
        establishment,
        ageRecordId: record._id
      },
      {
        $set: {
          engagement: {
            engagedOn,
            occupation: String(engagement.occupation || '')
              .trim()
              .toUpperCase(),
            processes: Array.isArray(engagement.processes)
              ? engagement.processes.map((process) =>
                  String(process).trim().toUpperCase(),
                )
              : [],
            childException,
            exceptionEvidence: String(
              engagement.exceptionEvidence || '',
            ).trim(),
            interferesWithSchooling: Boolean(
              engagement.interferesWithSchooling,
            ),
          },
          natureOfWork: String(req.body.natureOfWork || '').trim(),
          active: req.body.active !== false,
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'YOUNG_PERSON_REGISTER_RECORDED',
      resourceType: 'YoungPersonRegister',
      resourceIds: [entry._id],
      details: {
        name: record.name,
        establishment: establishment || '(default)',
        classification,
        occupation: entry.engagement.occupation,
        // Named in the audit line because it is the field that turns a
        // prohibited engagement into a permitted one on paper.
        childException,
      },
      req,
    });

    await triggerComplianceAlerts({
      record,
      entry,
      req
    });

    return res.status(201).json({ entry, classification });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/young-persons/register/:id/days
 *
 * Appends worked days. Append-only: section 7's limits are per day and per
 * spell, and replacing the list would let a long day be smoothed into a
 * compliant one after the fact.
 */
exports.recordDays = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid register entry id' });
    }

    if (!Array.isArray(req.body.days) || req.body.days.length === 0) {
      return res
        .status(400)
        .json({ message: 'days must be a non-empty array' });
    }

    const entry = await YoungPersonRegister.findOne({
      _id: req.params.id
    });

    if (!entry) {
      return res.status(404).json({ message: 'Register entry not found' });
    }

    for (const day of req.body.days) {
      const date = new Date(day?.date);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Each day needs a valid date' });
      }

      entry.days.push({
        date,
        shifts: Array.isArray(day.shifts)
          ? day.shifts.map((shift) => ({
              start: String(shift?.start || '').trim(),
              end: String(shift?.end || '').trim(),
            }))
          : [],
        waitingMinutes: Math.max(0, Number(day.waitingMinutes) || 0),
        worked: day.worked !== false,
      });
    }

    await entry.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'YOUNG_PERSON_DAYS_RECORDED',
      resourceType: 'YoungPersonRegister',
      resourceIds: [entry._id],
      details: { dayCount: req.body.days.length },
      req,
    });

    const record = await AgeRecord.findById(entry.ageRecordId);
    if (record) {
      await triggerComplianceAlerts({
        record,
        entry,
        req
      });
    }

    return res.status(201).json({ entry });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/young-persons/assessment
 *
 * Counts of people and occurrences. No monetary figure anywhere — see the
 * header, and the guard below.
 */
exports.getAssessment = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const result = await computePosition({
      establishment
    });

    // The guard, run on the way out rather than trusted. A future field that
    // introduced a "penalty estimate" would fail here rather than reaching a
    // report that adds it up.
    const offenders = assertNoAmounts(result);
    if (offenders.length > 0) {
      return res.status(500).json({
        message:
          'The assessment produced a monetary field. An underage engagement has no compensable amount, and a figure here would be summed into a compliance provision.',
        offenders,
      });
    }

    return res.json({
      establishment,
      result,
      note: 'Occurrences and people, never amounts. Section 14’s punishment is imprisonment and a fine on conviction — a criminal penalty rather than a liability that accrues — and it is not a price for the engagement.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/young-persons/findings
 */
exports.listFindings = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const findings = await EmploymentFinding.find({
      establishment
    })
      .sort({ severity: 1, createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({ establishment, findings });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/young-persons/findings/:id/resolve
 *
 * Records what was done. It does not delete the finding — the register exists
 * to show what happened, and clearing the row destroys the only evidence it did.
 */
exports.resolveFinding = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid finding id' });
    }

    const resolution = String(req.body.resolution || '').trim();
    if (!resolution) {
      return res.status(422).json({
        message:
          'A resolution has to say what was done. Marking a finding resolved with no action recorded turns the register into a record of things that stopped being displayed.',
      });
    }

    const finding = await EmploymentFinding.findOneAndUpdate(
      {
        _id: req.params.id
      },
      { $set: { resolvedOn: new Date(), resolution, recordedBy: req.userId } },
      { new: true },
    );

    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'YOUNG_PERSON_FINDING_RESOLVED',
      resourceType: 'EmploymentFinding',
      resourceIds: [finding._id],
      details: {
        code: finding.code,
        severity: finding.severity,
        name: finding.name,
        resolution,
      },
      req,
    });

    return res.json({ finding });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/young-persons/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const assessments = await EmploymentAssessment.find({
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
 * POST /api/young-persons/assessments
 *
 * Commits the position and persists its findings. The Schedule is snapshotted
 * because it was cut substantially in 2016 and a finding raised under the older
 * list has to stay readable as the finding it was.
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);
    const asAt = new Date();

    const result = await computePosition({
      establishment
    });

    if (result.people.length === 0) {
      return res.status(422).json({
        message:
          'No age record exists for this tenant. An assessment over nobody would read as an establishment with no young persons rather than as an establishment nobody has checked.',
      });
    }

    // Replaced rather than appended: the findings are a computed position as at
    // a date, and keeping every run's copy would make the register unreadable.
    // Resolutions survive because they live on the resolved rows, which are
    // preserved by code below.
    const resolved = await EmploymentFinding.find({
      establishment,
      resolvedOn: { $ne: null }
    }).lean();

    const resolvedKeys = new Set(
      resolved.map((row) => `${row.code}:${String(row.ageRecordId)}`),
    );

    await EmploymentFinding.deleteMany({
      establishment,
      resolvedOn: null
    });

    const documents = result.findings
      .filter(
        (finding) =>
          !resolvedKeys.has(`${finding.code}:${String(finding.personId)}`),
      )
      .map((finding) => ({
      establishment,
      code: finding.code,
      section: finding.section,
      severity: finding.severity,
      ageRecordId: finding.personId,
      name: finding.name,
      classification: finding.classification,
      ageYears: finding.ageYears ?? null,
      occurredOn: finding.date ? new Date(finding.date) : undefined,
      minutes: finding.minutes ?? null,
      limitMinutes: finding.limitMinutes ?? null,
      matched: finding.matched || [],
      note: finding.note || '',
      recordedBy: req.userId
    }));

    if (documents.length > 0) {
      await EmploymentFinding.insertMany(documents);
    }

    const assessment = await EmploymentAssessment.create({
      establishment,
      asAt,
      childrenEngaged: result.childrenEngaged,
      adolescentsEngaged: result.adolescentsEngaged,
      prohibitedCount: result.prohibited.length,

      breachCount: result.findings.filter(
        (finding) => finding.severity === SEVERITY.BREACH,
      ).length,

      scheduleSnapshot: result.schedule,
      rulesSnapshot: result.rules,
      committedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'YOUNG_PERSON_ASSESSMENT_COMMITTED',
      resourceType: 'EmploymentAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: establishment || '(default)',
        // Counts of people. There is no amount on this line and there is no
        // amount anywhere behind it.
        childrenEngaged: assessment.childrenEngaged,
        adolescentsEngaged: assessment.adolescentsEngaged,
        prohibitedCount: assessment.prohibitedCount,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * Trigger WebSocket alerts and log compliance exceptions for roster violations.
 */
async function triggerComplianceAlerts({ tenantId, record, entry, req }) {
  try {
    const logger = require('../utils/logger');
    const allEntries = await YoungPersonRegister.find({
      tenantId,
      active: true,
    }).lean();

    const personWorkDates = new Map();
    for (const ent of allEntries) {
      const personIdStr = String(ent.ageRecordId);
      const est = ent.establishment || '';
      const days = String(ent._id) === String(entry._id) ? entry.days : ent.days;
      for (const day of days || []) {
        if (!day.worked || !day.shifts || day.shifts.length === 0) continue;
        const dateStr = new Date(day.date).toISOString().split('T')[0];
        if (!personWorkDates.has(personIdStr)) {
          personWorkDates.set(personIdStr, new Map());
        }
        const dateMap = personWorkDates.get(personIdStr);
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, new Set());
        }
        dateMap.get(dateStr).add(est);
      }
    }

    const result = assessPerson({
      person: {
        personId: record._id,
        name: record.name,
        dateOfBirth: record.dateOfBirth,
        ageBasis: record.ageBasis,
      },
      engagement: entry.engagement,
      days: entry.days,
      dayOffChanges: entry.dayOffChanges,
      inRegister: true,
      personWorkDates,
    });

    const rosterViolations = result.findings.filter(f =>
      f.code.startsWith('ROSTER_') || f.code === 'NIGHT_WORK' || f.code === 'INTERVAL_SHORT' || f.code === 'DAY_EXCEEDS_LIMIT'
    );

    if (rosterViolations.length > 0) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'COMPLIANCE_VIOLATION',
        resourceType: 'YoungPersonRegister',
        resourceIds: [entry._id],
        details: {
          name: record.name,
          establishment: entry.establishment,
          violations: rosterViolations.map(v => ({ code: v.code, note: v.note, section: v.section })),
        },
        req,
      });

      const { getIo } = require('../sockets/payroll.socket');
      const io = getIo();
      if (io) {
        io.to(`tenant:${tenantId}`).emit('compliance_alert', {
          type: 'ADOLESCENT_ROSTER_VIOLATION',
          tenantId,
          personId: record._id,
          name: record.name,
          violations: rosterViolations,
        });
      }
    }
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('Failed to trigger compliance alerts:', { error: err.message });
  }
}
