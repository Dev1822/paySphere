/**
 * Inter-State Migrant Workmen Act, 1979 (#1826).
 *
 * The case worth stating first, because it is the reason the module exists: an
 * establishment can clear every wage floor the product knows about and still be
 * in breach. Section 13(1)(a) is a minimum; section 13(1)(b) is *parity with a
 * local workman doing similar work*, and a migrant paid the notified minimum
 * beside a local fitter on ₹640 is above the floor and under the entitlement.
 *
 * So `bindingWageRate` returns the basis alongside the rate, and the parity gap
 * is reported separately from the floor gap — the two are different breaches
 * with different remedies, and an establishment that pays arrears to the
 * notified rate has not fixed the second one.
 *
 * The other boundaries:
 *
 *   - the section 14 max, where the rupee floor is normally dead and is not
 *     always;
 *   - the displacement allowance being non-refundable, so a recovery against it
 *     is a breach rather than an accounting entry;
 *   - the return fare accruing at recruitment rather than at termination;
 *   - the section 4 threshold being five where the Contract Labour Act's is
 *     twenty, which is the band establishments actually sit in;
 *   - and a passbook that exists but is stale being distinguishable from one
 *     that is current.
 */

const {
  MIGRANT_RULES,
  WAGE_BASIS,
  FACILITY,
  JOURNEY_LEG,
  FINDING,
  SEVERITY,
  bindingWageRate,
  assessWageParity,
  displacementAllowance,
  journeyAllowance,
  assessFacilities,
  passbookState,
  assessApplicability,
  assessWorkman,
  assessEstablishment,
} = require('../interStateMigrant');

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

/** Recruited in Odisha at ₹400, employed in Kerala at ₹500, locals on ₹640. */
const rates = {
  homeStateRate: 400,
  hostStateRate: 500,
  localComparableRate: 640,
};

describe('which of the three candidate rates binds', () => {
  it('takes the higher of the two notified schedules as the floor', () => {
    const binding = bindingWageRate({ homeStateRate: 400, hostStateRate: 500 });

    expect(binding.floor).toBe(500);
    expect(binding.floorBasis).toBe(WAGE_BASIS.HOST_STATE_NOTIFIED);
  });

  it('takes the home state where it is the higher of the two', () => {
    const binding = bindingWageRate({ homeStateRate: 610, hostStateRate: 500 });

    expect(binding.floor).toBe(610);
    expect(binding.floorBasis).toBe(WAGE_BASIS.HOME_STATE_NOTIFIED);
  });

  it('gives a tie to the state of employment, which the inspection is under', () => {
    const binding = bindingWageRate({ homeStateRate: 500, hostStateRate: 500 });

    expect(binding.floorBasis).toBe(WAGE_BASIS.HOST_STATE_NOTIFIED);
  });

  it('lets a local comparator above the floor displace it', () => {
    const binding = bindingWageRate(rates);

    expect(binding.rate).toBe(640);
    expect(binding.basis).toBe(WAGE_BASIS.LOCAL_COMPARABLE);
    // And the floor is still reported, because the two are different breaches.
    expect(binding.floor).toBe(500);
  });

  it('does not let a local comparator below the floor pull the rate down', () => {
    // 13(1)(b) is an entitlement to parity, not a licence to pay a local
    // workman badly and match it.
    const binding = bindingWageRate({ ...rates, localComparableRate: 300 });

    expect(binding.rate).toBe(500);
    expect(binding.basis).toBe(WAGE_BASIS.HOST_STATE_NOTIFIED);
  });

  it('distinguishes an absent comparator from a comparator of zero', () => {
    expect(bindingWageRate({ hostStateRate: 500 }).comparatorRecorded).toBe(
      false,
    );
    expect(
      bindingWageRate({ hostStateRate: 500, localComparableRate: 0 })
        .comparatorRecorded,
    ).toBe(true);
  });
});

