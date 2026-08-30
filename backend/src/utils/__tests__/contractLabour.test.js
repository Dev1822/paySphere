/**
 * Contract Labour (Regulation and Abolition) Act, 1970 (#1700).
 *
 * The boundaries worth naming:
 *
 *   - applicability as a maximum over a trailing window, not a current
 *     headcount and not an average;
 *   - coverage staying sticky once section 7 registration has happened;
 *   - the licence sized against the peak deployment rather than the latest;
 *   - a month with no wage evidence counting as section 21 exposure, and PF and
 *     ESI deliberately *not* being added to it;
 *   - wage parity surfacing candidates rather than adjudicating them;
 *   - and nothing at all being reported for an establishment the Act does not
 *     cover.
 */

const {
  APPLICABILITY_THRESHOLD,
  LICENCE_THRESHOLD,
  OSH_CODE_THRESHOLD,
  REMITTANCE,
  FINDING,
  SEVERITY,
  monthKey,
  assessApplicability,
  assessLicence,
  assessSection21Exposure,
  assessWageParity,
  annualReturnStatus,
  assessEstablishment,
} = require('../contractLabour');

const AS_AT = new Date('2026-06-30T00:00:00Z');

/** A daily headcount series with one spike. */
const headcounts = (peak, peakDate = '2026-03-14') => [
  { date: '2025-09-01', workmen: 8 },
  { date: '2026-01-15', workmen: 11 },
  { date: peakDate, workmen: peak },
  { date: '2026-06-01', workmen: 9 },
];

describe('section 1(4) applicability', () => {
  it('applies on a single day above the threshold', () => {
    // Not on average and not at year end — on any day of the preceding twelve
    // months. A fortnight at twenty-three covers the whole year.
    const result = assessApplicability({
      dailyHeadcounts: headcounts(23),
      asAt: AS_AT,
    });

    expect(result.applicable).toBe(true);
    expect(result.peakWorkmen).toBe(23);
    expect(result.reason).toMatch(/2026-03-14/);
  });

  it('does not apply where the peak stays below twenty', () => {
    const result = assessApplicability({
      dailyHeadcounts: headcounts(19),
      asAt: AS_AT,
    });

    expect(result.applicable).toBe(false);
    expect(result.peakWorkmen).toBe(19);
    expect(result.reason).toMatch(/below the section 1\(4\) threshold/);
  });

  it('applies exactly at twenty', () => {
    expect(
      assessApplicability({
        dailyHeadcounts: headcounts(APPLICABILITY_THRESHOLD),
        asAt: AS_AT,
      }).applicable,
    ).toBe(true);
  });

  it('ignores a spike outside the trailing twelve months', () => {
    const result = assessApplicability({
      dailyHeadcounts: [
        { date: '2024-03-01', workmen: 90 },
        { date: '2026-05-01', workmen: 6 },
      ],
      asAt: AS_AT,
    });

    expect(result.applicable).toBe(false);
    expect(result.peakWorkmen).toBe(6);
  });

  it('stays covered once registered, whatever the headcount now', () => {
    // Section 7 registration does not lapse because the establishment shrank.
    // The same reasoning the Payment of Bonus Act's section 1(5) uses.
    const result = assessApplicability({
      dailyHeadcounts: headcounts(4),
      asAt: AS_AT,
      previouslyCovered: true,
    });

    expect(result.applicable).toBe(true);
    expect(result.reason).toMatch(/does not lapse/);
  });

  it('carries the successor threshold for when the OSH Code is notified', () => {
    const result = assessApplicability({
      dailyHeadcounts: headcounts(23),
      asAt: AS_AT,
    });

    expect(result.threshold).toBe(APPLICABILITY_THRESHOLD);
    expect(result.successorThreshold).toBe(OSH_CODE_THRESHOLD);
  });

  it('treats an empty series as not applicable rather than throwing', () => {
    expect(
      assessApplicability({ dailyHeadcounts: [], asAt: AS_AT }).applicable,
    ).toBe(false);
  });
});

