/**
 * Team Performance Analytics — Service Layer
 *
 * Mock teams, KPIs, OKRs, sprints, peer feedback, reviews,
 * trends, and insights.
 */

import {
  Team, TeamKPI, OKR, KeyResult, SprintRecord, PeerFeedback,
  PerformanceReview, TeamTrend, PerformanceSummary, PerformanceInsight,
  PerformanceRating, GoalStatus, ReviewCycle, SprintStatus,
  FeedbackType, Department,
} from './teamPerfTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee'];

// ── Teams ──────────────────────────────────────────────────────────────────

function generateTeams(): Team[] {
  const teams: Omit<Team, 'id' | 'sprintTrend'>[] = [
    { name: 'Frontend Squad', department: 'Engineering', lead: 'Aisha Patel', memberCount: 8, avgPerformanceScore: 78, teamHealthScore: 82, sprintVelocity: 42, okrCompletion: 75, avgEngagement: 80 },
    { name: 'Backend Platform', department: 'Engineering', lead: 'David Mueller', memberCount: 10, avgPerformanceScore: 74, teamHealthScore: 71, sprintVelocity: 55, okrCompletion: 68, avgEngagement: 72 },
    { name: 'Mobile Team', department: 'Engineering', lead: 'Mei Nakamura', memberCount: 6, avgPerformanceScore: 81, teamHealthScore: 85, sprintVelocity: 30, okrCompletion: 82, avgEngagement: 85 },
    { name: 'Product Growth', department: 'Product', lead: 'Elena Santos', memberCount: 5, avgPerformanceScore: 79, teamHealthScore: 78, sprintVelocity: 28, okrCompletion: 71, avgEngagement: 77 },
    { name: 'Design Systems', department: 'Design', lead: 'Grace Kim', memberCount: 4, avgPerformanceScore: 85, teamHealthScore: 88, sprintVelocity: 22, okrCompletion: 88, avgEngagement: 90 },
    { name: 'Demand Generation', department: 'Marketing', lead: 'Bella Rodriguez', memberCount: 7, avgPerformanceScore: 72, teamHealthScore: 68, sprintVelocity: 35, okrCompletion: 62, avgEngagement: 65 },
    { name: 'Enterprise Sales', department: 'Sales', lead: 'Tariq Khan', memberCount: 9, avgPerformanceScore: 76, teamHealthScore: 74, sprintVelocity: 48, okrCompletion: 70, avgEngagement: 73 },
    { name: 'People Operations', department: 'HR', lead: 'Nadia Chen', memberCount: 4, avgPerformanceScore: 80, teamHealthScore: 83, sprintVelocity: 18, okrCompletion: 85, avgEngagement: 86 },
    { name: 'DevOps & SRE', department: 'Operations', lead: 'Victor Singh', memberCount: 5, avgPerformanceScore: 77, teamHealthScore: 76, sprintVelocity: 32, okrCompletion: 73, avgEngagement: 75 },
    { name: 'Customer Success', department: 'Customer Success', lead: 'Luna Garcia', memberCount: 6, avgPerformanceScore: 82, teamHealthScore: 84, sprintVelocity: 38, okrCompletion: 80, avgEngagement: 82 },
  ];
  return teams.map(t => ({
    ...t, id: uid(),
    sprintTrend: Array.from({ length: 6 }, () => Math.round(t.sprintVelocity * (0.8 + Math.random() * 0.4))),
  }));
}

// ── KPIs ───────────────────────────────────────────────────────────────────

