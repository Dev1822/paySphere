/**
 * Minimum Wages Act, 1948 (#1698).
 *
 * The boundaries worth naming, because each is a place the number goes wrong
 * quietly rather than loudly:
 *
 *   - the section 2(h) exclusions, which are the difference between a structure
 *     that looks compliant and one that is;
 *   - the VDA floor, since the index does fall;
 *   - notification selection by *wage period*, not by publication date;
 *   - pro-rating, which is what stops every joiner reading as a breach;
 *   - the ordinary rate for overtime being the higher of the two rates;
 *   - and arrears netting off the shortfall already recognised, so a
 *     retrospective revision run twice does not bill twice.
 */

const {
  EXCLUDED_COMPONENT,
  SKILL_CATEGORY,
  AREA_CLASS,
  RATE_BASIS,
  EXCLUSION,
  WORKING_DAYS_PER_MONTH,
  classifyComponent,
  computeVda,
  notifiedRate,
  notificationInForce,
  comparableWage,
  overtimeEntitlement,
  assessEmployee,
  assessPeriod,
  retrospectiveArrears,
  applicableMinimumWage,
} = require('../minimumWages');

const KEY = {
  state: 'KA',
  scheduledEmployment: 'SHOPS_AND_ESTABLISHMENTS',
  areaClass: AREA_CLASS.ZONE_I,
  skillCategory: SKILL_CATEGORY.SKILLED,
};

/** A notification with the fields the engine reads and nothing else. */
const notification = (overrides = {}) => ({
  ...KEY,
  notificationRef: 'KA/LW/2025/01',
  effectiveFrom: new Date('2025-04-01T00:00:00Z'),
  rateBasis: RATE_BASIS.MONTHLY,
  basicRate: 15000,
  vdaBaseCpiPoints: 100,
  vdaRatePerPoint: 20,
  vdaRounding: 1,
  ...overrides,
});

/** An employee row in the shape the controller assembles. */
const employee = (overrides = {}) => ({
  employeeId: 'e1',
  name: 'A Kumar',
  designation: 'Technician',
  ...KEY,
  daysWorked: 26,
  daysInPeriod: 26,
  overtimeHours: 0,
  overtimePaid: 0,
  components: [
    { name: 'Basic', amount: 12000 },
    { name: 'Dearness allowance', amount: 6000 },
  ],
  ...overrides,
});

