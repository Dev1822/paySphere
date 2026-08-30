/**
 * EDLI paragraph 22 — the assurance benefit (#1878).
 *
 * The assertions that matter are the ones the obvious implementation fails:
 * that the wage ceiling is applied per month rather than to the average, that a
 * month of no wages counts as a month of the window, that the ₹2,50,000 floor
 * is conditional on twelve months of continuous employment which may span
 * establishments, and that an exempted establishment's shortfall is reported
 * rather than netted away.
 */

const {
  EDLI_RULES,
  SEED_RULE_SETS,
  SERVICE_BASIS,
  PAYEE_LIMB,
  BINDING,
  FINDING,
  SEVERITY,
  averagingWindow,
  resolveRules,
  averageMonthlyWages,
  averageBalance,
  continuousEmployment,
  assuranceBenefit,
  exemptedComparison,
  resolvePayees,
  assessClaim,
  assessClaims,
} = require('../edliAssurance');

const codesOf = (findings) => findings.map((finding) => finding.code);

const windowFor = (death) => averagingWindow(death);
const evenWages = (death, wages) =>
  windowFor(death).map((month) => ({ ...month, wages }));
const evenBalances = (death, balance) =>
  windowFor(death).map((month) => ({ ...month, balance }));

const nominee = {
  nominees: [{ name: 'Spouse', relationship: 'SPOUSE', sharePercent: 100 }],
};

describe('EDLI_RULES', () => {
  it('carries the post-2021 figures', () => {
    expect(EDLI_RULES.wageCeiling).toBe(15000);
    expect(EDLI_RULES.multiplier).toBe(35);
    expect(EDLI_RULES.bonusCap).toBe(175000);
    expect(EDLI_RULES.overallCap).toBe(700000);
    expect(EDLI_RULES.minimumBenefit).toBe(250000);
  });

  it('has an assurance component that tops out where the caps say it should', () => {
    // 35 × 15,000 is 5,25,000; plus the 1,75,000 bonus cap is exactly the
    // overall cap. If a rule set ever breaks that identity the overall cap has
    // to bite, which is why it is applied rather than assumed away.
    expect(EDLI_RULES.multiplier * EDLI_RULES.wageCeiling).toBe(525000);
    expect(
      EDLI_RULES.multiplier * EDLI_RULES.wageCeiling + EDLI_RULES.bonusCap,
    ).toBe(EDLI_RULES.overallCap);
  });
});

describe('averagingWindow', () => {
  it('takes the twelve months preceding the month of death', () => {
    const window = averagingWindow('2026-03-10');
    expect(window).toHaveLength(12);
    expect(window[0]).toEqual({ year: 2025, month: 3 });
    expect(window[11]).toEqual({ year: 2026, month: 2 });
  });

  it('excludes the month of death itself', () => {
    // A member who died on the third worked two days of it, and counting that
    // stub as a month of wages drags the average down for no reason the
    // paragraph gives.
    const window = averagingWindow('2026-03-03');
    expect(
      window.some((month) => month.year === 2026 && month.month === 3),
    ).toBe(false);
  });

  it('crosses a year boundary correctly', () => {
    const window = averagingWindow('2026-01-15');
    expect(window[0]).toEqual({ year: 2025, month: 1 });
    expect(window[11]).toEqual({ year: 2025, month: 12 });
  });

  it('is empty with no date', () => {
    expect(averagingWindow(null)).toEqual([]);
  });
});

describe('resolveRules', () => {
  it('uses the rules in force at the date of death, not the latest', () => {
    // A claim for a 2019 death settled today has to reproduce the ₹6,00,000 cap
    // that applied then; today's figure is a number the EPFO will not recognise.
    expect(resolveRules('2019-06-01').overallCap).toBe(600000);
    expect(resolveRules('2026-06-01').overallCap).toBe(700000);
  });

  it('falls back to the earliest set for a date before all of them', () => {
    expect(resolveRules('1990-01-01')).toBeTruthy();
  });

  it('carries the pre-2021 bonus cap too', () => {
    expect(resolveRules('2019-06-01').bonusCap).toBe(150000);
  });
});

