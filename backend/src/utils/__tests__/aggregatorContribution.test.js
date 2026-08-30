/**
 * Code on Social Security, 2020, section 114 (#1829).
 *
 * The case worth stating first, because it is the reason the signature is what
 * it is: the levy and its cap sit on **two unrelated bases**. One to two per
 * cent of turnover, capped at five per cent of what was paid to gig and
 * platform workers — and which one binds is a fact about the platform's
 * economics rather than about the statute.
 *
 * A delivery platform whose payouts are most of its cost is not capped. A
 * marketplace with high turnover and thin payouts is capped, and its
 * contribution has stopped tracking turnover entirely. A caller handed only the
 * smaller number cannot tell those apart, so `contributionFor` returns both
 * limbs and names the one that bound.
 *
 * The other boundaries:
 *
 *   - unattributed turnover being a finding rather than a rounding difference,
 *     because it is turnover no rate applies to;
 *   - a category rate outside the band clamped rather than trusted;
 *   - the same worker on three platforms being one beneficiary against three
 *     contributions, counted on an axis the levy is not on;
 *   - and the statutes a gig worker is outside being *asserted* rather than
 *     omitted — a silently excluded population is indistinguishable from a
 *     forgotten one.
 */

const {
  AGGREGATOR_RULES,
  AGGREGATOR_CATEGORY,
  LIMB,
  EXCLUDED_STATUTE,
  FINDING,
  SEVERITY,
  rateForCategory,
  attributeTurnover,
  contributionFor,
  statutoryExclusions,
  workerRegistration,
  reconcileAccrual,
  assessAggregator,
} = require('../aggregatorContribution');

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

/** ₹100 crore of turnover, ₹70 crore of it delivery. */
const byCategory = [
  {
    category: AGGREGATOR_CATEGORY.FOOD_AND_GROCERY_DELIVERY,
    turnover: 700000000,
  },
  { category: AGGREGATOR_CATEGORY.E_MARKETPLACE, turnover: 300000000 },
];

describe('the two unrelated bases', () => {
  it('lets the turnover limb bind where payouts are most of the cost', () => {
    // A delivery platform: ₹40 crore paid to riders, so the ceiling is ₹2
    // crore and the one per cent limb is ₹1 crore.
    const result = contributionFor({
      totalTurnover: 1000000000,
      byCategory,
      workerPayouts: 400000000,
    });

    expect(result.turnoverLimb).toBe(10000000);
    expect(result.payoutCeiling).toBe(20000000);
    expect(result.capped).toBe(false);
    expect(result.bindingLimb).toBe(LIMB.TURNOVER);
    expect(result.payable).toBe(10000000);
  });

  it('caps a platform whose payouts are thin', () => {
    // The same turnover, ₹5 crore of payouts. The contribution has stopped
    // tracking turnover altogether.
    const result = contributionFor({
      totalTurnover: 1000000000,
      byCategory,
      workerPayouts: 50000000,
    });

    expect(result.capped).toBe(true);
    expect(result.bindingLimb).toBe(LIMB.PAYOUT_CEILING);
    expect(result.payable).toBe(2500000);
    expect(codesOf(result)).toContain(FINDING.CEILING_BINDS);
  });

  it('reports both limbs whichever one bound', () => {
    // The point of the signature: a caller handed only the payable figure
    // cannot tell the two platforms above apart.
    const uncapped = contributionFor({
      totalTurnover: 1000000000,
      byCategory,
      workerPayouts: 400000000,
    });

    expect(uncapped.turnoverLimb).toBeGreaterThan(0);
    expect(uncapped.payoutCeiling).toBeGreaterThan(0);
    expect(uncapped.headroom).toBe(10000000);
  });

  it('warns before the ceiling starts to bind', () => {
    // A falling payout ratio crosses into the cap with the turnover limb
    // unchanged, and nothing else would signal it.
    const result = contributionFor({
      totalTurnover: 1000000000,
      byCategory,
      workerPayouts: 210000000,
    });

    expect(result.capped).toBe(false);
    expect(codesOf(result)).toContain(FINDING.CEILING_HEADROOM_THIN);
    expect(
      result.findings.find((e) => e.code === FINDING.CEILING_HEADROOM_THIN)
        .severity,
    ).toBe(SEVERITY.EXPOSURE);
  });

  it('falls to the ceiling where no turnover has been recorded', () => {
    const result = contributionFor({
      totalTurnover: 0,
      byCategory: [],
      workerPayouts: 50000000,
    });

    expect(codesOf(result)).toContain(FINDING.NO_TURNOVER_RECORDED);
    expect(result.payable).toBe(0);
  });
});

