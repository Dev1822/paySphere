/**
 * Employee Learning Paths — Type Definitions
 *
 * Course tracking, skill gap analysis, certification management,
 * learning analytics, and career development progression.
 */

export const COURSE_CATEGORIES = [
  'Technical', 'Leadership', 'Compliance', 'Soft Skills',
  'Domain Knowledge', 'Certification Prep', 'Onboarding', 'DEI',
] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const ENROLLMENT_STATUS = ['Not Started', 'In Progress', 'Completed', 'Overdue', 'Dropped'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[number];

export const SKILL_DOMAINS = [
  'JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker',
  'Kubernetes', 'SQL', 'TypeScript', 'Go', 'Rust', 'GraphQL',
  'System Design', 'Leadership', 'Communication', 'Data Analysis',
  'Project Management', 'Agile', 'Security', 'CI/CD',
] as const;
export type SkillDomain = (typeof SKILL_DOMAINS)[number];

export const PROFICIENCY_LEVELS = ['None', 'Aware', 'Basic', 'Intermediate', 'Advanced', 'Expert'] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Finance', 'HR', 'Legal', 'Operations', 'Customer Success',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<EnrollmentStatus, string> = {
  'Not Started': '#9ca3af', 'In Progress': '#3b82f6', 'Completed': '#22c55e',
  'Overdue': '#ef4444', 'Dropped': '#6b7280',
};

export const STATUS_BG: Record<EnrollmentStatus, string> = {
  'Not Started': '#f9fafb', 'In Progress': '#eff6ff', 'Completed': '#f0fdf4',
  'Overdue': '#fef2f2', 'Dropped': '#f3f4f6',
};

export const LEVEL_COLORS: Record<CourseLevel, string> = {
  'Beginner': '#22c55e', 'Intermediate': '#3b82f6', 'Advanced': '#f59e0b', 'Expert': '#ef4444',
};

export const PROFICIENCY_COLORS: Record<ProficiencyLevel, string> = {
  'None': '#e5e7eb', 'Aware': '#fbbf24', 'Basic': '#fb923c',
  'Intermediate': '#3b82f6', 'Advanced': '#8b5cf6', 'Expert': '#22c55e',
};

export const CATEGORY_ICONS: Record<CourseCategory, string> = {
  'Technical': '💻', 'Leadership': '👑', 'Compliance': '⚖️', 'Soft Skills': '🤝',
  'Domain Knowledge': '📚', 'Certification Prep': '📜', 'Onboarding': '🚀', 'DEI': '🌈',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  title: string;
  category: CourseCategory;
  level: CourseLevel;
  description: string;
  instructor: string;
  durationHours: number;
  totalModules: number;
  rating: number; // 1-5
  enrolledCount: number;
  maxEnrollment: number;
  skills: SkillDomain[];
  tags: string[];
  isMandatory: boolean;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  category: CourseCategory;
  level: CourseLevel;
  employeeId: string;
  employeeName: string;
  department: Department;
  status: EnrollmentStatus;
  progress: number; // 0-100
  completedModules: number;
  totalModules: number;
  score: number | null; // 0-100
  enrolledAt: string;
  lastAccessedAt: string;
  completedAt: string | null;
  deadline: string | null;
  timeSpentHours: number;
}

export interface SkillGap {
  id: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  skill: SkillDomain;
  currentLevel: ProficiencyLevel;
  targetLevel: ProficiencyLevel;
  gapSize: number; // 0-5
  recommendedCourses: string[];
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDate: string;
}

export interface Certification {
  id: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  name: string;
  issuer: string;
  obtainedDate: string;
  expiryDate: string | null;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  credentialId: string;
  linkedSkills: SkillDomain[];
}

export interface LearningTrend {
  month: string;
  coursesCompleted: number;
  hoursLogged: number;
  avgScore: number;
  certificationsEarned: number;
  activeLearners: number;
  completionRate: number;
}

export interface DepartmentLearning {
  department: Department;
  totalLearners: number;
  avgProgress: number;
  coursesCompleted: number;
  avgScore: number;
  topSkill: SkillDomain;
  skillGaps: number;
  mandatoryPending: number;
}

export interface LearningSummary {
  totalCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  inProgressEnrollments: number;
  overdueEnrollments: number;
  avgProgress: number;
  avgScore: number;
  totalHoursLogged: number;
  totalSkillGaps: number;
  criticalGaps: number;
  activeCertifications: number;
  expiringCerts: number;
  completionRate: number;
}

export interface LearningInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatHours(hours: number): string {
  return hours >= 1 ? `${Math.round(hours)}h` : `${Math.round(hours * 60)}m`;
}

export function formatScore(score: number | null): string {
  return score !== null ? `${score}%` : '—';
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
