/**
 * Shops and Commercial Establishments Acts (#1972).
 *
 * The assertions that matter are the ones an expiry field in a document vault
 * cannot make: that a lapsed certificate is a *different* finding from a late
 * renewal, that the amendment clock runs from the date a particular changed
 * rather than from the date the comparison was run, that the two weekly-holiday
 * tests are independent, and that an unseeded state answers rather than
 * defaults.
 *
 * `LAPSED_IS_OPERATING_UNREGISTERED` has its own block. Collapsing the two into
 * one row is how a serious finding gets cleared alongside a trivial one.
 */

const {
  PARTICULAR,
  REGISTRATION_STATE,
  FINDING,
  SEVERITY,
  LAPSED_IS_OPERATING_UNREGISTERED,
  WEEKLY_HOLIDAY_IS_TWO_TESTS,
  daysBetween,
  resolveRules,
  headcountBand,
  registrationPosition,
  amendmentsDue,
  weeklyHolidayPosition,
  hoursBreaches,
  nightWorkPosition,
  closurePosition,
  assessEstablishment,
} = require('../shopsEstablishments');

const utc = (iso) => new Date(`${iso}T00:00:00.000Z`);
const codesOf = (findings) => findings.map((finding) => finding.code);

describe('resolveRules', () => {
  it('returns the seeded rules for a state', () => {
    expect(resolveRules('KA').renewalYears).toBe(5);
    expect(resolveRules('MH').renewalYears).toBe(10);
    expect(resolveRules('DL').renewalYears).toBe(1);
  });

  it('returns null for an unseeded state rather than a national default', () => {
    // There is no national Act. A module that averaged the state windows would
    // be wrong in every state rather than right in one.
    expect(resolveRules('XX')).toBeNull();
  });

  it('lets an override change one field of a seeded state', () => {
    const rules = resolveRules('KA', { KA: { renewalYears: 3 } });
    expect(rules.renewalYears).toBe(3);
    expect(rules.registrationWindowDays).toBe(30);
  });
});

describe('headcountBand', () => {
  const rules = resolveRules('KA');

  it('finds the band a count falls in', () => {
    expect(headcountBand(4, rules).label).toBe('Fewer than 10');
    expect(headcountBand(12, rules).label).toBe('10 to 19');
    expect(headcountBand(400, rules).label).toBe('20 and above');
  });

  it('handles the open top band', () => {
    expect(headcountBand(20, rules).label).toBe('20 and above');
  });
});

describe('registrationPosition', () => {
  const rules = resolveRules('KA');

  it('counts down while the window is still open', () => {
    const position = registrationPosition({
      commencedOn: '2026-06-01',
      rules,
      asAt: '2026-06-11',
    });

    expect(position.state).toBe(REGISTRATION_STATE.WITHIN_WINDOW);
    expect(position.applyBy).toEqual(utc('2026-07-01'));
    expect(position.daysRemaining).toBe(20);
  });

  it('reports an unregistered establishment past the window', () => {
    const position = registrationPosition({
      commencedOn: '2026-01-01',
      rules,
      asAt: '2026-06-01',
    });

    expect(position.state).toBe(REGISTRATION_STATE.NEVER_REGISTERED);
    expect(position.overdueByDays).toBe(
      daysBetween(utc('2026-01-31'), utc('2026-06-01')),
    );
  });

  it('derives the expiry from the state’s own renewal cycle', () => {
    const position = registrationPosition({
      commencedOn: '2021-01-01',
      registeredOn: '2021-01-15',
      rules,
      asAt: '2024-01-01',
    });

    expect(position.validTo).toEqual(utc('2026-01-15'));
    expect(position.state).toBe(REGISTRATION_STATE.CURRENT);
  });

  it('reports a lapsed certificate as lapsed, with how long', () => {
    const position = registrationPosition({
      commencedOn: '2018-01-01',
      registeredOn: '2018-01-15',
      rules,
      asAt: '2026-06-01',
    });

    expect(position.state).toBe(REGISTRATION_STATE.LAPSED);
    expect(position.lapsedByDays).toBeGreaterThan(0);
  });

  it('treats a cycle of null as perpetual rather than as unknown', () => {
    // A real answer in a few states, and not the same as an expiry nobody has
    // recorded.
    const position = registrationPosition({
      commencedOn: '2018-01-01',
      registeredOn: '2018-01-15',
      rules: { ...rules, renewalYears: null },
      asAt: '2026-06-01',
    });

    expect(position.perpetual).toBe(true);
    expect(position.state).toBe(REGISTRATION_STATE.CURRENT);
  });

  it('is closed once it has been closed and surrendered', () => {
    const position = registrationPosition({
      commencedOn: '2018-01-01',
      registeredOn: '2018-01-15',
      closedOn: '2026-01-01',
      surrenderedOn: '2026-01-10',
      rules,
      asAt: '2026-06-01',
    });

    expect(position.state).toBe(REGISTRATION_STATE.CLOSED);
  });
});

