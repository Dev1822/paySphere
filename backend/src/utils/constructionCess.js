/**
 * Building and Other Construction Workers' Welfare Cess Act, 1996, with the
 * BOCW Act, 1996 (#1827).
 *
 * Every statutory levy in the product is a function of wages. Provident fund is
 * a percentage of basic, ESI of gross, the Labour Welfare Fund of a slab read
 * off a wage, bonus of an allocable surplus that starts from a wage bill.
 * `journalGenerator.js` posts all of them the same way for that reason.
 *
 * This one is one per cent of the **cost of construction**, which has no
 * relationship to the payroll at all. Forty workers on a ₹90 crore job and
 * forty on a ₹4 crore job carry the same wage bill and cess differing by a
 * factor of twenty-two. There is nowhere in a wage-based compliance tree to put
 * that, which is why the project rather than the employee is the unit here.
 *
 * Three things follow from the base being a project number:
 *
 *   - **The exclusions are the argument.** Section 3 excludes the cost of land
 *     and any compensation paid under the Employees' Compensation Act. On a
 *     real-estate project the land is frequently the larger half, so getting it
 *     wrong overstates the cess by more than the cess itself. `costOfConstruction`
 *     therefore returns what it took out alongside what it left in — an
 *     assessment order argues about exactly those lines.
 *
 *   - **What is deducted is an advance.** Rule 4 deducts one per cent at source
 *     from a contractor's bills; section 5 assesses the number afterwards. The
 *     difference is a refund or a demand, and a module that only tracked
 *     remittances could not produce the reconciliation the order is checked
 *     against.
 *
 *   - **Interest accrues and the penalty does not.** Section 8 interest runs at
 *     two per cent a month from the due date, which is arithmetic. The section 9
 *     penalty may extend to the amount of the cess and is discretionary, so it
 *     is reported as a ceiling. Accruing it would misstate the liability by
 *     asserting a decision nobody has made.
 *
 * Pure functions, no database access.
 */

const MONTH_MS = 30 * 86400000;

/**
 * The notified figures, as the default rule set.
 *
 * The Act permits a rate between one and two per cent and the notified figure
 * has been one — so the rule set holds a value that is presently constant and
 * is not a constant, which is exactly the case a rule set is for.
 */
const CESS_RULES = {
  /** Section 3 — the notified rate, inside the band below. */
  cessRatePercent: 1,
  /** Section 3(1) — the floor the Act permits. */
  minRatePercent: 1,
  /** And the ceiling. */
  maxRatePercent: 2,
  /** Rule 4(1) — deducted at source from a contractor's bill. */
  advanceDeductionPercent: 1,
  /** Rule 5 — days from completion or assessment to pay. */
  paymentWindowDays: 30,
  /** Section 8 — interest on a delayed payment, per month. */
  interestPercentPerMonth: 2,
  /** Section 9 — the penalty may extend to the cess itself. */
  penaltyCeilingPercent: 100,
  /** Section 1(4) of the BOCW Act — building workers. */
  applicabilityWorkers: 10,
  /** Section 12 — the beneficiary age band. */
  beneficiaryMinAge: 18,
  beneficiaryMaxAge: 60,
  /** Section 12 — days of construction work in the lookback. */
  beneficiaryQualifyingDays: 90,
  beneficiaryLookbackMonths: 12,
};

/**
 * What section 3 takes out of the project cost.
 *
 * Named rather than netted, because the exclusions are what an assessment order
 * argues about — and a caller handed only the net base has no way to show its
 * working.
 */
const EXCLUSION = {
  /** The one that gets missed, and the larger half on a real-estate project. */
  LAND: 'LAND',
  /** Section 3 — compensation under the Employees' Compensation Act. */
  EMPLOYEE_COMPENSATION: 'EMPLOYEE_COMPENSATION',
  /** Anything a rule set or an order allows. */
  OTHER: 'OTHER',
};