describe('section 12 licensing', () => {
  const licensed = {
    licenceNumber: 'CL/2025/441',
    licensedWorkmen: 30,
    licenceValidTo: '2027-01-31',
  };

  it('reports an unlicensed contractor above the threshold', () => {
    const result = assessLicence({}, AS_AT, 25);

    expect(result.licenceRequired).toBe(true);
    expect(result.findings[0].code).toBe(FINDING.UNLICENSED);
  });

  it('says nothing about a small contractor with no licence', () => {
    // Below twenty workmen section 12 does not require one, and reporting a
    // finding would bury the real breaches under a list of small contractors.
    const result = assessLicence({}, AS_AT, LICENCE_THRESHOLD - 1);

    expect(result.licenceRequired).toBe(false);
    expect(result.findings).toEqual([]);
  });

  it('reports an expired licence', () => {
    const result = assessLicence(
      { ...licensed, licenceValidTo: '2026-01-31' },
      AS_AT,
      25,
    );

    expect(result.expired).toBe(true);
    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.LICENCE_EXPIRED,
    );
  });

  it('warns before a licence expires, not after', () => {
    // Rule 29 requires renewal to be applied for thirty days before expiry, so
    // a warning on the expiry date arrives thirty days late.
    const result = assessLicence(
      { ...licensed, licenceValidTo: '2026-07-20' },
      AS_AT,
      25,
    );

    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.LICENCE_EXPIRING,
    );
  });

  it('reports capacity exceeded on a licence that is still valid', () => {
    // A current licence for thirty with forty deployed is a live breach, and
    // checking only expiry would let it hide behind a valid date.
    const result = assessLicence(licensed, AS_AT, 40);

    expect(result.expired).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.LICENCE_CAPACITY_EXCEEDED,
    );
  });

  it('is clean where the licence covers the deployment', () => {
    expect(assessLicence(licensed, AS_AT, 28).findings).toEqual([]);
  });
});

