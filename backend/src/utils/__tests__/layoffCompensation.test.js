/**
 * Industrial Disputes Act, 1947, Chapters VA and VB (#1830).
 *
 * The case worth stating first, because it is the reason this sits beside
 * `severanceCalculator.service.js` rather than inside it: Chapter VB's output
 * is not a payment. Where prior permission was required and absent, the workmen
 * are **deemed not to have been laid off**, and the liability is full wages as
 * if they had continued — several times the fifty per cent section 25C would
 * have paid.
 *
 * So `assessEstablishment` carries two aggregate figures and never one. A
 * single field either caller could read would be the most dangerous number in
 * this product.
 *
 * The other boundaries:
 *
 *   - section 25B counting a day of *lay-off* and a day of *legal strike* as
 *     service, which any present/absent ledger would read as absence;
 *   - maternity leave counting only to twelve weeks, so a longer leave splits;
 *   - the order of operations — weekly holidays out, then section 25E
 *     disentitlements, then the rolling forty-five-day ceiling;
 *   - the ceiling being rolling, so days compensated eight months ago still
 *     consume it;
 *   - and the section 25FFF cap being refused where the grounds claimed are the
 *     ones the proviso's explanation names.
 */

const {
  LAYOFF_RULES,
  SERVICE_DAY,
  DISENTITLEMENT,
  ACTION,
  PERMISSION_STATE,
  NOT_UNAVOIDABLE,
  FINDING,
  SEVERITY,
  dailyAveragePay,
  continuousService,
  layoffCompensation,
  chapterVBPosition,
  illegalityExposure,
  closureCompensation,
  seniorityList,
  reemploymentPreference,
  assessEstablishment,
} = require('../layoffCompensation');

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

/** ₹20,000 basic and ₹6,000 DA — ₹1,000 a day on the statutory twenty-six. */
const wages = { basic: 20000, dearnessAllowance: 6000 };

describe('a day’s average pay', () => {
  it('divides by the statutory twenty-six, not the calendar month', () => {
    expect(dailyAveragePay(wages)).toBe(1000);
  });
});

describe('section 25B continuous service', () => {
  it('counts a day of lay-off as service', () => {
    // The counter-intuitive one: lay-off days count toward the service that
    // qualifies for lay-off compensation, and read as absence to any ledger.
    const result = continuousService({
      days: [
        { kind: SERVICE_DAY.WORKED, days: 220 },
        { kind: SERVICE_DAY.LAYOFF, days: 25 },
      ],
    });

    expect(result.counted).toBe(245);
    expect(result.qualified).toBe(true);
  });

  it('counts a legal strike and not an illegal one', () => {
    const legal = continuousService({
      days: [
        { kind: SERVICE_DAY.WORKED, days: 230 },
        { kind: SERVICE_DAY.LEGAL_STRIKE, days: 15 },
      ],
    });
    const illegal = continuousService({
      days: [
        { kind: SERVICE_DAY.WORKED, days: 230 },
        { kind: SERVICE_DAY.ILLEGAL_STRIKE, days: 15 },
      ],
    });

    expect(legal.qualified).toBe(true);
    expect(illegal.counted).toBe(230);
    expect(illegal.qualified).toBe(false);
  });

  it('counts maternity leave only to twelve weeks', () => {
    // A longer leave splits rather than being counted whole or dropped.
    const result = continuousService({
      days: [
        { kind: SERVICE_DAY.WORKED, days: 150 },
        { kind: SERVICE_DAY.MATERNITY_LEAVE, days: 180 },
      ],
    });

    expect(result.maternityCapDays).toBe(84);
    expect(result.counted).toBe(150 + 84);
    // Still records what was actually taken, for the register that asks.
    expect(result.breakdown[SERVICE_DAY.MATERNITY_LEAVE]).toBe(180);
  });

  it('counts neither absence nor a weekly holiday', () => {
    const result = continuousService({
      days: [
        { kind: SERVICE_DAY.WORKED, days: 200 },
        { kind: SERVICE_DAY.ABSENT, days: 30 },
        { kind: SERVICE_DAY.WEEKLY_HOLIDAY, days: 52 },
      ],
    });

    expect(result.counted).toBe(200);
  });

  it('uses the 190-day figure below ground in a mine', () => {
    const result = continuousService({
      days: [{ kind: SERVICE_DAY.WORKED, days: 200 }],
      belowGroundInMine: true,
    });

    expect(result.required).toBe(LAYOFF_RULES.mineContinuousServiceDays);
    expect(result.qualified).toBe(true);
  });

  it('reports a shortfall rather than throwing', () => {
    const result = continuousService({
      days: [{ kind: SERVICE_DAY.WORKED, days: 100 }],
    });

    expect(result.qualified).toBe(false);
    expect(codesOf(result)).toEqual([FINDING.SERVICE_NOT_QUALIFIED]);
  });
});

