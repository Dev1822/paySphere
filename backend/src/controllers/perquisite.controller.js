/**
 * @fileoverview Perquisite valuation under Rule 3 (#1770).
 *
 * Two jobs, and the second is the one with the trap in it.
 *
 * The first is assembling the Rule 3 salary. It is basic pay, dearness allowance
 * entering retirement benefits, bonus, commission and every taxable allowance —
 * and no perquisite. The exclusion is what keeps the arithmetic from feeding
 * itself, since the accommodation value is a percentage of this figure and is
 * itself a perquisite, so anything that let a perquisite back into the base
 * would compound without limit.
 *
 * The second is the house rent allowance, and it is where a naive assembly goes
 * wrong. An employee in employer-owned accommodation **cannot claim the section
 * 10(13A) exemption at all** — they pay no rent. So for them the whole of the
 * house rent allowance is taxable and the whole of it belongs in the Rule 3
 * base, which raises the accommodation perquisite, which is a further reason
 * the two cannot be computed independently. `salaryStructure.js` has no idea
 * this is true, so the decision is made here.
 *
 * Everything that values a perquisite is in `utils/perquisiteValuation.js`.
 */

const mongoose = require('mongoose');

const {
  PerquisiteRules,
  PerquisiteGrant,
  PerquisiteStatement,
} = require('../models/perquisite.model');
const Employee = require('../models/employee.model');
const SalaryStructure = require('../models/salaryStructure.model');
const { AmortizationSchedule } = require('../models/loan.model');
const { COMPONENT_TYPE } = require('../config/salaryComponents');
const {
  resolveStructureOnDate,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const {
  PERQUISITE_RULES,
  PERQUISITE_KIND,
  ACCOMMODATION_TYPE,
  valuePerquisites,
  formTwelveBaLines,
  valuePopulation,
} = require('../utils/perquisiteValuation');
const eventBus = require('../services/event.service');

const MONTHS_PER_YEAR = 12;

/**
 * Components excluded from the Rule 3 base.
 *
 * Reimbursements and the perquisites themselves. A reimbursement of an expense
 * actually incurred is not salary, and a perquisite in the base would feed the
 * accommodation value it is partly made of.
 */
const NOT_RULE_THREE_SALARY =
  /reimbursement|perquisite|perk|employer contribution/i;

/**
 * Allowances exempt under Chapter III, so outside the base — **unless** the
 * employee is in employer-owned or leased accommodation, in which case the house
 * rent allowance is fully taxable and comes back in.
 */
const HOUSE_RENT_ALLOWANCE = /house rent|^hra$/i;
const OTHER_EXEMPT = /leave travel|^lta$|children education|hostel/i;

/**
 * The previous year an accounting period falls in.
 *
 * The Indian previous year runs 1 April to 31 March, so a date in January
 * belongs to the previous year that began the preceding April — the same
 * off-by-a-year the ESI contribution period has, for the same reason.
 *
 * @param {Date} date
 * @returns {number}
 */
function previousYearFor(date) {
  const when = date instanceof Date ? date : new Date(date);
  return when.getUTCMonth() + 1 >= 4
    ? when.getUTCFullYear()
    : when.getUTCFullYear() - 1;
}

/**
 * The rules in force for a previous year, falling back to the notified figures.
 *
 * Shaped back into the engine's nested form, because the model stores them flat
 * — a Mongoose sub-document for five numbers that always move together is more
 * ceremony than it earns, and the reshaping is one place.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {number} previousYear
 * @returns {Promise<object>}
 */
async function resolveRuleSet(tenantId, previousYear) {
  const stored = await PerquisiteRules.findOne({
    tenantId,
    previousYear,
  }).lean();

  if (!stored) {
    return { ...PERQUISITE_RULES, sbiRatesByLoanClass: {}, previousYear };
  }

  return {
    ...PERQUISITE_RULES,
    ownedAccommodation: {
      highPopulation: stored.ownedHighPopulation,
      highPercent: stored.ownedHighPercent,
      midPopulation: stored.ownedMidPopulation,
      midPercent: stored.ownedMidPercent,
      lowPercent: stored.ownedLowPercent,
    },
    leasedPercent: stored.leasedPercent,
    hotelPercent: stored.hotelPercent,
    hotelExemptDays: stored.hotelExemptDays,
    furniturePercent: stored.furniturePercent,
    smallCarMonthly: stored.smallCarMonthly,
    largeCarMonthly: stored.largeCarMonthly,
    driverMonthly: stored.driverMonthly,
    loanExemptAggregate: stored.loanExemptAggregate,
    sbiRatesByLoanClass: stored.sbiRatesByLoanClass || {},
    sbiRateSource: stored.sbiRateSource || '',
    previousYear,
  };
}

/**
 * Assemble the Rule 3 salary components for an employee.
 *
 * @param {Array<object>} structures
 * @param {Date} onDate
 * @param {boolean} inEmployerAccommodation
 * @param {number} fallbackMonthly the employee's `monthlySalary`
 * @returns {Array<object>}
 */
function ruleThreeComponents(
  structures,
  onDate,
  inEmployerAccommodation,
  fallbackMonthly,
) {
  const structure = resolveStructureOnDate(structures, onDate);

  if (!structure) {
    // No structure. The whole monthly salary is the best available base, and it
    // is an over-statement rather than an under-statement — which is the safe
    // direction here, since understating it understates the tax.
    return [{ label: 'Monthly salary', amount: Number(fallbackMonthly) || 0 }];
  }

  return computeComponentAmounts(structure)
    .components.filter((component) => component.type === COMPONENT_TYPE.EARNING)
    .map((component) => {
      const label = component.label || component.code || '';
      const amount = Number(component.amount) || 0;

      if (NOT_RULE_THREE_SALARY.test(label)) {
        return { label, amount, taxable: false };
      }

      // The house rent allowance. Exempt in the ordinary case, and fully
      // taxable — so fully in the base — for somebody living in accommodation
      // the employer provides, because they pay no rent and section 10(13A)
      // has nothing to exempt.
      if (HOUSE_RENT_ALLOWANCE.test(label)) {
        return { label, amount, taxable: inEmployerAccommodation };
      }

      if (OTHER_EXEMPT.test(label)) {
        return { label, amount, taxable: false };
      }

      return { label, amount, taxable: true };
    });
}

/**
 * How many months of the previous year a grant covered.
 *
 * @param {object} grant
 * @param {number} previousYear
 * @returns {number}
 */
function monthsInYear(grant, previousYear) {
  const yearStart = new Date(Date.UTC(previousYear, 3, 1));
  const yearEnd = new Date(Date.UTC(previousYear + 1, 2, 31));

  const from = grant.providedFrom
    ? new Date(
        Math.max(new Date(grant.providedFrom).getTime(), yearStart.getTime()),
      )
    : yearStart;

  const to = grant.providedTo
    ? new Date(
        Math.min(new Date(grant.providedTo).getTime(), yearEnd.getTime()),
      )
    : yearEnd;

  if (to < from) return 0;

  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * MONTHS_PER_YEAR +
    (to.getUTCMonth() - from.getUTCMonth()) +
    1;

  return Math.max(0, Math.min(months, MONTHS_PER_YEAR));
}

/**
 * The monthly maximum outstanding balances for a loan across a previous year.
 *
 * *Maximum* outstanding, which is neither the closing balance nor the average.
 * The balance is highest at the start of a month, before that month's principal
 * is recovered, so the figure for month M is the sum of every principal
 * component still scheduled at or after M — including the one due in M itself.
 *
 * Taken from `AmortizationSchedule` rather than re-derived from the principal
 * and the tenure, because the schedule is what was actually recovered and a
 * re-derivation would silently disagree with it wherever an instalment was
 * deferred — which `loan.model.js` records as a status, and which is exactly the
 * case where the outstanding balance is higher than a formula would say.
 *
 * @param {Array<object>} schedule rows for one loan, any order
 * @param {number} previousYear
 * @returns {Array<object>}
 */
function monthlyBalancesFor(schedule, previousYear) {
  const balances = [];

  const rows = (schedule || []).map((row) => ({
    ordinal: Number(row.year) * MONTHS_PER_YEAR + Number(row.month),
    principal: Number(row.principalComponent) || 0,
  }));

  for (let offset = 0; offset < MONTHS_PER_YEAR; offset += 1) {
    const cursor = new Date(Date.UTC(previousYear, 3 + offset, 1));
    const month = cursor.getUTCMonth() + 1;
    const year = cursor.getUTCFullYear();
    const ordinal = year * MONTHS_PER_YEAR + month;

    const maximumOutstanding = rows
      .filter((row) => row.ordinal >= ordinal)
      .reduce((sum, row) => sum + row.principal, 0);

    balances.push({ month, year, maximumOutstanding });
  }

  return balances;
}

/**
 * Build the valuation input for one employee.
 *
 * @param {object} params
 * @returns {object}
 */
function buildEmployeeInput({
  employee,
  grants,
  structures,
  loans,
  previousYear,
  rules,
}) {
  const accommodationGrant = grants.find(
    (grant) => grant.kind === PERQUISITE_KIND.ACCOMMODATION,
  );

  // The decision that has to be made before the base is assembled: living in
  // employer-provided accommodation makes the house rent allowance fully
  // taxable, which raises the base, which raises the accommodation value.
  const inEmployerAccommodation = Boolean(
    accommodationGrant &&
    accommodationGrant.accommodationType !== ACCOMMODATION_TYPE.HOTEL,
  );

  const onDate = new Date(Date.UTC(previousYear, 3, 1));

  const salaryComponents = ruleThreeComponents(
    structures,
    onDate,
    inEmployerAccommodation,
    employee.monthlySalary,
  );

  const input = {
    employee: { employeeId: employee._id, name: employee.fullName },
    salaryComponents,
  };

  if (accommodationGrant) {
    input.accommodation = {
      type: accommodationGrant.accommodationType || ACCOMMODATION_TYPE.OWNED,
      population: accommodationGrant.cityPopulation,
      rentPaidByEmployer: accommodationGrant.rentPaidByEmployer,
      rentRecovered: accommodationGrant.rentRecovered,
      hotelCharge: accommodationGrant.hotelCharge,
      hotelDays: accommodationGrant.hotelDays,
      furniture: {
        cost: accommodationGrant.furnitureCost,
        hireCharges: accommodationGrant.furnitureHireCharges,
      },
      months: monthsInYear(accommodationGrant, previousYear),
    };
  }

  const carGrant = grants.find(
    (grant) => grant.kind === PERQUISITE_KIND.MOTOR_CAR,
  );

  if (carGrant) {
    input.motorCar = {
      engineLitres: carGrant.engineLitres,
      driverProvided: carGrant.driverProvided,
      employeeOwned: carGrant.employeeOwned,
      reimbursement: carGrant.reimbursement,
      months: monthsInYear(carGrant, previousYear),
    };
  }

  const loanGrants = grants.filter(
    (grant) => grant.kind === PERQUISITE_KIND.CONCESSIONAL_LOAN,
  );

  if (loanGrants.length > 0) {
    const rates = rules.sbiRatesByLoanClass || {};

    input.loans = loanGrants.map((grant) => {
      const schedule = (loans || []).filter(
        (row) => String(row.loanId) === String(grant.loanId),
      );

      return {
        balances: monthlyBalancesFor(schedule, previousYear),
        // Frozen at 1 April. Read from the rule set rather than from the loan,
        // because the loan's own rate is what the employer charged and this is
        // the rate the employer should have charged.
        sbiRatePercent:
          Number(
            rates instanceof Map
              ? rates.get(grant.loanClass)
              : rates[grant.loanClass],
          ) || 0,
        interestCharged: grant.interestChargedInYear,
        forSpecifiedMedicalTreatment: grant.forSpecifiedMedicalTreatment,
      };
    });
  }

  const esopGrants = grants.filter(
    (grant) => grant.kind === PERQUISITE_KIND.ESOP,
  );

  if (esopGrants.length > 0) {
    const yearStart = new Date(Date.UTC(previousYear, 3, 1));
    const yearEnd = new Date(Date.UTC(previousYear + 1, 2, 31));

    input.esop = {
      exercises: esopGrants.flatMap((grant) =>
        (grant.exercises || []).filter((exercise) => {
          // The perquisite arises in the year of exercise, so an exercise
          // outside the year belongs to a different statement.
          if (!exercise.exercisedOn) return true;
          const on = new Date(exercise.exercisedOn);
          return on >= yearStart && on <= yearEnd;
        }),
      ),
    };
  }

  return input;
}

/**
 * Value everybody for a previous year.
 *
 * A plain function rather than a handler the commit path calls, so the preview
 * and the committed statement cannot drift.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
async function buildStatement({ tenantId, previousYear }) {
  const rules = await resolveRuleSet(tenantId, previousYear);

  const employees = await Employee.find({ tenantId })
    .select('fullName monthlySalary')
    .lean();

  if (employees.length === 0) {
    return {
      previousYear,
      rules,
      result: valuePopulation([], { rules }),
    };
  }

  const employeeIds = employees.map((employee) => employee._id);

  const [grants, structures, loans] = await Promise.all([
    PerquisiteGrant.find({
      tenantId,
      employeeId: { $in: employeeIds },
    }).lean(),
    SalaryStructure.find({
      tenantId,
      employeeId: { $in: employeeIds },
    }).lean(),
    AmortizationSchedule.find({
      tenantId,
      employeeId: { $in: employeeIds },
    }).lean(),
  ]);

  const grantsBy = new Map();
  for (const grant of grants) {
    const key = String(grant.employeeId);
    if (!grantsBy.has(key)) grantsBy.set(key, []);
    grantsBy.get(key).push(grant);
  }

  const structuresBy = new Map();
  for (const structure of structures) {
    const key = String(structure.employeeId);
    if (!structuresBy.has(key)) structuresBy.set(key, []);
    structuresBy.get(key).push(structure);
  }

  const loansBy = new Map();
  for (const row of loans) {
    const key = String(row.employeeId);
    if (!loansBy.has(key)) loansBy.set(key, []);
    loansBy.get(key).push(row);
  }

  const inputs = employees
    .map((employee) => {
      const employeeGrants = grantsBy.get(String(employee._id)) || [];

      // Nothing to value. Skipped rather than returned as a zero, because a
      // statement listing every employee with a nil perquisite is noise on a
      // page whose subject is the handful who carry one.
      if (employeeGrants.length === 0) return null;

      return buildEmployeeInput({
        employee,
        grants: employeeGrants,
        structures: structuresBy.get(String(employee._id)) || [],
        loans: loansBy.get(String(employee._id)) || [],
        previousYear,
        rules,
      });
    })
    .filter(Boolean);

  return { previousYear, rules, result: valuePopulation(inputs, { rules }) };
}

/**
 * GET /api/perquisites/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    const previousYear =
      Number(req.query.previousYear) || previousYearFor(new Date());

    return res.json({
      rules: await resolveRuleSet(req.tenantId, previousYear),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/perquisites/rules
 *
 * Audited, and the State Bank of India rate is the reason. It is frozen for the
 * whole year and applied to every concessional loan in the establishment, so
 * recording it a point too low understates the perquisite for every borrower
 * and there is nothing in a payslip that would show it.
 */
exports.updateRules = async (req, res, next) => {
  try {
    const previousYear =
      Number(req.body.previousYear) || previousYearFor(new Date());

    const update = {};
    const numeric = [
      'ownedHighPopulation',
      'ownedHighPercent',
      'ownedMidPopulation',
      'ownedMidPercent',
      'ownedLowPercent',
      'leasedPercent',
      'hotelPercent',
      'hotelExemptDays',
      'furniturePercent',
      'smallCarMonthly',
      'largeCarMonthly',
      'driverMonthly',
      'loanExemptAggregate',
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

    if (
      req.body.sbiRatesByLoanClass &&
      typeof req.body.sbiRatesByLoanClass === 'object'
    ) {
      const rates = {};
      for (const [loanClass, rate] of Object.entries(
        req.body.sbiRatesByLoanClass,
      )) {
        const value = Number(rate);
        if (Number.isFinite(value) && value >= 0) {
          rates[String(loanClass).trim()] = value;
        }
      }
      update.sbiRatesByLoanClass = rates;
    }

    if (typeof req.body.sbiRateSource === 'string') {
      update.sbiRateSource = req.body.sbiRateSource.trim();
    }

    const rules = await PerquisiteRules.findOneAndUpdate(
      {
        previousYear
      },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PERQUISITE_RULES_UPDATED',
      resourceType: 'PerquisiteRules',
      resourceIds: [rules._id],
      details: {
        previousYear,
        ownedHighPercent: rules.ownedHighPercent,
        sbiRateClasses: [...(rules.sbiRatesByLoanClass?.keys?.() || [])],
        sbiRateSource: rules.sbiRateSource,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/perquisites/grants
 */
exports.listGrants = async (req, res, next) => {
  try {
    const filter = {};

    if (mongoose.isValidObjectId(req.query.employeeId)) {
      filter.employeeId = req.query.employeeId;
    }

    const grants = await PerquisiteGrant.find(filter)
      .populate('employeeId', 'fullName')
      .sort({ providedFrom: -1 })
      .limit(Math.min(Number(req.query.limit) || 200, 500))
      .lean();

    return res.json({ grants });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/perquisites/grants
 */
exports.createGrant = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body?.employeeId)) {
      return res.status(400).json({ message: 'A valid employee is required' });
    }

    if (!Object.values(PERQUISITE_KIND).includes(req.body?.kind)) {
      return res.status(400).json({ message: 'Unknown perquisite kind' });
    }

    if (!req.body?.providedFrom) {
      return res
        .status(400)
        .json({
          message: 'The date the perquisite was first provided is required',
        });
    }

    const grant = await PerquisiteGrant.create({
      ...req.body,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PERQUISITE_GRANT_RECORDED',
      resourceType: 'PerquisiteGrant',
      resourceIds: [grant._id],
      details: {
        employeeId: grant.employeeId,
        kind: grant.kind,
        providedFrom: grant.providedFrom,
      },
      req,
    });

    return res.status(201).json({ grant });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/perquisites/grants/:id
 */
exports.deleteGrant = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid grant id' });
    }

    const grant = await PerquisiteGrant.findOneAndDelete({
      _id: req.params.id
    });

    if (!grant) {
      return res.status(404).json({ message: 'Grant not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PERQUISITE_GRANT_REMOVED',
      resourceType: 'PerquisiteGrant',
      resourceIds: [grant._id],
      details: { employeeId: grant.employeeId, kind: grant.kind },
      req,
    });

    return res.json({ removed: true });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/perquisites/preview
 */
exports.previewStatement = async (req, res, next) => {
  try {
    const previousYear =
      Number(req.query.previousYear) || previousYearFor(new Date());

    return res.json(
      await buildStatement({
        previousYear
      }),
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/perquisites/statements
 */
exports.commitStatement = async (req, res, next) => {
  try {
    const previousYear =
      Number(req.body?.previousYear) || previousYearFor(new Date());

    const { rules, result } = await buildStatement({
      previousYear
    });

    const statement = await PerquisiteStatement.findOneAndUpdate(
      {
        previousYear
      },
      {
        $set: {
          rules,
          employeeCount: result.employeeCount,
          withPerquisites: result.withPerquisites,
          total: result.total,
          byKind: result.byKind,
          compoundingCount: result.compoundingCount,
          summary: result.summary,
          findings: result.findings.map((entry) => {
            const {
              code,
              rule,
              severity,
              message,
              employeeId,
              employeeName,
              ...context
            } = entry;

            return {
              code,
              rule,
              severity,
              message,
              employeeId,
              employeeName,
              context,
            };
          }),
          employees: result.employees.map((employee) => ({
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            ruleThreeSalary: employee.ruleThreeSalary,
            ruleThreeMonths: employee.ruleThreeMonths,
            lines: formTwelveBaLines(employee),
            total: employee.total,
            marginalAllowanceMultiplier: employee.marginalAllowanceMultiplier,
          })),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PERQUISITE_STATEMENT_COMMITTED',
      resourceType: 'PerquisiteStatement',
      resourceIds: [statement._id],
      details: {
        previousYear,
        withPerquisites: statement.withPerquisites,
        total: statement.total,
        compoundingCount: statement.compoundingCount,
      },
      req,
    });

    return res.status(201).json({ statement });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/perquisites/statements
 */
exports.listStatements = async (req, res, next) => {
  try {
    const statements = await PerquisiteStatement.find(
      {},
      '-findings -employees',
    )
      .sort({ previousYear: -1 })
      .limit(Math.min(Number(req.query.limit) || 12, 30))
      .lean();

    return res.json({ statements });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/perquisites/employees/:employeeId
 *
 * One employee's Form 12BA lines, with the basis of each.
 *
 * The form asks for the value and the basis, which is why a bare total would not
 * do — and it is the endpoint `tdsEngine.utils.js` should read so the figure it
 * withholds on is traceable to the sub-rule that produced it.
 */
exports.getEmployeeStatement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const previousYear =
      Number(req.query.previousYear) || previousYearFor(new Date());

    const employee = await Employee.findOne({
      _id: req.params.employeeId
    })
      .select('fullName monthlySalary')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const rules = await resolveRuleSet(req.tenantId, previousYear);

    const [grants, structures, loans] = await Promise.all([
      PerquisiteGrant.find({
        employeeId: employee._id
      }).lean(),
      SalaryStructure.find({
        employeeId: employee._id
      }).lean(),
      AmortizationSchedule.find({
        employeeId: employee._id
      }).lean(),
    ]);

    const valuation = valuePerquisites({
      ...buildEmployeeInput({
        employee,
        grants,
        structures,
        loans,
        previousYear,
        rules,
      }),
      rules,
    });

    return res.json({
      previousYear,
      employee: { _id: employee._id, fullName: employee.fullName },
      valuation,
      lines: formTwelveBaLines(valuation),
    });
  } catch (error) {
    return next(error);
  }
};

exports.buildStatement = buildStatement;
exports.resolveRuleSet = resolveRuleSet;
exports.ruleThreeComponents = ruleThreeComponents;
exports.previousYearFor = previousYearFor;
exports.monthsInYear = monthsInYear;
