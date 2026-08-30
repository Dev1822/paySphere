/**
 * BOCW Welfare Cess Act, 1996 (#1827).
 *
 * The case worth stating first, because it is the reason the module exists:
 * this is the only levy in the product whose base is not a wage. Forty workers
 * on a ₹90 crore job and forty on a ₹4 crore job carry the same wage bill and
 * cess differing by a factor of twenty-two, so nothing derived from payroll can
 * produce the number.
 *
 * What follows from that:
 *
 *   - the exclusions are the argument, so they are returned alongside the base
 *     rather than netted into it — and a project with no land line is reported,
 *     because on a real-estate job the land is frequently the larger half;
 *   - what is deducted at source is an *advance*, and section 5 assesses the
 *     cess afterwards, so the difference has to survive as a demand or a refund;
 *   - section 8 interest accrues and the section 9 penalty does not, because
 *     one is arithmetic and the other is a decision nobody has made;
 *   - and the ninety-day beneficiary test counts days across *every* employer,
 *     so an establishment answering it from its own attendance ledger is wrong
 *     in a direction that always disqualifies.
 */

const {
  CESS_RULES,
  EXCLUSION,
  CESS_STATUS,
  FINDING,
  SEVERITY,
  costOfConstruction,
  assessCess,
  advanceCess,
  interestOn,
  penaltyCeiling,
  assessProject,
  beneficiaryEligibility,
  assessApplicability,
  assessEstablishment,
} = require('../constructionCess');

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

/** ₹90 crore, of which ₹40 crore was land. */
const project = {
  projectId: 'p1',
  name: 'Tower B',
  totalProjectCost: 900000000,
  exclusions: [{ kind: EXCLUSION.LAND, amount: 400000000 }],
};

describe('section 3 — the base, and what came out of it', () => {
  it('excludes the land and reports the exclusion rather than only the net', () => {
    const cost = costOfConstruction(project);

    expect(cost.base).toBe(500000000);
    expect(cost.excluded).toBe(400000000);
    // An assessment order argues about exactly this line, so a caller handed
    // only the net figure cannot show its working.
    expect(cost.exclusions[0].label).toBe('Cost of land');
  });

  it('says so when nobody excluded the land', () => {
    const cost = costOfConstruction({ totalProjectCost: 900000000 });

    expect(cost.landExcluded).toBe(false);
    expect(codesOf(cost)).toContain(FINDING.LAND_NOT_EXCLUDED);
    // Informational: a contract on somebody else's land legitimately has no
    // land line, and this is not a finding that the base is wrong.
    expect(cost.findings[0].severity).toBe(SEVERITY.INFORMATIONAL);
  });

  it('excludes compensation under the Employees’ Compensation Act', () => {
    const cost = costOfConstruction({
      totalProjectCost: 40000000,
      exclusions: [{ kind: EXCLUSION.EMPLOYEE_COMPENSATION, amount: 500000 }],
    });

    expect(cost.base).toBe(39500000);
  });

  it('ignores an exclusion kind section 3 does not name', () => {
    const cost = costOfConstruction({
      totalProjectCost: 40000000,
      exclusions: [{ kind: 'GST', amount: 7200000 }],
    });

    expect(cost.base).toBe(40000000);
    expect(cost.exclusions).toHaveLength(0);
  });

  it('floors the base at zero rather than producing a negative cess', () => {
    // A negative base would read as a credit rather than as bad data.
    const cost = costOfConstruction({
      totalProjectCost: 1000000,
      exclusions: [{ kind: EXCLUSION.LAND, amount: 4000000 }],
    });

    expect(cost.base).toBe(0);
  });
});