describe('section 25C compensation, and the order it is computed in', () => {
  const service = continuousService({
    days: [{ kind: SERVICE_DAY.WORKED, days: 250 }],
  });

  it('excludes weekly holidays before anything else', () => {
    const result = layoffCompensation({
      laidOffDays: 30,
      weeklyHolidays: 4,
      wages,
      service,
    });

    expect(result.compensableDays).toBe(26);
    expect(result.compensation).toBe(26 * 500);
  });

  it('nets section 25E disentitled days with a reason against each', () => {
    const result = layoffCompensation({
      laidOffDays: 30,
      weeklyHolidays: 4,
      disentitledDays: [
        { reason: DISENTITLEMENT.FAILED_TO_PRESENT, days: 3 },
        { reason: DISENTITLEMENT.REFUSED_ALTERNATIVE_EMPLOYMENT, days: 2 },
      ],
      wages,
      service,
    });

    expect(result.disentitledDays).toBe(5);
    expect(result.entitledDays).toBe(21);
    // Findings about conduct, not leave-type codes — which is why lay-off
    // cannot be a leave balance.
    expect(result.disentitled[0].label).toMatch(/present/);
  });

  it('caps at forty-five days across a rolling twelve months', () => {
    // Twenty days compensated eight months ago still consume the ceiling, so
    // this cannot be answered from the current spell alone.
    const result = layoffCompensation({
      laidOffDays: 60,
      weeklyHolidays: 8,
      compensatedDaysInWindow: 20,
      wages,
      service,
    });

    expect(result.ceilingRemaining).toBe(25);
    expect(result.payableDays).toBe(25);
    expect(result.beyondCeilingDays).toBe(27);
    expect(codesOf(result)).toContain(FINDING.CEILING_EXCEEDED);
  });

  it('disentitles before capping, not after', () => {
    // Capping first would let a disentitled day consume ceiling a compensable
    // one needed.
    const result = layoffCompensation({
      laidOffDays: 60,
      weeklyHolidays: 8,
      disentitledDays: [{ reason: DISENTITLEMENT.FAILED_TO_PRESENT, days: 4 }],
      compensatedDaysInWindow: 20,
      wages,
      service,
    });

    expect(result.entitledDays).toBe(48);
    expect(result.payableDays).toBe(25);
  });

  it('says when the ceiling has just been exhausted', () => {
    const result = layoffCompensation({
      laidOffDays: 45,
      wages,
      service,
    });

    expect(result.payableDays).toBe(45);
    expect(codesOf(result)).toContain(FINDING.CEILING_REACHED);
  });

  it('pays nothing to a workman without section 25B service', () => {
    const short = continuousService({
      days: [{ kind: SERVICE_DAY.WORKED, days: 100 }],
    });

    const result = layoffCompensation({
      laidOffDays: 30,
      wages,
      service: short,
    });

    expect(result.qualified).toBe(false);
    expect(result.compensation).toBe(0);
    expect(codesOf(result)).toContain(FINDING.SERVICE_NOT_QUALIFIED);
  });

  it('cannot disentitle more days than there were', () => {
    const result = layoffCompensation({
      laidOffDays: 10,
      disentitledDays: [{ reason: DISENTITLEMENT.FAILED_TO_PRESENT, days: 40 }],
      wages,
      service,
    });

    expect(result.entitledDays).toBe(0);
    expect(result.compensation).toBe(0);
  });
});