const EXCLUSION_LABEL = {
  [EXCLUSION.LAND]: 'Cost of land',
  [EXCLUSION.EMPLOYEE_COMPENSATION]:
    'Compensation under the Employees’ Compensation Act',
  [EXCLUSION.OTHER]: 'Other excluded cost',
};

/** Where a project's cess stands against its assessment. */
const CESS_STATUS = {
  /** Deductions are accumulating and nothing has been assessed. */
  ADVANCE_ACCRUING: 'ADVANCE_ACCRUING',
  /** Assessed, and the advance covered it. */
  SETTLED: 'SETTLED',
  /** Assessed, and more is owed. */
  DEMAND: 'DEMAND',
  /** Assessed, and too much was deducted. */
  REFUND_DUE: 'REFUND_DUE',
};

const FINDING = {
  RATE_OUTSIDE_BAND: 'RATE_OUTSIDE_BAND',
  LAND_NOT_EXCLUDED: 'LAND_NOT_EXCLUDED',
  ADVANCE_SHORT_DEDUCTED: 'ADVANCE_SHORT_DEDUCTED',
  CESS_OVERDUE: 'CESS_OVERDUE',
  DEMAND_OUTSTANDING: 'DEMAND_OUTSTANDING',
  REFUND_DUE: 'REFUND_DUE',
  PENALTY_EXPOSURE: 'PENALTY_EXPOSURE',
  BENEFICIARY_UNREGISTERED: 'BENEFICIARY_UNREGISTERED',
  BENEFICIARY_DAYS_UNRECORDED: 'BENEFICIARY_DAYS_UNRECORDED',
  BENEFICIARY_OUT_OF_AGE_BAND: 'BENEFICIARY_OUT_OF_AGE_BAND',
  REGISTRATION_REQUIRED: 'REGISTRATION_REQUIRED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

const FINDING_SECTION = {
  [FINDING.RATE_OUTSIDE_BAND]: 'Cess Act section 3(1)',
  [FINDING.LAND_NOT_EXCLUDED]: 'Cess Act section 3(1)',
  [FINDING.ADVANCE_SHORT_DEDUCTED]: 'Cess Rules, rule 4(1)',
  [FINDING.CESS_OVERDUE]: 'Cess Act section 8',
  [FINDING.DEMAND_OUTSTANDING]: 'Cess Act section 5',
  [FINDING.REFUND_DUE]: 'Cess Act section 5',
  [FINDING.PENALTY_EXPOSURE]: 'Cess Act section 9',
  [FINDING.BENEFICIARY_UNREGISTERED]: 'BOCW Act section 12',
  [FINDING.BENEFICIARY_DAYS_UNRECORDED]: 'BOCW Act section 12',
  [FINDING.BENEFICIARY_OUT_OF_AGE_BAND]: 'BOCW Act section 12',
  [FINDING.REGISTRATION_REQUIRED]: 'BOCW Act section 7',
  [FINDING.NOT_APPLICABLE]: 'BOCW Act section 1(4)',
};

const SEVERITY = {
  BREACH: 'BREACH',
  EXPOSURE: 'EXPOSURE',
  INFORMATIONAL: 'INFORMATIONAL',
};

/**
 * @param {*} value
 * @returns {number}
 */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

/**
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Merge a rule set over the notified figures.
 *
 * @param {object} [rules]
 * @returns {object}
 */
function resolveRules(rules) {
  const merged = { ...CESS_RULES, ...(rules || {}) };

  if (!(merged.cessRatePercent > 0)) {
    merged.cessRatePercent = CESS_RULES.cessRatePercent;
  }
  if (!(merged.beneficiaryLookbackMonths > 0)) {
    merged.beneficiaryLookbackMonths = CESS_RULES.beneficiaryLookbackMonths;
  }

  return merged;
}

/**
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function finding(code, severity, message, context = {}) {
  return {
    code,
    section: FINDING_SECTION[code] || '',
    severity,
    message,
    ...context,
  };
}

/**
 * Section 3 — the base the cess is charged on, and what came out of it.
 *
 * Both halves are returned. The exclusions are the part an assessment order
 * argues about, and a caller handed only the net figure cannot show its
 * working — nor notice that nobody excluded the land.
 *
 * @param {object} params
 * @param {number} params.totalProjectCost
 * @param {Array<object>} [params.exclusions]
 * @returns {object}
 */
function costOfConstruction({ totalProjectCost, exclusions = [] }) {
  const total = Math.max(0, toNumber(totalProjectCost));

  const rows = [];
  let excluded = 0;

  for (const entry of Array.isArray(exclusions) ? exclusions : []) {
    if (!Object.hasOwn(EXCLUSION_LABEL, entry?.kind)) continue;

    const amount = Math.max(0, toNumber(entry?.amount));
    excluded += amount;

    rows.push({
      kind: entry.kind,
      label: EXCLUSION_LABEL[entry.kind],
      amount: round2(amount),
      note: typeof entry?.note === 'string' ? entry.note : '',
    });
  }

  const findings = [];

  // Reported rather than assumed. A project with no land line is either a
  // contract on somebody else's land — common and correct — or an assessment
  // about to be made on a base that includes it.
  const landExcluded = rows.some((row) => row.kind === EXCLUSION.LAND);
  if (!landExcluded) {
    findings.push(
      finding(
        FINDING.LAND_NOT_EXCLUDED,
        SEVERITY.INFORMATIONAL,
        'No land cost has been excluded. Section 3 excludes it, and on a project where the land was bought it is frequently the larger half of the total.',
        {},
      ),
    );
  }

  // Excluding more than the project cost would produce a negative base and a
  // negative cess, which reads as a credit rather than as bad data.
  const base = Math.max(0, total - excluded);

  return {
    totalProjectCost: round2(total),
    exclusions: rows,
    excluded: round2(excluded),
    base: round2(base),
    landExcluded,
    findings,
  };
}

/**
 * Section 3 — the cess on that base.
 *
 * @param {number} base
 * @param {object} [rules]
 * @returns {object}
 */
function assessCess(base, rules) {
  const resolved = resolveRules(rules);
  const findings = [];

  let rate = resolved.cessRatePercent;

  if (rate < resolved.minRatePercent || rate > resolved.maxRatePercent) {
    findings.push(
      finding(
        FINDING.RATE_OUTSIDE_BAND,
        SEVERITY.BREACH,
        `The rule set carries ${rate}%, outside the ${resolved.minRatePercent}–${resolved.maxRatePercent}% section 3(1) permits. Assessing at ${resolved.minRatePercent}%.`,
        { rate, min: resolved.minRatePercent, max: resolved.maxRatePercent },
      ),
    );

    // Clamped rather than trusted. An out-of-band rate in a stored rule set
    // would otherwise produce an assessment the Act could not support, and the
    // finding alone would not stop the number being used.
    rate = Math.min(
      Math.max(rate, resolved.minRatePercent),
      resolved.maxRatePercent,
    );
  }

  const amount = round2((Math.max(0, toNumber(base)) * rate) / 100);

  return { base: round2(base), rate, assessed: amount, findings };
}

/**
 * Rule 4(1) — the one per cent deducted at source from a contractor's bills.
 *
 * An advance, not a payment. The whole point of tracking it separately is that
 * section 5 assesses the cess afterwards and the difference is a refund or a
 * demand — netting the two at the point of deduction would lose the
 * reconciliation the assessment order is checked against.
 *
 * @param {Array<object>} bills
 * @param {object} [rules]
 * @returns {object}
 */
function advanceCess(bills, rules) {
  const resolved = resolveRules(rules);

  const rows = [];
  const findings = [];

  let grossBilled = 0;
  let deducted = 0;
  let expected = 0;

  for (const bill of Array.isArray(bills) ? bills : []) {
    const amount = Math.max(0, toNumber(bill?.amount));
    const withheld = Math.max(0, toNumber(bill?.cessDeducted));
    const due = round2((amount * resolved.advanceDeductionPercent) / 100);

    grossBilled += amount;
    deducted += withheld;
    expected += due;

    const shortfall = round2(Math.max(0, due - withheld));

    rows.push({
      billId: bill?.billId || null,
      contractorName: bill?.contractorName || '',
      billedOn: toDate(bill?.billedOn),
      amount: round2(amount),
      expected: due,
      deducted: round2(withheld),
      shortfall,
    });

    if (shortfall > 0.005) {
      findings.push(
        finding(
          FINDING.ADVANCE_SHORT_DEDUCTED,
          SEVERITY.BREACH,
          `₹${round2(amount)} was billed and ₹${round2(withheld)} deducted against the ₹${due} rule 4 requires.`,
          {
            billId: bill?.billId || null,
            contractorName: bill?.contractorName || '',
            shortfall,
          },
        ),
      );
    }
  }

  return {
    bills: rows,
    grossBilled: round2(grossBilled),
    expected: round2(expected),
    deducted: round2(deducted),
    shortfall: round2(Math.max(0, expected - deducted)),
    findings,
  };
}

/**
 * Section 8 — interest on cess not paid within the window.
 *
 * Two per cent a month, so a cess unpaid for a year has grown by twenty-four
 * per cent before anybody considers the penalty. Simple rather than compounded:
 * section 8 says interest at two per cent for every month or part of a month,
 * which is a rate on the principal and not a balance that rolls up.
 *
 * A part month counts as a month, which is the Act's wording and also the
 * direction the arithmetic should err in.
 *
 * @param {object} params
 * @param {number} params.outstanding
 * @param {Date|string} params.dueOn
 * @param {Date|string} [params.asAt]
 * @param {object} [rules]
 * @returns {object}
 */
function interestOn({ outstanding, dueOn, asAt }, rules) {
  const resolved = resolveRules(rules);

  const principal = Math.max(0, toNumber(outstanding));
  const due = toDate(dueOn);
  const at = toDate(asAt) || new Date();

  if (!due || principal <= 0 || at <= due) {
    return {
      principal: round2(principal),
      months: 0,
      rate: resolved.interestPercentPerMonth,
      interest: 0,
    };
  }

  // Every month or part of a month.
  const months = Math.ceil((at.getTime() - due.getTime()) / MONTH_MS);

  return {
    principal: round2(principal),
    months,
    rate: resolved.interestPercentPerMonth,
    interest: round2(
      (principal * resolved.interestPercentPerMonth * months) / 100,
    ),
    dueOn: due,
    asAt: at,
  };
}

/**
 * Section 9 — the penalty, as a ceiling.
 *
 * Deliberately not an accrual. The penalty *may* extend to the amount of the
 * cess and is imposed by an order; accruing it would assert a decision nobody
 * has made and overstate the liability by up to its whole size. Reported so the
 * exposure is visible, and kept out of the payable figure.
 *
 * @param {number} assessed
 * @param {object} [rules]
 * @returns {number}
 */
function penaltyCeiling(assessed, rules) {
  const resolved = resolveRules(rules);
  return round2(
    (Math.max(0, toNumber(assessed)) * resolved.penaltyCeilingPercent) / 100,
  );
}

/**
 * A project's cess position, end to end.
 *
 * @param {object} project
 * @param {object} [rules]
 * @returns {object}
 */
function assessProject(project, rules) {
  const resolved = resolveRules(rules);

  const cost = costOfConstruction({
    totalProjectCost: project?.totalProjectCost,
    exclusions: project?.exclusions,
  });

  const cess = assessCess(cost.base, resolved);
  const advance = advanceCess(project?.bills, resolved);

  const findings = [...cost.findings, ...cess.findings, ...advance.findings];

  const paid = Math.max(0, toNumber(project?.cessPaid));
  const settled = round2(advance.deducted + paid);

  const assessedOn = toDate(project?.assessedOn);
  const completedOn = toDate(project?.completedOn);
  const asAt = toDate(project?.asAt) || new Date();

  // Rule 5 runs the window from completion or from the assessment, whichever
  // has happened. Before either, the deductions are simply accruing and nothing
  // is late — reporting an overdue amount then would be reporting a breach that
  // has not arisen.
  const windowStart = assessedOn || completedOn || null;
  const dueOn = windowStart
    ? new Date(windowStart.getTime() + resolved.paymentWindowDays * 86400000)
    : null;

  const net = round2(cess.assessed - settled);

  let status;
  if (!windowStart) {
    status = CESS_STATUS.ADVANCE_ACCRUING;
  } else if (net > 0.005) {
    status = CESS_STATUS.DEMAND;
  } else if (net < -0.005) {
    status = CESS_STATUS.REFUND_DUE;
  } else {
    status = CESS_STATUS.SETTLED;
  }

  const outstanding = Math.max(0, net);
  const interest =
    dueOn && outstanding > 0
      ? interestOn({ outstanding, dueOn, asAt }, resolved)
      : {
          principal: outstanding,
          months: 0,
          rate: resolved.interestPercentPerMonth,
          interest: 0,
        };

  if (status === CESS_STATUS.DEMAND) {
    findings.push(
      finding(
        FINDING.DEMAND_OUTSTANDING,
        SEVERITY.BREACH,
        `₹${round2(cess.assessed)} was assessed against ₹${settled} deducted and paid, leaving ₹${round2(outstanding)}.`,
        { assessed: cess.assessed, settled, outstanding: round2(outstanding) },
      ),
    );

    if (interest.months > 0) {
      findings.push(
        finding(
          FINDING.CESS_OVERDUE,
          SEVERITY.BREACH,
          `${interest.months} months past the ${resolved.paymentWindowDays}-day window, carrying ₹${interest.interest} of section 8 interest at ${interest.rate}% a month.`,
          { months: interest.months, interest: interest.interest },
        ),
      );
    }

    findings.push(
      finding(
        FINDING.PENALTY_EXPOSURE,
        SEVERITY.EXPOSURE,
        `Section 9 permits a penalty of up to ₹${penaltyCeiling(cess.assessed, resolved)}. It is discretionary and imposed by order, so it is not accrued here.`,
        { ceiling: penaltyCeiling(cess.assessed, resolved) },
      ),
    );
  }

  if (status === CESS_STATUS.REFUND_DUE) {
    findings.push(
      finding(
        FINDING.REFUND_DUE,
        SEVERITY.INFORMATIONAL,
        `₹${round2(-net)} more was deducted at source than the assessment came to.`,
        { refund: round2(-net) },
      ),
    );
  }

  return {
    projectId: project?.projectId || null,
    name: project?.name || '',
    cost,
    rate: cess.rate,
    assessed: cess.assessed,
    advance,
    cessPaid: round2(paid),
    settled,
    status,
    net,
    outstanding: round2(outstanding),
    dueOn,
    interest,
    /** A ceiling, not part of what is payable. */
    penaltyCeiling: penaltyCeiling(cess.assessed, resolved),
    /** What to remit today: the demand and the interest that has run on it. */
    payable: round2(outstanding + interest.interest),
    findings: findings.map((entry) => ({
      ...entry,
      projectId: project?.projectId || null,
      projectName: project?.name || '',
    })),
  };
}

/**
 * Section 12 of the BOCW Act — whether a worker can register as a beneficiary.
 *
 * Ninety days of construction work in the preceding twelve months, aged
 * eighteen to sixty. The ninety days are **across employers**, which is why the
 * days are taken as a recorded input rather than derived from one
 * establishment's attendance ledger: deriving them would systematically
 * under-report eligibility for exactly the itinerant worker the Board's
 * registration exists to protect, and would do so silently.
 *
 * @param {object} worker
 * @param {object} [rules]
 * @returns {object}
 */
function beneficiaryEligibility(worker, rules) {
  const resolved = resolveRules(rules);

  const asAt = toDate(worker?.asAt) || new Date();
  const dob = toDate(worker?.dateOfBirth);

  const findings = [];

  const contributions = Array.isArray(worker?.daysByEmployer)
    ? worker.daysByEmployer
    : [];

  const daysThisEstablishment = contributions
    .filter((row) => row?.thisEstablishment === true)
    .reduce((sum, row) => sum + Math.max(0, toNumber(row?.days)), 0);

  const daysTotal = contributions.reduce(
    (sum, row) => sum + Math.max(0, toNumber(row?.days)),
    0,
  );

  let age = null;
  if (dob) {
    age = Math.floor((asAt.getTime() - dob.getTime()) / (365.25 * 86400000));
  }

  const inAgeBand =
    age !== null &&
    age >= resolved.beneficiaryMinAge &&
    age <= resolved.beneficiaryMaxAge;

  const daysMet = daysTotal >= resolved.beneficiaryQualifyingDays;
  const eligible = inAgeBand && daysMet;
  const registered = worker?.registeredOn ? true : false;

  if (age !== null && !inAgeBand) {
    findings.push(
      finding(
        FINDING.BENEFICIARY_OUT_OF_AGE_BAND,
        SEVERITY.INFORMATIONAL,
        `Aged ${age}, outside the ${resolved.beneficiaryMinAge}–${resolved.beneficiaryMaxAge} band section 12 sets.`,
        { age },
      ),
    );
  }

  // The case the module is careful about: this establishment's own days fall
  // short, but the worker may well have the ninety across employers and nobody
  // has asked. Silence here would read as ineligible.
  if (
    !daysMet &&
    inAgeBand &&
    contributions.every((row) => row?.thisEstablishment === true)
  ) {
    findings.push(
      finding(
        FINDING.BENEFICIARY_DAYS_UNRECORDED,
        SEVERITY.INFORMATIONAL,
        `${daysTotal} days are recorded, all of them here. The ninety are counted across every construction employer in the preceding ${resolved.beneficiaryLookbackMonths} months, so this is not a finding that the worker is ineligible.`,
        { daysTotal, daysThisEstablishment },
      ),
    );
  }

  if (eligible && !registered) {
    findings.push(
      finding(
        FINDING.BENEFICIARY_UNREGISTERED,
        SEVERITY.BREACH,
        `${daysTotal} days across ${contributions.length} employer(s) and aged ${age} — entitled to register, and not registered.`,
        { daysTotal, age },
      ),
    );
  }

  return {
    workerId: worker?.workerId || null,
    name: worker?.name || '',
    age,
    inAgeBand,
    daysTotal,
    daysThisEstablishment,
    /** How much of the ninety came from somewhere else. */
    daysElsewhere: Math.max(0, daysTotal - daysThisEstablishment),
    employerCount: contributions.length,
    qualifyingDays: resolved.beneficiaryQualifyingDays,
    daysMet,
    inAgeBandAndDaysMet: eligible,
    eligible,
    registered,
    registeredOn: toDate(worker?.registeredOn),
    findings: findings.map((entry) => ({
      ...entry,
      workerId: worker?.workerId || null,
      workerName: worker?.name || '',
    })),
  };
}

/**
 * Section 1(4) of the BOCW Act — whether the Act applies at all.
 *
 * Ten building workers, which is neither the Contract Labour Act's twenty nor
 * the Apprentices Act's thirty. Reported next to both, because three different
 * thresholds shown together is the only way anybody notices an establishment
 * sits between them.
 *
 * @param {object} params
 * @param {object} [rules]
 * @returns {object}
 */
function assessApplicability({ buildingWorkers, registered = false }, rules) {
  const resolved = resolveRules(rules);

  const workers = Math.max(0, toNumber(buildingWorkers));
  const findings = [];
  const applicable = workers >= resolved.applicabilityWorkers;

  if (!applicable) {
    findings.push(
      finding(
        FINDING.NOT_APPLICABLE,
        SEVERITY.INFORMATIONAL,
        `${workers} building workers. The BOCW Act starts at ${resolved.applicabilityWorkers}.`,
        { buildingWorkers: workers, threshold: resolved.applicabilityWorkers },
      ),
    );
  } else if (!registered) {
    findings.push(
      finding(
        FINDING.REGISTRATION_REQUIRED,
        SEVERITY.BREACH,
        `${workers} building workers are engaged and the establishment is not registered under section 7.`,
        { buildingWorkers: workers, threshold: resolved.applicabilityWorkers },
      ),
    );
  }

  return {
    applicable,
    buildingWorkers: workers,
    threshold: resolved.applicabilityWorkers,
    /** Shown beside it, so the three thresholds are visibly different numbers. */
    contractLabourThreshold: 20,
    apprenticesActThreshold: 30,
    registered: registered === true,
    findings,
  };
}

/**
 * The establishment: every project, and the beneficiary register.
 *
 * @param {object} params
 * @returns {object}
 */
function assessEstablishment({
  projects = [],
  workers = [],
  applicability = {},
  rules,
} = {}) {
  const resolved = resolveRules(rules);

  const gate = assessApplicability(
    {
      buildingWorkers:
        applicability?.buildingWorkers !== undefined
          ? applicability.buildingWorkers
          : workers.length,
      registered: applicability?.registered,
    },
    resolved,
  );

  const assessedProjects = projects.map((project) =>
    assessProject(project, resolved),
  );
  const assessedWorkers = workers.map((worker) =>
    beneficiaryEligibility(worker, resolved),
  );

  const findings = [
    ...gate.findings,
    ...assessedProjects.flatMap((row) => row.findings),
    ...assessedWorkers.flatMap((row) => row.findings),
  ];

  const summary = new Map();
  for (const entry of findings) {
    const bucket = summary.get(entry.code) || {
      code: entry.code,
      section: entry.section,
      severity: entry.severity,
      count: 0,
      subjects: new Set(),
    };

    bucket.count += 1;
    if (entry.projectId) bucket.subjects.add(`p:${entry.projectId}`);
    if (entry.workerId) bucket.subjects.add(`w:${entry.workerId}`);
    summary.set(entry.code, bucket);
  }

  const sum = (rows, pick) =>
    round2(rows.reduce((total, row) => total + pick(row), 0));

  return {
    applicable: gate.applicable,
    applicability: gate,

    projectCount: assessedProjects.length,
    totalProjectCost: sum(assessedProjects, (row) => row.cost.totalProjectCost),
    excluded: sum(assessedProjects, (row) => row.cost.excluded),
    base: sum(assessedProjects, (row) => row.cost.base),
    assessed: sum(assessedProjects, (row) => row.assessed),
    advanceDeducted: sum(assessedProjects, (row) => row.advance.deducted),
    cessPaid: sum(assessedProjects, (row) => row.cessPaid),
    outstanding: sum(assessedProjects, (row) => row.outstanding),
    interest: sum(assessedProjects, (row) => row.interest.interest),
    payable: sum(assessedProjects, (row) => row.payable),
    /** Never added into `payable` — it is discretionary and imposed by order. */
    penaltyCeiling: sum(assessedProjects, (row) => row.penaltyCeiling),
    refundDue: sum(assessedProjects, (row) => Math.max(0, -row.net)),

    beneficiaryCount: assessedWorkers.length,
    eligibleCount: assessedWorkers.filter((row) => row.eligible).length,
    registeredCount: assessedWorkers.filter((row) => row.registered).length,
    /**
     * Workers who reached ninety days only by counting work done elsewhere.
     *
     * The number that says whether the register is being kept honestly: an
     * establishment deriving eligibility from its own attendance would report
     * zero here and be wrong about every one of them.
     */
    qualifiedElsewhereCount: assessedWorkers.filter(
      (row) => row.eligible && row.daysElsewhere > 0,
    ).length,

    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      subjectCount: bucket.subjects.size,
    })),
    projects: assessedProjects,
    workers: assessedWorkers,
  };
}

module.exports = {
  CESS_RULES,
  EXCLUSION,
  EXCLUSION_LABEL,
  CESS_STATUS,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  resolveRules,
  costOfConstruction,
  assessCess,
  advanceCess,
  interestOn,
  penaltyCeiling,
  assessProject,
  beneficiaryEligibility,
  assessApplicability,
  assessEstablishment,
};