describe('section 2(h): what counts as wages', () => {
  it.each([
    ['HRA', EXCLUDED_COMPONENT.HOUSE_RENT_ALLOWANCE],
    ['House rent allowance', EXCLUDED_COMPONENT.HOUSE_RENT_ALLOWANCE],
    ['Employer PF contribution', EXCLUDED_COMPONENT.EMPLOYER_PF_CONTRIBUTION],
    ['Employer ESI', EXCLUDED_COMPONENT.EMPLOYER_ESI_CONTRIBUTION],
    ['Conveyance', EXCLUDED_COMPONENT.TRAVEL_CONCESSION],
    [
      'Telephone reimbursement',
      EXCLUDED_COMPONENT.SPECIAL_EXPENSE_REIMBURSEMENT,
    ],
    ['Gratuity', EXCLUDED_COMPONENT.GRATUITY],
    ['Statutory bonus', EXCLUDED_COMPONENT.BONUS],
    ['Overtime pay', EXCLUDED_COMPONENT.OVERTIME],
  ])('%s is excluded as %s', (name, code) => {
    expect(classifyComponent(name)).toBe(code);
  });

  it.each([
    ['Basic'],
    ['Dearness allowance'],
    ['Special allowance'],
    ['City compensatory allowance'],
  ])('%s counts', (name) => {
    expect(classifyComponent(name)).toBeNull();
  });

  it('excludes the employer PF share and not the employee one', () => {
    // The proviso carves out the *employer's* contribution. The employee's own
    // deduction is made out of wages that have already been earned, so removing
    // it would understate what the employer offered.
    expect(classifyComponent('Employee PF deduction')).toBeNull();
    expect(classifyComponent('Employer PF contribution')).toBe(
      EXCLUDED_COMPONENT.EMPLOYER_PF_CONTRIBUTION,
    );
  });

  it('an unnamed component counts rather than disappearing', () => {
    expect(classifyComponent('')).toBeNull();
    expect(classifyComponent(undefined)).toBeNull();
  });

  it('splits a structure into what counts and what does not', () => {
    const result = comparableWage([
      { name: 'Basic', amount: 9000 },
      { name: 'Dearness allowance', amount: 2000 },
      { name: 'HRA', amount: 7000 },
      { name: 'Conveyance', amount: 1600 },
    ]);

    expect(result.comparableWage).toBe(11000);
    expect(result.counted).toHaveLength(2);
    expect(result.excluded.map((c) => c.code)).toEqual([
      EXCLUDED_COMPONENT.HOUSE_RENT_ALLOWANCE,
      EXCLUDED_COMPONENT.TRAVEL_CONCESSION,
    ]);
  });

  it('a ₹18,000 structure with ₹7,000 HRA offers ₹11,000, not ₹18,000', () => {
    // The whole reason this module exists.
    const { comparableWage: wage } = comparableWage([
      { name: 'Basic', amount: 11000 },
      { name: 'HRA', amount: 7000 },
    ]);

    expect(wage).toBe(11000);
  });

  it('honours a tenant’s own component mapping', () => {
    const patterns = [
      [/^site_allow/i, EXCLUDED_COMPONENT.SPECIAL_EXPENSE_REIMBURSEMENT],
    ];

    const result = comparableWage(
      [
        { name: 'HRA', amount: 5000 },
        { name: 'site_allowance', amount: 2000 },
      ],
      patterns,
    );

    // HRA is no longer matched, because the tenant's list replaced the default
    // rather than extending it. Deliberate: a partial override that silently
    // kept the defaults would be impossible to reason about.
    expect(result.comparableWage).toBe(5000);
    expect(result.excluded).toHaveLength(1);
  });
});

describe('variable dearness allowance', () => {
  it('is the index movement times the notified rate per point', () => {
    expect(computeVda(notification(), 137)).toMatchObject({
      points: 37,
      vda: 740,
      applied: true,
    });
  });

  it('floors at zero when the index falls below the base', () => {
    // The notified rate is a ratchet. A negative VDA would push the rate below
    // the gazetted basic, which no state notification permits.
    expect(computeVda(notification(), 82)).toMatchObject({ points: 0, vda: 0 });
  });

  it('is nil where the notification carries no VDA', () => {
    expect(computeVda(notification({ vdaRatePerPoint: 0 }), 200)).toEqual({
      points: 0,
      vda: 0,
      applied: false,
    });
  });

  it('rounds up to the notification’s own step', () => {
    const n = notification({ vdaRatePerPoint: 2.37, vdaRounding: 1 });
    // 37 × 2.37 = 87.69, gazetted as ₹88.
    expect(computeVda(n, 137).vda).toBe(88);
  });

  it('rounds to ten paise where the notification does', () => {
    const n = notification({ vdaRatePerPoint: 2.37, vdaRounding: 0.1 });
    expect(computeVda(n, 137).vda).toBe(87.7);
  });
});

