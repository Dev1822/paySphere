// ──────────────────────────────────────────────────────────────────────────────
// Salary Benchmarking & Compensation Intelligence Hub — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type CompensationType = 'FIXED' | 'VARIABLE' | 'HYBRID';
export type MarketPosition = 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET' | 'PREMIUM';
export type RoleLevel = 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'PRINCIPAL' | 'DIRECTOR' | 'VP' | 'C_SUITE';
export type EquityStatus = 'UNVESTED' | 'VESTING' | 'VESTED' | 'NO_EQUITY';
export type PayGapDirection = 'FAVORABLE' | 'NEUTRAL' | 'GAP_DETECTED';

// ─── Market Benchmark Point ───────────────────────────────────────────────────

export interface MarketBenchmark {
    role: string;
    level: RoleLevel;
    department: string;
    location: string;
    p10: number;
    p25: number;
    p50: number;    // median
    p75: number;
    p90: number;
    currency: string;
    source: 'MERCER' | 'RADFORD' | 'GLASSDOOR' | 'PAYSCALE' | 'INTERNAL';
    lastUpdated: string; // ISO date
    sampleSize: number;
}

// ─── Employee Compensation Record ─────────────────────────────────────────────

export interface EmployeeCompensation {
    employeeId: string;
    name: string;
    avatarInitials: string;
    role: string;
    level: RoleLevel;
    department: string;
    location: string;
    baseSalary: number;
    variablePay: number;
    stockValue: number;         // estimated annual RSU/ESOP value
    totalCTC: number;           // cost to company
    currency: string;
    compensationType: CompensationType;
    benchmarkP50: number;       // market median for role/level/location
    benchmarkP75: number;
    compaRatio: number;         // baseSalary / benchmarkP50
    marketPosition: MarketPosition;
    equityStatus: EquityStatus;
    yearsInRole: number;
    lastReviewDate: string;
    nextReviewDate: string;
    meritIncreasePct: number;   // last merit cycle %
    retentionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isHighPerformer: boolean;
}

// ─── Pay Equity Analysis ─────────────────────────────────────────────────────

export interface PayEquityGroup {
    groupKey: string;           // e.g., "Engineering / Senior / Female"
    department: string;
    level: RoleLevel;
    gender: 'Male' | 'Female' | 'Non-Binary' | 'Undisclosed';
    headcount: number;
    avgBaseSalary: number;
    medianBaseSalary: number;
    avgTotalCTC: number;
    benchmarkP50: number;
    avgCompaRatio: number;
    gapVsReferenceGroup: number;  // % difference from reference (positive = favourable)
    direction: PayGapDirection;
    isStatisticallySignificant: boolean;
}

// ─── Department Compensation Summary ─────────────────────────────────────────

export interface DepartmentCompSummary {
    department: string;
    headcount: number;
    avgBaseSalary: number;
    avgTotalCTC: number;
    avgCompaRatio: number;
    belowMarketCount: number;
    atMarketCount: number;
    aboveMarketCount: number;
    premiumCount: number;
    totalPayrollCost: number;
    projectedMeritBudget: number;
    retentionRiskHighCount: number;
    trendDirection: 'UP' | 'FLAT' | 'DOWN';
}

// ─── Compensation Band Definition ────────────────────────────────────────────

export interface CompBand {
    role: string;
    level: RoleLevel;
    department: string;
    bandMin: number;
    bandMid: number;
    bandMax: number;
    currency: string;
    marketAnchor: number;   // p50 from market data
    utilizationPct: number; // % of employees in the band
    outlierCount: number;   // count above/below band
}

// ─── Merit Increase Recommendation ───────────────────────────────────────────

export interface MeritRecommendation {
    employeeId: string;
    name: string;
    department: string;
    role: string;
    level: RoleLevel;
    currentBaseSalary: number;
    recommendedIncreasePct: number;
    recommendedNewSalary: number;
    reason: 'BELOW_MARKET' | 'HIGH_PERFORMER' | 'RETENTION_RISK' | 'PROMOTION' | 'STANDARD_CYCLE';
    urgency: 'IMMEDIATE' | 'NEXT_CYCLE' | 'PLANNED';
    estimatedCost: number;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── KPI Summary ─────────────────────────────────────────────────────────────

export interface CompensationKPIs {
    totalHeadcount: number;
    totalAnnualPayroll: number;
    avgCompaRatio: number;
    medianCompaRatio: number;
    belowMarketPct: number;
    aboveMarketPct: number;
    atMarketPct: number;
    premiumPct: number;
    retentionRiskHighCount: number;
    pendingMeritRecommendations: number;
    projectedMeritBudget: number;
    avgMeritIncreasePct: number;
    payGapDetectedGroups: number;
    payrollVarianceVsBudget: number;  // YTD %
}

// ─── Payroll Trend Point ─────────────────────────────────────────────────────

export interface PayrollTrendPoint {
    month: string;      // 'Jan', 'Feb', ...
    totalPayroll: number;
    headcount: number;
    avgSalary: number;
    meritSpend: number;
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

export type BenchmarkDashboardTab =
    | 'overview'
    | 'benchmarks'
    | 'employees'
    | 'equity'
    | 'bands'
    | 'merit';
