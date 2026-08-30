/**
 * EPF International Workers — paragraph 83 (#1971).
 *
 * The assertions that matter are the ones a "no ceiling" flag on the employee
 * record cannot make: that status is a determination on the definition rather
 * than a nationality, that a Certificate of Coverage re-attaches the worker at
 * full pay the day it lapses, that the domestic withdrawal ground does not
 * reach this member, and that EPS eligibility is totalised while the benefit is
 * not.
 *
 * `NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS` has its own block. The difference
 * between ₹1,800 and ₹72,000 a month reads as a bug to anybody who has only
 * seen the domestic path, and the sentence is what stops somebody "fixing" it
 * back to the ceiling.
 */

const {
  IW_RULES,
  LIMB,
  STATUS,
  SSA_COUNTRIES,
  WITHDRAWAL_GROUND,
  FINDING,
  SEVERITY,
  NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
  WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
  monthsBetween,
  determineStatus,
  certificatePosition,
  contributionBasis,
  withdrawalEligibility,
  pensionPosition,
  iwOneSchedule,
  assessWorker,
  assessEstablishment,
} = require('../internationalWorkerPf');

const utc = (iso) => new Date(`${iso}T00:00:00.000Z`);
const codesOf = (findings) => findings.map((finding) => finding.code);

const EXPAT = {
  limb: LIMB.FOREIGN_NATIONAL_IN_INDIA,
  from: '2024-01-01',
  determinedOn: '2024-01-05',
  countryCode: 'DE',
};

describe('monthsBetween', () => {
  it('counts completed months', () => {
    // Completed rather than rounded. A rounded month buys eligibility that has
    // not been earned.
    expect(monthsBetween('2024-01-15', '2024-07-14')).toBe(5);
    expect(monthsBetween('2024-01-15', '2024-07-15')).toBe(6);
  });

  it('is nought for an inverted range', () => {
    expect(monthsBetween('2024-07-15', '2024-01-15')).toBe(0);
  });
});

describe('determineStatus', () => {
  it('is undetermined where nobody has decided, rather than domestic', () => {
    // A question and not an answer. Defaulting to domestic is the error that
    // costs money, and it is the silent one.
    const status = determineStatus({ determination: {}, asOn: '2026-06-01' });
    expect(status.status).toBe(STATUS.UNDETERMINED);
  });

  it('reaches an Indian employee on deputation to an agreement country', () => {
    // The limb everybody misses. Keying off nationality would answer this
    // wrongly, and #1348 already records the deputation.
    const status = determineStatus({
      determination: {
        limb: LIMB.INDIAN_IN_SSA_COUNTRY,
        from: '2025-04-01',
        determinedOn: '2025-04-01',
        countryCode: 'DE',
      },
      asOn: '2026-06-01',
    });

    expect(status.status).toBe(STATUS.INTERNATIONAL_WORKER);
    expect(status.limb).toBe(LIMB.INDIAN_IN_SSA_COUNTRY);
  });

  it('is excluded while a valid certificate runs', () => {
    const status = determineStatus({
      determination: EXPAT,
      certificate: {
        countryCode: 'DE',
        validFrom: '2024-01-01',
        validTo: '2029-01-01',
      },
      asOn: '2026-06-01',
    });

    expect(status.status).toBe(STATUS.EXCLUDED_BY_CERTIFICATE);
  });

  it('re-attaches the day after the certificate lapses', () => {
    // Nothing in a payroll system notices a date passing on a scanned PDF, and
    // this is the whole reason the module exists.
    const status = determineStatus({
      determination: EXPAT,
      certificate: {
        countryCode: 'DE',
        validFrom: '2021-01-01',
        validTo: '2026-01-01',
      },
      asOn: '2026-01-02',
    });

    expect(status.status).toBe(STATUS.INTERNATIONAL_WORKER);
  });

  it('is domestic for a date outside the determination’s period', () => {
    const status = determineStatus({
      determination: { ...EXPAT, to: '2025-12-31' },
      asOn: '2026-06-01',
    });

    expect(status.status).toBe(STATUS.DOMESTIC);
  });
});

