/**
 * Employee Engagement Pulse — Type Definitions
 *
 * Engagement surveys, pulse checks, eNPS, recognition activity,
 * culture health metrics, and sentiment analysis.
 */

export const SURVEY_TYPES = ['Quarterly Engagement', 'Pulse Check', 'Onboarding Feedback', 'Exit Survey', 'Culture Assessment', 'Manager Effectiveness'] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SENTIMENT_LEVELS = ['Very Negative', 'Negative', 'Neutral', 'Positive', 'Very Positive'] as const;
export type SentimentLevel = (typeof SENTIMENT_LEVELS)[number];

export const ENGAGEMENT_DRIVERS = [
  'Compensation', 'Growth Opportunities', 'Work-Life Balance', 'Manager Relationship',
  'Team Collaboration', 'Company Vision', 'Recognition', 'Learning & Development',
  'Autonomy', 'Job Security', 'Work Environment', 'Benefits',
] as const;
export type EngagementDriver = (typeof ENGAGEMENT_DRIVERS)[number];

export const RECOGNITION_TYPES = ['Kudos', 'Spot Bonus', 'Peer Nomination', 'Manager Award', 'Team Celebration', 'Milestone'] as const;
export type RecognitionType = (typeof RECOGNITION_TYPES)[number];

export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Finance', 'HR', 'Legal', 'Operations', 'Customer Success',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const SENTIMENT_COLORS: Record<SentimentLevel, string> = {
  'Very Negative': '#dc2626', 'Negative': '#f97316', 'Neutral': '#eab308',
  'Positive': '#22c55e', 'Very Positive': '#16a34a',
};

export const SENTIMENT_BG: Record<SentimentLevel, string> = {
  'Very Negative': '#fef2f2', 'Negative': '#fff7ed', 'Neutral': '#fefce8',
  'Positive': '#f0fdf4', 'Very Positive': '#dcfce7',
};

export const SENTIMENT_EMOJI: Record<SentimentLevel, string> = {
  'Very Negative': '😤', 'Negative': '😟', 'Neutral': '😐', 'Positive': '😊', 'Very Positive': '🤩',
};

export const RECOGNITION_COLORS: Record<RecognitionType, string> = {
  'Kudos': '#3b82f6', 'Spot Bonus': '#22c55e', 'Peer Nomination': '#8b5cf6',
  'Manager Award': '#f59e0b', 'Team Celebration': '#ec4899', 'Milestone': '#06b6d4',
};

export const DRIVER_ICONS: Record<EngagementDriver, string> = {
  'Compensation': '💰', 'Growth Opportunities': '📈', 'Work-Life Balance': '⚖️',
  'Manager Relationship': '👤', 'Team Collaboration': '🤝', 'Company Vision': '🔭',
  'Recognition': '🏆', 'Learning & Development': '📚', 'Autonomy': '🎯',
  'Job Security': '🔒', 'Work Environment': '🏢', 'Benefits': '🎁',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface PulseSurvey {
  id: string;
  name: string;
  type: SurveyType;
  questions: number;
  responseRate: number; // 0-100
  avgSentiment: SentimentLevel;
  avgScore: number; // 1-5
  responses: number;
  totalInvited: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface PulseResponse {
  id: string;
  surveyId: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  sentiment: SentimentLevel;
  score: number; // 1-5
  enpsScore: number; // -100 to 100
  topDriver: EngagementDriver;
  bottomDriver: EngagementDriver;
  comment?: string;
  submittedAt: string;
}

export interface ENPSTrend {
  month: string;
  enps: number;
  promoters: number;
  passives: number;
  detractors: number;
  responseRate: number;
}

export interface DriverScore {
  driver: EngagementDriver;
  score: number; // 1-5
  trend: 'up' | 'down' | 'stable';
  responseCount: number;
}

export interface RecognitionEntry {
  id: string;
  from: string;
  to: string;
  department: Department;
  type: RecognitionType;
  message: string;
  points: number;
  createdAt: string;
}

export interface CultureHealth {
  id: string;
  metric: string;
  score: number; // 0-100
  benchmark: number;
  trend: 'up' | 'down' | 'stable';
  category: string;
}

export interface DepartmentEngagement {
  department: Department;
  eNPS: number;
  avgSentiment: number; // 1-5
  responseRate: number;
  recognitionCount: number;
  topDriver: EngagementDriver;
  totalEmployees: number;
}

export interface EngagementTrend {
  month: string;
  avgSentiment: number;
  eNPS: number;
  responseRate: number;
  recognitionCount: number;
  pulseScore: number;
}

export interface EngagementSummary {
  totalSurveys: number;
  totalResponses: number;
  avgResponseRate: number;
  overallENPS: number;
  avgSentimentScore: number;
  recognitionCount: number;
  cultureHealthScore: number;
  topDriver: string;
  bottomDriver: string;
  positiveCommentPct: number;
  activeSurveys: number;
}

export interface EngagementInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatENPS(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

export function formatSentiment(score: number): SentimentLevel {
  if (score >= 4.5) return 'Very Positive';
  if (score >= 3.5) return 'Positive';
  if (score >= 2.5) return 'Neutral';
  if (score >= 1.5) return 'Negative';
  return 'Very Negative';
}

export function getENPSLabel(score: number): string {
  if (score >= 50) return 'Excellent';
  if (score >= 30) return 'Good';
  if (score >= 0) return 'Needs Improvement';
  if (score >= -50) return 'Poor';
  return 'Critical';
}