describe('averageMonthlyWages', () => {
  const window = windowFor('2026-03-10');

  it('caps each month rather than the average', () => {
    // Six months at ₹40,000 and six at nothing. Capping the average gives
    // ₹15,000; capping each month first gives ₹7,500, and the paragraph caps
    // the wages. The difference is half the benefit.
    const wageMonths = window.map((month, index) => ({
      ...month,
      wages: index < 6 ? 40000 : 0,
    }));

    const result = averageMonthlyWages({
      window,
      wageMonths,
      ceiling: 15000,
    });

    expect(result.average).toBe(7500);
  });

  it('divides by the window, not by the months it found', () => {
    // A month of loss of pay is a month with no wages, not a month that did not
    // happen. Dividing by the months found would raise the average for exactly
    // the members whose earnings were interrupted.
    const wageMonths = window
      .slice(0, 6)
      .map((month) => ({ ...month, wages: 12000 }));

    const result = averageMonthlyWages({
      window,
      wageMonths,
      ceiling: 15000,
    });

    expect(result.divisor).toBe(12);
    expect(result.average).toBe(6000);
  });

  it('shortens the divisor for genuinely short service', () => {
    const wageMonths = window
      .slice(9)
      .map((month) => ({ ...month, wages: 12000 }));

    const result = averageMonthlyWages({
      window,
      wageMonths,
      ceiling: 15000,
      monthsInService: 3,
    });

    expect(result.divisor).toBe(3);
    expect(result.average).toBe(12000);
  });

  it('reports when the ceiling bound', () => {
    const result = averageMonthlyWages({
      window,
      wageMonths: window.map((month) => ({ ...month, wages: 40000 })),
      ceiling: 15000,
    });

    expect(result.ceilingBinding).toBe(true);
    expect(result.average).toBe(15000);
  });

  it('counts the months with no wages', () => {
    const result = averageMonthlyWages({
      window,
      wageMonths: window
        .slice(0, 10)
        .map((month) => ({ ...month, wages: 9000 })),
      ceiling: 15000,
    });

    expect(result.zeroMonths).toBe(2);
  });
});

describe('averageBalance', () => {
  const window = windowFor('2026-03-10');

  it('does not cap the balance', () => {
    // The ceiling in paragraph 22 is on the wages. The bonus has its own cap
    // and it is applied later; capping here would apply that limit twice.
    const result = averageBalance({
      window,
      balances: window.map((month) => ({ ...month, balance: 1000000 })),
    });

    expect(result.average).toBe(1000000);
  });

  it('treats a missing month as nil', () => {
    const result = averageBalance({
      window,
      balances: window
        .slice(0, 6)
        .map((month) => ({ ...month, balance: 120000 })),
    });

    expect(result.average).toBe(60000);
  });
});

describe('continuousEmployment', () => {
  it('aggregates prior service at another establishment', () => {
    const result = continuousEmployment({
      monthsHere: 3,
      monthsElsewhere: 14,
      basis: SERVICE_BASIS.PASSBOOK,
      requiredMonths: 12,
    });

    expect(result.months).toBe(17);
    expect(result.satisfied).toBe(true);
  });

  it('does not aggregate across a gap', () => {
    // Continuous employment is continuous. Prior service separated from this
    // engagement by a break does not add, which is not a matter of arithmetic.
    const result = continuousEmployment({
      monthsHere: 3,
      monthsElsewhere: 14,
      gapBetween: true,
      requiredMonths: 12,
    });

    expect(result.months).toBe(3);
    expect(result.satisfied).toBe(false);
  });

  it('carries the basis where prior service was used', () => {
    expect(
      continuousEmployment({
        monthsHere: 2,
        monthsElsewhere: 12,
        basis: SERVICE_BASIS.DECLARED,
        requiredMonths: 12,
      }).basis,
    ).toBe(SERVICE_BASIS.DECLARED);
  });

  it('reports this establishment where there is no prior service', () => {
    expect(
      continuousEmployment({ monthsHere: 24, requiredMonths: 12 }).basis,
    ).toBe(SERVICE_BASIS.THIS_ESTABLISHMENT);
  });
});