describe('Chapter VB — the lawfulness question', () => {
  it('requires no permission below the threshold', () => {
    const result = chapterVBPosition({ workmen: 60, action: ACTION.LAYOFF });

    expect(result.permissionRequired).toBe(false);
    expect(result.permission).toBe(PERMISSION_STATE.NOT_REQUIRED);
    expect(result.lawful).toBe(true);
  });

  it('requires it above, and calls the act illegal without it', () => {
    const result = chapterVBPosition({
      workmen: 250,
      action: ACTION.LAYOFF,
      permission: PERMISSION_STATE.NOT_SOUGHT,
    });

    expect(result.lawful).toBe(false);
    expect(codesOf(result)).toEqual(
      expect.arrayContaining([
        FINDING.PERMISSION_NOT_SOUGHT,
        FINDING.ACT_ILLEGAL,
      ]),
    );
  });

  it('honours a state that raised the threshold to three hundred', () => {
    // A wrong constant here does not produce a wrong number — it produces the
    // wrong kind of answer.
    const result = chapterVBPosition(
      {
        workmen: 250,
        action: ACTION.LAYOFF,
        permission: PERMISSION_STATE.NOT_SOUGHT,
      },
      { chapterVBThreshold: 300 },
    );

    expect(result.permissionRequired).toBe(false);
    expect(result.lawful).toBe(true);
  });

  it('accepts a deemed grant where the government did not answer', () => {
    const result = chapterVBPosition({
      workmen: 250,
      action: ACTION.RETRENCHMENT,
      permission: PERMISSION_STATE.DEEMED_GRANTED,
    });

    expect(result.lawful).toBe(true);
  });

  it('treats a refusal as an illegality if the act was done anyway', () => {
    const result = chapterVBPosition({
      workmen: 250,
      action: ACTION.CLOSURE,
      permission: PERMISSION_STATE.REFUSED,
    });

    expect(result.section).toBe('section 25-O');
    expect(codesOf(result)).toContain(FINDING.PERMISSION_REFUSED);
    expect(result.lawful).toBe(false);
  });

  it('checks the section 25N notice separately from the permission', () => {
    const result = chapterVBPosition({
      workmen: 250,
      action: ACTION.RETRENCHMENT,
      permission: PERMISSION_STATE.GRANTED,
      noticeMonths: 1,
    });

    expect(result.lawful).toBe(true);
    expect(codesOf(result)).toEqual([FINDING.NOTICE_SHORT]);
  });

  it('refuses to answer without an action', () => {
    expect(() => chapterVBPosition({ workmen: 250 })).toThrow(TypeError);
  });
});

describe('what an illegal act costs', () => {
  it('is full wages as if the workman had continued, not half', () => {
    const exposure = illegalityExposure({ days: 60, wages });

    expect(exposure.basis).toBe('FULL_WAGES_AS_IF_CONTINUED');
    expect(exposure.amount).toBe(60000);
    // Against ₹22,500 the compensation limb would have paid for 45 days.
    expect(exposure.note).toMatch(/must not be added/);
  });

  it('includes benefits as well as wages', () => {
    const exposure = illegalityExposure({
      days: 60,
      wages,
      benefitsPerDay: 200,
    });

    expect(exposure.amount).toBe(72000);
  });
});

describe('section 25FFF closure compensation', () => {
  it('is retrenchment compensation where nothing was unavoidable', () => {
    const result = closureCompensation({ completedYears: 10, wages });

    expect(result.uncapped).toBe(150000);
    expect(result.capAvailable).toBe(false);
    expect(result.amount).toBe(150000);
  });

  it('caps at three months where the circumstances really were beyond control', () => {
    const result = closureCompensation({
      completedYears: 10,
      wages,
      unavoidable: true,
    });

    expect(result.cap).toBe(78000);
    expect(result.amount).toBe(78000);
  });

  it('refuses the cap where the grounds are the ones the proviso names', () => {
    // Financial difficulties, accumulated stocks and an expired lease are
    // excluded by the explanation, and are the grounds most often claimed.
    const result = closureCompensation({
      completedYears: 10,
      wages,
      unavoidable: true,
      grounds: [NOT_UNAVOIDABLE.FINANCIAL_DIFFICULTIES],
    });

    expect(result.capAvailable).toBe(false);
    expect(result.amount).toBe(150000);
    expect(codesOf(result)).toContain(FINDING.CLOSURE_CAP_NOT_AVAILABLE);
  });

  it('does not cap upward where the uncapped figure is the smaller', () => {
    const result = closureCompensation({
      completedYears: 2,
      wages,
      unavoidable: true,
    });

    expect(result.amount).toBe(30000);
  });
});

