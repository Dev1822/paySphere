/**
 * @fileoverview Contract Labour (Regulation and Abolition) Act, 1970 (#1700).
 *
 * The controller assembles four things the engine needs and cannot fetch:
 * the contractors, the deployment months, the daily headcount series flattened
 * across every contractor, and the establishment's *own* median wage per
 * designation — which is the comparator rule 25(2)(v)(a) turns on and is the
 * only part of this that reads the employee directory.
 *
 * The parity comparator is a median rather than a mean, for the reason
 * `payEquity.js` gives: one senior operator on a legacy package drags a mean
 * far enough to make a real gap disappear.
 *
 * Everything that decides a number is in `utils/contractLabour.js`.
 */

const mongoose = require('mongoose');

const {
  ContractLabourContractor,
  ContractLabourDeployment,
  ContractLabourReturn,
} = require('../models/contractLabour.model');
const Employee = require('../models/employee.model');
const {
  REMITTANCE,
  FINDING,
  SEVERITY,
  assessEstablishment,
  annualReturnStatus,
} = require('../utils/contractLabour');
const eventBus = require('../services/event.service');

/**
 * The median of a list of numbers.
 *
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The establishment's own median wage per designation.
 *
 * The rule 25(2)(v)(a) comparator. `role` is the designation field the employee
 * directory carries, and it is compared case-insensitively against whatever the
 * contractor's register calls the same job — which will not match exactly and
 * is not expected to.
 *
 * @param {string} tenantId
 * @returns {Promise<Array<{designation: string, medianWage: number, headcount: number}>>}
 */
async function directWagesByDesignation(tenantId) {
  const employees = await Employee.find(
    { tenantId, isActive: true },
    'role monthlySalary',
  ).lean();

  const byDesignation = new Map();

  for (const employee of employees) {
    const designation = (employee.role || '').trim();
    if (!designation) continue;

    const wage = Number(employee.monthlySalary) || 0;
    if (wage <= 0) continue;

    if (!byDesignation.has(designation)) byDesignation.set(designation, []);
    byDesignation.get(designation).push(wage);
  }

  return [...byDesignation.entries()].map(([designation, wages]) => ({
    designation,
    medianWage: median(wages),
    headcount: wages.length,
  }));
}

/**
 * Everything the engine needs for an establishment, at a date.
 *
 * @param {string} tenantId
 * @param {Date} asAt
 * @returns {Promise<object>}
 */
async function assembleEstablishment(tenantId, asAt) {
  const [contractors, deployments, directWages] = await Promise.all([
    ContractLabourContractor.find({ tenantId }).lean(),
    // The trailing window plus a margin: the applicability test looks back
    // twelve months and the exposure computation wants whatever deployment
    // months exist inside it.
    ContractLabourDeployment.find({ tenantId }).sort({ month: 1 }).lean(),
    directWagesByDesignation(tenantId),
  ]);

  const deploymentsByContractor = {};
  const remittancesByContractor = {};
  const dailyHeadcounts = [];

  // Contract wages are aggregated across contractors before the parity
  // comparison rather than compared per contractor. Rule 25 asks whether a
  // contract workman doing this job is paid what a directly employed one is;
  // it does not care which contractor supplied them, and per-contractor rows
  // would report the same gap three times for a designation split across three.
  const contractWageTotals = new Map();

  for (const deployment of deployments) {
    const id = String(deployment.contractorId);

    if (!deploymentsByContractor[id]) deploymentsByContractor[id] = [];
    if (!remittancesByContractor[id]) remittancesByContractor[id] = [];

    deploymentsByContractor[id].push({
      month: deployment.month,
      workmen: deployment.workmen,
      wageBill: deployment.wageBill,
    });

    for (const remittance of deployment.remittances || []) {
      remittancesByContractor[id].push({
        month: remittance.month,
        type: remittance.type,
      });
    }

    for (const entry of deployment.dailyHeadcounts || []) {
      dailyHeadcounts.push({ date: entry.date, workmen: entry.workmen });
    }

    for (const line of deployment.designations || []) {
      const key = (line.designation || '').trim().toLowerCase();
      if (!key) continue;

      const bucket = contractWageTotals.get(key) || {
        designation: line.designation,
        workmen: 0,
        wageTotal: 0,
      };

      bucket.workmen += Number(line.workmen) || 0;
      bucket.wageTotal +=
        (Number(line.wage) || 0) * (Number(line.workmen) || 0);

      contractWageTotals.set(key, bucket);
    }
  }

  // A workman-weighted mean across contractors, which is the wage a workman at
  // that designation is actually on. An unweighted mean of contractor rates
  // would let a two-person contractor at a good rate offset a hundred-person
  // one at a poor one.
  const contractWages = [...contractWageTotals.values()].map((bucket) => ({
    designation: bucket.designation,
    workmen: bucket.workmen,
    wage: bucket.workmen > 0 ? bucket.wageTotal / bucket.workmen : 0,
  }));

  // If any deployment row records a month but no daily series, its monthly
  // headcount stands in — dated to the first of the month so it falls inside
  // the window. Better than treating the month as zero, which would tell an
  // establishment it is out of scope on the strength of missing data.
  for (const deployment of deployments) {
    const hasSeries = (deployment.dailyHeadcounts || []).length > 0;
    if (hasSeries || !deployment.month) continue;

    dailyHeadcounts.push({
      date: new Date(`${deployment.month}-01T00:00:00Z`),
      workmen: deployment.workmen,
    });
  }

  return {
    contractors,
    dailyHeadcounts,
    deploymentsByContractor,
    remittancesByContractor,
    contractWages,
    directWages,
    asAt,
  };
}

