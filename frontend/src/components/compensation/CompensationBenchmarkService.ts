/**
 * Compensation Benchmarking — Service Layer
 *
 * Mock market benchmarks, employee compensation, geographic COL,
 * pay equity metrics, and trend data.
 */

import {
  MarketBenchmark, EmployeeCompensation, CompensationGap,
  GeographicCOL, PayEquityMetric, CompensationTrend,
  BenchmarkSummary, CompensationAlert,
  CompLevel, JobFamily, Region, EquityType, CompensationStatus,
} from './CompensationBenchmarkTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const uid = () => Math.random().toString(36).substring(2, 10);

// ── Market Benchmarks ──────────────────────────────────────────────────────

function generateBenchmarks(): MarketBenchmark[] {
  const benchmarks: MarketBenchmark[] = [];
  const families: JobFamily[] = ['Engineering', 'Product', 'Design', 'Data Science', 'DevOps', 'Marketing', 'Sales', 'Finance', 'HR', 'Legal'];
  const levels: CompLevel[] = ['Junior', 'Mid-Level', 'Senior', 'Staff', 'Principal'];
  const regions: Region[] = ['North America', 'Europe', 'Asia Pacific', 'South Asia'];

  for (const family of families) {
    for (const level of levels) {
      for (const region of regions) {
        const bm = family === 'Engineering' ? 1.15 : family === 'Data Science' ? 1.12 : family === 'Product' ? 1.1 : 1.0;
        const lm = level === 'Junior' ? 1 : level === 'Mid-Level' ? 1.35 : level === 'Senior' ? 1.7 : level === 'Staff' ? 2.2 : 2.8;
        const rm = region === 'North America' ? 1 : region === 'Europe' ? 0.82 : region === 'Asia Pacific' ? 0.65 : 0.35;
        const p50 = Math.round(95000 * bm * lm * rm);
        benchmarks.push({
          id: uid(), jobFamily: family, level, region,
          source: pick(['Levels.fyi', 'Glassdoor', 'Payscale', 'Mercer'] as const),
          sampleSize: rand(200, 3000),
          baseSalaryP25: Math.round(p50 * 0.82), baseSalaryP50: p50,
          baseSalaryP75: Math.round(p50 * 1.22), baseSalaryP90: Math.round(p50 * 1.48),
          totalCompP50: Math.round(p50 * 1.35),
          annualBonusPct: Math.round((10 + Math.random() * 15) * 10) / 10,
          equityValueP50: Math.round(p50 * 0.35),
          benefitsValueP50: Math.round(p50 * 0.25),
          lastUpdated: `2026-0${rand(1, 7)}-${String(rand(1, 28)).padStart(2, '0')}`,
        });
      }
    }
  }
  return benchmarks;
}

// ── Employees ──────────────────────────────────────────────────────────────

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara','Ahmed','Bella','Carlos','Deepa','Ethan','Fatima'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee','Meyer','Diaz','Chowdhury'];
const DEPTS: Record<string, string[]> = {
  Engineering: ['Frontend', 'Backend', 'Platform', 'Mobile'],
  Product: ['Growth', 'Platform', 'Core'],
  Design: ['UX', 'Visual', 'Systems'],
  'Data Science': ['Analytics', 'ML', 'Research'],
  DevOps: ['SRE', 'Cloud', 'CI/CD'],
  Marketing: ['Growth', 'Brand', 'Content'],
  Sales: ['Enterprise', 'Mid-Market', 'SMB'],
  Finance: ['FP&A', 'Accounting', 'Treasury'],
  HR: ['People Ops', 'Talent', 'L&D'],
  Legal: ['Corporate', 'Compliance', 'IP'],
};

