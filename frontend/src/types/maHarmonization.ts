// ──────────────────────────────────────────────────────────────────────────────
// Mergers & Acquisitions (M&A) HR Harmonization Hub — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type IntegrationStatus = 'DUE_DILIGENCE' | 'DAY_ONE_PLANNING' | 'INTEGRATION_ACTIVE' | 'HARMONIZED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SynergyType = 'COST_REDUCTION' | 'REVENUE_UPLIFT' | 'TALENT_ACQUISITION';

export interface AcquisitionTarget {
  id: string;
  targetName: string;
  industry: string;
  headcount: number;
  dealValue: number;      // in USD/INR
  closeDate: string;
  status: IntegrationStatus;
  overallProgress: number; // 0 to 100
  keyRisks: RiskLevel;
}

export interface HarmonizationKPIs {
  totalHeadcountAcquired: number;
  redundantRolesIdentified: number;
  severanceBudgetUsed: number;
  severanceBudgetTotal: number;
  retainedCriticalTalentPct: number;
  cultureIntegrationScore: number; // 0-100
  benefitsCostDelta: number; // Positive = increased cost, Negative = savings
}

export interface RedundancyRecord {
  id: string;
  department: string;
  role: string;
  acquirerHeadcount: number;
  targetHeadcount: number;
  combinedHeadcount: number;
  targetOperatingModel: number; // Ideal headcount for the combined entry
  redundancyCount: number;
  estimatedSeveranceImpact: number;
  decision: 'RETAIN_ALL' | 'LAYOFF' | 'REDEPLOY';
  actionProgress: number;
}

export interface TalentRetentionProfile {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  criticality: 'MUST_RETAIN' | 'IMPORTANT' | 'STANDARD';
  flightRisk: RiskLevel;
  retentionBonus: number;
  vestingUnmappedEquity: number;
  sentimentScore: number; // 1 to 5
  status: 'PENDING_OFFER' | 'OFFER_ACCEPTED' | 'RESIGNED' | 'TRANSITIONED';
}

export interface BenefitMapping {
  category: string;
  acquirerBenefit: string;
  targetBenefit: string;
  harmonizationAction: 'MIGRATE_TO_ACQUIRER' | 'KEEP_SEPARATE' | 'CREATE_NEW_PLAN';
  costImpactPerEmployee: number; // +/- delta
  completionStatus: number; // 0-100
}

export interface IntegrationTimelineEvent {
  id: string;
  date: string;
  milestone: string;
  owner: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'AT_RISK';
}