describe('the Seventh Schedule rate', () => {
  it('applies the default where a category carries none', () => {
    const rate = rateForCategory(AGGREGATOR_CATEGORY.LOGISTICS);

    expect(rate.rate).toBe(AGGREGATOR_RULES.defaultRatePercent);
    expect(rate.withinBand).toBe(true);
  });

  it('applies a differentiated rate where one is notified', () => {
    const rate = rateForCategory(AGGREGATOR_CATEGORY.RIDE_SHARING, {
      categoryRates: { RIDE_SHARING: 2 },
    });

    expect(rate.rate).toBe(2);
  });

  it('clamps a rate outside the one-to-two band', () => {
    // A contribution outside the band is one the Code cannot support, and a
    // finding alone would not stop the number being used.
    const rate = rateForCategory(AGGREGATOR_CATEGORY.RIDE_SHARING, {
      categoryRates: { RIDE_SHARING: 4 },
    });

    expect(rate.rate).toBe(2);
    expect(rate.withinBand).toBe(false);
  });

  it('surfaces the clamp as a finding on the attribution', () => {
    const result = attributeTurnover(
      {
        totalTurnover: 100000000,
        byCategory: [
          { category: AGGREGATOR_CATEGORY.RIDE_SHARING, turnover: 100000000 },
        ],
      },
      { categoryRates: { RIDE_SHARING: 4 } },
    );

    expect(codesOf(result)).toContain(FINDING.RATE_OUTSIDE_BAND);
    expect(result.contribution).toBe(2000000);
  });
});

describe('turnover attribution', () => {
  it('splits turnover across categories at each one’s own rate', () => {
    const result = attributeTurnover(
      { totalTurnover: 1000000000, byCategory },
      { categoryRates: { FOOD_AND_GROCERY_DELIVERY: 2 } },
    );

    // ₹70 crore at 2% and ₹30 crore at 1%.
    expect(result.contribution).toBe(14000000 + 3000000);
  });

  it('treats an unattributed remainder as a finding, not as rounding', () => {
    // It is turnover no rate applies to, and absorbing it into whichever
    // category is listed first would produce a plausible number at the wrong
    // rate.
    const result = attributeTurnover({
      totalTurnover: 1000000000,
      byCategory: [byCategory[0]],
    });

    expect(result.unattributed).toBe(300000000);
    expect(codesOf(result)).toContain(FINDING.TURNOVER_UNATTRIBUTED);
  });

  it('tolerates a genuine rounding difference', () => {
    const result = attributeTurnover({
      totalTurnover: 1000000000,
      byCategory: [
        { category: AGGREGATOR_CATEGORY.E_MARKETPLACE, turnover: 999999900 },
      ],
    });

    expect(codesOf(result)).not.toContain(FINDING.TURNOVER_UNATTRIBUTED);
  });

  it('flags categories adding to more than the stated total', () => {
    const result = attributeTurnover({
      totalTurnover: 500000000,
      byCategory,
    });

    expect(codesOf(result)).toContain(FINDING.ATTRIBUTION_EXCEEDS_TOTAL);
  });

  it('ignores a category the Seventh Schedule does not name', () => {
    const result = attributeTurnover({
      totalTurnover: 100000000,
      byCategory: [{ category: 'CRYPTO_EXCHANGE', turnover: 100000000 }],
    });

    expect(result.categories).toHaveLength(0);
    expect(codesOf(result)).toContain(FINDING.TURNOVER_UNATTRIBUTED);
  });
});

describe('what a gig worker is outside', () => {
  it('asserts each exclusion rather than omitting it', () => {
    // #1771's lesson: a silently excluded population is indistinguishable from
    // a forgotten one.
    const exclusions = statutoryExclusions();

    for (const statute of Object.values(EXCLUDED_STATUTE)) {
      expect(exclusions[statute].applies).toBe(false);
      expect(exclusions[statute].reason).toMatch(/section 2\(35\)/);
    }
  });

  it('carries the exclusions on the aggregator, not only per worker', () => {
    const result = assessAggregator({ aggregator: { totalTurnover: 0 } });

    expect(result.exclusions[EXCLUDED_STATUTE.PROVIDENT_FUND].applies).toBe(
      false,
    );
  });
});