function generateEmployees(): EmployeeCompensation[] {
  const employees: EmployeeCompensation[] = [];
  const levels: CompLevel[] = ['Junior', 'Mid-Level', 'Senior', 'Staff', 'Principal', 'Director', 'VP'];
  const regions: Region[] = ['North America', 'Europe', 'Asia Pacific', 'South Asia'];
  const families: JobFamily[] = ['Engineering', 'Product', 'Design', 'Data Science', 'DevOps', 'Marketing', 'Sales', 'Finance', 'HR', 'Legal'];

  for (let i = 0; i < 60; i++) {
    const family = pick(families);
    const level = pick(levels);
    const region = pick(regions);
    const dept = pick(DEPTS[family] || ['General']);
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const bm = family === 'Engineering' ? 1.15 : family === 'Data Science' ? 1.12 : family === 'Product' ? 1.1 : 1.0;
    const lm = level === 'Junior' ? 1 : level === 'Mid-Level' ? 1.35 : level === 'Senior' ? 1.7 : level === 'Staff' ? 2.2 : level === 'Principal' ? 2.8 : level === 'Director' ? 3.2 : 3.8;
    const rm = region === 'North America' ? 1 : region === 'Europe' ? 0.82 : region === 'Asia Pacific' ? 0.65 : 0.35;
    const variation = 0.85 + Math.random() * 0.35;
    const baseSalary = Math.round(95000 * bm * lm * rm * variation);
    const annualBonusPct = Math.round((8 + Math.random() * 18) * 10) / 10;
    const annualBonusAmount = Math.round(baseSalary * annualBonusPct / 100);
    const equityType: EquityType | null = level === 'Junior' ? null : pick(['RSU', 'Stock Options', 'ESOP'] as EquityType[]);
    const equityAnnualValue = level === 'Junior' ? 0 : Math.round(baseSalary * (0.15 + Math.random() * 0.4));
    const signingBonus = Math.random() > 0.65 ? rand(5, 50) * 1000 : 0;
    const benefitsValue = Math.round(baseSalary * (0.2 + Math.random() * 0.1));
    const totalCompensation = baseSalary + annualBonusAmount + equityAnnualValue + benefitsValue;
    let percentile = 30 + Math.random() * 55;
    let status: CompensationStatus;
    if (percentile < 30) status = 'Below Market';
    else if (percentile < 60) status = 'At Market';
    else if (percentile < 82) status = 'Above Market';
    else status = 'Significantly Above';

    employees.push({
      id: uid(), employeeId: `EMP-${1000 + i}`,
      employeeName: `${firstName} ${lastName}`,
      jobFamily: family, level, department: dept,
      location: region === 'North America' ? 'San Francisco' : region === 'Europe' ? 'London' : region === 'Asia Pacific' ? 'Singapore' : 'Bangalore',
      country: region === 'North America' ? 'US' : region === 'Europe' ? 'UK' : region === 'Asia Pacific' ? 'SG' : 'IN',
      region, baseSalary, annualBonusPct, annualBonusAmount,
      equityType, equityAnnualValue, signingBonus, benefitsValue,
      totalCompensation, status, percentile: Math.round(percentile * 10) / 10,
      tenure: rand(3, 72),
      performanceRating: Math.round((2.5 + Math.random() * 2.5) * 10) / 10,
      promotionReady: Math.random() > 0.8,
    });
  }
  return employees;
}

// ── Gaps ───────────────────────────────────────────────────────────────────

