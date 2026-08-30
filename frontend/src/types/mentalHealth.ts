// ─── Mental Health & Burnout Prevention Hub — Type Definitions ───────────────

export type BurnoutRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type MoodScore = 1 | 2 | 3 | 4 | 5;
export type InterventionStatus = 'PROPOSED' | 'ACTIVE' | 'COMPLETED' | 'DECLINED';
export type InterventionType =
  | 'COUNSELLING'
  | 'WORKLOAD_REDUCTION'
  | 'FLEXIBLE_HOURS'
  | 'PEER_SUPPORT'
  | 'LEAVE_RECOMMENDATION'
  | 'EAP_REFERRAL'
  | 'MANAGER_COACHING';

export type AlertSeverity = 'info' | 'warning' | 'critical';

// ─── Core Employee Risk Profile ───────────────────────────────────────────────

export interface EmployeeBurnoutProfile {
  employeeId: string;
  name: string;
  department: string;
  jobTitle: string;
  avatarInitials: string;
  riskLevel: BurnoutRiskLevel;
  riskScore: number; // 0–100
  riskDelta: number; // change from last period (positive = worsening)
  overtimeHoursLast30d: number;
  absenteeismRate: number; // percent
  moodTrend: MoodScore[];
  latestMood: MoodScore;
  lastCheckInDate: string; // ISO
  activeIntervention: boolean;
  flaggedSignals: string[];
}

// ─── Department Heatmap ───────────────────────────────────────────────────────

export interface DepartmentHeatmapEntry {
  department: string;
  headcount: number;
  avgRiskScore: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  avgMoodScore: number;
  avgOvertimeHours: number;
  trendDirection: 'improving' | 'stable' | 'worsening';
}

// ─── Mood Analytics ───────────────────────────────────────────────────────────

export interface MoodCheckIn {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // ISO
  score: MoodScore;
  note?: string;
  anonymous: boolean;
}

export interface MoodTrendPoint {
  date: string; // 'YYYY-MM-DD'
  avgScore: number;
  checkInCount: number;
}

export interface MoodDistribution {
  score: MoodScore;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

// ─── Wellness Interventions ───────────────────────────────────────────────────

export interface WellnessIntervention {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  type: InterventionType;
  status: InterventionStatus;
  proposedDate: string;
  completedDate?: string;
  assignedTo: string; // HR manager name
  notes: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  outcome?: string;
}

// ─── EAP (Employee Assistance Program) ───────────────────────────────────────

export interface EAPUtilizationMetrics {
  totalSessions: number;
  sessionsThisMonth: number;
  uniqueEmployeesServed: number;
  utilizationRate: number; // percent
  avgSessionsPerEmployee: number;
  byCategory: EAPCategoryBreakdown[];
  monthlyTrend: EAPMonthlyPoint[];
}

export interface EAPCategoryBreakdown {
  category: string;
  sessions: number;
  percentage: number;
  icon: string;
}

export interface EAPMonthlyPoint {
  month: string;
  sessions: number;
  uniqueUsers: number;
}

// ─── Wellness Alerts ──────────────────────────────────────────────────────────

export interface WellnessAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  affectedCount: number;
  department?: string;
  createdAt: string;
  isRead: boolean;
  actionRequired: boolean;
}

// ─── Dashboard Summary KPIs ───────────────────────────────────────────────────

export interface MentalHealthKPIs {
  totalAtRisk: number;
  criticalRiskCount: number;
  highRiskCount: number;
  avgCompanyMoodScore: number;
  moodScoreDelta: number;
  activeInterventions: number;
  interventionSuccessRate: number;
  eapUtilizationRate: number;
  avgOvertimeHoursCompany: number;
  absenteeismRate: number;
  checkInParticipationRate: number;
}

// ─── Signals Taxonomy ─────────────────────────────────────────────────────────

export interface BurnoutSignal {
  key: string;
  label: string;
  weight: number;
  description: string;
}

export type DashboardTab =
  | 'overview'
  | 'heatmap'
  | 'employees'
  | 'interventions'
  | 'mood'
  | 'eap';