describe('the breach a minimum-wage check cannot see', () => {
  it('reports a parity gap where the floor is comfortably cleared', () => {
    const result = assessWageParity(
      { rates, paidDailyRate: 520, daysWorked: 26 },
      {},
    );

    expect(result.floorGap).toBe(0);
    expect(result.parityGap).toBe(120);
    expect(codesOf(result)).toContain(FINDING.BELOW_LOCAL_COMPARABLE);
    expect(codesOf(result)).not.toContain(FINDING.BELOW_STATUTORY_FLOOR);
  });

  it('reports both limbs where both are breached', () => {
    const result = assessWageParity(
      { rates, paidDailyRate: 450, daysWorked: 26 },
      {},
    );

    expect(result.floorGap).toBe(50);
    expect(result.parityGap).toBe(190);
    expect(codesOf(result)).toEqual(
      expect.arrayContaining([
        FINDING.BELOW_STATUTORY_FLOOR,
        FINDING.BELOW_LOCAL_COMPARABLE,
      ]),
    );
  });

  it('runs the arrears to the limb that binds rather than to the sum', () => {
    // Paying both gaps would be paying the shortfall twice: the parity gap
    // already spans the floor.
    const result = assessWageParity(
      { rates, paidDailyRate: 450, daysWorked: 26 },
      {},
    );

    expect(result.arrears).toBe(190 * 26);
  });

  it('says so when nobody has recorded a comparator', () => {
    const result = assessWageParity(
      {
        rates: { homeStateRate: 400, hostStateRate: 500 },
        paidDailyRate: 500,
        daysWorked: 26,
      },
      {},
    );

    expect(codesOf(result)).toContain(FINDING.NO_LOCAL_COMPARATOR);
    // Informational: an absent comparator is not a finding that none exists.
    expect(result.findings[0].severity).toBe(SEVERITY.INFORMATIONAL);
  });
});

describe('the section 14 displacement allowance', () => {
  it('takes fifty per cent of monthly wages where that is the larger limb', () => {
    const result = displacementAllowance({ monthlyWages: 16640, paid: 0 });

    expect(result.due).toBe(8320);
    expect(result.boundBy).toBe('PERCENT');
  });

  it('falls back to the rupee floor for a wage small enough to reach it', () => {
    // Dead for any realistic monthly wage, live for a part-month engagement —
    // which is why the max is written out rather than assumed away.
    const result = displacementAllowance({ monthlyWages: 120, paid: 0 });

    expect(result.due).toBe(MIGRANT_RULES.displacementFloor);
    expect(result.boundBy).toBe('FLOOR');
  });

  it('flags a payment that was never made', () => {
    const result = displacementAllowance({ monthlyWages: 16640 });

    expect(codesOf(result)).toContain(FINDING.DISPLACEMENT_UNPAID);
  });

  it('flags a short payment with the shortfall', () => {
    const result = displacementAllowance({ monthlyWages: 16640, paid: 5000 });

    expect(codesOf(result)).toContain(FINDING.DISPLACEMENT_SHORT);
    expect(result.shortfall).toBe(3320);
  });

  it('treats a recovery against it as a breach, not an accounting entry', () => {
    // The failure this module exists to make visible: section 14 says the
    // allowance is not refundable, so an advance-recovery pass that touches it
    // has taken back money the workman was entitled to keep.
    const result = displacementAllowance({
      monthlyWages: 16640,
      paid: 8320,
      recovered: 8320,
    });

    expect(result.recoverable).toBe(false);
    expect(codesOf(result)).toContain(FINDING.DISPLACEMENT_RECOVERED);
    expect(result.shortfall).toBe(8320);
  });
});