function generateGaps(): CompensationGap[] {
  const families: JobFamily[] = ['Engineering', 'Product', 'Design', 'Data Science', 'DevOps', 'Marketing', 'Sales'];
  const levels: CompLevel[] = ['Junior', 'Mid-Level', 'Senior', 'Staff'];
  return families.flatMap(family => levels.map(level => {
    const gap = rand(-15, 25);
    const marketP50 = rand(80000, 250000);
    const internalMedian = Math.round(marketP50 * (1 + gap / 100));
    const status: CompensationStatus = gap < -10 ? 'Below Market' : gap < 5 ? 'At Market' : gap < 20 ? 'Above Market' : 'Significantly Above';
    const riskLevel = gap < -15 ? 'Critical' as const : gap < -8 ? 'High' as const : gap < 0 ? 'Medium' as const : 'Low' as const;
    return {
      id: uid(), jobFamily: family, level, region: pick(['North America', 'Europe', 'Asia Pacific', 'South Asia'] as Region[]),
      gapAmount: internalMedian - marketP50, gapPct: gap,
      affectedEmployees: rand(3, 25), marketP50, internalMedian, status, riskLevel,
      recommendation: riskLevel === 'Critical' || riskLevel === 'High'
        ? `Urgent: Budget ${(Math.abs(gap) * 12000).toLocaleString()} for salary adjustments.`
        : `Monitor and plan adjustments for next cycle.`,
    };
  }));
}

// ── Geo COL ────────────────────────────────────────────────────────────────

function generateGeoData(): GeographicCOL[] {
  return [
    { id: uid(), city: 'San Francisco', country: 'US', region: 'North America', costOfLivingIndex: 179, taxRate: 37.5, purchasingPowerPct: 100, avgSalaryMultiplier: 1.0 },
    { id: uid(), city: 'New York', country: 'US', region: 'North America', costOfLivingIndex: 187, taxRate: 36.8, purchasingPowerPct: 95, avgSalaryMultiplier: 0.98 },
    { id: uid(), city: 'London', country: 'UK', region: 'Europe', costOfLivingIndex: 148, taxRate: 33.2, purchasingPowerPct: 78, avgSalaryMultiplier: 0.82 },
    { id: uid(), city: 'Berlin', country: 'Germany', region: 'Europe', costOfLivingIndex: 108, taxRate: 42.1, purchasingPowerPct: 85, avgSalaryMultiplier: 0.75 },
    { id: uid(), city: 'Singapore', country: 'Singapore', region: 'Asia Pacific', costOfLivingIndex: 136, taxRate: 18.5, purchasingPowerPct: 92, avgSalaryMultiplier: 0.65 },
    { id: uid(), city: 'Tokyo', country: 'Japan', region: 'Asia Pacific', costOfLivingIndex: 128, taxRate: 30.5, purchasingPowerPct: 80, avgSalaryMultiplier: 0.7 },
    { id: uid(), city: 'Bangalore', country: 'India', region: 'South Asia', costOfLivingIndex: 42, taxRate: 25.8, purchasingPowerPct: 145, avgSalaryMultiplier: 0.35 },
    { id: uid(), city: 'Mumbai', country: 'India', region: 'South Asia', costOfLivingIndex: 48, taxRate: 27.2, purchasingPowerPct: 130, avgSalaryMultiplier: 0.38 },
  ];
}

// ── Pay Equity ─────────────────────────────────────────────────────────────

function generateEquityMetrics(): PayEquityMetric[] {
  const families: JobFamily[] = ['Engineering', 'Product', 'Design', 'Data Science', 'Marketing', 'Sales'];
  const levels: CompLevel[] = ['Junior', 'Mid-Level', 'Senior', 'Staff'];
  return families.flatMap(family => levels.map(level => {
    const base = rand(75000, 200000);
    const genderGap = Math.round((-8 + Math.random() * 16) * 10) / 10;
    return {
      id: uid(), jobFamily: family, level,
      genderPayGapPct: genderGap,
      ethnicityPayGapPct: Math.round((-6 + Math.random() * 12) * 10) / 10,
      medianMaleSalary: Math.round(base * (1 + genderGap / 200)),
      medianFemaleSalary: Math.round(base * (1 - genderGap / 200)),
      maleCount: rand(10, 35), femaleCount: rand(8, 28),
      adjustedGapPct: Math.round(genderGap * 0.4 * 10) / 10,
      complianceStatus: Math.abs(genderGap) < 3 ? 'Compliant' : Math.abs(genderGap) < 6 ? 'Needs Review' : 'Non-Compliant',
    };
  }));
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): CompensationTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let avgBase = 128000, headcount = 180;
  return months.map((month, i) => {
    avgBase = Math.round(avgBase * (1 + 0.003 + Math.random() * 0.005));
    headcount += rand(2, 8);
    const avgTotalComp = Math.round(avgBase * 1.35);
    const marketP50 = Math.round(132000 * (1 + i * 0.004));
    return { month, avgBaseSalary: avgBase, avgTotalComp, marketP50,
      gapIndex: Math.round(((avgTotalComp - marketP50) / marketP50) * 1000) / 10, headcount };
  });
}

