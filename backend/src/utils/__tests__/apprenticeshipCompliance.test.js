/**
 * Apprentices Act, 1961 (#1771).
 *
 * The case worth stating first, because it is the reason the module exists: the
 * same individual counts for one statute and is invisible to the next. An
 * apprentice is inside the section 8 engagement band and outside the provident
 * fund, ESI, bonus and gratuity headcounts, because section 18 says an
 * apprentice is not a worker.
 *
 * `strengthFor` therefore takes the statute as a required argument. A bare
 * headcount would be right for one caller and quietly wrong for the next.
 *
 * The other boundaries:
 *
 *   - the band being a floor *and* a ceiling, so engaging too many is a breach
 *     rather than a cure for engaging too few;
 *   - the year-two uplift computed on the *prescribed* first-year rate, so
 *     generosity does not compound;
 *   - holidays and authorised leave not reducing the stipend, which is the
 *     opposite convention from loss of pay;
 *   - NAPS being a receivable rather than a reduction in the stipend;
 *   - and an unregistered contract exposing exactly the exclusions it took.
 */

const {
  APPRENTICESHIP_RULES,
  PRESCRIBED_STIPEND,
  STATUTE,
  REGISTRATION,
  FINDING,
  SEVERITY,
  strengthFor,
  evaluateBand,
  prescribedStipend,
  monthlyStipend,
  napsReimbursement,
  registrationStatus,
  unregisteredExposure,
  assessApprentice,
  assessEstablishment,
} = require('../apprenticeshipCompliance');

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

/** 100 direct, 40 contract, 10 casual, 8 apprentices. */
const composition = {
  directEmployees: 100,
  contractWorkers: 40,
  casualWorkers: 10,
  apprentices: 8,
  fresherApprentices: 8,
};

describe('the same establishment counted under each statute', () => {
  it('counts apprentices and contract workers for the Apprentices Act', () => {
    expect(strengthFor(composition, STATUTE.APPRENTICES_ACT)).toBe(158);
  });

  it('counts neither for the provident fund', () => {
    expect(strengthFor(composition, STATUTE.PROVIDENT_FUND)).toBe(100);
  });

  it('counts neither for bonus or gratuity', () => {
    expect(strengthFor(composition, STATUTE.BONUS)).toBe(100);
    expect(strengthFor(composition, STATUTE.GRATUITY)).toBe(100);
  });

  it('counts both for the Factories Act, by section 15', () => {
    expect(strengthFor(composition, STATUTE.FACTORIES_ACT)).toBe(158);
  });

  it('refuses to answer without a statute', () => {
    // The whole point of the signature. A default would give one caller the
    // right number and the next a plausible wrong one, silently.
    expect(() => strengthFor(composition)).toThrow(TypeError);
    expect(() => strengthFor(composition, 'HEADCOUNT')).toThrow(/not one of/);
  });

  it('returns every convention side by side from the establishment', () => {
    const result = assessEstablishment({ composition, apprentices: [] });

    expect(result.strength[STATUTE.APPRENTICES_ACT]).toBe(150);
    expect(result.strength[STATUTE.BONUS]).toBe(100);
  });
});

