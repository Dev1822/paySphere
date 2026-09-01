/**
 * @fileoverview EPF International Workers — paragraph 83 (#1971).
 *
 * Three decisions carry this controller.
 *
 * **It computes the contribution basis and does not build the ECR.**
 * `ecrGenerator.utils.js` keeps that job. This supplies the basis for the
 * members it owns — full monthly pay, no wage ceiling — and flags where a member
 * on the ECR was computed on the domestic ceiling while holding paragraph 83
 * status. #1875 keeps interest and damages; a shortfall found here is fed to it
 * rather than recomputed.
 *
 * **It refuses a withdrawal rather than offering a form.** A domestic member may
 * withdraw after two months' unemployment; an International Worker may not, and
 * a self-service portal that offers it offers something that will be refused.
 * `checkWithdrawal` returns the ground and the refusal with its authority so the
 * member is told why rather than told no.
 *
 * **It stores what the ceiling would have produced beside what is due.** The two
 * figures differ by roughly forty times, and a single stored number gives a
 * reviewer no way to tell an intended full-pay basis from a bug — which is how
 * somebody "fixes" a correct figure back to ₹1,800.
 *
 * Everything that decides a status, a basis or a due date is in
 * `utils/internationalWorkerPf.js`.
 */

const mongoose = require('mongoose');

const {
  InternationalWorkerStatus,
  CertificateOfCoverage,
  InternationalWorkerContribution,
  IwOneReturn,
} = require('../models/internationalWorkerPf.model');
const {
  IW_RULES,
  LIMB,
  STATUS,
  SSA_COUNTRIES,
  WITHDRAWAL_GROUND,
  NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
  WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
  determineStatus,
  certificatePosition,
  contributionBasis,
  withdrawalEligibility,
  assessEstablishment,
} = require('../utils/internationalWorkerPf');
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
 * The status determination and certificate in force for an employee on a date.
 *
 * @param {object} input
 * @returns {Promise<{determination: object|null, certificate: object|null}>}
 */
async function loadPosition({ tenantId, employeeId, asOn }) {
  const [determination, certificate] = await Promise.all([
    InternationalWorkerStatus.findOne({
      tenantId,
      employeeId,
      from: { $lte: asOn },
      $or: [{ to: null }, { to: { $gte: asOn } }],
    })
      .sort({ from: -1 })
      .lean(),
    CertificateOfCoverage.findOne({ tenantId, employeeId })
      .sort({ validTo: -1 })
      .lean(),
  ]);

  return { determination, certificate };
}

/**
 * GET /api/international-workers/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      rules: IW_RULES,
      limbs: LIMB,
      agreements: SSA_COUNTRIES,
      withdrawalGrounds: WITHDRAWAL_GROUND,
      notes: {
        noWageCeiling: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
        withdrawalIsNotAvailableOnUnemployment:
          WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
      },
      note: 'Detachment, totalisation and export of pension are three different things and an agreement can give one without the others. They are separate flags for that reason.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/international-workers/status
 *
 * Records the paragraph 83 determination. The limb is required and never
 * inferred — see the model.
 */
