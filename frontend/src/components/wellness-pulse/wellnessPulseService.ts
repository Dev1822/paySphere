/**
 * Employee Wellness Pulse — Service Layer
 *
 * Mock mood entries, wellness scores, programs, burnout alerts,
 * trends, department stats, and insights.
 */

import {
  MoodEntry, WellnessScore, WellnessProgram, BurnoutAlert,
  WellnessTrend, DepartmentWellness, WellnessSummary, WellnessInsight,
  MoodLevel, BurnoutRisk, EngagementTier, Department, ProgramType,
} from './wellnessPulseTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara','Ahmed','Bella','Carlos','Deepa'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee','Meyer','Diaz','Chowdhury'];
const DEPTS: Department[] = ['Engineering','Product','Design','Marketing','Sales','Finance','HR','Legal','Operations','Customer Success'];

const MOOD_MAP: Record<number, MoodLevel> = { 1: 'Very Low', 2: 'Low', 3: 'Neutral', 4: 'High', 5: 'Very High' };

const INSIGHTS_TEMPLATES: Omit<WellnessInsight, 'id'>[] = [
  { title: 'Engineering stress levels elevated', description: 'Avg stress in Engineering is 7.2/10, up 12% from last month. Consider workload review.', type: 'warning', metric: 'Avg Stress', value: '7.2/10', trend: 'up' },
  { title: 'Sales team engagement improving', description: 'Sales engagement score rose to 78 from 65. Team activities are having impact.', type: 'positive', metric: 'Engagement', value: '78/100', trend: 'up' },
  { title: '3 employees at critical burnout risk', description: 'Immediate intervention recommended for 2 Engineering and 1 Product employee.', type: 'critical', metric: 'Burnout Alerts', value: '3 critical', trend: 'up' },
  { title: 'Meditation program showing results', description: 'Participants report 18% lower stress. 42 employees enrolled.', type: 'positive', metric: 'Program Impact', value: '-18% stress', trend: 'down' },
  { title: 'Work-life balance declining in Q3', description: 'Avg WLB score dropped from 6.8 to 5.9 across all departments.', type: 'warning', metric: 'WLB Score', value: '5.9/10', trend: 'down' },
  { title: 'Financial wellness workshop waitlist growing', description: '28 employees on waitlist. Consider adding another session.', type: 'info', metric: 'Waitlist', value: '28', trend: 'up' },
];

// ── Mood Entries ───────────────────────────────────────────────────────────

function generateMoodEntries(): MoodEntry[] {
  const entries: MoodEntry[] = [];
  for (let i = 0; i < 80; i++) {
    const moodScore = rand(1, 5);
    entries.push({
      id: uid(),
      employeeId: `EMP-${1000 + rand(0, 59)}`,
      employeeName: `${pick(FIRST)} ${pick(LAST)}`,
      department: pick(DEPTS),
      mood: MOOD_MAP[moodScore],
      moodScore,
      stressLevel: rand(1, 10),
      workLifeBalance: rand(2, 10),
      note: moodScore <= 2 ? pick(['Heavy workload', 'Deadline pressure', 'Team conflict', 'Personal issues']) : undefined,
      submittedAt: `2026-08-${String(rand(1, 24)).padStart(2, '0')}T${String(rand(8, 18)).padStart(2, '0')}:${String(rand(0, 59)).padStart(2, '0')}:00Z`,
    });
  }
  return entries;
}

// ── Wellness Scores ────────────────────────────────────────────────────────

function generateWellnessScores(): WellnessScore[] {
  const scores: WellnessScore[] = [];
  for (let i = 0; i < 60; i++) {
    const physical = rand(30, 95);
    const mental = rand(25, 95);
    const emotional = rand(30, 95);
    const social = rand(20, 95);
    const financial = rand(35, 95);
    const professional = rand(30, 95);
    const overallScore = Math.round((physical + mental + emotional + social + financial + professional) / 6);
    const burnoutScore = Math.round(100 - overallScore + rand(-15, 15));
    const clampedBurnout = Math.max(0, Math.min(100, burnoutScore));
    const burnoutRisk: BurnoutRisk = clampedBurnout > 75 ? 'Critical' : clampedBurnout > 55 ? 'High' : clampedBurnout > 35 ? 'Moderate' : 'Low';
    const engagementScore = rand(30, 95);
    const engagementTier: EngagementTier = engagementScore > 80 ? 'Highly Engaged' : engagementScore > 60 ? 'Engaged' : engagementScore > 40 ? 'Passive' : 'Disengaged';

    scores.push({
      id: uid(),
      employeeId: `EMP-${1000 + i}`,
      employeeName: `${pick(FIRST)} ${pick(LAST)}`,
      department: pick(DEPTS),
      overallScore, physical, mental, emotional, social, financial, professional,
      burnoutRisk, burnoutScore: clampedBurnout,
      engagementTier, engagementScore,
      lastCheckIn: `2026-08-${String(rand(1, 24)).padStart(2, '0')}`,
      streakDays: rand(0, 45),
    });
  }
  return scores;
}