describe('the notified rate', () => {
  it('is basic plus VDA for a monthly notification', () => {
    const rate = notifiedRate(notification(), 137);

    expect(rate.basic).toBe(15000);
    expect(rate.vda).toBe(740);
    expect(rate.monthlyRate).toBe(15740);
  });

  it('derives the day rate on twenty-six days, not on the calendar month', () => {
    const rate = notifiedRate(notification({ vdaRatePerPoint: 0 }), 137);

    expect(rate.dailyRate).toBe(
      Math.round((15000 / WORKING_DAYS_PER_MONTH + Number.EPSILON) * 100) / 100,
    );
  });

  it('a daily notification is monthly-ised on twenty-six days', () => {
    // Multiplying by the days in the month instead would make February and
    // March produce different monthly rates from one unchanged notification.
    const rate = notifiedRate(
      notification({
        rateBasis: RATE_BASIS.DAILY,
        basicRate: 600,
        vdaRatePerPoint: 0,
      }),
      137,
    );

    expect(rate.dailyRate).toBe(600);
    expect(rate.monthlyRate).toBe(600 * WORKING_DAYS_PER_MONTH);
  });

  it('the hourly rate is the day rate over an eight-hour day', () => {
    const rate = notifiedRate(
      notification({
        rateBasis: RATE_BASIS.DAILY,
        basicRate: 800,
        vdaRatePerPoint: 0,
      }),
      137,
    );

    expect(rate.hourlyRate).toBe(100);
  });
});

describe('which notification is in force', () => {
  const april = notification({
    notificationRef: 'APR',
    effectiveFrom: new Date('2025-04-01T00:00:00Z'),
    basicRate: 15000,
  });
  const october = notification({
    notificationRef: 'OCT',
    effectiveFrom: new Date('2025-10-01T00:00:00Z'),
    basicRate: 16200,
  });

  it('picks the latest one in force on the wage period', () => {
    expect(
      notificationInForce(
        [april, october],
        KEY,
        new Date('2025-11-30T00:00:00Z'),
      ).notificationRef,
    ).toBe('OCT');
  });

  it('does not apply a later notification to an earlier period', () => {
    // Reassessing a closed period against today's rate manufactures arrears
    // that were never owed, which is why superseded notifications are kept.
    expect(
      notificationInForce(
        [april, october],
        KEY,
        new Date('2025-06-30T00:00:00Z'),
      ).notificationRef,
    ).toBe('APR');
  });

  it('applies a notification published late but effective early', () => {
    // Published in July, effective April. June is covered.
    expect(
      notificationInForce([april], KEY, new Date('2025-06-30T00:00:00Z')),
    ).not.toBeNull();
  });

  it('is null before the first notification takes effect', () => {
    expect(
      notificationInForce([april], KEY, new Date('2025-03-31T00:00:00Z')),
    ).toBeNull();
  });

  it('does not cross skill categories', () => {
    expect(
      notificationInForce(
        [april],
        { ...KEY, skillCategory: SKILL_CATEGORY.UNSKILLED },
        new Date('2025-06-30T00:00:00Z'),
      ),
    ).toBeNull();
  });

  it('does not cross area classes or states', () => {
    expect(
      notificationInForce(
        [april],
        { ...KEY, areaClass: AREA_CLASS.ZONE_III },
        new Date('2025-06-30'),
      ),
    ).toBeNull();
    expect(
      notificationInForce(
        [april],
        { ...KEY, state: 'MH' },
        new Date('2025-06-30'),
      ),
    ).toBeNull();
  });
});