describe('assuranceBenefit', () => {
  const satisfied = { satisfied: true };
  const unsatisfied = { satisfied: false };

  it('is thirty-five times the capped average plus half the balance', () => {
    const result = assuranceBenefit({
      averageWages: 10000,
      averageBalance: 200000,
      continuous: satisfied,
      rules: EDLI_RULES,
    });

    expect(result.assuranceComponent).toBe(350000);
    expect(result.bonusComponent).toBe(100000);
    expect(result.benefit).toBe(450000);
    expect(result.binding).toBe(BINDING.NONE);
  });

  it('caps the bonus and says it did', () => {
    const result = assuranceBenefit({
      averageWages: 10000,
      averageBalance: 1000000,
      continuous: satisfied,
      rules: EDLI_RULES,
    });

    expect(result.bonusBeforeCap).toBe(500000);
    expect(result.bonusComponent).toBe(175000);
    expect(result.binding).toBe(BINDING.BONUS_CAP);
  });

  it('lands on the overall cap at the ceiling wage', () => {
    const result = assuranceBenefit({
      averageWages: 15000,
      averageBalance: 1000000,
      continuous: satisfied,
      rules: EDLI_RULES,
    });

    expect(result.benefit).toBe(700000);
  });

  it('applies the floor where the twelve-month condition is met', () => {
    const result = assuranceBenefit({
      averageWages: 5000,
      averageBalance: 0,
      continuous: satisfied,
      rules: EDLI_RULES,
    });

    expect(result.afterOverallCap).toBe(175000);
    expect(result.benefit).toBe(250000);
    expect(result.binding).toBe(BINDING.MINIMUM);
  });

  it('does not apply the floor where it is not met', () => {
    // The single most common error in this computation. Applying the floor
    // unconditionally overstates a short-service claim by up to the whole
    // minimum.
    const result = assuranceBenefit({
      averageWages: 5000,
      averageBalance: 0,
      continuous: unsatisfied,
      rules: EDLI_RULES,
    });

    expect(result.benefit).toBe(175000);
    expect(result.minimumAvailable).toBe(false);
  });

  it('does not reduce a benefit already above the floor', () => {
    const result = assuranceBenefit({
      averageWages: 15000,
      averageBalance: 0,
      continuous: satisfied,
      rules: EDLI_RULES,
    });

    expect(result.benefit).toBe(525000);
  });
});

describe('exemptedComparison', () => {
  it('does not apply to an unexempted establishment', () => {
    const result = exemptedComparison({
      schemeBenefit: 500000,
      policyBenefit: 100000,
      exempted: false,
    });

    expect(result.applies).toBe(false);
    expect(result.shortfall).toBe(0);
  });

  it('reports the shortfall where the policy pays less', () => {
    const result = exemptedComparison({
      schemeBenefit: 700000,
      policyBenefit: 500000,
      exempted: true,
    });

    expect(result.shortfall).toBe(200000);
  });

  it('reports nothing where the policy pays more', () => {
    expect(
      exemptedComparison({
        schemeBenefit: 500000,
        policyBenefit: 900000,
        exempted: true,
      }).shortfall,
    ).toBe(0);
  });

  it('says when there is no policy figure to compare against', () => {
    const result = exemptedComparison({
      schemeBenefit: 500000,
      policyBenefit: null,
      exempted: true,
    });

    expect(result.recorded).toBe(false);
    expect(result.shortfall).toBe(0);
  });
});

