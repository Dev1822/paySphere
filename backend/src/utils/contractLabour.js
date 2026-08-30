/**
 * Contract Labour (Regulation and Abolition) Act, 1970 (#1700).
 *
 * `EnterpriseContractorService` and `ContractorDisbursementService` model a
 * contractor the way finance sees one: a vendor, an invoice, a TDS deduction, a
 * payment. That is correct as far as it goes and it stops exactly where this
 * Act starts, because the Act is not about the contractor. It is about the
 * **principal employer's liability for the contractor's workmen**, and the unit
 * of that liability is the workman — of whom there may be four hundred behind
 * one vendor row.
 *
 * Four things follow that a vendor ledger cannot express:
 *
 *   - applicability is a *maximum over a trailing twelve months*, not a current
 *     headcount;
 *   - a licence authorises a stated number of workmen and expires;
 *   - section 21 makes the principal employer liable for wages the contractor
 *     failed to pay, automatically and without being invoked;
 *   - Rule 25(2)(v)(a) entitles a contract workman doing the same work as a
 *     directly employed one to the same wages.
 *
 * Pure functions, no database access.
 */

/**
 * Section 1(4): twenty or more workmen employed as contract labour on any day
 * of the preceding twelve months.
 *
 * The Occupational Safety, Health and Working Conditions Code, 2020 subsumes
 * this Act and raises the threshold to fifty. Its rules are not notified in most
 * states and the 1970 Act remains in force, so the successor sits beside the
 * operative figure rather than replacing it — when the Code is notified this is
 * one line rather than a search.
 */
const APPLICABILITY_THRESHOLD = 20;
const OSH_CODE_THRESHOLD = 50;

/** Section 12: a contractor supplying this many workmen needs a licence. */
const LICENCE_THRESHOLD = 20;

/** The trailing window the applicability test looks back over. */
const LOOKBACK_MONTHS = 12;

/**
 * How long before a licence expires it should be surfaced.
 *
 * Renewal under rule 29 has to be applied for thirty days before expiry, so a
 * warning that arrives on the expiry date arrives thirty days late.
 */
const LICENCE_RENEWAL_NOTICE_DAYS = 60;

/** Rule 82: the annual return in Form XXV, due by 15 February. */
const ANNUAL_RETURN_MONTH = 2;
const ANNUAL_RETURN_DAY = 15;

/** The statutory remittances a contractor has to evidence, month by month. */
const REMITTANCE = {
  WAGES: 'WAGES',
  PROVIDENT_FUND: 'PROVIDENT_FUND',
  ESI: 'ESI',
};

/** What a compliance finding is about. */
const FINDING = {
  UNLICENSED: 'UNLICENSED',
  LICENCE_EXPIRED: 'LICENCE_EXPIRED',
  LICENCE_EXPIRING: 'LICENCE_EXPIRING',
  LICENCE_CAPACITY_EXCEEDED: 'LICENCE_CAPACITY_EXCEEDED',
  WAGES_UNEVIDENCED: 'WAGES_UNEVIDENCED',
  PF_UNEVIDENCED: 'PF_UNEVIDENCED',
  ESI_UNEVIDENCED: 'ESI_UNEVIDENCED',
  WAGE_PARITY_GAP: 'WAGE_PARITY_GAP',
  RETURN_OVERDUE: 'RETURN_OVERDUE',
};

/**
 * How much attention a finding deserves.
 *
 * `EXPOSURE` is its own level rather than a flavour of `HIGH` because it is the
 * only one with a rupee figure attached — it is money the principal employer may
 * have to find, as opposed to a register that is out of order.
 */