describe('section 14 overtime', () => {
  it('prices at twice the ordinary rate', () => {
    const result = overtimeEntitlement({
      overtimeHours: 10,
      comparableWage: 20800, // ₹100/hour on 26 × 8
      notifiedMonthlyRate: 15600,
      overtimePaid: 0,
    });

    expect(result.ordinaryHourlyRate).toBe(100);
    expect(result.entitlement).toBe(2000);
    expect(result.shortfall).toBe(2000);
  });

  it('uses the employee’s own rate where it exceeds the notified one', () => {
    // The Act floors the ordinary rate; it does not cap it. An employee paid
    // above the minimum does not have their overtime priced at the minimum.
    const result = overtimeEntitlement({
      overtimeHours: 5,
      comparableWage: 41600, // ₹200/hour
      notifiedMonthlyRate: 15600, // ₹75/hour
      overtimePaid: 0,
    });

    expect(result.ordinaryHourlyRate).toBe(200);
    expect(result.entitlement).toBe(2000);
  });

  it('uses the notified rate where the employee is paid below it', () => {
    const result = overtimeEntitlement({
      overtimeHours: 5,
      comparableWage: 10400, // ₹50/hour
      notifiedMonthlyRate: 20800, // ₹100/hour
      overtimePaid: 0,
    });

    expect(result.ordinaryHourlyRate).toBe(100);
    expect(result.entitlement).toBe(1000);
  });

  it('nets off what payroll already paid', () => {
    const result = overtimeEntitlement({
      overtimeHours: 10,
      comparableWage: 20800,
      notifiedMonthlyRate: 15600,
      overtimePaid: 1500,
    });

    expect(result.shortfall).toBe(500);
  });

  it('never reports a negative shortfall when payroll overpaid', () => {
    const result = overtimeEntitlement({
      overtimeHours: 10,
      comparableWage: 20800,
      notifiedMonthlyRate: 15600,
      overtimePaid: 5000,
    });

    expect(result.shortfall).toBe(0);
  });

  it('is nil where no overtime was worked', () => {
    expect(
      overtimeEntitlement({
        overtimeHours: 0,
        comparableWage: 20800,
        notifiedMonthlyRate: 15600,
        overtimePaid: 0,
      }).entitlement,
    ).toBe(0);
  });
});

describe('assessing one employee', () => {
  const period = {
    periodStart: new Date('2025-06-01T00:00:00Z'),
    periodEnd: new Date('2025-06-30T00:00:00Z'),
    cpiPoints: 137,
  };

  it('reports a shortfall against the notified rate', () => {
    const result = assessEmployee({
      employee: employee(),
      notifications: [notification()],
      ...period,
    });

    expect(result.assessed).toBe(true);
    expect(result.notifiedMonthlyRate).toBe(15740);
    expect(result.comparableWage).toBe(18000);
    expect(result.shortfall).toBe(0);
    expect(result.compliant).toBe(true);
  });

  it('a structure loaded with HRA fails against the same gross', () => {
    const result = assessEmployee({
      employee: employee({
        components: [
          { name: 'Basic', amount: 9000 },
          { name: 'HRA', amount: 7000 },
          { name: 'Conveyance', amount: 2000 },
        ],
      }),
      notifications: [notification()],
      ...period,
    });

    expect(result.grossPaid).toBe(18000);
    expect(result.comparableWage).toBe(9000);
    expect(result.shortfall).toBe(6740);
    expect(result.compliant).toBe(false);
  });

  it('pro-rates the entitlement for a part month', () => {
    // A joiner who worked 13 of 26 days is owed half the notified rate, not the
    // whole of it. Without this every joiner and leaver reads as a breach.
    const result = assessEmployee({
      employee: employee({
        daysWorked: 13,
        components: [{ name: 'Basic', amount: 7870 }],
      }),
      notifications: [notification()],
      ...period,
    });

    expect(result.proRataFraction).toBe(0.5);
    expect(result.entitlement).toBe(7870);
    expect(result.shortfall).toBe(0);
  });

  it('does not pro-rate above one for extra days worked', () => {
    // Days beyond the wage period's twenty-six are overtime, priced by
    // section 14, and must not inflate the ordinary entitlement as well.
    const result = assessEmployee({
      employee: employee({ daysWorked: 30 }),
      notifications: [notification()],
      ...period,
    });

    expect(result.proRataFraction).toBe(1);
    expect(result.entitlement).toBe(15740);
  });

  it('excludes an employee with no notification on record', () => {
    const result = assessEmployee({
      employee: employee({ state: 'MH' }),
      notifications: [notification()],
      ...period,
    });

    expect(result.assessed).toBe(false);
    expect(result.code).toBe(EXCLUSION.NO_NOTIFICATION);
    expect(result.reason).toMatch(/no notification/i);
  });

  it('excludes an employee with no components', () => {
    const result = assessEmployee({
      employee: employee({ components: [] }),
      notifications: [notification()],
      ...period,
    });

    expect(result.code).toBe(EXCLUSION.NO_WAGE_DATA);
  });

  it('excludes an employee who worked no days', () => {
    const result = assessEmployee({
      employee: employee({ daysWorked: 0 }),
      notifications: [notification()],
      ...period,
    });

    expect(result.code).toBe(EXCLUSION.NO_DAYS_WORKED);
  });

  it('carries the notification reference onto the line', () => {
    // The register has to say which gazette entry produced the figure.
    const result = assessEmployee({
      employee: employee(),
      notifications: [notification()],
      ...period,
    });

    expect(result.notificationRef).toBe('KA/LW/2025/01');
    expect(result.vdaPoints).toBe(37);
  });

  it('adds the overtime shortfall to the wage shortfall', () => {
    const result = assessEmployee({
      employee: employee({
        components: [{ name: 'Basic', amount: 10400 }],
        overtimeHours: 10,
        overtimePaid: 0,
      }),
      notifications: [notification()],
      ...period,
    });

    expect(result.shortfall).toBe(5340);
    expect(result.overtime.shortfall).toBeGreaterThan(0);
    expect(result.totalShortfall).toBe(
      Math.round((result.shortfall + result.overtime.shortfall) * 100) / 100,
    );
  });
});