describe('the section 8 band', () => {
  it('does not apply below thirty', () => {
    const band = evaluateBand({ directEmployees: 25, apprentices: 0 });

    expect(band.applicable).toBe(false);
    expect(codesOf(band)).toEqual([FINDING.NOT_APPLICABLE]);
  });

  it('applies at exactly thirty', () => {
    expect(
      evaluateBand({ directEmployees: 30, apprentices: 1 }).applicable,
    ).toBe(true);
  });

  it('measures against total strength, not the payroll headcount', () => {
    // 150, not 100. Using the payroll figure would make the floor 3 instead of 4.
    const band = evaluateBand(composition);

    expect(band.totalStrength).toBe(158);
    expect(band.floor).toBe(4);
  });

  it('rounds the floor up', () => {
    // 2.5% of 41 is 1.025, and one apprentice does not discharge it.
    const band = evaluateBand({ directEmployees: 41, apprentices: 1 });

    expect(band.floor).toBe(2);
    expect(band.shortfall).toBe(1);
    expect(codesOf(band)).toContain(FINDING.BELOW_BAND_FLOOR);
  });

  it('rounds the ceiling down', () => {
    // 15% of 41 is 6.15, so six is the most that may be engaged.
    expect(evaluateBand({ directEmployees: 41, apprentices: 0 }).ceiling).toBe(
      6,
    );
  });

  it('counts the apprentices themselves inside the base', () => {
    // Not a quirk — section 8 measures against *total strength*, and an
    // apprentice is part of it. So engaging more apprentices raises the ceiling
    // as well as the count, and the band cannot be computed from the payroll
    // headcount alone.
    const none = evaluateBand({ directEmployees: 100, apprentices: 0 });
    const twenty = evaluateBand({ directEmployees: 100, apprentices: 20 });

    expect(none.totalStrength).toBe(100);
    expect(none.ceiling).toBe(15);

    expect(twenty.totalStrength).toBe(120);
    expect(twenty.ceiling).toBe(18);
  });

  it('reports engaging too many as a breach in its own right', () => {
    // Not a way to cure an earlier shortfall. 20 against a ceiling of 18.
    const band = evaluateBand({ directEmployees: 100, apprentices: 20 });

    expect(band.excess).toBe(2);
    expect(codesOf(band)).toContain(FINDING.ABOVE_BAND_CEILING);
    expect(codesOf(band)).not.toContain(FINDING.BELOW_BAND_FLOOR);
  });

  it('is satisfied inside the band', () => {
    // Total strength 110: floor 3, ceiling 16, fresher sub-quota 6.
    const band = evaluateBand({
      directEmployees: 100,
      apprentices: 10,
      fresherApprentices: 6,
    });

    expect(band.totalStrength).toBe(110);
    expect(band.withinBand).toBe(true);
    expect(codesOf(band)).toHaveLength(0);
  });

  it('reports the fresher sub-quota separately', () => {
    // Ten apprentices meets the floor of 3, and none of them is a fresher.
    const band = evaluateBand({
      directEmployees: 100,
      apprentices: 10,
      fresherApprentices: 0,
    });

    expect(band.shortfall).toBe(0);
    expect(codesOf(band)).toContain(FINDING.FRESHER_SUB_QUOTA_UNMET);
  });

  it('caps the sub-quota at the number actually engaged', () => {
    // 5% of 100 is 5, but only three apprentices exist, so three freshers is
    // the most that can be asked for.
    const band = evaluateBand({
      directEmployees: 100,
      apprentices: 3,
      fresherApprentices: 3,
    });

    expect(band.fresherFloor).toBe(3);
    expect(codesOf(band)).not.toContain(FINDING.FRESHER_SUB_QUOTA_UNMET);
  });
});