describe('the section 15 journey allowance', () => {
  const base = {
    outwardFare: 1800,
    outwardJourneyDays: 2,
    dailyWage: 640,
    outwardPaid: 1800,
  };

  it('presumes a symmetric return fare where only one was recorded', () => {
    const result = journeyAllowance(base, {});
    const back = result.legs.find((leg) => leg.leg === JOURNEY_LEG.RETURN);

    // Presuming zero would silently halve the liability for the commonest data
    // shape in the collection.
    expect(back.fare).toBe(1800);
  });

  it('pays wages for the days spent travelling as though worked', () => {
    const result = journeyAllowance(base, {});
    const outward = result.legs.find((leg) => leg.leg === JOURNEY_LEG.OUTWARD);

    expect(outward.journeyWages).toBe(1280);
    expect(outward.due).toBe(3080);
  });

  it('flags a return leg that has not been accrued at all', () => {
    const result = journeyAllowance(base, {});

    expect(codesOf(result)).toContain(FINDING.RETURN_JOURNEY_UNACCRUED);
  });

  it('stops flagging it once it has been accrued, before it is paid', () => {
    // Accrual and payment are separate: the fare is owed from recruitment, and
    // it falls due when the workman actually leaves.
    const result = journeyAllowance({ ...base, returnAccrued: true }, {});

    expect(codesOf(result)).not.toContain(FINDING.RETURN_JOURNEY_UNACCRUED);

    // Still outstanding: ₹1,280 of outward journey wages that the ₹1,800 fare
    // payment did not cover, and the whole ₹3,080 return leg.
    expect(result.outstanding).toBe(1280 + 3080);
  });

  it('flags journey wages separately from the fare', () => {
    const result = journeyAllowance(
      { ...base, returnAccrued: true, returnPaid: 3080, journeyWagesPaid: 0 },
      {},
    );

    expect(codesOf(result)).toContain(FINDING.JOURNEY_WAGES_UNPAID);
  });

  it('drops journey wages where a rule set switches them off', () => {
    const result = journeyAllowance(base, { journeyWagesPayable: false });
    const outward = result.legs.find((leg) => leg.leg === JOURNEY_LEG.OUTWARD);

    expect(outward.journeyWages).toBe(0);
    expect(codesOf(result)).not.toContain(FINDING.JOURNEY_WAGES_UNPAID);
  });
});

describe('the section 16 facilities', () => {
  it('costs an un-provided facility rather than only flagging it', () => {
    const result = assessFacilities([
      {
        facility: FACILITY.ACCOMMODATION,
        provided: false,
        substituteCost: 42000,
      },
      { facility: FACILITY.MEDICAL, provided: true },
      { facility: FACILITY.PROTECTIVE_CLOTHING, provided: true },
    ]);

    expect(result.recoverableCost).toBe(42000);
    expect(codesOf(result)).toEqual([FINDING.FACILITY_NOT_PROVIDED]);
    // Costed, so it is an exposure rather than a bare breach.
    expect(result.findings[0].severity).toBe(SEVERITY.EXPOSURE);
  });

  it('treats a facility nobody recorded as un-provided', () => {
    const result = assessFacilities([]);

    expect(result.provided).toBe(0);
    expect(result.required).toBe(3);
    expect(result.findings).toHaveLength(3);
  });

  it('falls back to section 16’s three where a rule set carries no list', () => {
    // A stored rule set with an empty list would otherwise make every facility
    // optional and every finding disappear.
    const result = assessFacilities([], { requiredFacilities: [] });

    expect(result.required).toBe(3);
  });
});

