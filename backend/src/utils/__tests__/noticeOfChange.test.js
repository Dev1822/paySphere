/**
 * Section 9A notice of change (#1973).
 *
 * The tests are grouped around the five things that are easy to get wrong, and
 * each group is written so that the natural wrong answer fails:
 *
 *   - a change in the workman's favour must still require notice;
 *   - an unclassified change must come back UNDETERMINED and never EXEMPT;
 *   - a pending proceeding must come back as section 33 and never as a longer
 *     notice period;
 *   - the twenty-one days must be clear days, so a twenty-day notice fails;
 *   - the determination must be per person, so an establishment-wide change
 *     over a mixed population must produce fewer obliged than affected.
 */

const {
  FOURTH_SCHEDULE,
  CHANGE_VERDICT,
  EXEMPTION_GROUND,
  WORKMAN_GROUND,
  DEFAULT_RULES,
  resolveRules,
  classifyChange,
  determineWorkman,
  noticePopulation,
  noticeWindow,
  assessExemption,
  assessPendingProceeding,
  assessChange,
  orderQueue,
  formEFields,
} = require('../noticeOfChange');

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);

describe('the Fourth Schedule', () => {
  it('carries eleven items, each with the text a Form E has to state', () => {
    const items = Object.values(FOURTH_SCHEDULE);
    expect(items).toHaveLength(11);
    for (const item of items) {
      expect(typeof item.item).toBe('number');
      expect(item.text.length).toBeGreaterThan(10);
      expect(Array.isArray(item.effectedBy)).toBe(true);
    }
  });

  it('numbers the items uniquely', () => {
    const numbers = Object.values(FOURTH_SCHEDULE).map((i) => i.item);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('marks the two items qualified by standing orders', () => {
    expect(FOURTH_SCHEDULE.SHIFT_WORKING.qualifiedByStandingOrders).toBe(true);
    expect(FOURTH_SCHEDULE.RATIONALISATION.qualifiedByStandingOrders).toBe(
      true,
    );
  });

  it('marks item 8 as the one with no underlying document', () => {
    expect(
      FOURTH_SCHEDULE.WITHDRAWAL_OF_CONCESSION.hasNoUnderlyingDocument,
    ).toBe(true);
  });
});

describe('classifyChange', () => {
  it('takes a declared schedule item at face value', () => {
    const result = classifyChange({ scheduleItem: 'WAGES' });
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_REQUIRED);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].item).toBe(1);
    expect(result.inferred).toBe(false);
  });

  it('reports an unrecognised declared item as undetermined, not exempt', () => {
    const result = classifyChange({ scheduleItem: 'CANTEEN_PRICES' });
    expect(result.verdict).toBe(CHANGE_VERDICT.UNDETERMINED);
    expect(result.verdict).not.toBe(CHANGE_VERDICT.EXEMPT);
    expect(result.items).toHaveLength(0);
  });

  it('reports a change with nothing on it as undetermined', () => {
    expect(classifyChange({}).verdict).toBe(CHANGE_VERDICT.UNDETERMINED);
    expect(classifyChange(null).verdict).toBe(CHANGE_VERDICT.UNDETERMINED);
  });

  it('infers from the module effecting the change and says it inferred', () => {
    const result = classifyChange({ effectedBy: 'salaryRevision' });
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_REQUIRED);
    expect(result.inferred).toBe(true);
    expect(result.items.map((i) => i.key)).toContain('WAGES');
  });

  it('returns both items where a roster change is genuinely hours and shifts', () => {
    const result = classifyChange({ effectedBy: 'rostering' });
    const keys = result.items.map((i) => i.key);
    expect(keys).toContain('HOURS_AND_REST');
    expect(keys).toContain('SHIFT_WORKING');
    expect(result.reason).toMatch(/both/);
  });

  it('reports a module nothing is mapped to as undetermined', () => {
    const result = classifyChange({ effectedBy: 'flashcards' });
    expect(result.verdict).toBe(CHANGE_VERDICT.UNDETERMINED);
  });

  it('carves out a shift change made in accordance with standing orders', () => {
    const result = classifyChange({
      scheduleItem: 'SHIFT_WORKING',
      inAccordanceWithStandingOrders: true,
    });
    expect(result.verdict).toBe(CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER);
    expect(result.reason).toMatch(/standing orders/);
  });

  it('does not carve out a wages change on the standing orders ground', () => {
    const result = classifyChange({
      scheduleItem: 'WAGES',
      inAccordanceWithStandingOrders: true,
    });
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_REQUIRED);
  });

  it('carves out casual fluctuation from item 11 and nothing else', () => {
    expect(
      classifyChange({
        scheduleItem: 'HEADCOUNT_IN_DEPARTMENT',
        casualFluctuation: true,
      }).verdict,
    ).toBe(CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER);

    expect(
      classifyChange({ scheduleItem: 'WAGES', casualFluctuation: true })
        .verdict,
    ).toBe(CHANGE_VERDICT.NOTICE_REQUIRED);
  });

  it('classifies a favourable change exactly as it classifies an adverse one', () => {
    const raise = classifyChange({
      scheduleItem: 'COMPENSATORY_ALLOWANCE',
      description: 'shift allowance increased from 150 to 250',
      direction: 'INCREASE',
    });
    const cut = classifyChange({
      scheduleItem: 'COMPENSATORY_ALLOWANCE',
      description: 'shift allowance reduced from 250 to 150',
      direction: 'DECREASE',
    });
    expect(raise.verdict).toBe(cut.verdict);
    expect(raise.items[0].key).toBe(cut.items[0].key);
  });
});