/**
 * GET /api/contract-labour/contractors
 */
exports.listContractors = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.active === 'true') filter.active = true;

    const contractors = await ContractLabourContractor.find(filter)
      .sort({ name: 1 })
      .lean();

    return res.json({ contractors });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/contract-labour/contractors
 */
exports.createContractor = async (req, res, next) => {
  try {
    const contractor = await ContractLabourContractor.create({
      tenantId: req.tenantId,
      name: req.body.name,
      vendorId: mongoose.isValidObjectId(req.body.vendorId)
        ? req.body.vendorId
        : null,
      establishment: req.body.establishment || '',
      workNature: req.body.workNature || '',
      licenceNumber: req.body.licenceNumber || '',
      licensingOfficer: req.body.licensingOfficer || '',
      licenceValidFrom: req.body.licenceValidFrom || null,
      licenceValidTo: req.body.licenceValidTo || null,
      licensedWorkmen: Number(req.body.licensedWorkmen) || 0,
      securityDeposit: Number(req.body.securityDeposit) || 0,
      notes: req.body.notes || '',
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CONTRACT_LABOUR_CONTRACTOR_REGISTERED',
      resourceType: 'ContractLabourContractor',
      resourceIds: [contractor._id],
      details: {
        name: contractor.name,
        licenceNumber: contractor.licenceNumber,
        licensedWorkmen: contractor.licensedWorkmen,
      },
      req,
    });

    return res.status(201).json({ contractor });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

/**
 * PUT /api/contract-labour/contractors/:id/licence
 *
 * Its own endpoint rather than a general contractor update. The licence is the
 * field the whole register turns on — deploying against an expired or
 * undersized one is the breach — and separating it means an audit line that
 * says "the licence changed" rather than "something changed".
 */
exports.updateLicence = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid contractor id' });
    }

    const contractor = await ContractLabourContractor.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        $set: {
          licenceNumber: req.body.licenceNumber || '',
          licensingOfficer: req.body.licensingOfficer || '',
          licenceValidFrom: req.body.licenceValidFrom || null,
          licenceValidTo: req.body.licenceValidTo || null,
          licensedWorkmen: Number(req.body.licensedWorkmen) || 0,
          securityDeposit: Number(req.body.securityDeposit) || 0,
        },
      },
      { new: true },
    );

    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CONTRACT_LABOUR_LICENCE_UPDATED',
      resourceType: 'ContractLabourContractor',
      resourceIds: [contractor._id],
      details: {
        licenceNumber: contractor.licenceNumber,
        licensedWorkmen: contractor.licensedWorkmen,
        licenceValidTo: contractor.licenceValidTo,
      },
      req,
    });

    return res.json({ contractor });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/contract-labour/deployments
 *
 * Upserted on (tenant, contractor, month). Recording April twice would double
 * the section 21 exposure for April, which is the one figure on this register
 * that has to be right.
 */