describe('section 21 exposure', () => {
  const contractor = { _id: 'c1', name: 'Sundaram Facilities' };

  const deployments = [
    { month: '2026-04', workmen: 30, wageBill: 450000 },
    { month: '2026-05', workmen: 30, wageBill: 450000 },
    { month: '2026-06', workmen: 28, wageBill: 420000 },
  ];

  const fullyEvidenced = deployments.flatMap((d) => [
    { month: d.month, type: REMITTANCE.WAGES },
    { month: d.month, type: REMITTANCE.PROVIDENT_FUND },
    { month: d.month, type: REMITTANCE.ESI },
  ]);

  it('is nil where every month is evidenced', () => {
    const result = assessSection21Exposure({
      contractor,
      deployments,
      remittances: fullyEvidenced,
    });

    expect(result.exposure).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('treats a month with no wage evidence as exposure', () => {
    // The pessimistic reading, deliberately: the evidence is the contractor's
    // to produce under rule 78, and a month where none was is exactly the
    // situation section 21 exists for.
    const result = assessSection21Exposure({
      contractor,
      deployments,
      remittances: fullyEvidenced.filter(
        (r) => !(r.month === '2026-05' && r.type === REMITTANCE.WAGES),
      ),
    });

    expect(result.exposure).toBe(450000);
    expect(result.recoverableUnderSection21_4).toBe(450000);
  });

  it('accumulates exposure across months', () => {
    const result = assessSection21Exposure({
      contractor,
      deployments,
      remittances: [],
    });

    expect(result.exposure).toBe(450000 + 450000 + 420000);
  });

  it('does not add PF or ESI to the wage exposure', () => {
    // Section 21 makes the principal employer liable for *wages*. Unremitted
    // contributions are the contractor's default and the leading indicator of
    // the wage default — worth surfacing, wrong to add up.
    const result = assessSection21Exposure({
      contractor,
      deployments,
      remittances: deployments.map((d) => ({
        month: d.month,
        type: REMITTANCE.WAGES,
      })),
    });

    expect(result.exposure).toBe(0);
    expect(result.findings.map((f) => f.code).sort()).toEqual([
      FINDING.ESI_UNEVIDENCED,
      FINDING.PF_UNEVIDENCED,
    ]);
  });

  it('marks the wage finding as an exposure severity', () => {
    const result = assessSection21Exposure({
      contractor,
      deployments,
      remittances: [],
    });

    const wageFinding = result.findings.find(
      (f) => f.code === FINDING.WAGES_UNEVIDENCED,
    );

    expect(wageFinding.severity).toBe(SEVERITY.EXPOSURE);
    expect(wageFinding.amount).toBe(1320000);
  });

  it('reports per-month evidence so a gap can be chased', () => {
    const result = assessSection21Exposure({
      contractor,
      deployments,
      remittances: fullyEvidenced.filter((r) => r.month !== '2026-06'),
    });

    expect(result.months.find((m) => m.month === '2026-06')).toMatchObject({
      wagesEvidenced: false,
      pfEvidenced: false,
      esiEvidenced: false,
      exposure: 420000,
    });
  });
});

describe('rule 25(2)(v)(a) wage parity', () => {
  const directWages = [
    { designation: 'Machine operator', medianWage: 24000, headcount: 40 },
    { designation: 'Security guard', medianWage: 18000, headcount: 6 },
  ];

  it('reports a material gap with the cost of closing it', () => {
    const result = assessWageParity({
      contractWages: [
        { designation: 'Machine operator', wage: 18000, workmen: 12 },
      ],
      directWages,
    });

    expect(result.materialCount).toBe(1);
    expect(result.comparisons[0].gap).toBe(6000);
    expect(result.comparisons[0].gapPercent).toBe(25);
    expect(result.monthlyCost).toBe(72000);
  });

  it('ignores a gap inside the tolerance', () => {
    const result = assessWageParity({
      contractWages: [
        { designation: 'Machine operator', wage: 23500, workmen: 12 },
      ],
      directWages,
    });

    expect(result.materialCount).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('honours a tolerance the tenant sets', () => {
    const result = assessWageParity({
      contractWages: [
        { designation: 'Machine operator', wage: 23500, workmen: 12 },
      ],
      directWages,
      tolerance: 0.01,
    });

    expect(result.materialCount).toBe(1);
  });

  it('records that there is no comparator rather than dropping the row', () => {
    // "We employ nobody directly in that role" is itself the answer to the
    // inspector's question, so it belongs in the output.
    const result = assessWageParity({
      contractWages: [{ designation: 'Scaffolder', wage: 20000, workmen: 5 }],
      directWages,
    });

    expect(result.comparisons[0]).toMatchObject({
      comparable: false,
      directWage: null,
    });
    expect(result.findings).toEqual([]);
  });

  it('matches designations case- and whitespace-insensitively', () => {
    const result = assessWageParity({
      contractWages: [
        { designation: '  machine OPERATOR ', wage: 18000, workmen: 1 },
      ],
      directWages,
    });

    expect(result.comparisons[0].comparable).toBe(true);
  });

  it('never reports a negative gap where contract labour is paid more', () => {
    // Levelling down is not what rule 25 is for, and costing it would produce a
    // negative budget.
    const result = assessWageParity({
      contractWages: [
        { designation: 'Security guard', wage: 26000, workmen: 4 },
      ],
      directWages,
    });

    expect(result.comparisons[0].gap).toBe(0);
    expect(result.monthlyCost).toBe(0);
  });
});

describe('the Form XXV annual return', () => {
  it('is due on 15 February of the following year', () => {
    const result = annualReturnStatus(2025, '2026-01-10');

    expect(result.dueBy.toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(result.overdue).toBe(false);
  });

  it('is overdue once the date passes with nothing filed', () => {
    const result = annualReturnStatus(2025, '2026-03-01');

    expect(result.overdue).toBe(true);
    expect(result.daysLate).toBe(14);
    expect(result.findings[0].code).toBe(FINDING.RETURN_OVERDUE);
  });

  it('is measured to the filing date where one exists', () => {
    const result = annualReturnStatus(2025, '2026-06-30', '2026-02-10');

    expect(result.filed).toBe(true);
    expect(result.overdue).toBe(false);
  });

  it('reports a late filing as late even though it was filed', () => {
    const result = annualReturnStatus(2025, '2026-06-30', '2026-03-20');

    expect(result.filed).toBe(true);
    expect(result.overdue).toBe(true);
    expect(result.findings[0].detail).toMatch(/filed late/);
  });
});

describe('the establishment as a whole', () => {
  const contractors = [
    {
      _id: 'c1',
      name: 'Sundaram Facilities',
      licenceNumber: 'CL/2025/441',
      licensedWorkmen: 20,
      licenceValidTo: '2027-01-31',
    },
  ];

  const base = {
    contractors,
    dailyHeadcounts: headcounts(30),
    deploymentsByContractor: {
      c1: [{ month: '2026-05', workmen: 30, wageBill: 450000 }],
    },
    remittancesByContractor: { c1: [] },
    contractWages: [
      { designation: 'Machine operator', wage: 18000, workmen: 30 },
    ],
    directWages: [
      { designation: 'Machine operator', medianWage: 24000, headcount: 40 },
    ],
    asAt: AS_AT,
    returnYear: 2025,
  };

  it('reports nothing where the Act does not apply', () => {
    // Reporting licence and section 21 findings against an establishment the
    // Act does not cover would be reporting breaches of a statute that does not
    // apply to it.
    const result = assessEstablishment({
      ...base,
      dailyHeadcounts: headcounts(6),
    });

    expect(result.applicability.applicable).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.exposure).toBe(0);
    expect(result.contractors).toEqual([]);
  });

  it('collects licence, exposure, parity and return findings together', () => {
    const result = assessEstablishment(base);

    const codes = result.findings.map((f) => f.code);

    expect(codes).toContain(FINDING.LICENCE_CAPACITY_EXCEEDED);
    expect(codes).toContain(FINDING.WAGES_UNEVIDENCED);
    expect(codes).toContain(FINDING.WAGE_PARITY_GAP);
    expect(codes).toContain(FINDING.RETURN_OVERDUE);
  });

  it('sorts exposure findings above the rest', () => {
    // The one class of finding with a rupee figure attached goes first, because
    // it is money the principal employer may have to find.
    expect(assessEstablishment(base).findings[0].severity).toBe(
      SEVERITY.EXPOSURE,
    );
  });

  it('sizes the licence against the peak month, not the latest', () => {
    // A licence for twenty is breached by a month at forty even if this month is
    // back down to fifteen.
    const result = assessEstablishment({
      ...base,
      deploymentsByContractor: {
        c1: [
          { month: '2026-04', workmen: 40, wageBill: 600000 },
          { month: '2026-05', workmen: 15, wageBill: 225000 },
        ],
      },
    });

    expect(result.contractors[0].licence.deployedWorkmen).toBe(40);
    expect(result.contractors[0].findings.map((f) => f.code)).toContain(
      FINDING.LICENCE_CAPACITY_EXCEEDED,
    );
  });

  it('tags every finding with the contractor it belongs to', () => {
    const result = assessEstablishment(base);
    const contractorFindings = result.findings.filter((f) => f.contractorId);

    expect(contractorFindings.length).toBeGreaterThan(0);
    for (const finding of contractorFindings) {
      expect(finding.contractorName).toBe('Sundaram Facilities');
    }
  });

  it('totals exposure across contractors', () => {
    const result = assessEstablishment({
      ...base,
      contractors: [...contractors, { _id: 'c2', name: 'Metro Staffing' }],
      deploymentsByContractor: {
        c1: [{ month: '2026-05', workmen: 30, wageBill: 450000 }],
        c2: [{ month: '2026-05', workmen: 25, wageBill: 300000 }],
      },
      remittancesByContractor: { c1: [], c2: [] },
    });

    expect(result.exposure).toBe(750000);
  });

  it('omits the return status when no year is asked about', () => {
    const { returnYear, ...withoutYear } = base;

    expect(assessEstablishment(withoutYear).annualReturn).toBeNull();
    expect(returnYear).toBe(2025);
  });
});

describe('month keys', () => {
  it('are zero-padded so they sort as strings', () => {
    expect(monthKey('2026-03-14')).toBe('2026-03');
    expect(monthKey('2026-11-01')).toBe('2026-11');
    expect(['2026-11', '2026-03'].sort()).toEqual(['2026-03', '2026-11']);
  });

  it('are empty for an unusable date', () => {
    expect(monthKey('not a date')).toBe('');
  });
});