describe('amendmentsDue', () => {
  const rules = resolveRules('KA');

  it('dates the clock from when the particular changed, not from today', () => {
    // A hire that crossed a band in March started the clock in March. Dating it
    // from today reports an obligation already in default as one with fifteen
    // days left.
    const rows = amendmentsDue({
      onCertificate: { [PARTICULAR.HEADCOUNT_BAND]: 'Fewer than 10' },
      current: { [PARTICULAR.HEADCOUNT_BAND]: '10 to 19' },
      changedOn: { [PARTICULAR.HEADCOUNT_BAND]: '2026-03-01' },
      rules,
      asAt: '2026-06-01',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].notifyBy).toEqual(utc('2026-03-16'));
    expect(rows[0].overdue).toBe(true);
    expect(rows[0].daysRemaining).toBeNull();
  });

  it('counts down a change still inside the window', () => {
    const rows = amendmentsDue({
      onCertificate: { [PARTICULAR.ADDRESS]: 'Old' },
      current: { [PARTICULAR.ADDRESS]: 'New' },
      changedOn: { [PARTICULAR.ADDRESS]: '2026-06-01' },
      rules,
      asAt: '2026-06-06',
    });

    expect(rows[0].overdue).toBe(false);
    expect(rows[0].daysRemaining).toBe(10);
  });

  it('marks an undated change as undated rather than giving it fresh days', () => {
    const rows = amendmentsDue({
      onCertificate: { [PARTICULAR.MANAGER_NAME]: 'A' },
      current: { [PARTICULAR.MANAGER_NAME]: 'B' },
      rules,
      asAt: '2026-06-06',
    });

    expect(rows[0].undated).toBe(true);
    expect(rows[0].notifyBy).toBeNull();
  });

  it('raises nothing where the certificate still matches', () => {
    const rows = amendmentsDue({
      onCertificate: { [PARTICULAR.ADDRESS]: 'Same' },
      current: { [PARTICULAR.ADDRESS]: 'Same' },
      rules,
      asAt: '2026-06-06',
    });

    expect(rows).toEqual([]);
  });

  it('ignores a particular the certificate does not carry', () => {
    const rows = amendmentsDue({
      onCertificate: {},
      current: { [PARTICULAR.ADDRESS]: 'New' },
      rules,
      asAt: '2026-06-06',
    });

    expect(rows).toEqual([]);
  });
});

describe('weeklyHolidayPosition', () => {
  const rules = resolveRules('KA');

  it('keeps the two tests apart', () => {
    // An establishment trading seven days can still give each employee a day,
    // and a single verdict answers whichever question the reader was not
    // asking.
    const shifts = [];
    for (let day = 0; day < 7; day += 1) {
      shifts.push({
        employeeId: day % 2 === 0 ? 'a' : 'b',
        date: `2026-06-${String(7 + day).padStart(2, '0')}`,
      });
    }

    const position = weeklyHolidayPosition({ closingDay: 0, shifts, rules });

    // The establishment traded on its notified closing day...
    expect(position.tradedOnClosedDay).toHaveLength(1);
    // ...and neither employee worked all seven, so nobody lost their day.
    expect(position.employeesWithoutAWholeDay).toEqual([]);
    expect(position.note).toBe(WEEKLY_HOLIDAY_IS_TWO_TESTS);
  });

  it('finds an employee who worked every day of a week', () => {
    const shifts = [];
    for (let day = 0; day < 7; day += 1) {
      shifts.push({
        employeeId: 'a',
        date: `2026-06-${String(7 + day).padStart(2, '0')}`,
      });
    }

    const position = weeklyHolidayPosition({ closingDay: null, shifts, rules });

    expect(position.employeesWithoutAWholeDay).toHaveLength(1);
    expect(position.employeesWithoutAWholeDay[0].employeeId).toBe('a');
  });

  it('is not required where the state does not require it', () => {
    const position = weeklyHolidayPosition({
      closingDay: 0,
      shifts: [],
      rules: { ...rules, weeklyHolidayRequired: false },
    });

    expect(position.required).toBe(false);
  });
});