describe('determineWorkman', () => {
  it('treats an ordinary employee as a workman', () => {
    const result = determineWorkman({
      capacity: 'OPERATIONAL',
      monthlyWages: 24000,
    });
    expect(result.isWorkman).toBe(true);
    expect(result.ground).toBe(WORKMAN_GROUND.WORKMAN);
  });

  it('excludes a manager however low the wages', () => {
    const result = determineWorkman({
      capacity: 'MANAGERIAL',
      monthlyWages: 8000,
    });
    expect(result.isWorkman).toBe(false);
    expect(result.ground).toBe(WORKMAN_GROUND.MANAGERIAL_OR_ADMINISTRATIVE);
  });

  it('excludes an administrative employee on the same ground', () => {
    expect(
      determineWorkman({ capacity: 'ADMINISTRATIVE', monthlyWages: 90000 })
        .ground,
    ).toBe(WORKMAN_GROUND.MANAGERIAL_OR_ADMINISTRATIVE);
  });

  it('keeps a supervisor under the threshold inside the population', () => {
    const result = determineWorkman({
      capacity: 'SUPERVISORY',
      monthlyWages: 9500,
    });
    expect(result.isWorkman).toBe(true);
    expect(result.ground).toBe(WORKMAN_GROUND.SUPERVISORY_BELOW_THRESHOLD);
  });

  it('excludes a supervisor above the threshold', () => {
    const result = determineWorkman({
      capacity: 'SUPERVISORY',
      monthlyWages: 10001,
    });
    expect(result.isWorkman).toBe(false);
    expect(result.ground).toBe(WORKMAN_GROUND.SUPERVISORY_ABOVE_THRESHOLD);
  });

  it('treats the threshold itself as inside the population', () => {
    expect(
      determineWorkman({ capacity: 'SUPERVISORY', monthlyWages: 10000 })
        .isWorkman,
    ).toBe(true);
  });

  it('honours an overridden threshold', () => {
    const result = determineWorkman(
      { capacity: 'SUPERVISORY', monthlyWages: 12000 },
      { supervisoryWageThreshold: 15000 },
    );
    expect(result.isWorkman).toBe(true);
  });

  it('excludes the armed forces and the police', () => {
    expect(determineWorkman({ capacity: 'ARMED_FORCES' }).ground).toBe(
      WORKMAN_GROUND.ARMED_FORCES_OR_POLICE,
    );
    expect(determineWorkman({ capacity: 'POLICE' }).isWorkman).toBe(false);
  });

  it('gives a ground on the affirmative case too', () => {
    const result = determineWorkman({ capacity: 'TECHNICAL' });
    expect(result.reason).toMatch(/2\(s\)/);
  });
});