describe('certificatePosition', () => {
  it('counts down rather than reporting a date', () => {
    const position = certificatePosition({
      certificate: {
        countryCode: 'DE',
        validFrom: '2021-01-01',
        validTo: '2026-03-01',
      },
      asAt: '2026-01-01',
    });

    expect(position.daysRemaining).toBe(59);
    expect(position.expiring).toBe(true);
    expect(position.expired).toBe(false);
    expect(position.attachesFrom).toEqual(utc('2026-03-02'));
  });

  it('is not expiring outside the notice window', () => {
    const position = certificatePosition({
      certificate: {
        countryCode: 'DE',
        validFrom: '2021-01-01',
        validTo: '2027-01-01',
      },
      asAt: '2026-01-01',
    });

    expect(position.expiring).toBe(false);
    expect(position.daysRemaining).toBeGreaterThan(
      IW_RULES.certificateNoticeDays,
    );
  });

  it('detaches nobody where the country has no detachment article', () => {
    const position = certificatePosition({
      certificate: {
        countryCode: 'US',
        validFrom: '2021-01-01',
        validTo: '2029-01-01',
      },
      asAt: '2026-01-01',
    });

    expect(position.detachmentAvailable).toBe(false);
    expect(position.valid).toBe(false);
  });
});

describe('contributionBasis', () => {
  const pay = {
    paidInIndia: 200000,
    paidOutsideIndia: 300000,
    paidInForeignCurrency: 100000,
  };

  it('takes the full monthly pay with no ceiling', () => {
    const basis = contributionBasis({
      status: { status: STATUS.INTERNATIONAL_WORKER },
      pay,
    });

    expect(basis.basis).toBe(600000);
    expect(basis.ceilingApplied).toBe(false);
    expect(basis.employee).toBe(72000);
    expect(basis.employer).toBe(72000);
  });

  it('reports what the ceiling would have produced, for the comparison', () => {
    // A difference of forty times reads as a bug. The comparison is what makes
    // it visibly intended, and it is the figure #1875 charges interest on.
    const basis = contributionBasis({
      status: { status: STATUS.INTERNATIONAL_WORKER },
      pay,
    });

    expect(basis.ceilingWouldHaveBeen).toBe(IW_RULES.domesticWageCeiling);
    expect(basis.understatementIfCeilingApplied).toBe(
      Math.round((600000 - 15000) * 0.24),
    );
  });

  it('is nil while a certificate detaches the worker', () => {
    const basis = contributionBasis({
      status: { status: STATUS.EXCLUDED_BY_CERTIFICATE },
      pay,
    });

    expect(basis.applicable).toBe(false);
    expect(basis.employee).toBe(0);
  });

  it('applies the ceiling to a domestic member', () => {
    const basis = contributionBasis({
      status: { status: STATUS.DOMESTIC },
      pay,
    });

    expect(basis.ceilingApplied).toBe(true);
    expect(basis.basis).toBe(IW_RULES.domesticWageCeiling);
    expect(basis.employee).toBe(1800);
  });

  it('carries the paragraph 83 note on every international-worker basis', () => {
    const basis = contributionBasis({
      status: { status: STATUS.INTERNATIONAL_WORKER },
      pay,
    });
    expect(basis.note).toBe(NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS);
  });
});

describe('withdrawalEligibility', () => {
  const status = { status: STATUS.INTERNATIONAL_WORKER };

  it('refuses two months’ unemployment', () => {
    const result = withdrawalEligibility({
      status,
      ground: WITHDRAWAL_GROUND.TWO_MONTHS_UNEMPLOYED,
      age: 34,
    });

    expect(result.available).toBe(false);
    expect(result.reason).toBe(WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT);
  });

  it('refuses retirement below 58 — leaving India is not a ground', () => {
    const result = withdrawalEligibility({
      status,
      ground: WITHDRAWAL_GROUND.RETIREMENT_AT_58,
      age: 45,
    });

    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/Leaving India is not a ground/);
  });

  it('allows retirement at 58', () => {
    const result = withdrawalEligibility({
      status,
      ground: WITHDRAWAL_GROUND.RETIREMENT_AT_58,
      age: 58,
    });
    expect(result.available).toBe(true);
  });

  it('allows permanent incapacity', () => {
    const result = withdrawalEligibility({
      status,
      ground: WITHDRAWAL_GROUND.PERMANENT_INCAPACITY,
      age: 41,
    });
    expect(result.available).toBe(true);
  });

  it('allows an SSA route where the agreement gives one', () => {
    const result = withdrawalEligibility({
      status,
      ground: WITHDRAWAL_GROUND.UNDER_AN_SSA,
      age: 41,
      ssaCountryCode: 'DE',
    });
    expect(result.available).toBe(true);
  });

  it('refuses an SSA route where there is no agreement', () => {
    const result = withdrawalEligibility({
      status,
      ground: WITHDRAWAL_GROUND.UNDER_AN_SSA,
      age: 41,
      ssaCountryCode: 'US',
    });
    expect(result.available).toBe(false);
  });

  it('leaves a domestic member alone', () => {
    const result = withdrawalEligibility({
      status: { status: STATUS.DOMESTIC },
      ground: WITHDRAWAL_GROUND.TWO_MONTHS_UNEMPLOYED,
      age: 34,
    });
    expect(result.available).toBe(true);
  });
});