// ── Alerts ─────────────────────────────────────────────────────────────────

function generateAlerts(): CompensationAlert[] {
  return [
    { id: uid(), type: 'gap', severity: 'Critical', title: 'Engineering Staff salaries 18% below market', description: '4 engineers at Staff level have total comp significantly below P50. High attrition risk.', affectedCount: 4, estimatedCost: 120000, createdAt: '2026-08-20' },
    { id: uid(), type: 'equity', severity: 'High', title: 'Gender pay gap in Product at Senior level', description: 'Senior PMs show 8.2% unadjusted gender pay gap. Needs immediate review.', affectedCount: 6, estimatedCost: 45000, createdAt: '2026-08-18' },
    { id: uid(), type: 'retention', severity: 'High', title: '3 top performers below market P25', description: 'High-performing engineers below P25 are 3x more likely to leave within 6 months.', affectedCount: 3, estimatedCost: 95000, createdAt: '2026-08-19' },
    { id: uid(), type: 'budget', severity: 'Medium', title: 'Comp budget 92% utilized', description: 'Remaining budget may be insufficient for pending promotion cycle.', affectedCount: 0, estimatedCost: 280000, createdAt: '2026-08-15' },
    { id: uid(), type: 'compliance', severity: 'Medium', title: 'Pay equity audit overdue for DevOps', description: 'Last pay equity review for DevOps was 14 months ago.', affectedCount: 12, estimatedCost: 0, createdAt: '2026-08-14' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getCompensationBenchmarkData() {
  const benchmarks = generateBenchmarks();
  const employees = generateEmployees();
  const gaps = generateGaps();
  const geoData = generateGeoData();
  const equityMetrics = generateEquityMetrics();
  const trends = generateTrends();
  const alerts = generateAlerts();

  const summary: BenchmarkSummary = {
    totalEmployees: employees.length,
    avgBaseSalary: Math.round(employees.reduce((s, e) => s + e.baseSalary, 0) / employees.length),
    medianBaseSalary: employees.map(e => e.baseSalary).sort((a, b) => a - b)[Math.floor(employees.length / 2)],
    avgTotalComp: Math.round(employees.reduce((s, e) => s + e.totalCompensation, 0) / employees.length),
    marketPositionPct: Math.round(employees.reduce((s, e) => s + e.percentile, 0) / employees.length * 10) / 10,
    compensationCost: employees.reduce((s, e) => s + e.totalCompensation, 0),
    budgetUtilization: Math.round((85 + Math.random() * 12) * 10) / 10,
    belowMarketCount: employees.filter(e => e.status === 'Below Market').length,
    atMarketCount: employees.filter(e => e.status === 'At Market').length,
    aboveMarketCount: employees.filter(e => e.status === 'Above Market').length,
    significantAboveCount: employees.filter(e => e.status === 'Significantly Above').length,
    totalGapToMarket: gaps.reduce((s, g) => s + g.gapAmount, 0),
    avgGenderPayGapPct: Math.round(equityMetrics.reduce((s, m) => s + m.genderPayGapPct, 0) / equityMetrics.length * 10) / 10,
    pendingReviews: employees.filter(e => new Date(e.id).getTime() % 3 === 0).length,
    upcomingPromotions: employees.filter(e => e.promotionReady).length,
  };

  return { summary, benchmarks, employees, gaps, geoData, equityMetrics, trends, alerts };
}