describe('hoursBreaches', () => {
  const rules = resolveRules('KA');

  it('finds a shift outside the notified hours', () => {
    const breaches = hoursBreaches({
      shifts: [
        { employeeId: 'a', date: '2026-06-01', startHour: 5, endHour: 14 },
        { employeeId: 'b', date: '2026-06-01', startHour: 9, endHour: 18 },
        { employeeId: 'c', date: '2026-06-01', startHour: 14, endHour: 23 },
      ],
      rules,
    });

    expect(breaches.map((shift) => shift.employeeId)).toEqual(['a', 'c']);
  });

  it('ignores a shift with no hours recorded', () => {
    expect(
      hoursBreaches({
        shifts: [{ employeeId: 'a', date: '2026-06-01' }],
        rules,
      }),
    ).toEqual([]);
  });
});

describe('nightWorkPosition', () => {
  const rules = resolveRules('KA');

  it('requires every condition together', () => {
    // Consent without transport is a breach with one box ticked, and reporting
    // it as partial compliance is how it stays that way.
    const position = nightWorkPosition({
      engagement: { consentRecordedOn: '2026-05-01', groupSize: 4 },
      rules,
    });

    expect(position.met).toBe(false);
    expect(position.unmet).toHaveLength(1);
    expect(position.allConditionsRequiredTogether).toBe(true);
  });

  it('is met where all three hold', () => {
    const position = nightWorkPosition({
      engagement: {
        consentRecordedOn: '2026-05-01',
        transportProvided: true,
        groupSize: 3,
      },
      rules,
    });

    expect(position.met).toBe(true);
  });

  it('fails on the minimum group size', () => {
    const position = nightWorkPosition({
      engagement: {
        consentRecordedOn: '2026-05-01',
        transportProvided: true,
        groupSize: 1,
      },
      rules,
    });

    expect(position.met).toBe(false);
    expect(position.unmet[0]).toMatch(/Fewer than 3/);
  });
});

describe('closurePosition', () => {
  const rules = resolveRules('KA');

  it('is overdue where the establishment closed and nobody told the Inspector', () => {
    const position = closurePosition({
      closedOn: '2026-01-01',
      rules,
      asAt: '2026-06-01',
    });

    expect(position.overdue).toBe(true);
    expect(position.dueBy).toEqual(utc('2026-01-16'));
  });

  it('is satisfied where the intimation was in time', () => {
    const position = closurePosition({
      closedOn: '2026-01-01',
      intimatedOn: '2026-01-10',
      rules,
      asAt: '2026-06-01',
    });

    expect(position.satisfied).toBe(true);
    expect(position.late).toBe(false);
  });

  it('is null where the establishment has not closed', () => {
    expect(closurePosition({ rules, asAt: '2026-06-01' })).toBeNull();
  });
});