// ── Wellness Programs ──────────────────────────────────────────────────────

function generatePrograms(): WellnessProgram[] {
  const programs: Omit<WellnessProgram, 'id'>[] = [
    { name: 'Mindful Mornings', type: 'Meditation', description: 'Daily 15-min guided meditation sessions', startDate: '2026-07-01', endDate: '2026-09-30', capacity: 50, enrolled: 42, completed: 28, avgSatisfaction: 4.6, isActive: true, facilitator: 'Dr. Sarah Chen' },
    { name: 'Step It Up Challenge', type: 'Fitness Challenge', description: '30-day walking/running challenge with team leaderboard', startDate: '2026-08-01', endDate: '2026-08-31', capacity: 100, enrolled: 67, completed: 0, avgSatisfaction: 4.3, isActive: true, facilitator: 'Wellness Team' },
    { name: 'Stress Management Workshop', type: 'Workshop', description: '4-week workshop on stress coping techniques', startDate: '2026-08-05', endDate: '2026-08-26', capacity: 30, enrolled: 30, completed: 18, avgSatisfaction: 4.8, isActive: true, facilitator: 'Dr. James Park' },
    { name: 'Financial Wellness Series', type: 'Financial Planning', description: 'Budgeting, investing, and retirement planning', startDate: '2026-09-01', endDate: '2026-10-15', capacity: 40, enrolled: 12, completed: 0, avgSatisfaction: 0, isActive: false, facilitator: 'Nisha Gupta, CFP' },
    { name: 'Sleep Better Program', type: 'Sleep Program', description: '6-week sleep hygiene improvement program', startDate: '2026-07-15', endDate: '2026-08-26', capacity: 25, enrolled: 22, completed: 15, avgSatisfaction: 4.5, isActive: true, facilitator: 'Dr. Lisa Wang' },
    { name: 'Team Building Outdoor Day', type: 'Team Activity', description: 'Quarterly outdoor team bonding event', startDate: '2026-08-15', endDate: '2026-08-15', capacity: 80, enrolled: 71, completed: 71, avgSatisfaction: 4.9, isActive: false, facilitator: 'HR Team' },
    { name: 'Annual Health Screening', type: 'Health Screening', description: 'Comprehensive health check-ups with optional blood work', startDate: '2026-08-01', endDate: '2026-08-31', capacity: 60, enrolled: 48, completed: 35, avgSatisfaction: 4.2, isActive: true, facilitator: 'HealthFirst Clinic' },
    { name: 'Counseling Access', type: 'Counseling', description: 'Free confidential counseling sessions (6 per year)', startDate: '2026-01-01', endDate: '2026-12-31', capacity: 200, enrolled: 34, completed: 12, avgSatisfaction: 4.7, isActive: true, facilitator: 'MindCare Network' },
  ];
  return programs.map(p => ({ ...p, id: uid() }));
}

// ── Burnout Alerts ─────────────────────────────────────────────────────────

