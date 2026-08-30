/**
 * Employee Engagement Pulse — Service Layer
 *
 * Mock surveys, responses, eNPS trends, driver scores,
 * recognition entries, culture health, and insights.
 */

import {
  PulseSurvey, PulseResponse, ENPSTrend, DriverScore,
  RecognitionEntry, CultureHealth, DepartmentEngagement,
  EngagementTrend, EngagementSummary, EngagementInsight,
  SentimentLevel, EngagementDriver, RecognitionType, Department,
  SENTIMENT_LEVELS,
} from './engagementPulseTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee'];
const DEPTS: Department[] = ['Engineering','Product','Design','Marketing','Sales','Finance','HR','Legal','Operations','Customer Success'];

const COMMENT_POOL = [
  'Love the team culture here', 'Would appreciate more growth opportunities',
  'Manager is very supportive', 'Work-life balance could improve',
  'Great benefits package', 'Need clearer communication from leadership',
  'Recognition program is motivating', 'Learning budget is appreciated',
  'Sometimes feel overworked during crunch', 'Great onboarding experience',
  'Remote work flexibility is excellent', 'Would like more transparency on decisions',
  'Team collaboration is outstanding', 'Compensation could be more competitive',
  'Enjoy the autonomy in my role', 'More mentorship opportunities please',
];

// ── Surveys ────────────────────────────────────────────────────────────────

function generateSurveys(): PulseSurvey[] {
  return [
    { id: uid(), name: 'Q3 2026 Engagement Survey', type: 'Quarterly Engagement', questions: 25, responseRate: 78, avgSentiment: 'Positive', avgScore: 4.1, responses: 125, totalInvited: 160, startDate: '2026-07-01', endDate: '2026-07-15', isActive: false },
    { id: uid(), name: 'August Pulse Check', type: 'Pulse Check', questions: 5, responseRate: 85, avgSentiment: 'Positive', avgScore: 3.9, responses: 136, totalInvited: 160, startDate: '2026-08-01', endDate: '2026-08-05', isActive: true },
    { id: uid(), name: 'Manager Effectiveness Q3', type: 'Manager Effectiveness', questions: 15, responseRate: 72, avgSentiment: 'Positive', avgScore: 4.2, responses: 115, totalInvited: 160, startDate: '2026-07-15', endDate: '2026-07-30', isActive: false },
    { id: uid(), name: 'Culture Assessment 2026', type: 'Culture Assessment', questions: 30, responseRate: 68, avgSentiment: 'Neutral', avgScore: 3.7, responses: 109, totalInvited: 160, startDate: '2026-06-01', endDate: '2026-06-30', isActive: false },
    { id: uid(), name: 'New Hire Onboarding Survey', type: 'Onboarding Feedback', questions: 12, responseRate: 92, avgSentiment: 'Very Positive', avgScore: 4.5, responses: 23, totalInvited: 25, startDate: '2026-08-01', endDate: '2026-08-10', isActive: true },
    { id: uid(), name: 'Mid-Year Pulse Survey', type: 'Pulse Check', questions: 8, responseRate: 81, avgSentiment: 'Positive', avgScore: 4.0, responses: 130, totalInvited: 160, startDate: '2026-04-01', endDate: '2026-04-10', isActive: false },
  ];
}

// ── Responses ──────────────────────────────────────────────────────────────

function generateResponses(): PulseResponse[] {
  const responses: PulseResponse[] = [];
  const sentiments: SentimentLevel[] = ['Very Negative', 'Negative', 'Neutral', 'Positive', 'Very Positive'];
  const weights = [0.05, 0.1, 0.2, 0.4, 0.25];

  for (let i = 0; i < 100; i++) {
    const r = Math.random();
    let cum = 0, sentiment: SentimentLevel = 'Positive';
    for (let j = 0; j < sentiments.length; j++) { cum += weights[j]; if (r <= cum) { sentiment = sentiments[j]; break; } }
    const score = sentiment === 'Very Positive' ? 5 : sentiment === 'Positive' ? 4 : sentiment === 'Neutral' ? 3 : sentiment === 'Negative' ? 2 : 1;
    responses.push({
      id: uid(), surveyId: uid(),
      employeeId: `EMP-${rand(1000, 1059)}`,
      employeeName: `${pick(FIRST)} ${pick(LAST)}`,
      department: pick(DEPTS), sentiment, score,
      enpsScore: rand(-30, 80),
      topDriver: pick(['Compensation', 'Growth Opportunities', 'Team Collaboration', 'Recognition', 'Autonomy', 'Learning & Development'] as EngagementDriver[]),
      bottomDriver: pick(['Work-Life Balance', 'Manager Relationship', 'Company Vision', 'Job Security', 'Compensation'] as EngagementDriver[]),
      comment: Math.random() > 0.4 ? pick(COMMENT_POOL) : undefined,
      submittedAt: `2026-08-${String(rand(1, 24)).padStart(2, '0')}T${String(rand(8, 18)).padStart(2, '0')}:00Z`,
    });
  }
  return responses;
}