exports.recordDeployment = async (req, res, next) => {
  try {
    const { contractorId, month } = req.body;

    if (!mongoose.isValidObjectId(contractorId)) {
      return res.status(400).json({ message: 'Invalid contractor id' });
    }
    if (!/^\d{4}-\d{2}$/.test(String(month))) {
      return res.status(400).json({ message: 'month must be in YYYY-MM form' });
    }

    const contractor = await ContractLabourContractor.findOne({
      _id: contractorId,
      tenantId: req.tenantId,
    }).lean();

    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const designations = Array.isArray(req.body.designations)
      ? req.body.designations
          .filter((line) => line && line.designation)
          .map((line) => ({
            designation: String(line.designation).trim(),
            workmen: Number(line.workmen) || 0,
            wage: Number(line.wage) || 0,
          }))
      : [];

    const remittances = Array.isArray(req.body.remittances)
      ? req.body.remittances
          .filter(
            (r) => r && REMITTANCE[r.type] && /^\d{4}-\d{2}$/.test(r.month),
          )
          .map((r) => ({
            type: r.type,
            month: r.month,
            reference: r.reference || '',
            amount: Number(r.amount) || 0,
          }))
      : [];

    const dailyHeadcounts = Array.isArray(req.body.dailyHeadcounts)
      ? req.body.dailyHeadcounts
          .map((entry) => ({
            date: new Date(entry.date),
            workmen: Number(entry.workmen) || 0,
          }))
          .filter((entry) => !Number.isNaN(entry.date.getTime()))
      : [];

    const deployment = await ContractLabourDeployment.findOneAndUpdate(
      { tenantId: req.tenantId, contractorId, month },
      {
        $set: {
          tenantId: req.tenantId,
          contractorId,
          month,
          workmen:
            Number(req.body.workmen) ||
            designations.reduce((sum, line) => sum + line.workmen, 0),
          wageBill: Number(req.body.wageBill) || 0,
          designations,
          remittances,
          dailyHeadcounts,
          createdBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.status(201).json({ deployment });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

/**
 * GET /api/contract-labour/assessment
 *
 * Writes nothing. The remittance evidence arrives piecemeal through the month
 * and the position changes with every challan that lands, so this is a live
 * read rather than something committed.
 */
exports.getAssessment = async (req, res, next) => {
  try {
    const asAt = req.query.asAt ? new Date(req.query.asAt) : new Date();
    if (Number.isNaN(asAt.getTime())) {
      return res.status(400).json({ message: 'asAt must be a valid date' });
    }

    const input = await assembleEstablishment(req.tenantId, asAt);

    const returnYear =
      Number(req.query.returnYear) || asAt.getUTCFullYear() - 1;
    const filing = await ContractLabourReturn.findOne({
      tenantId: req.tenantId,
      year: returnYear,
    }).lean();

    const previous = await ContractLabourReturn.findOne({
      tenantId: req.tenantId,
    })
      .sort({ year: -1 })
      .lean();

    const assessment = assessEstablishment({
      ...input,
      // Coverage is sticky: an establishment that has ever filed a return under
      // the Act is registered under section 7, and registration does not lapse
      // because the headcount fell.
      previouslyCovered: Boolean(previous),
      returnYear,
      returnFiledOn: filing ? filing.filedOn : null,
      parityTolerance: Number(req.query.parityTolerance) || 0.05,
    });

    return res.json({
      asAt,
      assessment,
      severities: Object.values(SEVERITY),
      findingCodes: Object.values(FINDING),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/contract-labour/returns
 *
 * Records the Form XXV filing for a year, with the position as it stood when it
 * was filed. Upserted on (tenant, year) so a correction replaces the filing
 * rather than producing a second one for the same year.
 */
exports.recordReturn = async (req, res, next) => {
  try {
    const year = Number(req.body.year);
    if (!Number.isInteger(year) || year < 1971 || year > 2999) {
      return res.status(400).json({ message: 'year must be a calendar year' });
    }

    const asAt = req.body.filedOn ? new Date(req.body.filedOn) : new Date();
    if (Number.isNaN(asAt.getTime())) {
      return res.status(400).json({ message: 'filedOn must be a valid date' });
    }

    const input = await assembleEstablishment(req.tenantId, asAt);
    const assessment = assessEstablishment({ ...input, returnYear: year });

    const status = annualReturnStatus(year, asAt, asAt);

    const filing = await ContractLabourReturn.findOneAndUpdate(
      { tenantId: req.tenantId, year },
      {
        $set: {
          tenantId: req.tenantId,
          year,
          dueBy: status.dueBy,
          filedOn: asAt,
          acknowledgementRef: req.body.acknowledgementRef || '',
          exposureAtFiling: assessment.exposure,
          contractorCount: assessment.contractors.length,
          peakWorkmen: assessment.applicability.peakWorkmen,
          filedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CONTRACT_LABOUR_RETURN_FILED',
      resourceType: 'ContractLabourReturn',
      resourceIds: [filing._id],
      details: {
        year,
        filedOn: filing.filedOn,
        late: status.overdue,
        exposureAtFiling: filing.exposureAtFiling,
      },
      req,
    });

    return res.status(201).json({ return: filing, late: status.overdue });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/contract-labour/registers/:form
 *
 * Forms XII, XIII and XVII as CSV, in the prescribed column order.
 *
 * One endpoint rather than three because the three differ only in which columns
 * they select from the same assembled data, and three near-identical handlers
 * is how the column order in one of them quietly drifts.
 */
exports.exportRegister = async (req, res, next) => {
  try {
    const form = String(req.params.form || '').toUpperCase();

    const FORMS = {
      XII: 'register-of-contractors',
      XIII: 'register-of-workmen',
      XVII: 'wage-register',
    };

    if (!FORMS[form]) {
      return res.status(400).json({
        message: 'Unknown form. The registers are XII, XIII and XVII.',
      });
    }

    const [contractors, deployments] = await Promise.all([
      ContractLabourContractor.find({ tenantId: req.tenantId })
        .sort({ name: 1 })
        .lean(),
      ContractLabourDeployment.find({ tenantId: req.tenantId })
        .sort({ month: 1 })
        .lean(),
    ]);

    const byId = new Map(contractors.map((c) => [String(c._id), c]));

    // Quoted and doubled: a contractor name or a designation containing a comma
    // would otherwise shift every column after it, which is the class of bug
    // that makes a register look fine in a spreadsheet and be wrong.
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    let header;
    let rows;

    if (form === 'XII') {
      header = [
        'Name of contractor',
        'Nature of work',
        'Establishment',
        'Licence number',
        'Licensed workmen',
        'Licence valid from',
        'Licence valid to',
        'Security deposit',
      ];

      rows = contractors.map((contractor) =>
        [
          contractor.name,
          contractor.workNature,
          contractor.establishment,
          contractor.licenceNumber,
          contractor.licensedWorkmen,
          contractor.licenceValidFrom
            ? new Date(contractor.licenceValidFrom).toISOString().slice(0, 10)
            : '',
          contractor.licenceValidTo
            ? new Date(contractor.licenceValidTo).toISOString().slice(0, 10)
            : '',
          contractor.securityDeposit,
        ]
          .map(escape)
          .join(','),
      );
    } else if (form === 'XIII') {
      header = [
        'Month',
        'Name of contractor',
        'Designation',
        'Number of workmen',
        'Nature of work',
      ];

      rows = deployments.flatMap((deployment) => {
        const contractor = byId.get(String(deployment.contractorId));

        return (deployment.designations || []).map((line) =>
          [
            deployment.month,
            contractor ? contractor.name : '',
            line.designation,
            line.workmen,
            contractor ? contractor.workNature : '',
          ]
            .map(escape)
            .join(','),
        );
      });
    } else {
      header = [
        'Month',
        'Name of contractor',
        'Designation',
        'Number of workmen',
        'Monthly wage',
        'Wage bill',
        'Wages evidenced',
      ];

      rows = deployments.flatMap((deployment) => {
        const contractor = byId.get(String(deployment.contractorId));

        const wagesEvidenced = (deployment.remittances || []).some(
          (r) => r.type === REMITTANCE.WAGES && r.month === deployment.month,
        );

        return (deployment.designations || []).map((line) =>
          [
            deployment.month,
            contractor ? contractor.name : '',
            line.designation,
            line.workmen,
            line.wage,
            deployment.wageBill,
            wagesEvidenced ? 'Yes' : 'No',
          ]
            .map(escape)
            .join(','),
        );
      });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CONTRACT_LABOUR_REGISTER_EXPORTED',
      resourceType: 'ContractLabourContractor',
      resourceIds: contractors.map((c) => c._id),
      details: { form, rows: rows.length },
      req,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="form-${form.toLowerCase()}-${FORMS[form]}.csv"`,
    );

    return res.send([header.map(escape).join(','), ...rows].join('\n'));
  } catch (error) {
    return next(error);
  }
};
