// ──────────────────────────────────────────────────────────────────────────────
// Salary Benchmarking & Compensation Intelligence Hub — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
    MarketBenchmark, EmployeeCompensation, PayEquityGroup,
    DepartmentCompSummary, CompBand, MeritRecommendation,
    CompensationKPIs, PayrollTrendPoint,
    RoleLevel, MarketPosition, EquityStatus,
} from '../types/salaryBenchmark';

// ─── Seed Helpers ─────────────────────────────────────────────────────────────

const rng = (min: number, max: number, decimals = 0): number => {
    const v = Math.random() * (max - min) + min;
    return decimals ? parseFloat(v.toFixed(decimals)) : Math.round(v);
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const FIRST_NAMES = ['Arjun', 'Priya', 'Rahul', 'Sneha', 'Karan', 'Meera', 'Vivek', 'Anjali',
    'Rohit', 'Divya', 'Siddharth', 'Nisha', 'Aarav', 'Pooja', 'Nikhil', 'Kavita',
    'Akash', 'Riya', 'Manish', 'Swati', 'Suresh', 'Lakshmi', 'Deepak', 'Ananya'];
const LAST_NAMES = ['Sharma', 'Patel', 'Verma', 'Singh', 'Kumar', 'Joshi', 'Mehta', 'Nair',
    'Gupta', 'Reddy', 'Iyer', 'Rao', 'Bose', 'Saxena', 'Malhotra', 'Agarwal'];

const DEPARTMENTS = ['Engineering', 'Product', 'Data Science', 'Finance', 'Sales',
    'Marketing', 'HR', 'Legal', 'Operations', 'Customer Success'];
const LOCATIONS = ['Bangalore', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai', 'Remote'];
const LEVELS: RoleLevel[] = ['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL', 'DIRECTOR', 'VP'];
const EQUITY_STATUSES: EquityStatus[] = ['UNVESTED', 'VESTING', 'VESTED', 'NO_EQUITY'];
const SOURCES: MarketBenchmark['source'][] = ['MERCER', 'RADFORD', 'GLASSDOOR', 'PAYSCALE', 'INTERNAL'];

const ROLE_BY_DEPT: Record<string, string[]> = {
    Engineering: ['Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'DevOps Engineer', 'Security Engineer'],
    Product: ['Product Manager', 'Product Analyst', 'UX Designer', 'Product Designer'],
    'Data Science': ['Data Scientist', 'ML Engineer', 'Data Analyst', 'Research Engineer'],
    Finance: ['Financial Analyst', 'Controller', 'Accountant', 'Treasury Manager'],
    Sales: ['Account Executive', 'Sales Manager', 'Business Development Rep', 'Solutions Engineer'],
    Marketing: ['Growth Marketer', 'Content Strategist', 'Brand Manager', 'SEO Specialist'],
    HR: ['HR Business Partner', 'Recruiter', 'L&D Specialist', 'Compensation Analyst'],
    Legal: ['Legal Counsel', 'Compliance Manager', 'Contract Manager'],
    Operations: ['Operations Manager', 'Process Analyst', 'Logistics Manager'],
    'Customer Success': ['Customer Success Manager', 'Onboarding Specialist', 'Support Lead'],
};

// ─── Level → Base Salary Range (INR LPA) ─────────────────────────────────────

const LEVEL_SALARY_MAP: Record<RoleLevel, [number, number]> = {
    INTERN: [300000, 700000],
    JUNIOR: [600000, 1200000],
    MID: [1200000, 2200000],
    SENIOR: [2200000, 4000000],
    LEAD: [3500000, 6000000],
    PRINCIPAL: [5500000, 9000000],
    DIRECTOR: [8000000, 15000000],
    VP: [14000000, 25000000],
    C_SUITE: [22000000, 40000000],
};

const MARKET_POSITION_LABELS: Record<string, MarketPosition> = {
    BELOW_MARKET: 'BELOW_MARKET',
    AT_MARKET: 'AT_MARKET',
    ABOVE_MARKET: 'ABOVE_MARKET',
    PREMIUM: 'PREMIUM',
};

function getMarketPosition(compaRatio: number): MarketPosition {
    if (compaRatio < 0.85) return 'BELOW_MARKET';
    if (compaRatio < 1.05) return 'AT_MARKET';
    if (compaRatio < 1.20) return 'ABOVE_MARKET';
    return 'PREMIUM';
}

// ─── 1. Market Benchmarks ─────────────────────────────────────────────────────

export function generateMarketBenchmarks(): MarketBenchmark[] {
    const benchmarks: MarketBenchmark[] = [];
    DEPARTMENTS.forEach((dept) => {
        const roles = ROLE_BY_DEPT[dept];
        roles.forEach((role) => {
            LEVELS.slice(1, 6).forEach((level) => {
                const [min, max] = LEVEL_SALARY_MAP[level];
                const p50 = rng(min * 0.9, max * 0.9);
                benchmarks.push({
                    role,
                    level,
                    department: dept,
                    location: pick(LOCATIONS),
                    p10: Math.round(p50 * 0.72),
                    p25: Math.round(p50 * 0.86),
                    p50,
                    p75: Math.round(p50 * 1.15),
                    p90: Math.round(p50 * 1.32),
                    currency: 'INR',
                    source: pick(SOURCES),
                    lastUpdated: new Date(Date.now() - rng(0, 90) * 86400000).toISOString().split('T')[0],
                    sampleSize: rng(40, 850),
                });
            });
        });
    });
    return benchmarks;
}

// ─── 2. Employee Compensation Records ─────────────────────────────────────────

export function generateEmployeeCompensations(count = 60): EmployeeCompensation[] {
    return Array.from({ length: count }, (_, i) => {
        const firstName = pick(FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const dept = pick(DEPARTMENTS);
        const role = pick(ROLE_BY_DEPT[dept]);
        const level = pick(LEVELS.slice(0, 7));
        const [salMin, salMax] = LEVEL_SALARY_MAP[level];
        const baseSalary = rng(salMin, salMax);
        const variablePay = Math.round(baseSalary * rng(5, 25) / 100);
        const stockValue = Math.round(baseSalary * rng(0, 40) / 100);
        const totalCTC = baseSalary + variablePay + stockValue;
        const benchmarkP50 = Math.round(baseSalary * rng(80, 120) / 100);
        const benchmarkP75 = Math.round(benchmarkP50 * 1.15);
        const compaRatio = parseFloat((baseSalary / benchmarkP50).toFixed(3));
        const marketPosition = getMarketPosition(compaRatio);
        const retentionRisk = compaRatio < 0.85
            ? (Math.random() > 0.5 ? 'CRITICAL' : 'HIGH')
            : compaRatio > 1.2 ? 'LOW' : pick(['LOW', 'MEDIUM', 'HIGH'] as const);
        const lastReviewDays = rng(30, 400);
        const lastReviewDate = new Date(Date.now() - lastReviewDays * 86400000).toISOString().split('T')[0];
        const nextReviewDate = new Date(Date.now() + rng(30, 180) * 86400000).toISOString().split('T')[0];
        return {
            employeeId: `EMP${String(1000 + i).padStart(5, '0')}`,
            name: `${firstName} ${lastName}`,
            avatarInitials: `${firstName[0]}${lastName[0]}`,
            role, level, department: dept,
            location: pick(LOCATIONS),
            baseSalary, variablePay, stockValue, totalCTC,
            currency: 'INR',
            compensationType: pick(['FIXED', 'VARIABLE', 'HYBRID'] as const),
            benchmarkP50, benchmarkP75, compaRatio, marketPosition,
            equityStatus: pick(EQUITY_STATUSES),
            yearsInRole: rng(0, 8),
            lastReviewDate, nextReviewDate,
            meritIncreasePct: rng(3, 18, 1),
            retentionRisk,
            isHighPerformer: Math.random() > 0.7,
        };
    });
}

// ─── 3. Pay Equity Groups ─────────────────────────────────────────────────────

export function generatePayEquityGroups(employees: EmployeeCompensation[]): PayEquityGroup[] {
    const genders: PayEquityGroup['gender'][] = ['Male', 'Female', 'Non-Binary', 'Undisclosed'];
    const groups: PayEquityGroup[] = [];
    const depts = [...new Set(employees.map((e) => e.department))];
    const levels: RoleLevel[] = ['MID', 'SENIOR', 'LEAD', 'PRINCIPAL'];

    depts.forEach((dept) => {
        levels.forEach((level) => {
            genders.forEach((gender) => {
                const headcount = rng(2, 15);
                const [min, max] = LEVEL_SALARY_MAP[level];
                const refP50 = rng(min * 0.9, max * 0.9);
                // simulate gap: females/NB slightly lower in some depts
                const gapFactor = gender === 'Male' ? 1 : gender === 'Female' ? rng(90, 103) / 100 : rng(92, 105) / 100;
                const avgBase = Math.round(refP50 * gapFactor * rng(92, 108) / 100);
                const avgCTC = Math.round(avgBase * rng(120, 145) / 100);
                const avgCompaRatio = parseFloat((avgBase / refP50).toFixed(3));
                // gap vs male reference group
                const gapVsRef = gender === 'Male' ? 0 : parseFloat(((gapFactor - 1) * 100).toFixed(2));
                const direction = gapVsRef >= 1
                    ? 'FAVORABLE'
                    : gapVsRef > -3
                        ? 'NEUTRAL'
                        : 'GAP_DETECTED';

                if (headcount >= 3) { // only include statistically meaningful groups
                    groups.push({
                        groupKey: `${dept} / ${level} / ${gender}`,
                        department: dept, level, gender, headcount,
                        avgBaseSalary: avgBase,
                        medianBaseSalary: Math.round(avgBase * rng(97, 103) / 100),
                        avgTotalCTC: avgCTC,
                        benchmarkP50: refP50,
                        avgCompaRatio,
                        gapVsReferenceGroup: gapVsRef,
                        direction: direction as PayEquityGroup['direction'],
                        isStatisticallySignificant: Math.abs(gapVsRef) > 2 && headcount >= 5,
                    });
                }
            });
        });
    });
    return groups;
}

// ─── 4. Department Compensation Summaries ─────────────────────────────────────

export function generateDeptSummaries(employees: EmployeeCompensation[]): DepartmentCompSummary[] {
    const depts = [...new Set(employees.map((e) => e.department))];
    return depts.map((dept) => {
        const grp = employees.filter((e) => e.department === dept);
        const avgBase = Math.round(grp.reduce((s, e) => s + e.baseSalary, 0) / grp.length);
        const avgCTC = Math.round(grp.reduce((s, e) => s + e.totalCTC, 0) / grp.length);
        const avgCompa = parseFloat((grp.reduce((s, e) => s + e.compaRatio, 0) / grp.length).toFixed(3));
        return {
            department: dept,
            headcount: grp.length,
            avgBaseSalary: avgBase,
            avgTotalCTC: avgCTC,
            avgCompaRatio: avgCompa,
            belowMarketCount: grp.filter((e) => e.marketPosition === 'BELOW_MARKET').length,
            atMarketCount: grp.filter((e) => e.marketPosition === 'AT_MARKET').length,
            aboveMarketCount: grp.filter((e) => e.marketPosition === 'ABOVE_MARKET').length,
            premiumCount: grp.filter((e) => e.marketPosition === 'PREMIUM').length,
            totalPayrollCost: Math.round(grp.reduce((s, e) => s + e.totalCTC, 0)),
            projectedMeritBudget: Math.round(avgBase * grp.length * 0.07),
            retentionRiskHighCount: grp.filter((e) => e.retentionRisk === 'HIGH' || e.retentionRisk === 'CRITICAL').length,
            trendDirection: pick(['UP', 'FLAT', 'DOWN'] as const),
        };
    });
}

// ─── 5. Compensation Bands ────────────────────────────────────────────────────

export function generateCompBands(): CompBand[] {
    const bands: CompBand[] = [];
    DEPARTMENTS.slice(0, 5).forEach((dept) => {
        const roles = ROLE_BY_DEPT[dept].slice(0, 2);
        roles.forEach((role) => {
            ['MID', 'SENIOR', 'LEAD'].forEach((level) => {
                const [min, max] = LEVEL_SALARY_MAP[level as RoleLevel];
                const mid = rng(min, max);
                bands.push({
                    role, level: level as RoleLevel, department: dept,
                    bandMin: Math.round(mid * 0.80),
                    bandMid: mid,
                    bandMax: Math.round(mid * 1.20),
                    currency: 'INR',
                    marketAnchor: Math.round(mid * rng(95, 108) / 100),
                    utilizationPct: rng(55, 95, 1),
                    outlierCount: rng(0, 5),
                });
            });
        });
    });
    return bands;
}

// ─── 6. Merit Recommendations ────────────────────────────────────────────────

export function generateMeritRecommendations(employees: EmployeeCompensation[]): MeritRecommendation[] {
    const reasons: MeritRecommendation['reason'][] = [
        'BELOW_MARKET', 'HIGH_PERFORMER', 'RETENTION_RISK', 'PROMOTION', 'STANDARD_CYCLE'
    ];
    return employees
        .filter((e) => e.marketPosition === 'BELOW_MARKET' || e.retentionRisk === 'HIGH'
            || e.retentionRisk === 'CRITICAL' || e.isHighPerformer)
        .slice(0, 25)
        .map((e) => {
            const pct = e.retentionRisk === 'CRITICAL' ? rng(15, 30, 1)
                : e.marketPosition === 'BELOW_MARKET' ? rng(10, 20, 1)
                    : rng(5, 12, 1);
            const newSalary = Math.round(e.baseSalary * (1 + pct / 100));
            const reason = e.retentionRisk === 'CRITICAL' ? 'RETENTION_RISK'
                : e.marketPosition === 'BELOW_MARKET' ? 'BELOW_MARKET'
                    : e.isHighPerformer ? 'HIGH_PERFORMER'
                        : pick(reasons);
            return {
                employeeId: e.employeeId,
                name: e.name,
                department: e.department,
                role: e.role,
                level: e.level,
                currentBaseSalary: e.baseSalary,
                recommendedIncreasePct: pct,
                recommendedNewSalary: newSalary,
                reason,
                urgency: e.retentionRisk === 'CRITICAL' ? 'IMMEDIATE'
                    : e.retentionRisk === 'HIGH' ? 'NEXT_CYCLE' : 'PLANNED',
                estimatedCost: newSalary - e.baseSalary,
                priority: e.retentionRisk === 'CRITICAL' ? 'CRITICAL'
                    : e.marketPosition === 'BELOW_MARKET' ? 'HIGH'
                        : e.isHighPerformer ? 'MEDIUM' : 'LOW',
            };
        });
}

// ─── 7. Payroll Trend ─────────────────────────────────────────────────────────

export function generatePayrollTrend(): PayrollTrendPoint[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let headcount = 220;
    let avgSal = 1800000;
    return months.map((month) => {
        headcount += rng(-2, 8);
        avgSal = Math.round(avgSal * (1 + rng(-1, 2) / 100));
        const totalPayroll = Math.round(headcount * avgSal / 12);
        return {
            month, totalPayroll, headcount,
            avgSalary: avgSal,
            meritSpend: Math.round(totalPayroll * rng(5, 12) / 100),
        };
    });
}

// ─── 8. KPIs ─────────────────────────────────────────────────────────────────

export function computeCompKPIs(
    employees: EmployeeCompensation[],
    meritRecs: MeritRecommendation[]
): CompensationKPIs {
    const totalCTC = employees.reduce((s, e) => s + e.totalCTC, 0);
    const avgCompa = employees.reduce((s, e) => s + e.compaRatio, 0) / employees.length;
    const sorted = [...employees].sort((a, b) => a.compaRatio - b.compaRatio);
    const med = sorted[Math.floor(sorted.length / 2)]?.compaRatio ?? 1;
    const below = employees.filter((e) => e.marketPosition === 'BELOW_MARKET').length;
    const at = employees.filter((e) => e.marketPosition === 'AT_MARKET').length;
    const above = employees.filter((e) => e.marketPosition === 'ABOVE_MARKET').length;
    const premium = employees.filter((e) => e.marketPosition === 'PREMIUM').length;
    const total = employees.length;
    return {
        totalHeadcount: total,
        totalAnnualPayroll: totalCTC,
        avgCompaRatio: parseFloat(avgCompa.toFixed(3)),
        medianCompaRatio: parseFloat(med.toFixed(3)),
        belowMarketPct: parseFloat(((below / total) * 100).toFixed(1)),
        atMarketPct: parseFloat(((at / total) * 100).toFixed(1)),
        aboveMarketPct: parseFloat(((above / total) * 100).toFixed(1)),
        premiumPct: parseFloat(((premium / total) * 100).toFixed(1)),
        retentionRiskHighCount: employees.filter((e) => e.retentionRisk === 'HIGH' || e.retentionRisk === 'CRITICAL').length,
        pendingMeritRecommendations: meritRecs.length,
        projectedMeritBudget: meritRecs.reduce((s, r) => s + r.estimatedCost, 0),
        avgMeritIncreasePct: parseFloat((meritRecs.reduce((s, r) => s + r.recommendedIncreasePct, 0) / (meritRecs.length || 1)).toFixed(1)),
        payGapDetectedGroups: rng(2, 8),
        payrollVarianceVsBudget: rng(-5, 8, 1),
    };
}