describe('assessing a period', () => {
  const period = {
    periodStart: new Date('2025-06-01T00:00:00Z'),
    periodEnd: new Date('2025-06-30T00:00:00Z'),
    cpiPoints: 137,
    notifications: [notification()],
  };

  it('separates assessed lines from exclusions', () => {
    const result = assessPeriod({
      ...period,
      employees: [
        employee({ employeeId: 'a' }),
        employee({ employeeId: 'b', state: 'MH' }),
      ],
    });

    expect(result.assessedCount).toBe(1);
    expect(result.excludedCount).toBe(1);
  });

  it('totals the wage and overtime shortfalls separately', () => {
    const result = assessPeriod({
      ...period,
      employees: [
        employee({
          employeeId: 'a',
          components: [{ name: 'Basic', amount: 10000 }],
        }),
        employee({
          employeeId: 'b',
          components: [{ name: 'Basic', amount: 15740 }],
          overtimeHours: 10,
        }),
      ],
    });

    expect(result.wageShortfall).toBe(5740);
    expect(result.overtimeShortfall).toBeGreaterThan(0);
    expect(result.totalShortfall).toBe(
      Math.round((result.wageShortfall + result.overtimeShortfall) * 100) / 100,
    );
  });

  it('is compliant when nothing is short', () => {
    const result = assessPeriod({ ...period, employees: [employee()] });

    expect(result.compliant).toBe(true);
    expect(result.shortfallCount).toBe(0);
  });

  it('groups by state, worst first', () => {
    const mhNotification = notification({
      state: 'MH',
      notificationRef: 'MH/2025',
      basicRate: 18000,
      vdaRatePerPoint: 0,
    });

    const result = assessPeriod({
      ...period,
      notifications: [notification(), mhNotification],
      employees: [
        employee({
          employeeId: 'a',
          components: [{ name: 'Basic', amount: 15000 }],
        }),
        employee({
          employeeId: 'b',
          state: 'MH',
          components: [{ name: 'Basic', amount: 9000 }],
        }),
      ],
    });

    expect(result.byState[0]).toMatchObject({ state: 'MH', shortfall: 9000 });
    expect(result.byState[1].state).toBe('KA');
  });

  it('an empty workforce is compliant rather than an error', () => {
    const result = assessPeriod({ ...period, employees: [] });

    expect(result.compliant).toBe(true);
    expect(result.totalShortfall).toBe(0);
  });
});