describe('the rate the Act permits', () => {
  it('assesses at the notified one per cent', () => {
    const cess = assessCess(500000000);

    expect(cess.rate).toBe(1);
    expect(cess.assessed).toBe(5000000);
  });

  it('accepts a rate inside the one-to-two band', () => {
    const cess = assessCess(500000000, { cessRatePercent: 2 });

    expect(cess.assessed).toBe(10000000);
    expect(cess.findings).toHaveLength(0);
  });

  it('clamps a stored rate outside the band rather than trusting it', () => {
    // The finding alone would not stop the number being used, and an assessment
    // the Act cannot support is worse than a loud one that is wrong.
    const cess = assessCess(500000000, { cessRatePercent: 5 });

    expect(cess.rate).toBe(2);
    expect(codesOf(cess)).toContain(FINDING.RATE_OUTSIDE_BAND);
  });
});

describe('rule 4 — the advance deducted from a contractor’s bills', () => {
  const bills = [
    {
      billId: 'b1',
      contractorName: 'Sarvottam Infra',
      amount: 10000000,
      cessDeducted: 100000,
    },
    {
      billId: 'b2',
      contractorName: 'Sarvottam Infra',
      amount: 5000000,
      cessDeducted: 20000,
    },
  ];

  it('expects one per cent of every bill', () => {
    const advance = advanceCess(bills);

    expect(advance.expected).toBe(150000);
    expect(advance.deducted).toBe(120000);
    expect(advance.shortfall).toBe(30000);
  });

  it('names the bill that was short-deducted', () => {
    const advance = advanceCess(bills);
    const short = advance.findings.find(
      (entry) => entry.code === FINDING.ADVANCE_SHORT_DEDUCTED,
    );

    expect(short.billId).toBe('b2');
    expect(short.shortfall).toBe(30000);
  });

  it('does not complain about a bill deducted in full', () => {
    const advance = advanceCess([bills[0]]);

    expect(advance.findings).toHaveLength(0);
  });
});

describe('section 8 interest and the section 9 ceiling', () => {
  it('charges nothing before the due date', () => {
    const result = interestOn({
      outstanding: 5000000,
      dueOn: '2026-09-01',
      asAt: '2026-08-01',
    });

    expect(result.interest).toBe(0);
    expect(result.months).toBe(0);
  });

  it('counts a part month as a month, which is the Act’s wording', () => {
    const result = interestOn({
      outstanding: 100000,
      dueOn: '2026-01-01',
      asAt: '2026-01-05',
    });

    expect(result.months).toBe(1);
    expect(result.interest).toBe(2000);
  });

  it('runs simple rather than compounding, at two per cent a month', () => {
    // Section 8 is a rate on the principal for every month or part of a month,
    // not a balance that rolls up.
    const result = interestOn({
      outstanding: 100000,
      dueOn: '2026-01-01',
      asAt: '2026-12-27',
    });

    expect(result.months).toBe(12);
    expect(result.interest).toBe(24000);
  });

  it('reports the penalty as a ceiling of the cess itself', () => {
    expect(penaltyCeiling(5000000)).toBe(5000000);
  });
});