describe('pensionPosition', () => {
  const status = { status: STATUS.INTERNATIONAL_WORKER };

  it('totalises for eligibility and pays only for Indian service', () => {
    // #1769's ten-year test is right for a domestic member and wrong here. Six
    // years in India and eight in Germany is eligible; India pays on six.
    const result = pensionPosition({
      status,
      indianServiceMonths: 72,
      foreignServiceMonths: 96,
      ssaCountryCode: 'DE',
    });

    expect(result.eligible).toBe(true);
    expect(result.basis).toBe('TOTALISED');
    expect(result.indiaPaysForMonths).toBe(72);
  });

  it('is not eligible where there is no agreement at all', () => {
    const result = pensionPosition({
      status,
      indianServiceMonths: 72,
      foreignServiceMonths: 96,
      ssaCountryCode: 'US',
    });

    expect(result.eligible).toBe(false);
    expect(result.basis).toBe('NO_AGREEMENT');
  });

  it('counts only Indian service where the agreement has no totalisation', () => {
    // Detachment, totalisation and export of pension are three different things
    // and an agreement can give one without the others. An agreement that
    // detaches but does not totalise leaves the ten-year test on Indian service
    // alone, and 72 months does not meet it.
    const result = pensionPosition({
      status,
      indianServiceMonths: 72,
      foreignServiceMonths: 96,
      ssaCountryCode: 'ZZ',
      agreements: {
        ZZ: {
          code: 'ZZ',
          label: 'Detachment only',
          detachment: true,
          totalisation: false,
          exportOfPension: false,
        },
      },
    });

    expect(result.basis).toBe('AGREEMENT_WITHOUT_TOTALISATION');
    expect(result.countedServiceMonths).toBe(72);
    expect(result.eligible).toBe(false);
  });

  it('uses the domestic test for a domestic member', () => {
    const result = pensionPosition({
      status: { status: STATUS.DOMESTIC },
      indianServiceMonths: 130,
    });

    expect(result.basis).toBe('DOMESTIC');
    expect(result.eligible).toBe(true);
  });
});

describe('iwOneSchedule', () => {
  it('is owed for a month with no international workers at all', () => {
    // Built from month ends and never from the worker table — which is exactly
    // why a month with nobody in it still appears.
    const rows = iwOneSchedule({
      from: '2026-01-01',
      to: '2026-04-30',
      asAt: '2026-06-01',
    });

    expect(rows).toHaveLength(4);
    expect(rows[0].forMonthEnding).toEqual(utc('2026-01-31'));
    expect(rows[0].dueOn).toEqual(utc('2026-02-15'));
    expect(rows.every((row) => row.overdue)).toBe(true);
  });

  it('marks a filed month as filed and not overdue', () => {
    const rows = iwOneSchedule({
      from: '2026-01-01',
      to: '2026-02-28',
      filings: [{ forMonthEnding: '2026-01-31' }],
      asAt: '2026-06-01',
    });

    expect(rows[0].filed).toBe(true);
    expect(rows[0].overdue).toBe(false);
  });

  it('counts down a month that is not yet due', () => {
    const rows = iwOneSchedule({
      from: '2026-01-01',
      to: '2026-01-31',
      asAt: '2026-02-05',
    });

    expect(rows[0].overdue).toBe(false);
    expect(rows[0].daysRemaining).toBe(10);
  });
});

