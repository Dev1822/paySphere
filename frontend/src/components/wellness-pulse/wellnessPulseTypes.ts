/**
 * Employee Wellness Pulse — Type Definitions
 *
 * Employee wellbeing tracking, mood analytics, burnout risk assessment,
 * engagement scoring, and wellness program participation.
 */

export const MOOD_LEVELS = ['Very Low', 'Low', 'Neutral', 'High', 'Very High'] as const;
export type MoodLevel = (typeof MOOD_LEVELS)[number];

export const WELLNESS_DIMENSIONS = [
  'Physical', 'Mental', 'Emotional', 'Social', 'Financial', 'Professional',
] as const;
export type WellnessDimension = (typeof WELLNESS_DIMENSIONS)[number];

export const BURNOUT_RISK = ['Low', 'Moderate', 'High', 'Critical'] as const;
export type BurnoutRisk = (typeof BURNOUT_RISK)[number];

export const ENGAGEMENT_TIERS = ['Disengaged', 'Passive', 'Engaged', 'Highly Engaged'] as const;
export type EngagementTier = (typeof ENGAGEMENT_TIERS)[number];

export const PROGRAM_TYPES = [
  'Meditation', 'Fitness Challenge', 'Counseling', 'Workshop',
  'Team Activity', 'Health Screening', 'Financial Planning', 'Sleep Program',
] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Finance', 'HR', 'Legal', 'Operations', 'Customer Success',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const MOOD_COLORS: Record<MoodLevel, string> = {
  'Very Low': '#dc2626', 'Low': '#f97316', 'Neutral': '#eab308',
  'High': '#22c55e', 'Very High': '#16a34a',
};

export const MOOD_BG: Record<MoodLevel, string> = {
  'Very Low': '#fef2f2', 'Low': '#fff7ed', 'Neutral': '#fefce8',
  'High': '#f0fdf4', 'Very High': '#dcfce7',
};

export const MOOD_EMOJI: Record<MoodLevel, string> = {
  'Very Low': '😢', 'Low': '😟', 'Neutral': '😐', 'High': '😊', 'Very High': '😄',
};

export const BURNOUT_COLORS: Record<BurnoutRisk, string> = {
  'Low': '#22c55e', 'Moderate': '#eab308', 'High': '#f97316', 'Critical': '#dc2626',
};

export const BURNOUT_BG: Record<BurnoutRisk, string> = {
  'Low': '#f0fdf4', 'Moderate': '#fefce8', 'High': '#fff7ed', 'Critical': '#fef2f2',
};

export const ENGAGEMENT_COLORS: Record<EngagementTier, string> = {
  'Disengaged': '#dc2626', 'Passive': '#eab308', 'Engaged': '#3b82f6', 'Highly Engaged': '#8b5cf6',
};

export const DIMENSION_ICONS: Record<WellnessDimension, string> = {
  'Physical': '🏃', 'Mental': '🧠', 'Emotional': '❤️',
  'Social': '👥', 'Financial': '💰', 'Professional': '📈',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface MoodEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  mood: MoodLevel;
  moodScore: number; // 1-5
  stressLevel: number; // 1-10
  workLifeBalance: number; // 1-10
  note?: string;
  submittedAt: string;
}

export interface WellnessScore {
  id: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  overallScore: number; // 0-100
  physical: number;
  mental: number;
  emotional: number;
  social: number;
  financial: number;
  professional: number;
  burnoutRisk: BurnoutRisk;
  burnoutScore: number; // 0-100
  engagementTier: EngagementTier;
  engagementScore: number; // 0-100
  lastCheckIn: string;
  streakDays: number;
}

export interface WellnessProgram {
  id: string;
  name: string;
  type: ProgramType;
  description: string;
  startDate: string;
  endDate: string;
  capacity: number;
  enrolled: number;
  completed: number;
  avgSatisfaction: number; // 1-5
  isActive: boolean;
  facilitator: string;
}

export interface BurnoutAlert {
  id: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  riskLevel: BurnoutRisk;
  burnoutScore: number;
  primaryFactors: string[];
  recommendation: string;
  detectedAt: string;
  acknowledged: boolean;
}

export interface WellnessTrend {
  month: string;
  avgMood: number;
  avgStress: number;
  avgWorkLife: number;
  avgEngagement: number;
  avgWellnessScore: number;
  participationRate: number;
}

export interface DepartmentWellness {
  department: Department;
  avgWellnessScore: number;
  avgMood: number;
  avgStress: number;
  avgEngagement: number;
  burnoutCount: number;
  totalEmployees: number;
  participationRate: number;
}

export interface WellnessSummary {
  totalEmployees: number;
  avgWellnessScore: number;
  avgMood: number;
  avgStress: number;
  avgEngagement: number;
  avgWorkLifeBalance: number;
  burnoutAtRisk: number;
  highEngagement: number;
  activeCheckIns: number;
  programParticipationRate: number;
  avgStreakDays: number;
  criticalAlerts: number;
}

export interface WellnessInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatScore(value: number): string {
  return `${Math.round(value)}`;
}

export function formatMoodEmoji(score: number): string {
  if (score >= 4.5) return '😄';
  if (score >= 3.5) return '😊';
  if (score >= 2.5) return '😐';
  if (score >= 1.5) return '😟';
  return '😢';
}

export function getBurnoutColor(risk: BurnoutRisk): string {
  return BURNOUT_COLORS[risk];
}

export function getEngagementColor(tier: EngagementTier): string {
  return ENGAGEMENT_COLORS[tier];
}