describe('resolvePayees', () => {
  it('pays a valid nomination', () => {
    const result = resolvePayees({
      nominees: [{ name: 'Spouse', sharePercent: 100 }],
    });

    expect(result.limb).toBe(PAYEE_LIMB.NOMINEE);
    expect(result.complete).toBe(true);
  });

  it('falls to the family where there is no nomination', () => {
    const result = resolvePayees({ family: [{ name: 'Mother' }] });
    expect(result.limb).toBe(PAYEE_LIMB.FAMILY);
  });

  it('falls to the legal heir where there is neither', () => {
    const result = resolvePayees({ legalHeirs: [{ name: 'Brother' }] });
    expect(result.limb).toBe(PAYEE_LIMB.LEGAL_HEIR);
  });

  it('reports an incomplete nomination as incomplete, not as absent', () => {
    // The remainder falls to the next limb, which is a different outcome from
    // having no nomination at all.
    const result = resolvePayees({
      nominees: [{ name: 'Spouse', sharePercent: 60 }],
    });

    expect(result.limb).toBe(PAYEE_LIMB.NOMINEE);
    expect(result.complete).toBe(false);
    expect(result.sharesTotal).toBe(60);
  });

  it('is unresolved with nothing on record', () => {
    expect(resolvePayees({}).limb).toBe(PAYEE_LIMB.UNRESOLVED);
  });

  it('ignores a nominee with no share', () => {
    expect(
      resolvePayees({ nominees: [{ name: 'Spouse', sharePercent: 0 }] }).limb,
    ).toBe(PAYEE_LIMB.UNRESOLVED);
  });
});

describe('assessClaim', () => {
  const death = '2026-03-10';

  it('computes a full-ceiling claim to the overall cap', () => {
    const claim = assessClaim({
      member: { memberId: '1', name: 'A', dateOfDeath: death },
      wageMonths: evenWages(death, 40000),
      balances: evenBalances(death, 500000),
      service: { monthsHere: 36 },
      nomination: nominee,
    });

    expect(claim.assuranceComponent).toBe(525000);
    expect(claim.bonusComponent).toBe(175000);
    expect(claim.benefit).toBe(700000);
  });

  it('does not give a three-month member the floor', () => {
    const claim = assessClaim({
      member: { memberId: '2', dateOfDeath: death },
      wageMonths: windowFor(death)
        .slice(9)
        .map((month) => ({ ...month, wages: 10000 })),
      service: { monthsHere: 3 },
      nomination: nominee,
    });

    expect(claim.minimumAvailable).toBe(false);
    expect(claim.benefit).toBe(350000);
    expect(codesOf(claim.findings)).toContain(FINDING.MINIMUM_NOT_AVAILABLE);
  });

  it('gives a three-month member the floor with qualifying prior service', () => {
    // The case this module exists to get right. Neither the joining date nor
    // the attendance ledger can tell this member from the one above.
    const claim = assessClaim({
      member: { memberId: '3', dateOfDeath: death },
      wageMonths: windowFor(death)
        .slice(9)
        .map((month) => ({ ...month, wages: 2000 })),
      service: {
        monthsHere: 3,
        monthsElsewhere: 14,
        basis: SERVICE_BASIS.PASSBOOK,
      },
      nomination: nominee,
    });

    expect(claim.minimumAvailable).toBe(true);
    expect(claim.benefit).toBe(250000);
    expect(claim.binding).toBe(BINDING.MINIMUM);
  });

  it('flags a floor resting on a declaration alone', () => {
    const claim = assessClaim({
      member: { memberId: '4', dateOfDeath: death },
      wageMonths: windowFor(death)
        .slice(9)
        .map((month) => ({ ...month, wages: 2000 })),
      service: {
        monthsHere: 3,
        monthsElsewhere: 14,
        basis: SERVICE_BASIS.DECLARED,
      },
      nomination: nominee,
    });

    expect(codesOf(claim.findings)).toContain(
      FINDING.PRIOR_SERVICE_DECLARED_ONLY,
    );
  });

  it('flags months of no wages inside a full window', () => {
    const claim = assessClaim({
      member: { memberId: '5', dateOfDeath: death },
      wageMonths: windowFor(death)
        .slice(0, 9)
        .map((month) => ({ ...month, wages: 12000 })),
      service: { monthsHere: 36 },
      nomination: nominee,
    });

    expect(codesOf(claim.findings)).toContain(
      FINDING.ZERO_WAGE_MONTHS_IN_WINDOW,
    );
  });

  it('raises an unresolved payee as a breach', () => {
    const claim = assessClaim({
      member: { memberId: '6', dateOfDeath: death },
      wageMonths: evenWages(death, 12000),
      service: { monthsHere: 36 },
      nomination: {},
    });

    const finding = claim.findings.find(
      (row) => row.code === FINDING.PAYEE_UNRESOLVED,
    );
    expect(finding.severity).toBe(SEVERITY.BREACH);
  });

  it('reports an exempted shortfall without netting it into the benefit', () => {
    const claim = assessClaim({
      member: { memberId: '7', dateOfDeath: death },
      wageMonths: evenWages(death, 40000),
      balances: evenBalances(death, 500000),
      service: { monthsHere: 36 },
      nomination: nominee,
      exemption: { exempted: true, policyBenefit: 400000 },
    });

    expect(claim.benefit).toBe(700000);
    expect(claim.exemption.shortfall).toBe(300000);
    expect(codesOf(claim.findings)).toContain(
      FINDING.EXEMPTED_POLICY_SHORTFALL,
    );
  });

  it('flags an exempted establishment with no policy figure recorded', () => {
    const claim = assessClaim({
      member: { memberId: '8', dateOfDeath: death },
      wageMonths: evenWages(death, 12000),
      service: { monthsHere: 36 },
      nomination: nominee,
      exemption: { exempted: true },
    });

    expect(codesOf(claim.findings)).toContain(
      FINDING.EXEMPTED_POLICY_NOT_RECORDED,
    );
  });

  it('snapshots the rules it computed under', () => {
    const claim = assessClaim({
      member: { memberId: '9', dateOfDeath: '2019-06-10' },
      wageMonths: evenWages('2019-06-10', 40000),
      balances: evenBalances('2019-06-10', 1000000),
      service: { monthsHere: 36 },
      nomination: nominee,
    });

    expect(claim.rules.overallCap).toBe(600000);
    expect(claim.benefit).toBe(600000);
    expect(codesOf(claim.findings)).toContain(FINDING.RULES_PREDATE_DEATH);
  });

  it('refuses to compute without a date of death', () => {
    expect(() =>
      assessClaim({ member: { memberId: '10' }, wageMonths: [] }),
    ).toThrow(TypeError);
  });
});