describe('the section 4 and 8 thresholds', () => {
  it('does not apply below five migrant workmen', () => {
    const result = assessApplicability({ migrantPeak: 4 });

    expect(result.applicable).toBe(false);
    expect(codesOf(result)).toEqual([FINDING.NOT_APPLICABLE]);
  });

  it('applies at five, where the Contract Labour Act does not', () => {
    const result = assessApplicability({ migrantPeak: 6, registered: false });

    expect(result.applicable).toBe(true);
    expect(result.threshold).toBe(5);
    // Reported next to the 1970 Act's own number, because two different
    // figures shown together is the only way anybody notices they differ.
    expect(result.contractLabourThreshold).toBe(20);
    expect(codesOf(result)).toContain(FINDING.REGISTRATION_REQUIRED);
  });

  it('measures on the twelve-month peak rather than on today', () => {
    // Both sections are worded on "any day", so a site that ran twelve migrants
    // in March and two today is inside the Act.
    const result = assessApplicability({ migrantPeak: 12, registered: true });

    expect(result.applicable).toBe(true);
    expect(codesOf(result)).not.toContain(FINDING.REGISTRATION_REQUIRED);
  });

  it('licenses each contractor on its own migrant headcount', () => {
    const result = assessApplicability({
      migrantPeak: 30,
      registered: true,
      contractors: [
        {
          contractorId: 'a',
          name: 'Kalinga Labour',
          migrantWorkmen: 18,
          licensed: false,
        },
        {
          contractorId: 'b',
          name: 'Vasant Enterprises',
          migrantWorkmen: 3,
          licensed: false,
        },
      ],
    });

    // The second is below the section 8 threshold on its own deployment, even
    // though the site as a whole is well inside the Act.
    expect(codesOf(result)).toEqual([FINDING.CONTRACTOR_UNLICENSED]);
    expect(result.contractors[1].needsLicence).toBe(false);
  });
});

describe('the Form XIII passbook', () => {
  it('flags one that was never issued', () => {
    const result = passbookState({});

    expect(result.issued).toBe(false);
    expect(codesOf(result)).toEqual([FINDING.PASSBOOK_NOT_ISSUED]);
  });

  it('accepts one that has not needed updating', () => {
    const result = passbookState({
      issuedOn: '2026-01-10',
      asAt: '2026-08-01',
    });

    expect(result.issued).toBe(true);
    expect(result.stale).toBe(false);
    expect(result.findings).toHaveLength(0);
  });

  it('is not stale inside the window after a rate change', () => {
    const result = passbookState({
      issuedOn: '2026-01-10',
      rateChangedOn: '2026-07-20',
      asAt: '2026-08-01',
    });

    expect(result.stale).toBe(false);
  });

  it('goes stale once the window has run, which a bare existence check misses', () => {
    const result = passbookState({
      issuedOn: '2026-01-10',
      rateChangedOn: '2026-04-01',
      asAt: '2026-08-01',
    });

    expect(result.stale).toBe(true);
    expect(result.staleByDays).toBeGreaterThan(90);
    expect(codesOf(result)).toEqual([FINDING.PASSBOOK_STALE]);
  });

  it('is current again once it has been brought up to date', () => {
    const result = passbookState({
      issuedOn: '2026-01-10',
      rateChangedOn: '2026-04-01',
      lastUpdatedOn: '2026-04-10',
      asAt: '2026-08-01',
    });

    expect(result.stale).toBe(false);
  });
});

describe('a workman end to end', () => {
  const workman = {
    workmanId: 'w1',
    name: 'Sukanta Behera',
    trade: 'Fitter',
    homeState: 'Odisha',
    hostState: 'Kerala',
    rates,
    paidDailyRate: 520,
    daysWorked: 26,
    outwardFare: 1800,
    outwardJourneyDays: 2,
    outwardPaid: 1800,
    passbookIssuedOn: '2026-02-01',
  };

  it('bases the displacement allowance on the rate that binds, not the one paid', () => {
    // An establishment underpaying the wage should not get a smaller statutory
    // allowance out of having underpaid it.
    const result = assessWorkman(workman);

    expect(result.monthlyWages).toBe(640 * 26);
    expect(result.displacement.due).toBe(8320);
  });

  it('prices the journey at the binding rate too', () => {
    const result = assessWorkman(workman);
    const outward = result.journey.legs[0];

    expect(outward.journeyWages).toBe(1280);
  });

  it('takes an explicit monthly wage over the derived one', () => {
    const result = assessWorkman({ ...workman, monthlyWages: 20000 });

    expect(result.displacement.due).toBe(10000);
  });

  it('sums what is owed across every limb', () => {
    const result = assessWorkman(workman);

    expect(result.outstanding).toBe(
      result.parity.arrears +
        result.displacement.shortfall +
        result.journey.outstanding,
    );
  });

  it('stamps every finding with the workman it belongs to', () => {
    const result = assessWorkman(workman);

    expect(result.findings.length).toBeGreaterThan(0);
    for (const entry of result.findings) {
      expect(entry.workmanId).toBe('w1');
      expect(entry.workmanName).toBe('Sukanta Behera');
    }
  });
});