describe('section 25G seniority', () => {
  const workmen = [
    { workmanId: 'a', name: 'Anil', category: 'Fitter', serviceDays: 900 },
    { workmanId: 'b', name: 'Basant', category: 'Fitter', serviceDays: 400 },
    { workmanId: 'c', name: 'Chandan', category: 'Fitter', serviceDays: 250 },
    { workmanId: 'd', name: 'Dilip', category: 'Welder', serviceDays: 100 },
  ];

  it('orders last in, first out within the category', () => {
    const result = seniorityList({ workmen, category: 'Fitter', proposed: [] });

    expect(result.order.map((row) => row.name)).toEqual([
      'Chandan',
      'Basant',
      'Anil',
    ]);
    // The welder is a different category and is not in this list.
    expect(result.order).toHaveLength(3);
  });

  it('accepts a selection that follows the order', () => {
    const result = seniorityList({
      workmen,
      category: 'Fitter',
      proposed: ['c'],
    });

    expect(result.departures).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('flags a departure in both directions', () => {
    // Selecting Anil skips two juniors, so both the selection and each
    // retention are departures the record has to explain.
    const result = seniorityList({
      workmen,
      category: 'Fitter',
      proposed: ['a'],
    });

    expect(result.departures).toBe(2);
    expect(result.unexplainedDepartures).toBe(2);
    expect(codesOf(result)).toContain(FINDING.SENIORITY_DEPARTURE_UNEXPLAINED);
  });

  it('downgrades a departure that carries a reason', () => {
    const result = seniorityList({
      workmen,
      category: 'Fitter',
      proposed: ['a'],
      reasons: { a: 'Post abolished', c: 'Sole holder of a required licence' },
    });

    expect(result.departures).toBe(2);
    expect(result.unexplainedDepartures).toBe(0);
    expect(
      result.findings.every(
        (entry) => entry.severity === SEVERITY.INFORMATIONAL,
      ),
    ).toBe(true);
  });
});

describe('section 25H re-employment', () => {
  const retrenched = [
    { workmanId: 'a', name: 'Anil', category: 'Fitter', serviceDays: 900 },
    { workmanId: 'c', name: 'Chandan', category: 'Fitter', serviceDays: 250 },
    {
      workmanId: 'e',
      name: 'Esha',
      category: 'Fitter',
      serviceDays: 800,
      reemployedOn: '2026-05-01',
    },
  ];

  it('offers the vacancy to the longest-serving retrenched workman first', () => {
    const result = reemploymentPreference({ retrenched, category: 'Fitter' });

    expect(result.candidates.map((row) => row.name)).toEqual([
      'Anil',
      'Chandan',
    ]);
    expect(codesOf(result)).toContain(FINDING.REEMPLOYMENT_PREFERENCE_DUE);
  });

  it('drops somebody already re-employed', () => {
    const result = reemploymentPreference({ retrenched, category: 'Fitter' });

    expect(result.candidates.map((row) => row.workmanId)).not.toContain('e');
  });

  it('says nothing where no retrenched workman is in the category', () => {
    const result = reemploymentPreference({ retrenched, category: 'Welder' });

    expect(result.candidates).toHaveLength(0);
    expect(result.findings).toHaveLength(0);
  });
});

describe('the establishment', () => {
  const spells = [
    {
      workmanId: 'a',
      name: 'Anil',
      category: 'Fitter',
      wages,
      laidOffDays: 60,
      weeklyHolidays: 8,
      serviceDays: [{ kind: SERVICE_DAY.WORKED, days: 250 }],
    },
    {
      workmanId: 'b',
      name: 'Basant',
      category: 'Fitter',
      wages,
      laidOffDays: 60,
      weeklyHolidays: 8,
      serviceDays: [{ kind: SERVICE_DAY.WORKED, days: 100 }],
    },
  ];

  it('carries the two liabilities as two fields, never one', () => {
    const result = assessEstablishment({
      spells,
      chapterVB: {
        workmen: 250,
        action: ACTION.LAYOFF,
        permission: PERMISSION_STATE.GRANTED,
      },
    });

    // Anil: 45 days at ₹500. Basant has no 25B service and gets nothing.
    expect(result.compensation).toBe(22500);
    // Both, at full wages for sixty days, if it had been unlawful.
    expect(result.illegalityExposure).toBe(120000);
    expect(result.applicableLiability).toBe('COMPENSATION');
  });

  it('switches which liability applies when the act is unlawful', () => {
    const result = assessEstablishment({
      spells,
      chapterVB: {
        workmen: 250,
        action: ACTION.LAYOFF,
        permission: PERMISSION_STATE.NOT_SOUGHT,
      },
    });

    expect(result.lawful).toBe(false);
    expect(result.applicableLiability).toBe('FULL_WAGES_AS_IF_CONTINUED');
    // Both figures are still there. Adding them would pay an alternative twice.
    expect(result.compensation).toBe(22500);
    expect(result.illegalityExposure).toBe(120000);
  });

  it('counts only the workmen who qualified under section 25B', () => {
    const result = assessEstablishment({
      spells,
      chapterVB: { workmen: 60, action: ACTION.LAYOFF },
    });

    expect(result.spellCount).toBe(2);
    expect(result.qualifiedCount).toBe(1);
  });

  it('groups findings by code with a distinct workman count', () => {
    const result = assessEstablishment({
      spells,
      chapterVB: { workmen: 60, action: ACTION.LAYOFF },
    });

    const short = result.summary.find(
      (row) => row.code === FINDING.SERVICE_NOT_QUALIFIED,
    );

    expect(short.workmanCount).toBe(1);
    expect(short.section).toBe('section 25B');
  });
});