describe('retrospective revision arrears', () => {
  const priorPeriod = {
    periodStart: new Date('2025-04-01T00:00:00Z'),
    periodEnd: new Date('2025-04-30T00:00:00Z'),
    lines: [
      {
        ...KEY,
        employeeId: 'a',
        name: 'A Kumar',
        proRataFraction: 1,
        comparableWage: 15000,
        entitlement: 15000,
        shortfall: 0,
      },
    ],
  };

  const revision = notification({
    notificationRef: 'KA/LW/2025/REV',
    effectiveFrom: new Date('2025-04-01T00:00:00Z'),
    basicRate: 16000,
    vdaRatePerPoint: 0,
  });

  it('bills the difference for the elapsed periods', () => {
    const result = retrospectiveArrears({
      periods: [priorPeriod],
      notification: revision,
      cpiPoints: 137,
    });

    expect(result.totalArrear).toBe(1000);
    expect(result.employeeCount).toBe(1);
    expect(result.periods[0].lines[0]).toMatchObject({
      previousShortfall: 0,
      revisedShortfall: 1000,
      arrear: 1000,
    });
  });

  it('nets off a shortfall already recognised', () => {
    // Running the same revision twice must not bill the employer twice.
    const alreadyShort = {
      ...priorPeriod,
      lines: [{ ...priorPeriod.lines[0], shortfall: 600 }],
    };

    const result = retrospectiveArrears({
      periods: [alreadyShort],
      notification: revision,
      cpiPoints: 137,
    });

    expect(result.totalArrear).toBe(400);
  });

  it('ignores periods that closed before the effective date', () => {
    const march = {
      ...priorPeriod,
      periodStart: new Date('2025-03-01T00:00:00Z'),
      periodEnd: new Date('2025-03-31T00:00:00Z'),
    };

    const result = retrospectiveArrears({
      periods: [march],
      notification: revision,
      cpiPoints: 137,
    });

    expect(result.periods).toEqual([]);
    expect(result.totalArrear).toBe(0);
  });

  it('ignores lines in another state or skill category', () => {
    const mixed = {
      ...priorPeriod,
      lines: [
        { ...priorPeriod.lines[0], employeeId: 'b', state: 'MH' },
        {
          ...priorPeriod.lines[0],
          employeeId: 'c',
          skillCategory: SKILL_CATEGORY.UNSKILLED,
        },
      ],
    };

    const result = retrospectiveArrears({
      periods: [mixed],
      notification: revision,
      cpiPoints: 137,
    });

    expect(result.totalArrear).toBe(0);
  });

  it('applies the revised rate to the part-month fraction', () => {
    const halfMonth = {
      ...priorPeriod,
      lines: [
        {
          ...priorPeriod.lines[0],
          proRataFraction: 0.5,
          comparableWage: 7500,
          entitlement: 7500,
        },
      ],
    };

    const result = retrospectiveArrears({
      periods: [halfMonth],
      notification: revision,
      cpiPoints: 137,
    });

    expect(result.periods[0].lines[0].revisedEntitlement).toBe(8000);
    expect(result.totalArrear).toBe(500);
  });

  it('reports no arrear where the revision is not an increase', () => {
    const cut = notification({
      effectiveFrom: new Date('2025-04-01T00:00:00Z'),
      basicRate: 14000,
      vdaRatePerPoint: 0,
    });

    expect(
      retrospectiveArrears({
        periods: [priorPeriod],
        notification: cut,
        cpiPoints: 137,
      }).totalArrear,
    ).toBe(0);
  });
});

describe('the section 12 floor the bonus engine needs', () => {
  it('returns the notified monthly rate in force', () => {
    expect(
      applicableMinimumWage(
        [notification()],
        KEY,
        new Date('2025-06-30T00:00:00Z'),
        137,
      ),
    ).toBe(15740);
  });

  it('returns zero when nothing is notified, so the caller falls back', () => {
    // Zero rather than ₹7,000: the statutory floor belongs to the Payment of
    // Bonus Act and this module has no business asserting it.
    expect(
      applicableMinimumWage([], KEY, new Date('2025-06-30T00:00:00Z'), 137),
    ).toBe(0);
  });
});