describe('noticePopulation', () => {
  const people = [
    {
      employeeId: 'a',
      name: 'A',
      capacity: 'OPERATIONAL',
      monthlyWages: 21000,
    },
    { employeeId: 'b', name: 'B', capacity: 'SUPERVISORY', monthlyWages: 9000 },
    {
      employeeId: 'c',
      name: 'C',
      capacity: 'SUPERVISORY',
      monthlyWages: 41000,
    },
    {
      employeeId: 'd',
      name: 'D',
      capacity: 'MANAGERIAL',
      monthlyWages: 120000,
    },
  ];

  it('separates who a change touched from who it obliged', () => {
    const result = noticePopulation(people);
    expect(result.affected).toBe(4);
    expect(result.obliged).toBe(2);
  });

  it('returns the excluded names with their ground rather than dropping them', () => {
    const result = noticePopulation(people);
    expect(result.excluded.map((r) => r.employeeId).sort()).toEqual(['c', 'd']);
    expect(result.excluded.every((r) => r.ground && r.reason)).toBe(true);
  });

  it('handles an empty population without inventing one', () => {
    const result = noticePopulation([]);
    expect(result.affected).toBe(0);
    expect(result.obliged).toBe(0);
  });
});

describe('noticeWindow', () => {
  it('computes the latest in-time notice date backwards from the effective date', () => {
    const result = noticeWindow(d('2026-04-01'), null, d('2026-03-01'));
    // Clear days: 21 clear days before 1 April is 10 March.
    expect(result.latestNoticeDate.toISOString().slice(0, 10)).toBe(
      '2026-03-10',
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_REQUIRED);
    expect(result.daysRemaining).toBe(9);
  });

  it('accepts twenty-one clear days', () => {
    const result = noticeWindow(
      d('2026-04-01'),
      d('2026-03-10'),
      d('2026-03-11'),
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_SERVED);
    expect(result.daysGiven).toBe(21);
    expect(result.shortfallDays).toBe(0);
  });

  it('rejects twenty clear days — the off-by-one this module exists to avoid', () => {
    const result = noticeWindow(
      d('2026-04-01'),
      d('2026-03-11'),
      d('2026-03-12'),
    );
    expect(result.daysGiven).toBe(20);
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_PERIOD_SHORT);
    expect(result.shortfallDays).toBe(1);
  });

  it('counts calendar days rather than clear days when told to', () => {
    const result = noticeWindow(
      d('2026-04-01'),
      d('2026-03-11'),
      d('2026-03-12'),
      { clearDays: false },
    );
    expect(result.daysGiven).toBe(21);
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_SERVED);
  });

  it('reports short notice while the effective date can still be moved', () => {
    const result = noticeWindow(
      d('2026-04-01'),
      d('2026-03-25'),
      d('2026-03-26'),
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_PERIOD_SHORT);
    expect(result.reason).toMatch(/moving it to/);
  });

  it('reports a change that took effect on short notice as a default', () => {
    const result = noticeWindow(
      d('2026-04-01'),
      d('2026-03-25'),
      d('2026-04-05'),
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE);
    expect(result.reason).toMatch(/Short notice is no notice/);
  });

  it('reports a change that took effect with no notice at all', () => {
    const result = noticeWindow(d('2026-04-01'), null, d('2026-04-02'));
    expect(result.verdict).toBe(CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE);
    expect(result.daysGiven).toBe(0);
    expect(result.shortfallDays).toBe(21);
  });

  it('says the change is not void even where it reports a default', () => {
    const result = noticeWindow(d('2026-04-01'), null, d('2026-04-02'));
    expect(result.reason).toMatch(/does not make the change void/);
  });

  it('reports no notice and the window already past as short, not as a default', () => {
    const result = noticeWindow(d('2026-04-01'), null, d('2026-03-20'));
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_PERIOD_SHORT);
    expect(result.shortfallDays).toBeGreaterThan(0);
  });

  it('cannot compute a window without a proposed effective date', () => {
    const result = noticeWindow(null, d('2026-03-01'), d('2026-03-02'));
    expect(result.verdict).toBe(CHANGE_VERDICT.UNDETERMINED);
    expect(result.latestNoticeDate).toBeNull();
  });

  it('ignores the time of day a notice was served', () => {
    const late = noticeWindow(
      d('2026-04-01'),
      new Date('2026-03-10T23:59:00.000Z'),
      d('2026-03-11'),
    );
    const early = noticeWindow(
      d('2026-04-01'),
      new Date('2026-03-10T00:01:00.000Z'),
      d('2026-03-11'),
    );
    expect(late.daysGiven).toBe(early.daysGiven);
  });
});