describe('the Rule 11 stipend', () => {
  it('takes the prescribed rate for the qualification', () => {
    expect(prescribedStipend('SCHOOL_10', 1).prescribed).toBe(
      PRESCRIBED_STIPEND.SCHOOL_10,
    );
    expect(prescribedStipend('DEGREE', 1).prescribed).toBe(9000);
  });

  it('uplifts ten per cent in year two', () => {
    expect(prescribedStipend('SCHOOL_10', 2).prescribed).toBe(6600);
  });

  it('uplifts fifteen per cent in year three', () => {
    expect(prescribedStipend('SCHOOL_10', 3).prescribed).toBe(6900);
  });

  it('takes a revised table from the rule set', () => {
    // The Rule 11 figures are revised by notification, so an establishment
    // assessed for an earlier year needs the ones in force then.
    expect(
      prescribedStipend('SCHOOL_10', 1, {
        prescribedStipends: { SCHOOL_10: 5000 },
      }).prescribed,
    ).toBe(5000);
  });

  it('falls back to Rule 11 where the rule set carries no table', () => {
    // A stored rule set with no stipends must not zero every prescribed rate
    // and make every shortfall vanish.
    expect(
      prescribedStipend('SCHOOL_10', 1, { bandFloorPercent: 2.5 }).prescribed,
    ).toBe(6000);
  });

  it('computes the uplift on the prescribed rate, not on what was paid', () => {
    // An employer paying ₹12,000 to a class-10 apprentice in year one owes
    // ₹6,600 in year two, not ₹13,200. Generosity does not compound.
    const stipend = monthlyStipend({
      qualification: 'SCHOOL_10',
      year: 2,
      actualStipend: 12000,
      workingDays: 26,
      daysAttended: 26,
    });

    expect(stipend.prescribedFullMonth).toBe(6600);
    expect(stipend.shortfall).toBe(0);
  });

  it('reports a shortfall against the prescribed rate', () => {
    const stipend = monthlyStipend({
      qualification: 'DIPLOMA',
      year: 1,
      actualStipend: 6000,
      workingDays: 26,
      daysAttended: 26,
    });

    expect(stipend.prescribed).toBe(8000);
    expect(stipend.shortfall).toBe(2000);
    expect(codesOf(stipend)).toContain(FINDING.STIPEND_BELOW_PRESCRIBED);
  });

  it('prorates on attendance', () => {
    const stipend = monthlyStipend({
      qualification: 'SCHOOL_10',
      year: 1,
      actualStipend: 6000,
      workingDays: 26,
      daysAttended: 13,
    });

    expect(stipend.prescribed).toBe(3000);
    expect(stipend.paid).toBe(3000);
  });

  it('does not treat a holiday as an absence', () => {
    // The opposite convention from `salaryCalculator.js`. Reusing that would
    // under-pay every apprentice in every month with a public holiday in it.
    const stipend = monthlyStipend({
      qualification: 'SCHOOL_10',
      year: 1,
      actualStipend: 6000,
      workingDays: 26,
      daysAttended: 24,
      holidays: 2,
    });

    expect(stipend.creditedDays).toBe(26);
    expect(stipend.prescribed).toBe(6000);
  });

  it('does not treat authorised leave as an absence either', () => {
    const stipend = monthlyStipend({
      qualification: 'SCHOOL_10',
      year: 1,
      actualStipend: 6000,
      workingDays: 26,
      daysAttended: 22,
      authorisedLeaveDays: 4,
    });

    expect(stipend.creditedDays).toBe(26);
  });

  it('never credits more days than the month has', () => {
    const stipend = monthlyStipend({
      qualification: 'SCHOOL_10',
      year: 1,
      actualStipend: 6000,
      workingDays: 26,
      daysAttended: 26,
      holidays: 4,
    });

    expect(stipend.creditedDays).toBe(26);
    expect(stipend.prescribed).toBe(6000);
  });
});

describe('NAPS reimbursement', () => {
  it('is a quarter of the stipend', () => {
    const naps = napsReimbursement({
      stipendPaid: 5000,
      daysAttended: 26,
      registrationStatus: REGISTRATION.REGISTERED,
    });

    expect(naps.amount).toBe(1250);
    expect(naps.capped).toBe(false);
  });

  it('caps at ₹1,500 a month', () => {
    const naps = napsReimbursement({
      stipendPaid: 9000,
      daysAttended: 26,
      registrationStatus: REGISTRATION.REGISTERED,
    });

    expect(naps.amount).toBe(1500);
    expect(naps.capped).toBe(true);
  });

  it('is nothing where the contract is not registered', () => {
    expect(
      napsReimbursement({
        stipendPaid: 5000,
        daysAttended: 26,
        registrationStatus: REGISTRATION.PENDING,
      }).amount,
    ).toBe(0);

    expect(
      napsReimbursement({
        stipendPaid: 5000,
        daysAttended: 26,
        registrationStatus: REGISTRATION.LAPSED,
      }).amount,
    ).toBe(0);
  });

  it('is nothing below the attendance threshold', () => {
    const naps = napsReimbursement({
      stipendPaid: 5000,
      daysAttended: 10,
      registrationStatus: REGISTRATION.REGISTERED,
    });

    expect(naps.amount).toBe(0);
    expect(naps.findings.map((f) => f.code)).toContain(
      FINDING.NAPS_ATTENDANCE_UNMET,
    );
  });

  it('does not reduce the stipend', () => {
    // A receivable, not a discount. Netting it off would pay the apprentice
    // below the prescribed minimum, which is a breach of section 13 whatever
    // the government later refunds.
    const apprentice = assessApprentice({
      apprentice: {
        apprenticeId: 'a1',
        qualification: 'SCHOOL_10',
        engagedOn: '2026-01-05',
        registeredOn: '2026-01-20',
        currentYear: 1,
      },
      months: [
        {
          month: 2,
          calendarYear: 2026,
          stipendPaid: 6000,
          workingDays: 26,
          daysAttended: 26,
        },
      ],
      asAt: '2026-03-01',
    });

    expect(apprentice.stipendPaid).toBe(6000);
    expect(apprentice.reimbursement).toBe(1500);
    expect(apprentice.stipendShortfall).toBe(0);
  });
});