describe('the worker, counted per person', () => {
  it('adds days across every aggregator', () => {
    // Forty days on each of three platforms is one hundred and twenty days of
    // gig work, and each platform on its own would think this worker short.
    const result = workerRegistration({
      workerId: 'w1',
      name: 'Anup Barman',
      engagements: [
        { aggregator: 'Platform A', days: 40 },
        { aggregator: 'Platform B', days: 40 },
        { aggregator: 'Platform C', days: 40 },
      ],
    });

    expect(result.daysTotal).toBe(120);
    expect(result.aggregatorCount).toBe(3);
    expect(result.qualifies).toBe(true);
  });

  it('says the same person is one beneficiary against several contributions', () => {
    const result = workerRegistration({
      workerId: 'w1',
      engagements: [
        { aggregator: 'Platform A', days: 40 },
        { aggregator: 'Platform B', days: 40 },
      ],
    });

    const entry = result.findings.find(
      (row) => row.code === FINDING.WORKER_MULTI_AGGREGATOR,
    );

    expect(entry.aggregatorCount).toBe(2);
    expect(entry.severity).toBe(SEVERITY.INFORMATIONAL);
  });

  it('flags a qualifying worker who has not registered', () => {
    const result = workerRegistration({
      workerId: 'w1',
      engagements: [{ aggregator: 'Platform A', days: 120 }],
    });

    expect(codesOf(result)).toContain(FINDING.WORKER_UNREGISTERED);
  });

  it('stops flagging once registered', () => {
    const result = workerRegistration({
      workerId: 'w1',
      engagements: [{ aggregator: 'Platform A', days: 120 }],
      registeredOn: '2026-04-01',
    });

    expect(result.registered).toBe(true);
    expect(codesOf(result)).not.toContain(FINDING.WORKER_UNREGISTERED);
  });

  it('does not qualify a worker short of the ninety days', () => {
    const result = workerRegistration({
      workerId: 'w1',
      engagements: [{ aggregator: 'Platform A', days: 60 }],
    });

    expect(result.qualifies).toBe(false);
    expect(result.findings).toHaveLength(0);
  });
});

describe('the provisional accrual and the true-up', () => {
  it('reports a mid-year shortfall as provisional rather than as a breach', () => {
    const result = reconcileAccrual({ payable: 10000000, deposited: 7000000 });

    expect(result.provisional).toBe(true);
    expect(result.shortfall).toBe(3000000);
    expect(codesOf(result)).toEqual([FINDING.ACCRUAL_SHORT]);
    expect(result.findings[0].severity).toBe(SEVERITY.EXPOSURE);
  });

  it('becomes a breach once turnover is finalised', () => {
    const result = reconcileAccrual({
      payable: 10000000,
      deposited: 7000000,
      turnoverFinalised: true,
    });

    expect(result.provisional).toBe(false);
    expect(codesOf(result)).toEqual([FINDING.TRUE_UP_DUE]);
    expect(result.findings[0].severity).toBe(SEVERITY.BREACH);
  });

  it('reports an excess without netting it into a signed payment', () => {
    const result = reconcileAccrual({
      payable: 7000000,
      deposited: 10000000,
      turnoverFinalised: true,
    });

    expect(result.excess).toBe(3000000);
    expect(result.shortfall).toBe(0);
    expect(result.findings).toHaveLength(0);
  });
});

describe('an aggregator end to end', () => {
  const aggregator = {
    name: 'Rasoi Express',
    totalTurnover: 1000000000,
    byCategory,
    workerPayouts: 400000000,
    deposited: 10000000,
    turnoverFinalised: true,
  };

  const workers = [
    {
      workerId: 'w1',
      name: 'Anup Barman',
      engagements: [
        { aggregator: 'Rasoi Express', days: 60 },
        { aggregator: 'Chalo Rides', days: 60 },
      ],
    },
    {
      workerId: 'w2',
      name: 'Neelam Tirkey',
      engagements: [{ aggregator: 'Rasoi Express', days: 200 }],
      registeredOn: '2026-04-01',
    },
  ];

  it('settles where the deposit matches the binding limb', () => {
    const result = assessAggregator({ aggregator, workers });

    expect(result.contribution.payable).toBe(10000000);
    expect(result.accrual.shortfall).toBe(0);
  });

  it('counts the workers engaged by more than one platform', () => {
    // One beneficiary against several contributions — the count that keeps the
    // two axes apart.
    const result = assessAggregator({ aggregator, workers });

    expect(result.multiAggregatorCount).toBe(1);
    expect(result.qualifyingCount).toBe(2);
    expect(result.registeredCount).toBe(1);
  });

  it('would have called the multi-platform worker short on its own days', () => {
    // Sixty days here. It is the sixty elsewhere that carries them over
    // ninety, which is the whole reason the register is keyed on the person.
    const result = assessAggregator({ aggregator, workers });
    const worker = result.workers.find((row) => row.workerId === 'w1');

    expect(worker.daysByAggregator['Rasoi Express']).toBe(60);
    expect(worker.daysTotal).toBe(120);
    expect(worker.qualifies).toBe(true);
  });

  it('groups findings by code with a distinct worker count', () => {
    const result = assessAggregator({ aggregator, workers });
    const unregistered = result.summary.find(
      (row) => row.code === FINDING.WORKER_UNREGISTERED,
    );

    expect(unregistered.workerCount).toBe(1);
    expect(unregistered.section).toBe('section 113');
  });
});
