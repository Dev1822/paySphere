/**
 * Compensation Benchmarking — Type Definitions
 *
 * Industry salary benchmarking, geographic cost-of-living adjustments,
 * internal equity analysis, and total-rewards comparison.
 */

export const COMP_LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Staff', 'Principal', 'Director', 'VP', 'C-Suite'] as const;
export type CompLevel = (typeof COMP_LEVELS)[number];

export const JOB_FAMILIES = [
  'Engineering', 'Product', 'Design', 'Data Science', 'DevOps',
  'Marketing', 'Sales', 'Finance', 'HR', 'Legal',
  'Operations', 'Customer Success', 'Security', 'QA', 'IT Support',
] as const;
export type JobFamily = (typeof JOB_FAMILIES)[number];

export const REGIONS = [
  'North America', 'Europe', 'Asia Pacific', 'Latin America',
  'Middle East & Africa', 'South Asia',
] as const;
export type Region = (typeof REGIONS)[number];

export const COMPENSATION_STATUS = ['Below Market', 'At Market', 'Above Market', 'Significantly Above'] as const;
export type CompensationStatus = (typeof COMPENSATION_STATUS)[number];

export const EQUITY_TYPES = ['RSU', 'Stock Options', 'ESOP', 'Phantom Stock', 'Profit Share'] as const;
export type EquityType = (typeof EQUITY_TYPES)[number];

export const BENCHMARK_SOURCES = [
  'Levels.fyi', 'Glassdoor', 'Payscale', 'Mercer', 'Radford',
  'Willis Towers Watson', 'Comp.ai', 'Internal Survey',
] as const;
export type BenchmarkSource = (typeof BENCHMARK_SOURCES)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<CompensationStatus, string> = {
  'Below Market': '#ef4444',
  'At Market': '#22c55e',
  'Above Market': '#3b82f6',
  'Significantly Above': '#8b5cf6',
};

export const STATUS_BG: Record<CompensationStatus, string> = {
  'Below Market': '#fef2f2',
  'At Market': '#f0fdf4',
  'Above Market': '#eff6ff',
  'Significantly Above': '#f5f3ff',
};

export const LEVEL_COLORS: Record<CompLevel, string> = {
  'Junior': '#94a3b8', 'Mid-Level': '#60a5fa', 'Senior': '#34d399',
  'Staff': '#a78bfa', 'Principal': '#f59e0b', 'Director': '#f97316',
  'VP': '#ef4444', 'C-Suite': '#dc2626',
};

export const FAMILY_ICONS: Record<string, string> = {
  'Engineering': '💻', 'Product': '📋', 'Design': '🎨',
  'Data Science': '📊', 'DevOps': '🔧', 'Marketing': '📢',
  'Sales': '💰', 'Finance': '🏦', 'HR': '👥', 'Legal': '⚖️',
  'Operations': '⚙️', 'Customer Success': '🤝', 'Security': '🔒',
  'QA': '🧪', 'IT Support': '🛠️',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface MarketBenchmark {
  id: string;
  jobFamily: JobFamily;
  level: CompLevel;
  region: Region;
  source: BenchmarkSource;
  sampleSize: number;
  baseSalaryP25: number;
  baseSalaryP50: number;
  baseSalaryP75: number;
  baseSalaryP90: number;
  totalCompP50: number;
  annualBonusPct: number;
  equityValueP50: number;
  benefitsValueP50: number;
  lastUpdated: string;
}

export interface EmployeeCompensation {
  id: string;
  employeeId: string;
  employeeName: string;
  jobFamily: JobFamily;
  level: CompLevel;
  department: string;
  location: string;
  region: Region;
  baseSalary: number;
  annualBonusPct: number;
  annualBonusAmount: number;
  equityType: EquityType | null;
  equityAnnualValue: number;
  signingBonus: number;
  benefitsValue: number;
  totalCompensation: number;
  status: CompensationStatus;
  percentile: number;
  tenure: number;
  performanceRating: number;
  promotionReady: boolean;
}

export interface CompensationGap {
  id: string;
  jobFamily: JobFamily;
  level: CompLevel;
  region: Region;
  gapAmount: number;
  gapPct: number;
  affectedEmployees: number;
  marketP50: number;
  internalMedian: number;
  status: CompensationStatus;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendation: string;
}

export interface GeographicCOL {
  id: string;
  city: string;
  country: string;
  region: Region;
  costOfLivingIndex: number;
  taxRate: number;
  purchasingPowerPct: number;
  avgSalaryMultiplier: number;
}

export interface PayEquityMetric {
  id: string;
  jobFamily: JobFamily;
  level: CompLevel;
  genderPayGapPct: number;
  ethnicityPayGapPct: number;
  medianMaleSalary: number;
  medianFemaleSalary: number;
  maleCount: number;
  femaleCount: number;
  adjustedGapPct: number;
  complianceStatus: 'Compliant' | 'Needs Review' | 'Non-Compliant';
}

export interface CompensationTrend {
  month: string;
  avgBaseSalary: number;
  avgTotalComp: number;
  marketP50: number;
  gapIndex: number;
  headcount: number;
}

export interface BenchmarkSummary {
  totalEmployees: number;
  avgBaseSalary: number;
  medianBaseSalary: number;
  avgTotalComp: number;
  marketPositionPct: number;
  compensationCost: number;
  budgetUtilization: number;
  belowMarketCount: number;
  atMarketCount: number;
  aboveMarketCount: number;
  significantAboveCount: number;
  totalGapToMarket: number;
  avgGenderPayGapPct: number;
  pendingReviews: number;
  upcomingPromotions: number;
}

export interface CompensationAlert {
  id: string;
  type: 'gap' | 'equity' | 'retention' | 'budget' | 'compliance';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  title: string;
  description: string;
  affectedCount: number;
  estimatedCost: number;
  createdAt: string;
}

export interface BenchmarkFilters {
  jobFamily: JobFamily | 'All';
  level: CompLevel | 'All';
  region: Region | 'All';
  status: CompensationStatus | 'All';
  searchQuery: string;
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