describe('the establishment', () => {
  const workmen = [
    // Above every floor, under the colleague beside him. The case the product
    // could not previously see.
    {
      workmanId: 'w1',
      name: 'Sukanta Behera',
      rates,
      paidDailyRate: 520,
      daysWorked: 26,
      outwardFare: 1800,
      outwardPaid: 1800,
      returnAccrued: true,
      returnPaid: 1800,
      displacementPaid: 8320,
      passbookIssuedOn: '2026-02-01',
    },
    // Compliant on every limb.
    {
      workmanId: 'w2',
      name: 'Rameshwar Yadav',
      rates: { ...rates, localComparableRate: 640 },
      paidDailyRate: 640,
      daysWorked: 26,
      outwardFare: 1800,
      outwardPaid: 1800,
      returnAccrued: true,
      returnPaid: 1800,
      displacementPaid: 8320,
      passbookIssuedOn: '2026-02-01',
    },
  ];

  const establishment = {
    workmen,
    applicability: { migrantPeak: 9, registered: true },
    facilities: [
      { facility: FACILITY.ACCOMMODATION, provided: true },
      { facility: FACILITY.MEDICAL, provided: true },
      { facility: FACILITY.PROTECTIVE_CLOTHING, provided: true },
    ],
  };

  it('counts the workmen who are above the floor and under the comparator', () => {
    const result = assessEstablishment(establishment);

    // The headline number for this module: one man, compliant on every wage
    // floor in the product, and owed arrears.
    expect(result.parityOnlyCount).toBe(1);
    expect(result.wageArrears).toBe(120 * 26);
  });

  it('keeps the section 16 exposure outside the per-workman totals', () => {
    const result = assessEstablishment({
      ...establishment,
      facilities: [
        {
          facility: FACILITY.ACCOMMODATION,
          provided: false,
          substituteCost: 42000,
        },
        { facility: FACILITY.MEDICAL, provided: true },
        { facility: FACILITY.PROTECTIVE_CLOTHING, provided: true },
      ],
    });

    // It is owed to the government rather than to a workman, so it cannot be
    // attributed to one — but it is still part of what the site owes.
    expect(result.facilityExposure).toBe(42000);
    expect(result.outstanding).toBe(
      result.workmen.reduce((sum, row) => sum + row.outstanding, 0) + 42000,
    );
  });

  it('groups findings by code with a distinct workman count', () => {
    const result = assessEstablishment(establishment);
    const parity = result.summary.find(
      (row) => row.code === FINDING.BELOW_LOCAL_COMPARABLE,
    );

    expect(parity.workmanCount).toBe(1);
    expect(parity.section).toBe('section 13(1)(b)');
  });

  it('falls back to the roll size where no peak has been recorded', () => {
    const result = assessEstablishment({ workmen, facilities: [] });

    expect(result.applicability.migrantPeak).toBe(2);
    expect(result.applicable).toBe(false);
  });

  it('reports an unregistered establishment above the threshold', () => {
    const result = assessEstablishment({
      ...establishment,
      applicability: { migrantPeak: 9, registered: false },
    });

    expect(result.findings.map((entry) => entry.code)).toContain(
      FINDING.REGISTRATION_REQUIRED,
    );
  });
});