describe('assessWorker', () => {
  const pay = { paidInIndia: 200000, paidOutsideIndia: 400000 };

  it('flags a remittance computed on the domestic ceiling', () => {
    // The finding the module exists for. ₹1,800 against ₹72,000 is not a
    // rounding error.
    const result = assessWorker({
      determination: EXPAT,
      pay,
      contributionAsRemitted: 3600,
      asAt: '2026-06-01',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.CEILING_APPLIED_TO_IW,
    );
    expect(finding.severity).toBe(SEVERITY.BREACH);
    expect(finding.shortfall).toBe(144000 - 3600);
  });

  it('raises an expiring certificate before it lapses', () => {
    const result = assessWorker({
      determination: EXPAT,
      certificate: {
        countryCode: 'DE',
        validFrom: '2021-03-01',
        validTo: '2026-03-01',
      },
      pay,
      asAt: '2026-01-15',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.CERTIFICATE_EXPIRING,
    );
    expect(finding.severity).toBe(SEVERITY.DUE);
    expect(finding.attachesFrom).toEqual(utc('2026-03-02'));
  });

  it('reports a lapsed certificate as a breach with the attachment date', () => {
    const result = assessWorker({
      determination: EXPAT,
      certificate: {
        countryCode: 'DE',
        validFrom: '2021-01-01',
        validTo: '2026-01-01',
      },
      pay,
      asAt: '2026-06-01',
    });

    expect(codesOf(result.findings)).toContain(FINDING.CERTIFICATE_EXPIRED);
  });

  it('flags a certificate from a country with no detachment article', () => {
    const result = assessWorker({
      determination: EXPAT,
      certificate: {
        countryCode: 'US',
        validFrom: '2021-01-01',
        validTo: '2029-01-01',
      },
      pay,
      asAt: '2026-06-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.CERTIFICATE_FROM_NON_SSA_COUNTRY,
    );
    // And the worker is contributing on full pay throughout, not detached.
    expect(result.status.status).toBe(STATUS.INTERNATIONAL_WORKER);
  });

  it('flags a deputation on record with no paragraph 83 determination', () => {
    const result = assessWorker({
      determination: { limb: LIMB.INDIAN_IN_SSA_COUNTRY, from: '2026-01-01' },
      pay,
      asAt: '2026-06-01',
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.DEPUTATION_NOT_CLASSIFIED,
    );
  });

  it('is quiet where the full-pay contribution was remitted', () => {
    const result = assessWorker({
      determination: EXPAT,
      pay,
      contributionAsRemitted: 144000,
      asAt: '2026-06-01',
    });

    expect(codesOf(result.findings)).not.toContain(
      FINDING.CEILING_APPLIED_TO_IW,
    );
  });
});

describe('assessEstablishment', () => {
  it('sums the exposure across workers into one figure', () => {
    const result = assessEstablishment({
      workers: [
        {
          employeeId: 'e1',
          determination: EXPAT,
          pay: { paidInIndia: 600000 },
          contributionAsRemitted: 3600,
        },
        {
          employeeId: 'e2',
          determination: EXPAT,
          pay: { paidInIndia: 300000 },
          contributionAsRemitted: 3600,
        },
      ],
      period: { from: '2026-01-01', to: '2026-02-28' },
      asAt: '2026-06-01',
    });

    // One number rather than a column somebody adds up.
    expect(result.contributionUnderstatementIfCeilingApplied).toBe(
      Math.round((600000 - 15000) * 0.24) + Math.round((300000 - 15000) * 0.24),
    );
    expect(result.severityCounts.BREACH).toBeGreaterThan(0);
  });

  it('raises IW-1 for every month in the period', () => {
    const result = assessEstablishment({
      workers: [],
      period: { from: '2026-01-01', to: '2026-03-31' },
      asAt: '2026-06-01',
    });

    expect(result.iwOne).toHaveLength(3);
    expect(codesOf(result.findings)).toContain(FINDING.IW_ONE_OVERDUE);
  });
});

describe('NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS', () => {
  it('names the ceiling and says the large figure is the right one', () => {
    expect(NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS).toMatch(/15,000/);
    expect(NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS).toMatch(
      /forty times too large/i,
    );
  });

  it('travels on every assessment', () => {
    const result = assessWorker({
      determination: EXPAT,
      pay: { paidInIndia: 500000 },
      asAt: '2026-06-01',
    });

    expect(result.notes.noWageCeiling).toBe(
      NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
    );
    expect(result.notes.withdrawalIsNotAvailableOnUnemployment).toBe(
      WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
    );
  });
});