const SEVERITY = {
  EXPOSURE: 'EXPOSURE',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

const FINDING_SEVERITY = {
  [FINDING.UNLICENSED]: SEVERITY.HIGH,
  [FINDING.LICENCE_EXPIRED]: SEVERITY.HIGH,
  [FINDING.LICENCE_EXPIRING]: SEVERITY.LOW,
  [FINDING.LICENCE_CAPACITY_EXCEEDED]: SEVERITY.MEDIUM,
  [FINDING.WAGES_UNEVIDENCED]: SEVERITY.EXPOSURE,
  [FINDING.PF_UNEVIDENCED]: SEVERITY.MEDIUM,
  [FINDING.ESI_UNEVIDENCED]: SEVERITY.MEDIUM,
  [FINDING.WAGE_PARITY_GAP]: SEVERITY.MEDIUM,
  [FINDING.RETURN_OVERDUE]: SEVERITY.MEDIUM,
};

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

/**
 * @param {*} value
 * @returns {number}
 */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * A `YYYY-MM` key, so months compare and sort as strings.
 *
 * @param {Date|string} value
 * @returns {string}
 */
function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Whether the Act applies to the establishment.
 *
 * The test is the **maximum** daily headcount over the trailing twelve months,
 * not the current one and not an average. An establishment that peaked at
 * twenty-three contract workmen for a fortnight in March is covered for the
 * whole year, and a naive "how many do we have now" check tells it the
 * opposite — which is the direction that ends in a prosecution.
 *
 * Sticky once it has applied, for the same reason the Payment of Bonus Act's
 * section 1(5) makes coverage sticky: an establishment that shrinks back below
 * the threshold does not stop being registered under section 7.
 *
 * @param {object} input
 * @param {Array<{date: Date|string, workmen: number}>} input.dailyHeadcounts
 * @param {Date|string} input.asAt
 * @param {boolean} [input.previouslyCovered]
 * @returns {object}
 */
function assessApplicability({
  dailyHeadcounts,
  asAt,
  previouslyCovered = false,
}) {
  const to = new Date(asAt);
  const from = new Date(to.getTime());
  from.setUTCMonth(from.getUTCMonth() - LOOKBACK_MONTHS);

  let peak = 0;
  let peakOn = null;

  for (const entry of dailyHeadcounts || []) {
    const date = new Date(entry.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date < from || date > to) continue;

    const workmen = toNumber(entry.workmen);
    if (workmen > peak) {
      peak = workmen;
      peakOn = date;
    }
  }

  const crossedInWindow = peak >= APPLICABILITY_THRESHOLD;
  const applicable = crossedInWindow || previouslyCovered;

  let reason;
  if (crossedInWindow) {
    reason = `${peak} contract workmen were employed on ${
      peakOn ? peakOn.toISOString().slice(0, 10) : 'a day in the window'
    }, which is at or above the section 1(4) threshold of ${APPLICABILITY_THRESHOLD}`;
  } else if (previouslyCovered) {
    reason =
      'the establishment is already registered under section 7; coverage does not lapse because the headcount has since fallen';
  } else {
    reason = `the peak over the trailing ${LOOKBACK_MONTHS} months was ${peak}, below the section 1(4) threshold of ${APPLICABILITY_THRESHOLD}`;
  }

  return {
    applicable,
    peakWorkmen: peak,
    peakOn,
    windowFrom: from,
    windowTo: to,
    threshold: APPLICABILITY_THRESHOLD,
    successorThreshold: OSH_CODE_THRESHOLD,
    previouslyCovered,
    reason,
  };
}

/**
 * The state of a contractor's licence at a date.
 *
 * @param {object} contractor
 * @param {Date|string} asAt
 * @param {number} deployedWorkmen
 * @returns {object}
 */
function assessLicence(contractor, asAt, deployedWorkmen) {
  const at = new Date(asAt);
  const deployed = toNumber(deployedWorkmen);

  const required = deployed >= LICENCE_THRESHOLD;
  const findings = [];

  const validTo = contractor.licenceValidTo
    ? new Date(contractor.licenceValidTo)
    : null;
  const authorised = toNumber(contractor.licensedWorkmen);

  if (!contractor.licenceNumber) {
    // Not a finding where the contractor is below the section 12 threshold —
    // reporting one would bury the real breaches under a list of small
    // contractors who never needed a licence.
    if (required) {
      findings.push({
        code: FINDING.UNLICENSED,
        severity: FINDING_SEVERITY[FINDING.UNLICENSED],
        detail: `${deployed} workmen deployed with no licence on record; section 12 requires one at ${LICENCE_THRESHOLD} or more`,
      });
    }
  } else if (validTo && validTo < at) {
    findings.push({
      code: FINDING.LICENCE_EXPIRED,
      severity: FINDING_SEVERITY[FINDING.LICENCE_EXPIRED],
      detail: `licence ${contractor.licenceNumber} expired on ${validTo
        .toISOString()
        .slice(0, 10)}`,
    });
  } else if (validTo) {
    const daysToExpiry = Math.floor(
      (validTo.getTime() - at.getTime()) / 86400000,
    );

    if (daysToExpiry <= LICENCE_RENEWAL_NOTICE_DAYS) {
      findings.push({
        code: FINDING.LICENCE_EXPIRING,
        severity: FINDING_SEVERITY[FINDING.LICENCE_EXPIRING],
        detail: `licence ${contractor.licenceNumber} expires in ${daysToExpiry} days; rule 29 requires renewal to be applied for thirty days before expiry`,
      });
    }
  }

  // Checked independently of expiry: a current licence issued for twenty-five
  // workmen with forty deployed against it is a live breach, and reporting only
  // the expiry would let it hide behind a valid date.
  if (contractor.licenceNumber && authorised > 0 && deployed > authorised) {
    findings.push({
      code: FINDING.LICENCE_CAPACITY_EXCEEDED,
      severity: FINDING_SEVERITY[FINDING.LICENCE_CAPACITY_EXCEEDED],
      detail: `${deployed} workmen deployed against a licence authorising ${authorised}`,
    });
  }

  return {
    licenceRequired: required,
    licenceNumber: contractor.licenceNumber || '',
    licensedWorkmen: authorised,
    deployedWorkmen: deployed,
    validTo,
    expired: Boolean(validTo && validTo < at),
    findings,
  };
}

/**
 * Section 21 exposure for one contractor.
 *
 * Section 21(4) makes the principal employer liable to pay wages the contractor
 * has failed to pay, and 21(4) then gives a right of recovery. It is not a
 * guarantee that has to be invoked — the obligation lands automatically — so the
 * establishment has a real, quantifiable contingent liability equal to the
 * unpaid wages of every workman on site.
 *
 * A month with no wage-payment evidence is treated as unpaid. That is
 * deliberately the pessimistic reading: the evidence is the contractor's to
 * produce under rule 78, and a month where none was produced is exactly the
 * situation section 21 exists for. It is reported as *exposure* rather than as
 * a debt, which is the honest description.
 *
 * @param {object} input
 * @param {object} input.contractor
 * @param {Array<{month: string, workmen: number, wageBill: number}>} input.deployments
 * @param {Array<{month: string, type: string}>} input.remittances
 * @returns {object}
 */
function assessSection21Exposure({ contractor, deployments, remittances }) {
  const evidenced = new Set(
    (remittances || [])
      .filter((r) => r && r.type && r.month)
      .map((r) => `${r.type}:${r.month}`),
  );

  const months = [];
  const findings = [];

  let exposure = 0;

  for (const deployment of deployments || []) {
    const month = deployment.month;
    if (!month) continue;

    const wageBill = round2(toNumber(deployment.wageBill));
    const workmen = toNumber(deployment.workmen);

    const wagesEvidenced = evidenced.has(`${REMITTANCE.WAGES}:${month}`);
    const pfEvidenced = evidenced.has(`${REMITTANCE.PROVIDENT_FUND}:${month}`);
    const esiEvidenced = evidenced.has(`${REMITTANCE.ESI}:${month}`);

    if (!wagesEvidenced) exposure = round2(exposure + wageBill);

    months.push({
      month,
      workmen,
      wageBill,
      wagesEvidenced,
      pfEvidenced,
      esiEvidenced,
      exposure: wagesEvidenced ? 0 : wageBill,
    });
  }

  const unevidencedWageMonths = months.filter((m) => !m.wagesEvidenced);
  if (unevidencedWageMonths.length) {
    findings.push({
      code: FINDING.WAGES_UNEVIDENCED,
      severity: FINDING_SEVERITY[FINDING.WAGES_UNEVIDENCED],
      detail: `no wage-payment evidence for ${unevidencedWageMonths
        .map((m) => m.month)
        .join(
          ', ',
        )} — ${round2(exposure)} of principal employer exposure under section 21`,
      amount: round2(exposure),
    });
  }

  // PF and ESI are separate findings rather than part of the wage exposure.
  // The principal employer's section 21 liability is for *wages*; unremitted
  // contributions are the contractor's default and the leading indicator of the
  // wage default, which makes them worth surfacing and wrong to add up.
  const pfMissing = months.filter((m) => !m.pfEvidenced).map((m) => m.month);
  if (pfMissing.length) {
    findings.push({
      code: FINDING.PF_UNEVIDENCED,
      severity: FINDING_SEVERITY[FINDING.PF_UNEVIDENCED],
      detail: `no provident fund remittance evidence for ${pfMissing.join(', ')}`,
    });
  }

  const esiMissing = months.filter((m) => !m.esiEvidenced).map((m) => m.month);
  if (esiMissing.length) {
    findings.push({
      code: FINDING.ESI_UNEVIDENCED,
      severity: FINDING_SEVERITY[FINDING.ESI_UNEVIDENCED],
      detail: `no employees' state insurance remittance evidence for ${esiMissing.join(', ')}`,
    });
  }

  return {
    contractorId: contractor._id || contractor.id || null,
    contractorName: contractor.name || '',
    months,
    exposure: round2(exposure),
    recoverableUnderSection21_4: round2(exposure),
    findings,
  };
}

/**
 * Rule 25(2)(v)(a) wage parity.
 *
 * Where a contract workman performs the same or similar kind of work as a
 * workman directly employed by the principal employer, they are entitled to the
 * same wages, hours and conditions.
 *
 * "Same or similar kind of work" is a judgement, and this does not make it. The
 * engine's job is to surface the candidates — a designation the establishment
 * also employs directly, at a materially higher median — and leave the
 * determination to whoever is accountable for it. Hence a tolerance, and hence
 * "gap" rather than "breach".
 *
 * @param {object} input
 * @param {Array<{designation: string, wage: number, workmen: number}>} input.contractWages
 * @param {Array<{designation: string, medianWage: number, headcount: number}>} input.directWages
 * @param {number} [input.tolerance] fraction, default 5%
 * @returns {object}
 */
function assessWageParity({ contractWages, directWages, tolerance = 0.05 }) {
  const directByDesignation = new Map(
    (directWages || [])
      .filter((row) => row && row.designation)
      .map((row) => [row.designation.trim().toLowerCase(), row]),
  );

  const comparisons = [];
  const findings = [];

  for (const row of contractWages || []) {
    if (!row || !row.designation) continue;

    const direct = directByDesignation.get(
      row.designation.trim().toLowerCase(),
    );

    // No directly employed comparator means rule 25(2)(v)(a) has nothing to
    // compare against. Recorded rather than dropped, because "we have no
    // comparator" is itself the answer to the inspector's question.
    if (!direct) {
      comparisons.push({
        designation: row.designation,
        contractWage: round2(toNumber(row.wage)),
        workmen: toNumber(row.workmen),
        directWage: null,
        comparable: false,
        gap: 0,
        gapPercent: 0,
      });
      continue;
    }

    const contractWage = round2(toNumber(row.wage));
    const directWage = round2(toNumber(direct.medianWage));

    const gap = round2(Math.max(0, directWage - contractWage));
    const gapPercent = directWage > 0 ? round2((gap / directWage) * 100) : 0;

    const material = directWage > 0 && gap / directWage > tolerance;

    comparisons.push({
      designation: row.designation,
      contractWage,
      workmen: toNumber(row.workmen),
      directWage,
      directHeadcount: toNumber(direct.headcount),
      comparable: true,
      gap,
      gapPercent,
      material,
      // The cost of closing it, which is what the finding is actually for.
      monthlyCost: material ? round2(gap * toNumber(row.workmen)) : 0,
    });

    if (material) {
      findings.push({
        code: FINDING.WAGE_PARITY_GAP,
        severity: FINDING_SEVERITY[FINDING.WAGE_PARITY_GAP],
        detail: `${row.designation}: contract workmen at ${contractWage} against a directly employed median of ${directWage}, a gap of ${gapPercent}%`,
        amount: round2(gap * toNumber(row.workmen)),
      });
    }
  }

  return {
    tolerance,
    comparisons,
    findings,
    materialCount: comparisons.filter((c) => c.material).length,
    monthlyCost: round2(
      comparisons.reduce((sum, c) => sum + (c.monthlyCost || 0), 0),
    ),
  };
}

/**
 * When the Form XXV annual return is due for a calendar year, and whether it is
 * late.
 *
 * @param {number} year the calendar year the return covers
 * @param {Date|string} asAt
 * @param {Date|string} [filedOn]
 * @returns {object}
 */
function annualReturnStatus(year, asAt, filedOn) {
  const dueBy = new Date(
    Date.UTC(Number(year) + 1, ANNUAL_RETURN_MONTH - 1, ANNUAL_RETURN_DAY),
  );

  const filed = filedOn ? new Date(filedOn) : null;
  const at = new Date(asAt);

  const measuredTo = filed && !Number.isNaN(filed.getTime()) ? filed : at;
  const overdue = measuredTo > dueBy;

  const findings = overdue
    ? [
        {
          code: FINDING.RETURN_OVERDUE,
          severity: FINDING_SEVERITY[FINDING.RETURN_OVERDUE],
          detail: `the Form XXV return for ${year} was due by ${dueBy
            .toISOString()
            .slice(
              0,
              10,
            )}${filed ? ' and was filed late' : ' and has not been filed'}`,
        },
      ]
    : [];

  return {
    year: Number(year),
    dueBy,
    filedOn: filed,
    filed: Boolean(filed && !Number.isNaN(filed.getTime())),
    overdue,
    daysLate: overdue
      ? Math.floor((measuredTo.getTime() - dueBy.getTime()) / 86400000)
      : 0,
    findings,
  };
}

/**
 * The whole compliance position for an establishment.
 *
 * @param {object} input
 * @param {Array<object>} input.contractors
 * @param {Array<{date: Date|string, workmen: number}>} input.dailyHeadcounts
 * @param {Array<object>} input.deploymentsByContractor keyed by contractor id
 * @param {Array<object>} input.remittancesByContractor keyed by contractor id
 * @param {Array<object>} input.contractWages
 * @param {Array<object>} input.directWages
 * @param {Date|string} input.asAt
 * @param {boolean} [input.previouslyCovered]
 * @param {number} [input.returnYear]
 * @param {Date|string} [input.returnFiledOn]
 * @param {number} [input.parityTolerance]
 * @returns {object}
 */
function assessEstablishment({
  contractors,
  dailyHeadcounts,
  deploymentsByContractor = {},
  remittancesByContractor = {},
  contractWages,
  directWages,
  asAt,
  previouslyCovered = false,
  returnYear,
  returnFiledOn,
  parityTolerance = 0.05,
}) {
  const applicability = assessApplicability({
    dailyHeadcounts,
    asAt,
    previouslyCovered,
  });

  // Short-circuited on purpose. Reporting licence and section 21 findings for
  // an establishment the Act does not cover would be reporting breaches of a
  // statute that does not apply to it.
  if (!applicability.applicable) {
    return {
      applicability,
      contractors: [],
      wageParity: null,
      annualReturn: null,
      findings: [],
      exposure: 0,
    };
  }

  const perContractor = [];
  const findings = [];

  for (const contractor of contractors || []) {
    const id = String(contractor._id || contractor.id || '');
    const deployments = deploymentsByContractor[id] || [];
    const remittances = remittancesByContractor[id] || [];

    // The licence is sized against the *peak* deployment rather than the
    // latest: a licence for twenty-five is breached by a month at forty even if
    // this month is back down to twenty.
    const peakDeployed = deployments.reduce(
      (max, d) => Math.max(max, toNumber(d.workmen)),
      0,
    );

    const licence = assessLicence(contractor, asAt, peakDeployed);
    const exposure = assessSection21Exposure({
      contractor,
      deployments,
      remittances,
    });

    const contractorFindings = [...licence.findings, ...exposure.findings].map(
      (finding) => ({
        ...finding,
        contractorId: id || null,
        contractorName: contractor.name || '',
      }),
    );

    findings.push(...contractorFindings);

    perContractor.push({
      contractorId: id || null,
      name: contractor.name || '',
      licence,
      exposure,
      findings: contractorFindings,
    });
  }

  const wageParity = assessWageParity({
    contractWages,
    directWages,
    tolerance: parityTolerance,
  });
  findings.push(...wageParity.findings);

  const annualReturn =
    typeof returnYear !== 'undefined'
      ? annualReturnStatus(returnYear, asAt, returnFiledOn)
      : null;

  if (annualReturn) findings.push(...annualReturn.findings);

  const severityOrder = [
    SEVERITY.EXPOSURE,
    SEVERITY.HIGH,
    SEVERITY.MEDIUM,
    SEVERITY.LOW,
  ];

  return {
    applicability,
    contractors: perContractor,
    wageParity,
    annualReturn,
    findings: findings.sort(
      (a, b) =>
        severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
    ),
    exposure: round2(
      perContractor.reduce((sum, c) => sum + c.exposure.exposure, 0),
    ),
  };
}

module.exports = {
  APPLICABILITY_THRESHOLD,
  OSH_CODE_THRESHOLD,
  LICENCE_THRESHOLD,
  LOOKBACK_MONTHS,
  LICENCE_RENEWAL_NOTICE_DAYS,
  ANNUAL_RETURN_MONTH,
  ANNUAL_RETURN_DAY,
  REMITTANCE,
  FINDING,
  FINDING_SEVERITY,
  SEVERITY,

  monthKey,
  assessApplicability,
  assessLicence,
  assessSection21Exposure,
  assessWageParity,
  annualReturnStatus,
  assessEstablishment,
};