// ── eNPS Trend ─────────────────────────────────────────────────────────────

function generateENPSTrend(): ENPSTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let enps = 25;
  return months.map((month) => {
    enps = Math.max(-20, Math.min(70, enps + rand(-5, 6)));
    const total = 100;
    const promPct = Math.round(30 + enps / 2 + Math.random() * 10);
    const detPct = Math.round(100 - promPct - (total - promPct - rand(15, 35)));
    return {
      month, enps, promoters: promPct, passives: total - promPct - Math.max(0, detPct),
      detractors: Math.max(0, detPct), responseRate: rand(65, 90),
    };
  });
}

// ── Driver Scores ──────────────────────────────────────────────────────────

function generateDriverScores(): DriverScore[] {
  const drivers: EngagementDriver[] = ['Compensation', 'Growth Opportunities', 'Work-Life Balance', 'Manager Relationship', 'Team Collaboration', 'Company Vision', 'Recognition', 'Learning & Development', 'Autonomy', 'Job Security', 'Work Environment', 'Benefits'];
  return drivers.map(driver => ({
    driver,
    score: round1(2.5 + Math.random() * 2.5),
    trend: pick(['up', 'down', 'stable'] as const),
    responseCount: rand(50, 140),
  })).sort((a, b) => b.score - a.score);
}

// ── Recognition ────────────────────────────────────────────────────────────

function generateRecognition(): RecognitionEntry[] {
  const messages = [
    'Outstanding work on the Q3 launch!', 'Always willing to help teammates',
    'Innovative solution to a complex problem', 'Exceeded all KPIs this month',
    'Great leadership during the crisis', 'Improved team morale significantly',
    'Delivered exceptional customer support', 'Mentored 3 new hires successfully',
    'Spearheaded the accessibility initiative', 'Reduced costs by 15% through automation',
  ];
  return Array.from({ length: 25 }, () => ({
    id: uid(),
    from: `${pick(FIRST)} ${pick(LAST)}`,
    to: `${pick(FIRST)} ${pick(LAST)}`,
    department: pick(DEPTS),
    type: pick(['Kudos', 'Spot Bonus', 'Peer Nomination', 'Manager Award', 'Team Celebration', 'Milestone'] as RecognitionType[]),
    message: pick(messages),
    points: pick([10, 25, 50, 100, 200]),
    createdAt: `2026-08-${String(rand(1, 24)).padStart(2, '0')}`,
  }));
}

// ── Culture Health ─────────────────────────────────────────────────────────

function generateCultureHealth(): CultureHealth[] {
  return [
    { id: uid(), metric: 'Trust in Leadership', score: 72, benchmark: 68, trend: 'up', category: 'Leadership' },
    { id: uid(), metric: 'Innovation Culture', score: 65, benchmark: 60, trend: 'stable', category: 'Innovation' },
    { id: uid(), metric: 'Diversity & Inclusion', score: 78, benchmark: 70, trend: 'up', category: 'DEI' },
    { id: uid(), metric: 'Psychological Safety', score: 70, benchmark: 65, trend: 'up', category: 'Wellbeing' },
    { id: uid(), metric: 'Collaboration Index', score: 82, benchmark: 75, trend: 'stable', category: 'Teamwork' },
    { id: uid(), metric: 'Change Readiness', score: 58, benchmark: 62, trend: 'down', category: 'Adaptability' },
    { id: uid(), metric: 'Communication Quality', score: 68, benchmark: 65, trend: 'stable', category: 'Communication' },
    { id: uid(), metric: 'Values Alignment', score: 75, benchmark: 70, trend: 'up', category: 'Culture' },
  ];
}