describe('assessClaims', () => {
  const death = '2026-03-10';

  const register = {
    claims: [
      {
        member: { memberId: '1', dateOfDeath: death },
        wageMonths: evenWages(death, 40000),
        balances: evenBalances(death, 500000),
        service: { monthsHere: 36 },
        nomination: nominee,
        exemption: { exempted: true, policyBenefit: 400000 },
      },
      {
        member: { memberId: '2', dateOfDeath: death },
        wageMonths: evenWages(death, 12000),
        service: { monthsHere: 36 },
        nomination: nominee,
      },
    ],
  };

  it('totals what the scheme pays', () => {
    const result = assessClaims(register);
    expect(result.benefitTotal).toBe(700000 + 420000);
  });

  it('keeps the exempted shortfall out of the benefit total', () => {
    // Adding them would double-count: the shortfall is the part of the same
    // benefit the policy did not cover, not an additional payment.
    const result = assessClaims(register);

    expect(result.exemptedShortfallTotal).toBe(300000);
    expect(result.benefitTotal).not.toBe(
      700000 + 420000 + result.exemptedShortfallTotal,
    );
  });

  it('summarises the findings across claims', () => {
    const result = assessClaims(register);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('survives being called with nothing', () => {
    const result = assessClaims();
    expect(result.claims).toEqual([]);
    expect(result.benefitTotal).toBe(0);
  });
});

describe('SEED_RULE_SETS', () => {
  it('keeps the earlier set rather than replacing it', () => {
    // Claims for earlier deaths are settled years later, and a claim computed
    // under today's figures for a 2019 death is a number the EPFO will not
    // recognise.
    expect(SEED_RULE_SETS.length).toBeGreaterThan(1);
    expect(SEED_RULE_SETS[0].overallCap).toBe(600000);
  });
});