exports.recordStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    if (!Object.values(LIMB).includes(req.body.limb)) {
      return res.status(400).json({
        message:
          'limb must be recorded. Paragraph 83 reaches a foreign national in India and an Indian employee on deputation to an agreement country, and nationality answers the second one wrongly.',
      });
    }

    const from = readDate(req.body.from);
    if (!from) {
      return res.status(400).json({ message: 'from must be a valid date' });
    }

    const countryCode = String(req.body.countryCode || '')
      .trim()
      .toUpperCase();

    // The second limb only reaches an employee going to a country India has an
    // agreement with. Without one there is no limb-two status to record.
    if (
      req.body.limb === LIMB.INDIAN_IN_SSA_COUNTRY &&
      !SSA_COUNTRIES[countryCode]
    ) {
      return res.status(400).json({
        message: `India has no Social Security Agreement with ${countryCode || 'that country'}. An Indian employee working there is not an International Worker under the second limb.`,
      });
    }

    const status = await InternationalWorkerStatus.findOneAndUpdate(
      {
        employeeId: req.body.employeeId,
        from
      },
      {
        $set: {
          limb: req.body.limb,
          countryCode,
          to: readDate(req.body.to),
          determinedOn: readDate(req.body.determinedOn) || new Date(),
          ground: String(req.body.ground || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'IW_STATUS_DETERMINED',
      resourceType: 'InternationalWorkerStatus',
      resourceIds: [status._id],
      details: {
        employeeId: req.body.employeeId,
        limb: req.body.limb,
        countryCode,
        from,
        to: status.to,
        // Named because this determination is what removes the wage ceiling.
        ceilingApplies: false,
      },
      req,
    });

    return res.status(201).json({
      status,
      note: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/international-workers/certificates
 *
 * A certificate from a country India has no detachment article with detaches
 * nobody. It is accepted onto the record — the document exists — and the
 * assessment reports that it has no effect, rather than the write silently
 * excluding a member who is not excluded.
 */
exports.recordCertificate = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const validFrom = readDate(req.body.validFrom);
    const validTo = readDate(req.body.validTo);
    if (!validFrom || !validTo) {
      return res
        .status(400)
        .json({ message: 'validFrom and validTo must both be valid dates' });
    }
    if (validTo < validFrom) {
      return res
        .status(400)
        .json({ message: 'validTo cannot precede validFrom' });
    }

    const countryCode = String(req.body.countryCode || '')
      .trim()
      .toUpperCase();
    if (!countryCode) {
      return res.status(400).json({ message: 'countryCode is required' });
    }

    const certificate = await CertificateOfCoverage.findOneAndUpdate(
      {
        employeeId: req.body.employeeId,
        validFrom
      },
      {
        $set: {
          countryCode,
          certificateNumber: String(req.body.certificateNumber || '').trim(),
          validTo,
          documentId: mongoose.isValidObjectId(req.body.documentId)
            ? req.body.documentId
            : undefined,
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const position = certificatePosition({ certificate, asAt: new Date() });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'IW_CERTIFICATE_RECORDED',
      resourceType: 'CertificateOfCoverage',
      resourceIds: [certificate._id],
      details: {
        employeeId: req.body.employeeId,
        countryCode,
        validFrom,
        validTo,
        // Audited because a certificate from a country with no detachment
        // article excludes nobody, and recording one anyway is the record an
        // assessment asks about.
        detachmentAvailable: position?.detachmentAvailable,
        attachesFrom: position?.attachesFrom,
      },
      req,
    });

    return res.status(201).json({
      certificate,
      position,
      note: position?.detachmentAvailable
        ? `The worker is an excluded employee until ${validTo.toISOString().slice(0, 10)}, and attaches at full pay with no ceiling from the day after.`
        : `India has no detachment article with ${countryCode}. This certificate detaches nobody, and the worker contributes on full pay throughout.`,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/international-workers/certificates/expiring
 *
 * The query the module exists for, and the one that runs on a schedule rather
 * than when somebody opens a record. A lapsed certificate re-attaches the worker
 * at full pay and the under-remittance compounds monthly until it is noticed.
 */
exports.listExpiringCertificates = async (req, res, next) => {
  try {
    const withinDays =
      Number(req.query.withinDays) || IW_RULES.certificateNoticeDays;

    const horizon = new Date(Date.now() + withinDays * 86400000);

    const certificates = await CertificateOfCoverage.find({
      validTo: { $lte: horizon }
    })
      .sort({ validTo: 1 })
      .lean();

    return res.json({
      withinDays,
      certificates: certificates.map((certificate) => ({
        ...certificate,
        position: certificatePosition({ certificate, asAt: new Date() }),
      })),
      note: `Raised ${IW_RULES.certificateNoticeDays} days ahead by default rather than thirty: extending a certificate is an application to a foreign social security authority, and thirty days is not enough time to make one.`,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/international-workers/contributions
 *
 * Computes the basis for a month and stores it with what the ceiling would have
 * produced. Both, always — see the header.
 */
exports.recordContribution = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const forMonthEnding = readDate(req.body.forMonthEnding);
    if (!forMonthEnding) {
      return res
        .status(400)
        .json({ message: 'forMonthEnding must be a valid date' });
    }

    const { determination, certificate } = await loadPosition({
      employeeId: req.body.employeeId,
      asOn: forMonthEnding
    });

    const status = determineStatus({
      determination,
      certificate,
      asOn: forMonthEnding,
    });

    const pay = {
      paidInIndia: Number(req.body.paidInIndia) || 0,
      paidOutsideIndia: Number(req.body.paidOutsideIndia) || 0,
      paidInForeignCurrency: Number(req.body.paidInForeignCurrency) || 0,
    };

    const basis = contributionBasis({ status, pay });

    const record = await InternationalWorkerContribution.findOneAndUpdate(
      {
        employeeId: req.body.employeeId,
        forMonthEnding
      },
      {
        $set: {
          status: status.status,
          ...pay,
          basis: basis.basis,
          ceilingWouldHaveBeen: basis.ceilingWouldHaveBeen || 0,
          employeeShare: basis.employee,
          employerShare: basis.employer,
          employerToPension: basis.employerToPension || 0,
          remitted:
            req.body.remitted === undefined ? null : Number(req.body.remitted),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'IW_CONTRIBUTION_COMPUTED',
      resourceType: 'InternationalWorkerContribution',
      resourceIds: [record._id],
      details: {
        employeeId: req.body.employeeId,
        forMonthEnding,
        status: status.status,
        basis: basis.basis,
        // Both, because the gap between them is what a reviewer is checking.
        ceilingWouldHaveBeen: basis.ceilingWouldHaveBeen || 0,
        ceilingApplied: Boolean(basis.ceilingApplied),
      },
      req,
    });

    return res.status(201).json({
      contribution: record,
      basis,
      note: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/international-workers/withdrawal
 *
 * Read-only. Answers whether a withdrawal is available and, where it is not,
 * why — a member told "no" with no reason applies again next month.
 */
exports.checkWithdrawal = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const asOn = readDate(req.query.asOn) || new Date();

    const { determination, certificate } = await loadPosition({
      employeeId: req.query.employeeId,
      asOn
    });

    const status = determineStatus({ determination, certificate, asOn });

    const result = withdrawalEligibility({
      status,
      ground: req.query.ground || WITHDRAWAL_GROUND.TWO_MONTHS_UNEMPLOYED,
      age: Number(req.query.age) || 0,
      ssaCountryCode:
        req.query.ssaCountryCode || determination?.countryCode || undefined,
    });

    return res.json({
      status: status.status,
      withdrawal: result,
      note: WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/international-workers/iw-1
 *
 * Files the monthly return. Owed for a month with no international workers at
 * all, so the worker count is allowed to be nought and that is not an error.
 */
exports.fileIwOne = async (req, res, next) => {
  try {
    const forMonthEnding = readDate(req.body.forMonthEnding);
    if (!forMonthEnding) {
      return res
        .status(400)
        .json({ message: 'forMonthEnding must be a valid date' });
    }

    const dueOn = new Date(
      forMonthEnding.getTime() + IW_RULES.iwOneDueDays * 86400000,
    );

    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const filing = await IwOneReturn.findOneAndUpdate(
      {
        establishment,
        forMonthEnding
      },
      {
        $set: {
          dueOn,
          workerCount: Number(req.body.workerCount) || 0,
          totalContribution: Number(req.body.totalContribution) || 0,
          filedOn: readDate(req.body.filedOn) || new Date(),
          acknowledgement: String(req.body.acknowledgement || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'IW_ONE_FILED',
      resourceType: 'IwOneReturn',
      resourceIds: [filing._id],
      details: {
        establishment: establishment || '(default)',
        forMonthEnding,
        dueOn,
        workerCount: filing.workerCount,
        filedOn: filing.filedOn,
      },
      req,
    });

    return res.status(201).json({ filing });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/international-workers/position
 *
 * The establishment's whole position: every worker's status, contribution and
 * certificate, and the IW-1 schedule.
 */
exports.getPosition = async (req, res, next) => {
  try {
    const establishment =
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '';

    const now = new Date();
    const from =
      readDate(req.query.from) || new Date(now.getUTCFullYear(), 0, 1);
    const to = readDate(req.query.to) || now;

    const determinations = await InternationalWorkerStatus.find({}).lean();

    const certificates = await CertificateOfCoverage.find({})
      .sort({ validTo: -1 })
      .lean();

    const certificateBy = new Map();
    for (const certificate of certificates) {
      const key = String(certificate.employeeId);
      // The latest certificate wins. An older one that has already lapsed does
      // not detach anybody, and reporting it would hide the current position.
      if (!certificateBy.has(key)) certificateBy.set(key, certificate);
    }

    const contributions = await InternationalWorkerContribution.find({
      forMonthEnding: { $gte: from, $lte: to }
    })
      .sort({ forMonthEnding: -1 })
      .lean();

    const latestContribution = new Map();
    for (const row of contributions) {
      const key = String(row.employeeId);
      if (!latestContribution.has(key)) latestContribution.set(key, row);
    }

    const filings = await IwOneReturn.find({
      establishment,
      filedOn: { $ne: null }
    }).lean();

    const result = assessEstablishment({
      workers: determinations.map((determination) => {
        const key = String(determination.employeeId);
        const contribution = latestContribution.get(key);

        return {
          employeeId: determination.employeeId,
          determination,
          certificate: certificateBy.get(key) || null,
          pay: {
            paidInIndia: contribution?.paidInIndia || 0,
            paidOutsideIndia: contribution?.paidOutsideIndia || 0,
            paidInForeignCurrency: contribution?.paidInForeignCurrency || 0,
          },
          contributionAsRemitted: contribution?.remitted ?? undefined,
        };
      }),
      filings,
      period: { from, to },
      asAt: now,
    });

    return res.json({ establishment, period: { from, to }, result });
  } catch (error) {
    return next(error);
  }
};