function generateBurnoutAlerts(): BurnoutAlert[] {
  return [
    { id: uid(), employeeId: 'EMP-1002', employeeName: 'David Mueller', department: 'Engineering', riskLevel: 'Critical', burnoutScore: 88, primaryFactors: ['Sustained overtime', 'High on-call frequency', 'Missed personal milestones'], recommendation: 'Immediate workload reduction and 1-on-1 with manager. Consider sabbatical.', detectedAt: '2026-08-20', acknowledged: false },
    { id: uid(), employeeId: 'EMP-1015', employeeName: 'Mei Nakamura', department: 'Engineering', riskLevel: 'Critical', burnoutScore: 82, primaryFactors: ['Extended crunch period', 'Limited PTO usage', 'High stress scores'], recommendation: 'Reduce sprint capacity by 30%. Assign wellness buddy.', detectedAt: '2026-08-19', acknowledged: false },
    { id: uid(), employeeId: 'EMP-1023', employeeName: 'Quinn Patel', department: 'Product', riskLevel: 'Critical', burnoutScore: 79, primaryFactors: ['Cross-functional overload', 'Decision fatigue', 'Poor sleep quality'], recommendation: 'Delegate 2 projects. Schedule counseling session.', detectedAt: '2026-08-18', acknowledged: true },
    { id: uid(), employeeId: 'EMP-1008', employeeName: 'Elena Santos', department: 'Design', riskLevel: 'High', burnoutScore: 68, primaryFactors: ['Tight deadlines', 'Scope creep'], recommendation: 'Review project timeline. Ensure reasonable turnaround expectations.', detectedAt: '2026-08-17', acknowledged: true },
    { id: uid(), employeeId: 'EMP-1031', employeeName: 'Yusuf Khan', department: 'Sales', riskLevel: 'High', burnoutScore: 65, primaryFactors: ['Quarter-end pressure', 'Target anxiety'], recommendation: 'Review quota realism. Offer coaching session.', detectedAt: '2026-08-16', acknowledged: true },
    { id: uid(), employeeId: 'EMP-1042', employeeName: 'Bella Rodriguez', department: 'Marketing', riskLevel: 'Moderate', burnoutScore: 52, primaryFactors: ['Content production pace', 'Social media pressure'], recommendation: 'Review content calendar. Consider hiring contractor.', detectedAt: '2026-08-15', acknowledged: false },
  ];
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): WellnessTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let avgMood = 3.2, avgStress = 6.5, avgWLB = 6.0, avgEng = 62, avgWellness = 60;
  return months.map((month) => {
    avgMood = round1(Math.max(1, Math.min(5, avgMood + (-0.05 + Math.random() * 0.15))));
    avgStress = round1(Math.max(1, Math.min(10, avgStress + (-0.2 + Math.random() * 0.3))));
    avgWLB = round1(Math.max(1, Math.min(10, avgWLB + (-0.1 + Math.random() * 0.2))));
    avgEng = Math.max(40, Math.min(85, avgEng + rand(-3, 4)));
    avgWellness = Math.max(45, Math.min(80, avgWellness + rand(-2, 3)));
    return {
      month, avgMood, avgStress: avgStress, avgWorkLife: avgWLB,
      avgEngagement: avgEng, avgWellnessScore: avgWellness,
      participationRate: Math.max(30, Math.min(75, rand(40, 65))),
    };
  });
}

// ── Department Wellness ────────────────────────────────────────────────────

function generateDeptWellness(): DepartmentWellness[] {
  return DEPTS.map(dept => ({
    department: dept,
    avgWellnessScore: rand(45, 85),
    avgMood: round1(2.5 + Math.random() * 2.5),
    avgStress: round1(3 + Math.random() * 5),
    avgEngagement: rand(50, 90),
    burnoutCount: rand(0, 4),
    totalEmployees: rand(5, 20),
    participationRate: rand(40, 90),
  }));
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getWellnessPulseData() {
  const moodEntries = generateMoodEntries();
  const wellnessScores = generateWellnessScores();
  const programs = generatePrograms();
  const burnoutAlerts = generateBurnoutAlerts();
  const trends = generateTrends();
  const deptWellness = generateDeptWellness();
  const insights = INSIGHTS_TEMPLATES.map(t => ({ ...t, id: uid() }));

  const summary: WellnessSummary = {
    totalEmployees: wellnessScores.length,
    avgWellnessScore: Math.round(wellnessScores.reduce((s, w) => s + w.overallScore, 0) / wellnessScores.length),
    avgMood: round1(moodEntries.reduce((s, m) => s + m.moodScore, 0) / moodEntries.length),
    avgStress: round1(moodEntries.reduce((s, m) => s + m.stressLevel, 0) / moodEntries.length),
    avgEngagement: Math.round(wellnessScores.reduce((s, w) => s + w.engagementScore, 0) / wellnessScores.length),
    avgWorkLifeBalance: round1(moodEntries.reduce((s, m) => s + m.workLifeBalance, 0) / moodEntries.length),
    burnoutAtRisk: wellnessScores.filter(w => w.burnoutRisk === 'High' || w.burnoutRisk === 'Critical').length,
    highEngagement: wellnessScores.filter(w => w.engagementTier === 'Highly Engaged').length,
    activeCheckIns: moodEntries.length,
    programParticipationRate: Math.round(programs.reduce((s, p) => s + (p.enrolled / p.capacity) * 100, 0) / programs.length),
    avgStreakDays: Math.round(wellnessScores.reduce((s, w) => s + w.streakDays, 0) / wellnessScores.length),
    criticalAlerts: burnoutAlerts.filter(a => a.riskLevel === 'Critical' && !a.acknowledged).length,
  };

  return { summary, moodEntries, wellnessScores, programs, burnoutAlerts, trends, deptWellness, insights };
}