describe('a project end to end', () => {
  const withBills = {
    ...project,
    bills: [{ billId: 'b1', amount: 10000000, cessDeducted: 100000 }],
  };

  it('is simply accruing before completion or assessment', () => {
    // Nothing is late yet, and reporting an overdue amount would be reporting a
    // breach that has not arisen.
    const result = assessProject(withBills);

    expect(result.status).toBe(CESS_STATUS.ADVANCE_ACCRUING);
    expect(result.dueOn).toBeNull();
    expect(result.interest.interest).toBe(0);
  });

  it('becomes a demand once assessed, net of the advance', () => {
    const result = assessProject({
      ...withBills,
      completedOn: '2026-01-01',
      asAt: '2026-03-15',
    });

    expect(result.assessed).toBe(5000000);
    expect(result.settled).toBe(100000);
    expect(result.status).toBe(CESS_STATUS.DEMAND);
    expect(result.outstanding).toBe(4900000);
  });

  it('keeps the section 9 ceiling out of what is payable', () => {
    const result = assessProject({
      ...withBills,
      completedOn: '2026-01-01',
      asAt: '2026-03-15',
    });

    // Discretionary and imposed by order. Accruing it would overstate the
    // liability by up to its whole size.
    expect(result.penaltyCeiling).toBe(5000000);
    expect(result.payable).toBe(result.outstanding + result.interest.interest);
    expect(codesOf(result)).toContain(FINDING.PENALTY_EXPOSURE);
  });

  it('becomes a refund where more was deducted than assessed', () => {
    const result = assessProject({
      ...project,
      bills: [{ billId: 'b1', amount: 900000000, cessDeducted: 9000000 }],
      completedOn: '2026-01-01',
      asAt: '2026-03-15',
    });

    expect(result.status).toBe(CESS_STATUS.REFUND_DUE);
    expect(result.outstanding).toBe(0);
    expect(codesOf(result)).toContain(FINDING.REFUND_DUE);
  });

  it('settles where the advance and the payments come to the assessment', () => {
    const result = assessProject({
      ...withBills,
      cessPaid: 4900000,
      completedOn: '2026-01-01',
      asAt: '2026-03-15',
    });

    expect(result.status).toBe(CESS_STATUS.SETTLED);
    expect(result.payable).toBe(0);
  });

  it('runs the payment window from the assessment where there is one', () => {
    const fromCompletion = assessProject({
      ...withBills,
      completedOn: '2026-01-01',
      asAt: '2026-06-01',
    });
    const fromAssessment = assessProject({
      ...withBills,
      completedOn: '2026-01-01',
      assessedOn: '2026-04-01',
      asAt: '2026-06-01',
    });

    expect(fromAssessment.interest.months).toBeLessThan(
      fromCompletion.interest.months,
    );
  });
});

