/**
 * Team Performance Analytics — Type Definitions
 *
 * Team KPIs, OKR tracking, sprint velocity, peer feedback,
 * performance reviews, and goal completion analytics.
 */

export const PERFORMANCE_RATINGS = ['Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'] as const;
export type PerformanceRating = (typeof PERFORMANCE_RATINGS)[number];

export const REVIEW_CYCLES = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'H1 2026', 'Annual 2025'] as const;
export type ReviewCycle = (typeof REVIEW_CYCLES)[number];

export const GOAL_STATUSES = ['Not Started', 'On Track', 'At Risk', 'Behind', 'Completed', 'Cancelled'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const FEEDBACK_TYPES = ['Peer', 'Manager', 'Self', 'Upward', '360'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const SPRINT_STATUSES = ['Planning', 'Active', 'Review', 'Completed'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Finance', 'HR', 'Legal', 'Operations', 'Customer Success',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const RATING_COLORS: Record<PerformanceRating, string> = {
  'Needs Improvement': '#ef4444', 'Meets Expectations': '#3b82f6',
  'Exceeds Expectations': '#22c55e', 'Outstanding': '#8b5cf6',
};

export const RATING_BG: Record<PerformanceRating, string> = {
  'Needs Improvement': '#fef2f2', 'Meets Expectations': '#eff6ff',
  'Exceeds Expectations': '#f0fdf4', 'Outstanding': '#f5f3ff',
};

export const GOAL_COLORS: Record<GoalStatus, string> = {
  'Not Started': '#9ca3af', 'On Track': '#22c55e', 'At Risk': '#eab308',
  'Behind': '#ef4444', 'Completed': '#3b82f6', 'Cancelled': '#6b7280',
};

export const DEPT_COLORS: Record<string, string> = {
  'Engineering': '#3b82f6', 'Product': '#8b5cf6', 'Design': '#ec4899',
  'Marketing': '#f59e0b', 'Sales': '#22c55e', 'Finance': '#06b6d4',
  'HR': '#f97316', 'Legal': '#6366f1', 'Operations': '#14b8a6',
  'Customer Success': '#a855f7',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  department: Department;
  lead: string;
  memberCount: number;
  avgPerformanceScore: number;
  teamHealthScore: number; // 0-100
  sprintVelocity: number; // story points
  sprintTrend: number[]; // last 6 sprints
  okrCompletion: number; // 0-100
  avgEngagement: number; // 0-100
}

export interface TeamKPI {
  id: string;
  teamId: string;
  teamName: string;
  department: Department;
  name: string;
  target: number;
  current: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  deadline: string;
  status: GoalStatus;
}

export interface OKR {
  id: string;
  teamId: string;
  teamName: string;
  objective: string;
  keyResults: KeyResult[];
  owner: string;
  quarter: ReviewCycle;
  overallProgress: number;
  status: GoalStatus;
}

export interface KeyResult {
  id: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  progress: number; // 0-100
  status: GoalStatus;
}

export interface SprintRecord {
  id: string;
  teamId: string;
  teamName: string;
  sprintNumber: number;
  name: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  plannedPoints: number;
  completedPoints: number;
  velocity: number;
  storiesPlanned: number;
  storiesCompleted: number;
  storiesCarriedOver: number;
  avgCycleTime: number; // days
  blockers: number;
}

export interface PeerFeedback {
  id: string;
  fromEmployee: string;
  toEmployee: string;
  department: Department;
  type: FeedbackType;
  rating: PerformanceRating;
  strengths: string;
  improvements: string;
  sentiment: number; // 1-5
  submittedAt: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  reviewer: string;
  cycle: ReviewCycle;
  overallRating: PerformanceRating;
  score: number; // 0-100
  technicalSkills: number;
  communication: number;
  leadership: number;
  teamwork: number;
  innovation: number;
  strengths: string[];
  improvements: string[];
  goalsNextPeriod: string[];
  submittedAt: string;
}

export interface TeamTrend {
  month: string;
  avgPerformance: number;
  avgEngagement: number;
  avgVelocity: number;
  goalCompletionRate: number;
  headcount: number;
}

export interface PerformanceSummary {
  totalTeams: number;
  totalMembers: number;
  avgPerformanceScore: number;
  avgEngagement: number;
  avgTeamHealth: number;
  avgOKRCompletion: number;
  avgSprintVelocity: number;
  outstandingCount: number;
  needsImprovementCount: number;
  totalGoals: number;
  completedGoals: number;
  activeSprints: number;
}

export interface PerformanceInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  teamName?: string;
  metric: string;
  value: string;
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatScore(score: number): string {
  return `${Math.round(score)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function getRatingEmoji(rating: PerformanceRating): string {
  if (rating === 'Outstanding') return '🏆';
  if (rating === 'Exceeds Expectations') return '⭐';
  if (rating === 'Meets Expectations') return '✅';
  return '⚠️';
}