describe('assessExemption', () => {
  it('claims nothing where nothing is claimed', () => {
    expect(assessExemption(undefined).exempt).toBe(false);
    expect(assessExemption({}).exempt).toBe(false);
  });

  it('refuses a ground that is not one of the three', () => {
    const result = assessExemption({
      ground: 'BUSINESS_NECESSITY',
      authority: 'board minute 12',
    });
    expect(result.exempt).toBe(false);
    expect(result.reason).toMatch(/not a recognised ground/);
  });

  it('refuses a recognised ground with no authority behind it', () => {
    const result = assessExemption({ ground: 'SETTLEMENT_OR_AWARD' });
    expect(result.exempt).toBe(false);
    expect(result.ground).toBe(EXEMPTION_GROUND.SETTLEMENT_OR_AWARD);
    expect(result.reason).toMatch(/is a belief/);
  });

  it('accepts a section 9B notification with its number', () => {
    const result = assessExemption({
      ground: 'SECTION_9B_NOTIFICATION',
      authority: 'S.O. 4412 dated 2025-11-02',
    });
    expect(result.exempt).toBe(true);
    expect(result.reason).toMatch(/S\.O\. 4412/);
    expect(result.reason).toMatch(/stated period/);
  });

  it('accepts a settlement and says why it sits outside section 9A', () => {
    const result = assessExemption({
      ground: 'SETTLEMENT_OR_AWARD',
      authority: 'settlement dated 2026-01-14 under section 12(3)',
    });
    expect(result.exempt).toBe(true);
    expect(result.reason).toMatch(/machinery/);
  });
});