describe('section 12 — the ninety days, across employers', () => {
  const base = {
    workerId: 'w1',
    name: 'Ganesh Sahu',
    dateOfBirth: '1990-06-01',
    asAt: '2026-08-01',
  };

  it('qualifies a worker who reached ninety only by counting other employers', () => {
    // The case the module exists to protect. Sixty days here and forty
    // elsewhere is ninety days of construction work, and an establishment
    // deriving the answer from its own ledger would call this worker
    // ineligible.
    const result = beneficiaryEligibility({
      ...base,
      daysByEmployer: [
        { employer: 'This site', days: 60, thisEstablishment: true },
        { employer: 'Konark Builders', days: 40 },
      ],
    });

    expect(result.daysTotal).toBe(100);
    expect(result.daysElsewhere).toBe(40);
    expect(result.eligible).toBe(true);
    expect(codesOf(result)).toContain(FINDING.BENEFICIARY_UNREGISTERED);
  });

  it('does not call a worker ineligible when only this site has been counted', () => {
    const result = beneficiaryEligibility({
      ...base,
      daysByEmployer: [
        { employer: 'This site', days: 60, thisEstablishment: true },
      ],
    });

    expect(result.eligible).toBe(false);
    // Reported as "nobody has asked" rather than as a disqualification.
    expect(codesOf(result)).toContain(FINDING.BENEFICIARY_DAYS_UNRECORDED);
    expect(codesOf(result)).not.toContain(FINDING.BENEFICIARY_UNREGISTERED);
  });

  it('excludes a worker outside the eighteen-to-sixty band', () => {
    const result = beneficiaryEligibility({
      ...base,
      dateOfBirth: '1960-01-01',
      daysByEmployer: [
        { employer: 'This site', days: 200, thisEstablishment: true },
      ],
    });

    expect(result.inAgeBand).toBe(false);
    expect(result.eligible).toBe(false);
    expect(codesOf(result)).toContain(FINDING.BENEFICIARY_OUT_OF_AGE_BAND);
  });

  it('stops flagging once the worker is registered', () => {
    const result = beneficiaryEligibility({
      ...base,
      daysByEmployer: [
        { employer: 'This site', days: 120, thisEstablishment: true },
      ],
      registeredOn: '2026-05-01',
    });

    expect(result.eligible).toBe(true);
    expect(result.registered).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('honours a rule set that moves the qualifying days', () => {
    const result = beneficiaryEligibility(
      {
        ...base,
        daysByEmployer: [
          { employer: 'This site', days: 60, thisEstablishment: true },
        ],
      },
      { beneficiaryQualifyingDays: 45 },
    );

    expect(result.eligible).toBe(true);
  });
});

describe('the ten-worker threshold', () => {
  it('does not apply below ten building workers', () => {
    const result = assessApplicability({ buildingWorkers: 8 });

    expect(result.applicable).toBe(false);
    expect(codesOf(result)).toEqual([FINDING.NOT_APPLICABLE]);
  });

  it('reports all three thresholds side by side', () => {
    // Ten here, twenty under the Contract Labour Act, thirty under the
    // Apprentices Act — and establishments sit between them.
    const result = assessApplicability({
      buildingWorkers: 25,
      registered: true,
    });

    expect(result.threshold).toBe(10);
    expect(result.contractLabourThreshold).toBe(20);
    expect(result.apprenticesActThreshold).toBe(30);
  });

  it('flags an unregistered establishment above the threshold', () => {
    const result = assessApplicability({ buildingWorkers: 25 });

    expect(codesOf(result)).toContain(FINDING.REGISTRATION_REQUIRED);
  });
});

describe('the establishment', () => {
  const establishment = {
    projects: [
      {
        ...project,
        bills: [{ billId: 'b1', amount: 10000000, cessDeducted: 100000 }],
        completedOn: '2026-01-01',
        asAt: '2026-03-15',
      },
      {
        projectId: 'p2',
        name: 'Site road',
        totalProjectCost: 40000000,
        exclusions: [{ kind: EXCLUSION.LAND, amount: 0 }],
        bills: [{ billId: 'b3', amount: 40000000, cessDeducted: 400000 }],
        completedOn: '2026-01-01',
        asAt: '2026-03-15',
      },
    ],
    workers: [
      {
        workerId: 'w1',
        name: 'Ganesh Sahu',
        dateOfBirth: '1990-06-01',
        asAt: '2026-08-01',
        daysByEmployer: [
          { employer: 'This site', days: 60, thisEstablishment: true },
          { employer: 'Konark Builders', days: 40 },
        ],
      },
    ],
    applicability: { buildingWorkers: 42, registered: true },
  };

  it('adds the cess across projects on their own bases', () => {
    const result = assessEstablishment(establishment);

    // ₹50 crore and ₹4 crore, at one per cent.
    expect(result.base).toBe(540000000);
    expect(result.assessed).toBe(5400000);
  });

  it('keeps the penalty ceiling out of the payable total', () => {
    const result = assessEstablishment(establishment);

    expect(result.payable).toBe(
      result.projects.reduce((sum, row) => sum + row.payable, 0),
    );
    expect(result.penaltyCeiling).toBeGreaterThan(0);
  });

  it('counts the beneficiaries who qualified only by counting elsewhere', () => {
    // The number that says whether the register is being kept honestly.
    const result = assessEstablishment(establishment);

    expect(result.eligibleCount).toBe(1);
    expect(result.qualifiedElsewhereCount).toBe(1);
  });

  it('groups findings by code with a distinct subject count', () => {
    const result = assessEstablishment(establishment);
    const demand = result.summary.find(
      (row) => row.code === FINDING.DEMAND_OUTSTANDING,
    );

    // Only the tower. The site road was billed in full and deducted in full, so
    // its advance already covers its assessment — which is the case the
    // advance-against-assessment split exists to keep visible.
    expect(demand.subjectCount).toBe(1);
    expect(demand.section).toBe('Cess Act section 5');
    expect(result.projects[1].status).toBe(CESS_STATUS.SETTLED);
  });

  it('falls back to the worker count where no headcount was recorded', () => {
    const result = assessEstablishment({
      projects: [],
      workers: establishment.workers,
    });

    expect(result.applicability.buildingWorkers).toBe(1);
    expect(result.applicable).toBe(false);
  });
});