describe('registration and the thirty-day window', () => {
  it('is pending inside the window', () => {
    const status = registrationStatus({
      engagedOn: '2026-06-01',
      asAt: '2026-06-20',
    });

    expect(status.status).toBe(REGISTRATION.PENDING);
    expect(status.dueBy.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('lapses past it', () => {
    const status = registrationStatus({
      engagedOn: '2026-06-01',
      asAt: '2026-07-15',
    });

    expect(status.status).toBe(REGISTRATION.LAPSED);
    expect(status.daysLate).toBe(14);
  });

  it('counts a late registration as registered', () => {
    // The Act's remedy for lateness is the section 30 penalty, not a
    // retrospective loss of apprentice status, so day forty is REGISTERED.
    const status = registrationStatus({
      engagedOn: '2026-06-01',
      registeredOn: '2026-07-11',
      asAt: '2026-08-01',
    });

    expect(status.status).toBe(REGISTRATION.REGISTERED);
    expect(status.daysLate).toBe(10);
  });

  it('is not late where it was registered inside the window', () => {
    const status = registrationStatus({
      engagedOn: '2026-06-01',
      registeredOn: '2026-06-15',
    });

    expect(status.status).toBe(REGISTRATION.REGISTERED);
    expect(status.daysLate).toBe(0);
  });

  it('uses the exact window from the rule set', () => {
    const status = registrationStatus({
      engagedOn: '2026-06-01',
      asAt: '2026-07-01',
    });

    expect(status.status).toBe(REGISTRATION.PENDING);
    expect(APPRENTICESHIP_RULES.registrationWindowDays).toBe(30);
  });
});

describe('the exposure an unregistered contract creates', () => {
  it('is exactly the exclusions section 18 took', () => {
    const exposure = unregisteredExposure({
      stipendPaidInPeriod: 60000,
      months: 10,
    });

    expect(exposure.providentFund).toBe(7200);
    expect(exposure.esi).toBe(1950);
    expect(exposure.bonus).toBe(4998);
    expect(exposure.total).toBe(14148);
  });

  it('carries no gratuity below five years', () => {
    const exposure = unregisteredExposure({
      stipendPaidInPeriod: 60000,
      months: 10,
    });

    expect(exposure.gratuityApplies).toBe(false);
    expect(exposure.gratuity).toBe(0);
  });

  it('carries gratuity past five years', () => {
    const exposure = unregisteredExposure({
      stipendPaidInPeriod: 360000,
      months: 60,
    });

    expect(exposure.gratuityApplies).toBe(true);
    expect(exposure.gratuity).toBeGreaterThan(0);
  });

  it('is attached to the apprentice when the contract has lapsed', () => {
    const apprentice = assessApprentice({
      apprentice: {
        apprenticeId: 'a2',
        name: 'Unregistered',
        qualification: 'SCHOOL_12',
        engagedOn: '2026-01-05',
        currentYear: 1,
      },
      months: [1, 2, 3].map((month) => ({
        month,
        calendarYear: 2026,
        stipendPaid: 7000,
        workingDays: 26,
        daysAttended: 26,
      })),
      asAt: '2026-06-01',
    });

    expect(apprentice.registration.status).toBe(REGISTRATION.LAPSED);
    expect(apprentice.exposure.total).toBeGreaterThan(0);

    const entry = apprentice.findings.find(
      (f) => f.code === FINDING.REGISTRATION_LAPSED,
    );
    expect(entry.severity).toBe(SEVERITY.EXPOSURE);
  });

  it('is nothing where the contract was registered', () => {
    const apprentice = assessApprentice({
      apprentice: {
        apprenticeId: 'a3',
        qualification: 'SCHOOL_12',
        engagedOn: '2026-01-05',
        registeredOn: '2026-01-20',
        currentYear: 1,
      },
      months: [
        {
          month: 2,
          calendarYear: 2026,
          stipendPaid: 7000,
          workingDays: 26,
          daysAttended: 26,
        },
      ],
      asAt: '2026-06-01',
    });

    expect(apprentice.exposure).toBeNull();
  });
});

describe('the establishment', () => {
  const apprentice = (id, extra = {}) => ({
    apprentice: {
      apprenticeId: id,
      name: id,
      qualification: 'SCHOOL_12',
      engagedOn: '2026-01-05',
      registeredOn: '2026-01-20',
      currentYear: 1,
      isFresher: true,
      ...extra,
    },
    months: [
      {
        month: 2,
        calendarYear: 2026,
        stipendPaid: 7000,
        workingDays: 26,
        daysAttended: 26,
      },
    ],
  });

  const result = assessEstablishment({
    composition: { directEmployees: 100, contractWorkers: 40 },
    apprentices: [
      apprentice('a'),
      apprentice('b'),
      apprentice('c', { registeredOn: null }),
    ],
    asAt: '2026-06-01',
  });

  it('derives the apprentice count from the roll rather than the caller', () => {
    // So the band cannot be evaluated against a number that disagrees with the
    // list standing next to it.
    expect(result.band.apprentices).toBe(3);
    expect(result.apprenticeCount).toBe(3);
  });

  it('includes the apprentices in the total strength', () => {
    expect(result.band.totalStrength).toBe(143);
  });

  it('separates registered from lapsed', () => {
    expect(result.registeredCount).toBe(2);
    expect(result.lapsedCount).toBe(1);
  });

  it('totals the reimbursement receivable', () => {
    // Two registered at ₹1,500 each; the lapsed one claims nothing.
    expect(result.reimbursementReceivable).toBe(3000);
  });

  it('totals the exposure from the lapsed contract', () => {
    expect(result.exposure).toBeGreaterThan(0);
  });

  it('reports the band shortfall', () => {
    // 2.5% of 143 is 3.575, so four are required and three are engaged.
    expect(result.band.floor).toBe(4);
    expect(result.band.shortfall).toBe(1);
    expect(codesOf(result)).toContain(FINDING.BELOW_BAND_FLOOR);
  });

  it('carries the apprentice onto their own findings', () => {
    const entry = result.findings.find(
      (f) => f.code === FINDING.REGISTRATION_LAPSED,
    );

    expect(entry.apprenticeName).toBe('c');
  });

  it('summarises by code', () => {
    const entry = result.summary.find(
      (f) => f.code === FINDING.REGISTRATION_LAPSED,
    );

    expect(entry.apprenticeCount).toBe(1);
    expect(entry.section).toBe('section 4(4)');
  });

  it('totals the stipend shortfall across the roll', () => {
    const underpaid = assessEstablishment({
      composition: { directEmployees: 100 },
      apprentices: [
        {
          apprentice: {
            apprenticeId: 'd',
            qualification: 'DEGREE',
            engagedOn: '2026-01-05',
            registeredOn: '2026-01-20',
            currentYear: 1,
          },
          months: [
            {
              month: 2,
              calendarYear: 2026,
              stipendPaid: 6000,
              workingDays: 26,
              daysAttended: 26,
            },
          ],
        },
      ],
      asAt: '2026-06-01',
    });

    // ₹9,000 prescribed for a degree, ₹6,000 paid.
    expect(underpaid.stipendShortfall).toBe(3000);
  });
});