// ── Department Engagement ──────────────────────────────────────────────────

function generateDeptEngagement(): DepartmentEngagement[] {
  return DEPTS.map(dept => ({
    department: dept,
    eNPS: rand(-10, 60),
    avgSentiment: round1(3 + Math.random() * 2),
    responseRate: rand(60, 95),
    recognitionCount: rand(3, 15),
    topDriver: pick(['Compensation', 'Growth Opportunities', 'Team Collaboration', 'Recognition', 'Autonomy'] as EngagementDriver[]),
    totalEmployees: rand(8, 25),
  }));
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): EngagementTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let sent = 3.5, enps = 25, rate = 70, recog = 15, pulse = 70;
  return months.map((month) => {
    sent = Math.max(2.5, Math.min(4.5, sent + (-0.05 + Math.random() * 0.15)));
    enps = Math.max(-10, Math.min(55, enps + rand(-3, 4)));
    rate = Math.max(55, Math.min(90, rate + rand(-3, 4)));
    recog = Math.max(8, Math.min(25, recog + rand(-2, 3)));
    pulse = Math.max(55, Math.min(85, pulse + rand(-2, 3)));
    return { month, avgSentiment: round1(sent), eNPS: enps, responseRate: rate, recognitionCount: recog, pulseScore: pulse };
  });
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): EngagementInsight[] {
  return [
    { id: uid(), title: 'eNPS improved to +32', description: 'Up from +24 last quarter. Promoters increasing, detractors decreasing.', type: 'positive', metric: 'eNPS', value: '+32', trend: 'up' },
    { id: uid(), title: 'Work-Life Balance scoring lowest', description: 'WLB rated 3.1/5, down 0.3 from last quarter. Needs attention.', type: 'warning', metric: 'WLB Score', value: '3.1/5', trend: 'down' },
    { id: uid(), title: 'Recognition activity up 28%', description: 'Peer recognition increased significantly after new points system launch.', type: 'positive', metric: 'Recognition', value: '+28%', trend: 'up' },
    { id: uid(), title: 'Change Readiness below benchmark', description: 'Culture health score 58 vs benchmark 62. Employees uncertain about recent changes.', type: 'warning', metric: 'Change Readiness', value: '58/100', trend: 'down' },
    { id: uid(), title: 'Sales team eNPS dropped to +5', description: 'Lowest among all departments. Concerns about quota realism and support.', type: 'critical', metric: 'Sales eNPS', value: '+5', trend: 'down' },
    { id: uid(), title: 'Onboarding satisfaction at 4.5/5', description: 'New hires rate onboarding very positively. Keep current program.', type: 'positive', metric: 'Onboarding', value: '4.5/5', trend: 'stable' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getEngagementPulseData() {
  const surveys = generateSurveys();
  const responses = generateResponses();
  const enpsTrend = generateENPSTrend();
  const driverScores = generateDriverScores();
  const recognition = generateRecognition();
  const cultureHealth = generateCultureHealth();
  const deptEngagement = generateDeptEngagement();
  const trends = generateTrends();
  const insights = generateInsights();

  const summary: EngagementSummary = {
    totalSurveys: surveys.length,
    totalResponses: responses.length + surveys.reduce((s, sv) => s + sv.responses, 0),
    avgResponseRate: Math.round(surveys.reduce((s, sv) => s + sv.responseRate, 0) / surveys.length),
    overallENPS: enpsTrend[enpsTrend.length - 1].enps,
    avgSentimentScore: round1(responses.reduce((s, r) => s + r.score, 0) / responses.length),
    recognitionCount: recognition.length,
    cultureHealthScore: Math.round(cultureHealth.reduce((s, c) => s + c.score, 0) / cultureHealth.length),
    topDriver: driverScores[0]?.driver || 'Team Collaboration',
    bottomDriver: driverScores[driverScores.length - 1]?.driver || 'Compensation',
    positiveCommentPct: Math.round(responses.filter(r => r.score >= 4).length / responses.length * 100),
    activeSurveys: surveys.filter(s => s.isActive).length,
  };

  return { surveys, responses, enpsTrend, driverScores, recognition, cultureHealth, deptEngagement, trends, insights, summary };
}