describe('assessEstablishment', () => {
  it('reports an unseeded state as a gap and computes nothing', () => {
    const result = assessEstablishment({ state: 'XX' });

    expect(codesOf(result.findings)).toEqual([FINDING.STATE_RULES_UNKNOWN]);
    expect(result.registration).toBeNull();
  });

  it('raises operating-unregistered as its own finding beside the missed window', () => {
    // Two findings, not one. The window being missed is procedural; trading
    // without a certificate is separate and continuing.
    const result = assessEstablishment({
      state: 'KA',
      registration: { commencedOn: '2026-01-01' },
      asAt: '2026-06-01',
    });

    expect(codesOf(result.findings)).toContain(FINDING.REGISTRATION_OVERDUE);
    expect(codesOf(result.findings)).toContain(FINDING.OPERATING_UNREGISTERED);
  });

  it('reports a lapsed certificate as unregistered rather than as a late renewal', () => {
    const result = assessEstablishment({
      state: 'DL',
      registration: { commencedOn: '2020-01-01', registeredOn: '2020-02-01' },
      asAt: '2026-06-01',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.OPERATING_UNREGISTERED,
    );
    expect(finding.severity).toBe(SEVERITY.BREACH);
    expect(finding.detail).toBe(LAPSED_IS_OPERATING_UNREGISTERED);
    expect(codesOf(result.findings)).not.toContain(FINDING.RENEWAL_DUE);
  });

  it('counts down a renewal inside ninety days', () => {
    const result = assessEstablishment({
      state: 'DL',
      registration: { commencedOn: '2025-01-01', registeredOn: '2025-07-01' },
      asAt: '2026-05-15',
    });

    const finding = result.findings.find((f) => f.code === FINDING.RENEWAL_DUE);
    expect(finding.severity).toBe(SEVERITY.DUE);
    expect(finding.daysRemaining).toBe(47);
  });

  it('explains a headcount amendment as caused by a hire', () => {
    const result = assessEstablishment({
      state: 'KA',
      registration: { commencedOn: '2020-01-01', registeredOn: '2024-01-01' },
      particulars: {
        onCertificate: { [PARTICULAR.HEADCOUNT_BAND]: 'Fewer than 10' },
        current: { [PARTICULAR.HEADCOUNT_BAND]: '10 to 19' },
        changedOn: { [PARTICULAR.HEADCOUNT_BAND]: '2026-05-01' },
      },
      asAt: '2026-06-01',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.AMENDMENT_OVERDUE,
    );
    expect(finding.particular).toBe(PARTICULAR.HEADCOUNT_BAND);
    expect(finding.detail).toMatch(/ordinary hire crossed a band/);
  });

  it('reports a shift on the notified closing day without moving it', () => {
    const result = assessEstablishment({
      state: 'KA',
      registration: {
        commencedOn: '2020-01-01',
        registeredOn: '2024-01-01',
        closingDay: 0,
      },
      shifts: [{ employeeId: 'a', date: '2026-06-07' }],
      asAt: '2026-06-10',
    });

    const finding = result.findings.find(
      (f) => f.code === FINDING.TRADED_ON_CLOSED_DAY,
    );
    expect(finding.detail).toMatch(/roster is not moved by this module/);
  });

  it('reports the Factories Act overlap rather than reconciling it', () => {
    // #1702 keeps those ceilings. Where both Acts cover an establishment they
    // are separate obligations, not one to be netted off.
    const result = assessEstablishment({
      state: 'KA',
      registration: { commencedOn: '2020-01-01', registeredOn: '2024-01-01' },
      alsoCoveredByFactoriesAct: true,
      asAt: '2026-06-01',
    });

    expect(result.alsoCoveredByFactoriesAct).toBe(true);
  });

  it('carries both notes on every assessment', () => {
    const result = assessEstablishment({
      state: 'KA',
      registration: { commencedOn: '2020-01-01', registeredOn: '2024-01-01' },
      asAt: '2026-06-01',
    });

    expect(result.notes.lapsedIsOperatingUnregistered).toBe(
      LAPSED_IS_OPERATING_UNREGISTERED,
    );
    expect(result.notes.weeklyHolidayIsTwoTests).toBe(
      WEEKLY_HOLIDAY_IS_TWO_TESTS,
    );
  });
});

describe('LAPSED_IS_OPERATING_UNREGISTERED', () => {
  it('says the two are different findings with different consequences', () => {
    expect(LAPSED_IS_OPERATING_UNREGISTERED).toMatch(/trading unregistered/i);
    expect(LAPSED_IS_OPERATING_UNREGISTERED).toMatch(/different finding/i);
  });
});
