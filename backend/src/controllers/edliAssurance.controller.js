/**
 * @fileoverview EDLI paragraph 22 — the assurance benefit (#1878).
 *
 * Three decisions carry this controller.
 *
 * **It never recomputes the contribution.** `ecrGenerator.utils.js` is the
 * single place that decides the half per cent. This controller reads wage
 * months and balances and answers what the scheme *pays*, which is a different
 * question and has had no home in the product.
 *
 * **A claim cannot be committed without a resolved payee.** The assurance goes
 * to the nominee under Form 2, failing which to the family as the scheme
 * defines it, failing which to the legal heir. A benefit with no payee is a
 * figure rather than a claim, and committing one would put a number in front of
 * a family with nobody entitled to receive it.
 *
 * **The exempted comparison is computed for exempted establishments, not
 * skipped for them.** For an unexempted establishment the EPFO settles the
 * claim on its own arithmetic; for one exempted under section 17(2A) nobody
 * else is computing paragraph 22 at all, and the exemption is conditional on
 * the group policy paying not less than it would. The shortfall is reported as
 * its own field and never netted into the benefit — it is the part of the same
 * benefit the policy did not cover, and it is the establishment's liability
 * rather than the insurer's.
 *
 * Everything that decides a window, a cap or a floor is in
 * `utils/edliAssurance.js`.
 */

const mongoose = require('mongoose');

const {
  EpfNomination,
  EdliExemption,
  EdliPriorService,
  EdliClaim,
} = require('../models/edliAssurance.model');
const Payroll = require('../models/payroll.model');
const {
  EDLI_RULES,
  SEED_RULE_SETS,
  SERVICE_BASIS,
  PAYEE_LIMB,
  averagingWindow,
  resolveRules,
  assessClaim,
} = require('../utils/edliAssurance');
const eventBus = require('../services/event.service');

/**
 * @param {*} value
 * @returns {string}
 */