describe('assessPendingProceeding', () => {
  it('reports no proceeding where there is none', () => {
    expect(assessPendingProceeding(undefined).pending).toBe(false);
    expect(assessPendingProceeding({ pending: false }).verdict).toBeNull();
  });

  it('requires express permission and does not offer a notice period', () => {
    const result = assessPendingProceeding({
      pending: true,
      forum: 'the Conciliation Officer, Pune',
    });
    expect(result.verdict).toBe(CHANGE_VERDICT.SECTION_33_PERMISSION_REQUIRED);
    expect(result.reason).toMatch(/express permission/);
    expect(result.reason).not.toMatch(/twenty-one days' notice/);
  });

  it('lets the change proceed on the notice track once permission is on record', () => {
    const result = assessPendingProceeding({
      pending: true,
      forum: 'the Industrial Tribunal',
      expressPermissionReference: 'order dated 2026-02-20 in Ref. 14/2025',
    });
    expect(result.pending).toBe(true);
    expect(result.permissionOnRecord).toBe(true);
    expect(result.verdict).toBeNull();
  });
});

describe('assessChange', () => {
  const workmen = [
    { employeeId: 'a', capacity: 'OPERATIONAL', monthlyWages: 22000 },
    { employeeId: 'b', capacity: 'SKILLED', monthlyWages: 27000 },
  ];

  it('short-circuits to section 33 before it computes any window', () => {
    const result = assessChange(
      {
        scheduleItem: 'WAGES',
        effectiveOn: d('2026-06-01'),
        noticedOn: d('2026-05-01'),
        proceeding: { pending: true, forum: 'the Labour Court' },
      },
      workmen,
      { asOf: d('2026-05-02') },
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.SECTION_33_PERMISSION_REQUIRED);
    expect(result.window).toBeNull();
  });

  it('still reports the schedule item under section 33', () => {
    const result = assessChange(
      {
        scheduleItem: 'WAGES',
        effectiveOn: d('2026-06-01'),
        proceeding: { pending: true },
      },
      workmen,
      { asOf: d('2026-05-02') },
    );
    expect(result.scheduleItems.map((i) => i.key)).toContain('WAGES');
  });

  it('reports an unclassified change as undetermined with no window', () => {
    const result = assessChange({ effectiveOn: d('2026-06-01') }, workmen, {
      asOf: d('2026-05-02'),
    });
    expect(result.verdict).toBe(CHANGE_VERDICT.UNDETERMINED);
    expect(result.window).toBeNull();
  });

  it('applies an exemption only after the change is classified', () => {
    const result = assessChange(
      {
        scheduleItem: 'WAGES',
        effectiveOn: d('2026-06-01'),
        exemption: {
          ground: 'SETTLEMENT_OR_AWARD',
          authority: 'settlement dated 2026-01-14',
        },
      },
      workmen,
      { asOf: d('2026-05-02') },
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.EXEMPT);
    expect(result.scheduleItems[0].key).toBe('WAGES');
    expect(result.window).toBeNull();
  });

  it('does not treat an exemption with no authority as an exemption', () => {
    const result = assessChange(
      {
        scheduleItem: 'WAGES',
        effectiveOn: d('2026-06-01'),
        exemption: { ground: 'SETTLEMENT_OR_AWARD' },
      },
      workmen,
      { asOf: d('2026-05-02') },
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_REQUIRED);
  });

  it('reports no obligation where the change touches only managers', () => {
    const result = assessChange(
      { scheduleItem: 'WAGES', effectiveOn: d('2026-06-01') },
      [
        { employeeId: 'm1', capacity: 'MANAGERIAL', monthlyWages: 180000 },
        { employeeId: 'm2', capacity: 'SUPERVISORY', monthlyWages: 65000 },
      ],
      { asOf: d('2026-05-02') },
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER);
    expect(result.population.affected).toBe(2);
    expect(result.population.obliged).toBe(0);
  });

  it('obliges notice for the workmen inside a mixed population', () => {
    const result = assessChange(
      { scheduleItem: 'HOURS_AND_REST', effectiveOn: d('2026-06-01') },
      [
        { employeeId: 'a', capacity: 'OPERATIONAL', monthlyWages: 19000 },
        { employeeId: 'm', capacity: 'MANAGERIAL', monthlyWages: 150000 },
      ],
      { asOf: d('2026-05-02') },
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_REQUIRED);
    expect(result.population.affected).toBe(2);
    expect(result.population.obliged).toBe(1);
  });

  it('requires notice for a change in the workmen’s favour', () => {
    const result = assessChange(
      {
        scheduleItem: 'CONTRIBUTION_TO_FUND',
        description: 'employer PF raised from statutory to 14 per cent',
        direction: 'INCREASE',
        effectiveOn: d('2026-06-01'),
      },
      workmen,
      { asOf: d('2026-05-25') },
    );
    expect(result.verdict).toBe(CHANGE_VERDICT.NOTICE_PERIOD_SHORT);
    expect(result.notes.favourableChangeStillNeedsNotice).toMatch(
      /not conditioned on the change being adverse/,
    );
  });

  it('carries the rules it used on the result', () => {
    const result = assessChange(
      { scheduleItem: 'WAGES', effectiveOn: d('2026-06-01') },
      workmen,
      { asOf: d('2026-05-02'), rules: { noticeDays: 30 } },
    );
    expect(result.rules.noticeDays).toBe(30);
    expect(result.window.noticeDays).toBe(30);
  });
});

describe('orderQueue', () => {
  it('puts defaults first and exemptions last', () => {
    const ordered = orderQueue([
      { verdict: CHANGE_VERDICT.EXEMPT },
      { verdict: CHANGE_VERDICT.NOTICE_REQUIRED, window: { daysRemaining: 9 } },
      { verdict: CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE },
      { verdict: CHANGE_VERDICT.SECTION_33_PERMISSION_REQUIRED },
    ]);
    expect(ordered.map((r) => r.verdict)).toEqual([
      CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE,
      CHANGE_VERDICT.SECTION_33_PERMISSION_REQUIRED,
      CHANGE_VERDICT.NOTICE_REQUIRED,
      CHANGE_VERDICT.EXEMPT,
    ]);
  });

  it('orders the ones still inside their window by days remaining', () => {
    const ordered = orderQueue([
      {
        verdict: CHANGE_VERDICT.NOTICE_REQUIRED,
        window: { daysRemaining: 14 },
      },
      { verdict: CHANGE_VERDICT.NOTICE_REQUIRED, window: { daysRemaining: 2 } },
      { verdict: CHANGE_VERDICT.NOTICE_REQUIRED, window: { daysRemaining: 7 } },
    ]);
    expect(ordered.map((r) => r.window.daysRemaining)).toEqual([2, 7, 14]);
  });

  it('keeps undetermined changes in the queue rather than dropping them', () => {
    const ordered = orderQueue([
      { verdict: CHANGE_VERDICT.NOTICE_SERVED },
      { verdict: CHANGE_VERDICT.UNDETERMINED },
    ]);
    expect(ordered[0].verdict).toBe(CHANGE_VERDICT.UNDETERMINED);
  });

  it('does not mutate the array it is given', () => {
    const input = [
      { verdict: CHANGE_VERDICT.EXEMPT },
      { verdict: CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE },
    ];
    orderQueue(input);
    expect(input[0].verdict).toBe(CHANGE_VERDICT.EXEMPT);
  });
});

describe('formEFields', () => {
  const assessment = assessChange(
    {
      scheduleItem: 'HOURS_AND_REST',
      description: 'general shift moved from 09:00–17:30 to 08:00–16:30',
      effectiveOn: d('2026-07-01'),
    },
    [{ employeeId: 'a', capacity: 'OPERATIONAL', monthlyWages: 23000 }],
    { asOf: d('2026-05-20') },
  );

  it('produces the fields a notice has to state', () => {
    const result = formEFields(assessment);
    expect(result.ready).toBe(true);
    expect(result.form.form).toBe(DEFAULT_RULES.noticeForm);
    expect(result.form.scheduleItems[0].item).toBe(4);
    expect(result.form.workmenAffected).toBe(1);
  });

  it('refuses to produce a notice stating no schedule item', () => {
    const undetermined = assessChange(
      { description: 'something', effectiveOn: d('2026-07-01') },
      [{ employeeId: 'a', capacity: 'OPERATIONAL' }],
      { asOf: d('2026-05-20') },
    );
    const result = formEFields(undetermined);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('Fourth Schedule item');
  });

  it('lists everything missing rather than the first thing missing', () => {
    const result = formEFields({ rules: DEFAULT_RULES });
    expect(result.missing.length).toBeGreaterThan(1);
  });
});

describe('resolveRules', () => {
  it('defaults to the central figures', () => {
    const rules = resolveRules();
    expect(rules.noticeDays).toBe(21);
    expect(rules.supervisoryWageThreshold).toBe(10000);
    expect(rules.clearDays).toBe(true);
  });

  it('lets an appropriate government override without editing the engine', () => {
    const rules = resolveRules({ noticeDays: 30, noticeForm: 'Form XIV' });
    expect(rules.noticeDays).toBe(30);
    expect(rules.noticeForm).toBe('Form XIV');
    expect(rules.supervisoryWageThreshold).toBe(10000);
  });
});