function generateKPIs(teams: Team[]): TeamKPI[] {
  const kpiTemplates = [
    { name: 'Sprint Velocity', unit: 'pts', targetFn: (t: Team) => t.sprintVelocity },
    { name: 'Bug Resolution Rate', unit: '%', targetFn: () => 90 },
    { name: 'Code Review Turnaround', unit: 'hrs', targetFn: () => 24 },
    { name: 'Customer NPS', unit: 'score', targetFn: () => 70 },
    { name: 'Feature Delivery', unit: '%', targetFn: () => 85 },
    { name: 'Team Engagement', unit: '%', targetFn: () => 80 },
  ];
  const kpis: TeamKPI[] = [];
  for (const team of teams) {
    for (const tmpl of kpiTemplates.slice(0, rand(2, 4))) {
      const target = tmpl.targetFn(team);
      const current = Math.round(target * (0.7 + Math.random() * 0.5));
      const status: GoalStatus = current >= target ? 'Completed' : current >= target * 0.85 ? 'On Track' : current >= target * 0.65 ? 'At Risk' : 'Behind';
      kpis.push({
        id: uid(), teamId: team.id, teamName: team.name, department: team.department,
        name: tmpl.name, target, current, unit: tmpl.unit,
        trend: pick(['up', 'down', 'stable'] as const),
        deadline: `2026-${String(rand(9, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
        status,
      });
    }
  }
  return kpis;
}

// ── OKRs ───────────────────────────────────────────────────────────────────

function generateOKRs(teams: Team[]): OKR[] {
  const objectives = [
    'Improve platform reliability to 99.9% uptime',
    'Reduce customer churn by 15%',
    'Ship 3 major features this quarter',
    'Achieve 80% test coverage across all services',
    'Reduce average incident response time to under 15 minutes',
    'Increase team velocity by 20%',
    'Launch new onboarding flow for enterprise customers',
    'Establish design system v2 with 50+ components',
  ];
  return teams.slice(0, 6).map((team, i) => {
    const krCount = rand(2, 4);
    const keyResults: KeyResult[] = Array.from({ length: krCount }, (_, j) => {
      const target = rand(70, 100);
      const current = rand(20, target);
      const progress = Math.round((current / target) * 100);
      return {
        id: uid(),
        description: `KR ${j + 1}: ${pick(['Achieve', 'Reduce', 'Increase', 'Ship', 'Launch'])} ${pick(['target metric', 'quality goal', 'efficiency gain', 'coverage target', 'response time'])}`,
        target, current, unit: pick(['%', 'pts', 'days', 'count']),
        progress,
        status: progress >= 100 ? 'Completed' : progress >= 70 ? 'On Track' : progress >= 40 ? 'At Risk' : 'Behind',
      };
    });
    const overallProgress = Math.round(keyResults.reduce((s, kr) => s + kr.progress, 0) / keyResults.length);
    return {
      id: uid(), teamId: team.id, teamName: team.name,
      objective: objectives[i % objectives.length],
      keyResults, owner: team.lead,
      quarter: pick(['Q1 2026', 'Q2 2026', 'Q3 2026'] as ReviewCycle[]),
      overallProgress,
      status: overallProgress >= 80 ? 'On Track' : overallProgress >= 50 ? 'At Risk' : 'Behind',
    };
  });
}

// ── Sprints ────────────────────────────────────────────────────────────────

function generateSprints(teams: Team[]): SprintRecord[] {
  const sprints: SprintRecord[] = [];
  for (const team of teams) {
    for (let s = 1; s <= 4; s++) {
      const planned = rand(30, 60);
      const completed = Math.round(planned * (0.7 + Math.random() * 0.35));
      const status: SprintStatus = s < 4 ? 'Completed' : pick(['Active', 'Review'] as SprintStatus[]);
      sprints.push({
        id: uid(), teamId: team.id, teamName: team.name,
        sprintNumber: 80 + s, name: `Sprint ${80 + s}`,
        status, startDate: `2026-0${5 + Math.floor(s / 2)}-${String((s % 2) * 14 + 1).padStart(2, '0')}`,
        endDate: `2026-0${5 + Math.floor((s + 1) / 2)}-${String(((s + 1) % 2) * 14 + 14).padStart(2, '0')}`,
        plannedPoints: planned, completedPoints: completed, velocity: completed,
        storiesPlanned: rand(8, 15), storiesCompleted: rand(5, 14),
        storiesCarriedOver: rand(0, 3), avgCycleTime: round1(2 + Math.random() * 4),
        blockers: rand(0, 5),
      });
    }
  }
  return sprints;
}

// ── Peer Feedback ──────────────────────────────────────────────────────────

function generatePeerFeedback(teams: Team[]): PeerFeedback[] {
  const feedbacks: PeerFeedback[] = [];
  const strengthsPool = ['Strong technical skills', 'Great communicator', 'Team player', 'Proactive problem solver', 'Mentors others well', 'Delivers consistently', 'Creative thinker', 'Adaptable'];
  const improvementsPool = ['Could delegate more', 'Needs to improve documentation', 'Sometimes overcommits', 'Could be more assertive', 'Should share knowledge more', 'Time management could improve'];
  const ratings: PerformanceRating[] = ['Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'];

  for (const team of teams) {
    for (let i = 0; i < rand(3, 6); i++) {
      feedbacks.push({
        id: uid(),
        fromEmployee: `${pick(FIRST)} ${pick(LAST)}`,
        toEmployee: `${pick(FIRST)} ${pick(LAST)}`,
        department: team.department,
        type: pick(['Peer', 'Manager', 'Self', '360'] as FeedbackType[]),
        rating: pick(ratings),
        strengths: pick(strengthsPool) + '. ' + pick(strengthsPool) + '.',
        improvements: pick(improvementsPool) + '.',
        sentiment: rand(3, 5),
        submittedAt: `2026-${String(rand(5, 8)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
      });
    }
  }
  return feedbacks;
}

// ── Performance Reviews ────────────────────────────────────────────────────

function generateReviews(teams: Team[]): PerformanceReview[] {
  const reviews: PerformanceReview[] = [];
  const ratings: PerformanceRating[] = ['Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'];
  const strengthsPool = ['Technical excellence', 'Communication', 'Leadership', 'Innovation', 'Collaboration', 'Reliability'];
  const improvementsPool = ['Delegation', 'Documentation', 'Time management', 'Public speaking', 'Strategic thinking'];

  for (const team of teams) {
    for (let i = 0; i < rand(2, 5); i++) {
      const rating = pick(ratings);
      const score = rating === 'Outstanding' ? rand(85, 100) : rating === 'Exceeds Expectations' ? rand(70, 89) : rating === 'Meets Expectations' ? rand(50, 74) : rand(20, 49);
      reviews.push({
        id: uid(), employeeId: `EMP-${rand(1000, 1059)}`,
        employeeName: `${pick(FIRST)} ${pick(LAST)}`,
        department: team.department, reviewer: team.lead,
        cycle: pick(['Q2 2026', 'Q1 2026', 'H1 2026'] as ReviewCycle[]),
        overallRating: rating, score,
        technicalSkills: rand(40, 100), communication: rand(40, 100),
        leadership: rand(40, 100), teamwork: rand(40, 100), innovation: rand(40, 100),
        strengths: [pick(strengthsPool), pick(strengthsPool)],
        improvements: [pick(improvementsPool)],
        goalsNextPeriod: [`${pick(['Improve', 'Launch', 'Reduce', 'Achieve'])} ${pick(['metrics', 'features', 'process', 'coverage'])}`],
        submittedAt: `2026-${String(rand(5, 8)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
      });
    }
  }
  return reviews;
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): TeamTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let perf = 72, eng = 70, vel = 40, goal = 60, hc = 48;
  return months.map((month) => {
    perf = Math.max(65, Math.min(85, perf + rand(-2, 3)));
    eng = Math.max(60, Math.min(85, eng + rand(-2, 3)));
    vel = Math.max(30, Math.min(55, vel + rand(-3, 4)));
    goal = Math.max(50, Math.min(80, goal + rand(-3, 4)));
    hc = Math.max(45, Math.min(60, hc + rand(0, 3)));
    return { month, avgPerformance: perf, avgEngagement: eng, avgVelocity: vel, goalCompletionRate: goal, headcount: hc };
  });
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): PerformanceInsight[] {
  return [
    { id: uid(), title: 'Design Systems team excelling', description: 'Highest team health (88) and OKR completion (88%) across all teams.', type: 'positive', teamName: 'Design Systems', metric: 'Health Score', value: '88/100' },
    { id: uid(), title: 'Backend Platform velocity declining', description: 'Sprint velocity dropped 18% over last 3 sprints. Review workload distribution.', type: 'warning', teamName: 'Backend Platform', metric: 'Velocity', value: '-18%' },
    { id: uid(), title: 'Demand Generation behind on OKRs', description: 'Only 62% OKR completion. Marketing team needs realignment.', type: 'critical', teamName: 'Demand Generation', metric: 'OKR Completion', value: '62%' },
    { id: uid(), title: 'Customer NPS improved to 78', description: 'Customer Success team exceeded NPS target. Great cross-team collaboration.', type: 'positive', metric: 'NPS', value: '78' },
    { id: uid(), title: '3 teams need performance improvement plans', description: 'Backend Platform, Demand Generation, and Enterprise Sales scored below 75.', type: 'warning', metric: 'Below Target', value: '3 teams' },
    { id: uid(), title: 'Sprint blocker rate increasing', description: 'Average blockers per sprint up from 1.2 to 2.8. Process review recommended.', type: 'info', metric: 'Blockers/Sprint', value: '2.8' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getTeamPerformanceData() {
  const teams = generateTeams();
  const kpis = generateKPIs(teams);
  const okrs = generateOKRs(teams);
  const sprints = generateSprints(teams);
  const peerFeedback = generatePeerFeedback(teams);
  const reviews = generateReviews(teams);
  const trends = generateTrends();
  const insights = generateInsights();

  const summary: PerformanceSummary = {
    totalTeams: teams.length,
    totalMembers: teams.reduce((s, t) => s + t.memberCount, 0),
    avgPerformanceScore: Math.round(teams.reduce((s, t) => s + t.avgPerformanceScore, 0) / teams.length),
    avgEngagement: Math.round(teams.reduce((s, t) => s + t.avgEngagement, 0) / teams.length),
    avgTeamHealth: Math.round(teams.reduce((s, t) => s + t.teamHealthScore, 0) / teams.length),
    avgOKRCompletion: Math.round(teams.reduce((s, t) => s + t.okrCompletion, 0) / teams.length),
    avgSprintVelocity: Math.round(teams.reduce((s, t) => s + t.sprintVelocity, 0) / teams.length),
    outstandingCount: reviews.filter(r => r.overallRating === 'Outstanding').length,
    needsImprovementCount: reviews.filter(r => r.overallRating === 'Needs Improvement').length,
    totalGoals: okrs.reduce((s, o) => s + o.keyResults.length, 0),
    completedGoals: okrs.reduce((s, o) => s + o.keyResults.filter(kr => kr.status === 'Completed').length, 0),
    activeSprints: sprints.filter(s => s.status === 'Active').length,
  };

  return { teams, kpis, okrs, sprints, peerFeedback, reviews, trends, insights, summary };
}