function readEstablishment(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The wage months of the averaging window, from the payroll runs.
 *
 * Reads the whole emolument the way `complianceAggregator.js` does rather than
 * a `grossSalary` field, because the payroll model does not carry one. EDLI
 * wages follow the provident fund wage definition, and taking basic alone would
 * understate the average for anybody whose pay is largely allowances — though
 * for most members the ₹15,000 ceiling binds before the difference shows.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {mongoose.Types.ObjectId} employeeId
 * @param {Array<{year: number, month: number}>} window
 * @returns {Promise<Array<{year: number, month: number, wages: number}>>}
 */
async function loadWageMonths(tenantId, employeeId, window) {
  if (window.length === 0) return [];

  const runs = await Payroll.find({
    tenantId,
    employeeId,
    $or: window.map((month) => ({ year: month.year, month: month.month })),
  })
    .select('year month baseSalary bonus overtimePay arrearsPayout')
    .lean();

  return runs.map((run) => ({
    year: run.year,
    month: run.month,
    wages:
      (Number(run.baseSalary) || 0) +
      (Number(run.bonus) || 0) +
      (Number(run.overtimePay) || 0) +
      (Number(run.arrearsPayout) || 0),
  }));
}

/**
 * Compute a claim from what is on record.
 *
 * @param {object} input
 * @returns {Promise<object>}
 */
async function computeClaim({
  tenantId,
  establishment,
  employeeId,
  dateOfDeath,
  balances,
  monthsHere,
}) {
  const rules = resolveRules(dateOfDeath);
  const window = averagingWindow(dateOfDeath, rules.averagingMonths);

  const wageMonths = await loadWageMonths(tenantId, employeeId, window);

  const nomination = await EpfNomination.findOne({
    tenantId,
    employeeId,
  }).lean();

  const exemption = await EdliExemption.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  // Prior service is aggregated across records, and a break on **any** of them
  // breaks the chain. Taking the longest single record instead would let a
  // member with two short unrelated engagements qualify for a floor the
  // paragraph does not give them.
  const priorService = await EdliPriorService.find({
    tenantId,
    employeeId,
  }).lean();

  const monthsElsewhere = priorService.reduce(
    (total, row) => total + (row.months || 0),
    0,
  );
  const gapBetween = priorService.some((row) => row.gapBetween);

  // The weakest basis on record wins, because the floor rests on the whole
  // chain rather than on its best-documented link.
  const basis = priorService.some((row) => row.basis === SERVICE_BASIS.DECLARED)
    ? SERVICE_BASIS.DECLARED
    : priorService[0]?.basis || SERVICE_BASIS.THIS_ESTABLISHMENT;

  const policyBenefit =
    exemption?.exempted && exemption.benefitBasis === 'FLAT'
      ? exemption.flatBenefit
      : undefined;

  return assessClaim({
    member: { memberId: employeeId, dateOfDeath },
    wageMonths,
    balances: balances || [],
    service: { monthsHere, monthsElsewhere, basis, gapBetween },
    nomination: nomination || {},
    exemption: {
      exempted: Boolean(exemption?.exempted),
      policyBenefit,
    },
    ruleSets: SEED_RULE_SETS,
  });
}

/**
 * GET /api/edli/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    const asOn = req.query.asOn ? new Date(req.query.asOn) : new Date();

    return res.json({
      current: EDLI_RULES,
      inForce: resolveRules(asOn),
      history: SEED_RULE_SETS,
      note: 'The figures are dated. A claim for an earlier death reproduces the rule set in force then — the overall cap moved from ₹6,00,000 to ₹7,00,000 in 2021 and the bonus cap moved with it.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/edli/nominations
 */
exports.listNominations = async (req, res, next) => {
  try {
    const nominations = await EpfNomination.find({ tenantId: req.tenantId })
      .populate('employeeId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    return res.json({
      nominations,
      note: 'The EPF Form 2 nomination, which decides who receives the assurance. Not the peer recognition nominations — those are a different feature entirely.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/edli/nominations/:employeeId
 */
exports.upsertNomination = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const nominees = Array.isArray(req.body.nominees) ? req.body.nominees : [];

    for (const nominee of nominees) {
      if (!String(nominee?.name || '').trim()) {
        return res.status(400).json({ message: 'Each nominee needs a name' });
      }

      const share = Number(nominee?.sharePercent);
      if (!Number.isFinite(share) || share < 0 || share > 100) {
        return res
          .status(400)
          .json({ message: 'sharePercent must be between 0 and 100' });
      }
    }

    const total = nominees.reduce(
      (sum, nominee) => sum + Number(nominee.sharePercent),
      0,
    );

    if (total > 100) {
      return res.status(422).json({
        message:
          'The nominated shares exceed a hundred per cent. Shares below a hundred are accepted — the remainder falls to the next limb of the scheme — but above it there is nothing for them to fall to.',
      });
    }

    const nomination = await EpfNomination.findOneAndUpdate(
      { tenantId: req.tenantId, employeeId: req.params.employeeId },
      {
        $set: {
          uan: String(req.body.uan || '').trim(),
          nominees: nominees.map((nominee) => ({
            name: String(nominee.name).trim(),
            relationship: String(nominee.relationship || '').trim(),
            dateOfBirth: nominee.dateOfBirth
              ? new Date(nominee.dateOfBirth)
              : undefined,
            sharePercent: Number(nominee.sharePercent),
            guardianName: String(nominee.guardianName || '').trim(),
          })),
          family: Array.isArray(req.body.family) ? req.body.family : [],
          legalHeirs: Array.isArray(req.body.legalHeirs)
            ? req.body.legalHeirs
            : [],
          filedOn: req.body.filedOn ? new Date(req.body.filedOn) : undefined,
          formReference: String(req.body.formReference || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPF_NOMINATION_RECORDED',
      resourceType: 'EpfNomination',
      resourceIds: [nomination._id],
      details: {
        employeeId: req.params.employeeId,
        nomineeCount: nomination.nominees.length,
        // The total is in the audit line because a nomination summing to less
        // than a hundred sends the remainder to a different limb of the scheme,
        // and that is a change of payee rather than of amount.
        sharesTotal: total,
      },
      req,
    });

    return res.json({ nomination, sharesTotal: total });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/edli/exemption
 */
exports.getExemption = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const exemption = await EdliExemption.findOne({
      tenantId: req.tenantId,
      establishment,
    }).lean();

    return res.json({
      establishment,
      exemption: exemption || null,
      note: 'An exemption under section 17(2A) is conditional on the group policy paying not less than the scheme would. That cannot be checked without the policy’s benefit, so the paragraph 22 figure is computed for an exempted establishment as well.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/edli/exemption
 */
exports.upsertExemption = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.body.establishment);
    const exempted = Boolean(req.body.exempted);

    const benefitBasis = ['FLAT', 'MULTIPLE_OF_SALARY', 'SCHEDULE'].includes(
      req.body.benefitBasis,
    )
      ? req.body.benefitBasis
      : 'FLAT';

    // An exemption with no policy behind it cannot be checked against the
    // condition it rests on, and recording it without one would make the
    // establishment look covered.
    if (
      exempted &&
      benefitBasis === 'FLAT' &&
      !(Number(req.body.flatBenefit) > 0)
    ) {
      return res.status(422).json({
        message:
          'An exemption on a flat-benefit policy needs the benefit figure. The exemption is conditional on the policy paying not less than paragraph 22 would, and without the figure that condition cannot be tested.',
      });
    }

    const exemption = await EdliExemption.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      {
        $set: {
          exempted,
          orderReference: String(req.body.orderReference || '').trim(),
          exemptedFrom: req.body.exemptedFrom
            ? new Date(req.body.exemptedFrom)
            : undefined,
          insurer: String(req.body.insurer || '').trim(),
          policyNumber: String(req.body.policyNumber || '').trim(),
          benefitBasis,
          flatBenefit: Math.max(0, Number(req.body.flatBenefit) || 0),
          salaryMultiple: Math.max(0, Number(req.body.salaryMultiple) || 0),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EDLI_EXEMPTION_RECORDED',
      resourceType: 'EdliExemption',
      resourceIds: [exemption._id],
      details: {
        establishment: establishment || '(default)',
        exempted,
        benefitBasis,
        flatBenefit: exemption.flatBenefit,
      },
      req,
    });

    return res.json({ exemption });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/edli/prior-service
 *
 * Service at another establishment. Stated rather than derived, because the
 * ₹2,50,000 floor turns on it and neither the joining date nor the attendance
 * ledger can answer it.
 */
exports.recordPriorService = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const months = Number(req.body.months);
    if (!Number.isFinite(months) || months < 0) {
      return res
        .status(400)
        .json({ message: 'months must be a non-negative number' });
    }

    const basis = Object.values(SERVICE_BASIS).includes(req.body.basis)
      ? req.body.basis
      : SERVICE_BASIS.DECLARED;

    // Anything above a declaration is a claim about a document, so the document
    // has to be identified. A passbook basis with no reference is a declaration
    // wearing a stronger label.
    if (
      basis !== SERVICE_BASIS.DECLARED &&
      !String(req.body.documentReference || '').trim()
    ) {
      return res.status(422).json({
        message:
          'A basis stronger than a declaration needs the document it rests on. Without a reference this is a declaration under a different name, and a ₹2,50,000 floor may rest on it.',
      });
    }

    const record = await EdliPriorService.create({
      tenantId: req.tenantId,
      employeeId: req.body.employeeId,
      previousEstablishment: String(
        req.body.previousEstablishment || '',
      ).trim(),
      previousEpfCode: String(req.body.previousEpfCode || '').trim(),
      months,
      gapBetween: Boolean(req.body.gapBetween),
      basis,
      documentReference: String(req.body.documentReference || '').trim(),
      recordedBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EDLI_PRIOR_SERVICE_RECORDED',
      resourceType: 'EdliPriorService',
      resourceIds: [record._id],
      details: {
        employeeId: req.body.employeeId,
        months,
        // Both in the audit line: the months decide whether the floor applies,
        // and the gap decides whether the months aggregate at all.
        gapBetween: record.gapBetween,
        basis,
      },
      req,
    });

    return res.status(201).json({ record });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/edli/preview
 *
 * Computes without committing. Read-only.
 */
exports.previewClaim = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const dateOfDeath = new Date(req.query.dateOfDeath);
    if (Number.isNaN(dateOfDeath.getTime())) {
      return res
        .status(400)
        .json({ message: 'dateOfDeath must be a valid date' });
    }

    const claim = await computeClaim({
      tenantId: req.tenantId,
      establishment: readEstablishment(req.query.establishment),
      employeeId: req.query.employeeId,
      dateOfDeath,
      monthsHere: Number(req.query.monthsHere) || undefined,
      balances: [],
    });

    return res.json({
      claim,
      note: 'The four boundaries are reported separately. A benefit sitting exactly on ₹7,00,000 is the caps meeting, not a coincidence, and a family told “seven lakh” should be able to see which limit produced it.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/edli/claims
 */
exports.listClaims = async (req, res, next) => {
  try {
    const establishment = readEstablishment(req.query.establishment);

    const claims = await EdliClaim.find({
      tenantId: req.tenantId,
      establishment,
    })
      .populate('employeeId', 'name')
      .sort({ dateOfDeath: -1 })
      .limit(200)
      .lean();

    return res.json({ establishment, claims });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/edli/claims
 *
 * Commits a claim. Refuses without a resolved payee — see the header.
 */
exports.commitClaim = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const dateOfDeath = new Date(req.body.dateOfDeath);
    if (Number.isNaN(dateOfDeath.getTime())) {
      return res
        .status(400)
        .json({ message: 'dateOfDeath must be a valid date' });
    }

    const establishment = readEstablishment(req.body.establishment);

    const claim = await computeClaim({
      tenantId: req.tenantId,
      establishment,
      employeeId: req.body.employeeId,
      dateOfDeath,
      monthsHere: Number(req.body.monthsHere) || undefined,
      balances: Array.isArray(req.body.balances) ? req.body.balances : [],
    });

    if (claim.payees.limb === PAYEE_LIMB.UNRESOLVED) {
      return res.status(422).json({
        message:
          'There is no nominee, no family and no legal heir on record. A benefit with no payee is a figure rather than a claim, and committing it would put a number in front of a family with nobody entitled to receive it.',
        benefit: claim.benefit,
      });
    }

    const record = await EdliClaim.findOneAndUpdate(
      { tenantId: req.tenantId, employeeId: req.body.employeeId, dateOfDeath },
      {
        $set: {
          establishment,
          uan: claim.member.uan,
          window: claim.wages.months,
          averageMonthlyWages: Math.round(claim.wages.average),
          averageBalance: Math.round(claim.balance.average),
          assuranceComponent: claim.assuranceComponent,
          bonusBeforeCap: claim.bonusBeforeCap,
          bonusComponent: claim.bonusComponent,
          benefit: claim.benefit,
          binding: claim.binding,
          minimumAvailable: claim.minimumAvailable,
          continuousMonths: claim.continuous.months,
          serviceBasis: claim.continuous.basis,
          payeeLimb: claim.payees.limb,
          payees: claim.payees.payees,
          exemptedPolicyBenefit: claim.exemption.policyBenefit,
          exemptedShortfall: claim.exemption.shortfall,
          rulesSnapshot: claim.rules,
          findings: claim.findings,
          filedOn: req.body.filedOn ? new Date(req.body.filedOn) : undefined,
          claimReference: String(req.body.claimReference || '').trim(),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EDLI_CLAIM_COMMITTED',
      resourceType: 'EdliClaim',
      resourceIds: [record._id],
      details: {
        employeeId: req.body.employeeId,
        dateOfDeath,
        benefit: record.benefit,
        // The boundary is on the line as well as the figure, because it says
        // whether the number came from the member's wages or from a cap.
        binding: record.binding,
        payeeLimb: record.payeeLimb,
        // Separate from the benefit, and deliberately not added to it.
        exemptedShortfall: record.exemptedShortfall,
      },
      req,
    });

    return res.status(201).json({ claim: record });
  } catch (error) {
    return next(error);
  }
};
