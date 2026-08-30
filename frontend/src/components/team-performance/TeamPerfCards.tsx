/**
 * Team Performance Analytics — Card Components
 *
 * StatCard, TeamCard, OKRCard, SprintCard, KPIRow, ReviewCard,
 * FeedbackCard, InsightCard, OverviewStats.
 */

import React from 'react';
import {
  Team, TeamKPI, OKR, SprintRecord, PeerFeedback,
  PerformanceReview, PerformanceInsight, PerformanceSummary,
  RATING_COLORS, RATING_BG, GOAL_COLORS, DEPT_COLORS,
  formatScore, getRatingEmoji,
  GoalStatus, SprintStatus,
} from './teamPerfTypes';

// ── Stat Card ──────────────────────────────────────────────────────────────

export const StatCard: React.FC<{
  label: string; value: string | number; icon?: string;
  color?: string; subtitle?: string;
}> = ({ label, value, icon, color = '#2563EB', subtitle }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    flex: '1 1 180px', minWidth: 160,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
    {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
  </div>
);

// ── Overview Stats ─────────────────────────────────────────────────────────

export const OverviewStats: React.FC<{ summary: PerformanceSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Teams" value={summary.totalTeams} icon="👥" />
    <StatCard label="Total Members" value={summary.totalMembers} icon="👤" />
    <StatCard label="Avg Performance" value={`${summary.avgPerformanceScore}/100`} icon="📊" color={summary.avgPerformanceScore > 75 ? '#22c55e' : '#eab308'} />
    <StatCard label="Engagement" value={`${summary.avgEngagement}%`} icon="⚡" color={summary.avgEngagement > 75 ? '#22c55e' : '#eab308'} />
    <StatCard label="Team Health" value={`${summary.avgTeamHealth}/100`} icon="💚" color={summary.avgTeamHealth > 75 ? '#22c55e' : '#eab308'} />
    <StatCard label="OKR Completion" value={`${summary.avgOKRCompletion}%`} icon="🎯" />
    <StatCard label="Sprint Velocity" value={`${summary.avgSprintVelocity} pts`} icon="🚀" />
    <StatCard label="Outstanding" value={summary.outstandingCount} icon="🏆" color="#8b5cf6" />
    <StatCard label="Needs Improvement" value={summary.needsImprovementCount} icon="⚠️" color="#ef4444" />
    <StatCard label="Goals Completed" value={`${summary.completedGoals}/${summary.totalGoals}`} icon="✅" />
    <StatCard label="Active Sprints" value={summary.activeSprints} icon="🔄" color="#3b82f6" />
  </div>
);

// ── Sprint Status Badge ────────────────────────────────────────────────────

const SprintBadge: React.FC<{ status: SprintStatus }> = ({ status }) => {
  const colors: Record<SprintStatus, string> = { 'Planning': '#9ca3af', 'Active': '#22c55e', 'Review': '#eab308', 'Completed': '#3b82f6' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: colors[status], background: `${colors[status]}15` }}>{status}</span>
  );
};

// ── Goal Status Badge ──────────────────────────────────────────────────────

const GoalBadge: React.FC<{ status: GoalStatus }> = ({ status }) => (
  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: GOAL_COLORS[status], background: `${GOAL_COLORS[status]}15` }}>{status}</span>
);

// ── Team Card ──────────────────────────────────────────────────────────────

export const TeamCard: React.FC<{ team: Team }> = ({ team }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>
        <span style={{ color: DEPT_COLORS[team.department] || '#374151' }}>●</span> {team.name}
      </div>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{team.memberCount} members</span>
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Lead: {team.lead} · {team.department}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12, marginBottom: 8 }}>
      <div>Performance: <b style={{ color: team.avgPerformanceScore > 75 ? '#22c55e' : '#eab308' }}>{team.avgPerformanceScore}</b></div>
      <div>Health: <b style={{ color: team.teamHealthScore > 75 ? '#22c55e' : '#eab308' }}>{team.teamHealthScore}</b></div>
      <div>Velocity: <b>{team.sprintVelocity} pts</b></div>
      <div>OKR: <b>{team.okrCompletion}%</b></div>
      <div>Engagement: <b>{team.avgEngagement}%</b></div>
    </div>
    {/* Sprint trend sparkline */}
    <div style={{ display: 'flex', alignItems: 'end', gap: 2, height: 24 }}>
      {team.sprintTrend.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${(v / Math.max(...team.sprintTrend)) * 100}%`,
          background: i === team.sprintTrend.length - 1 ? '#3b82f6' : '#d1d5db',
          borderRadius: 2, minHeight: 3,
        }} />
      ))}
    </div>
  </div>
);

// ── OKR Card ───────────────────────────────────────────────────────────────

export const OKRCard: React.FC<{ okr: OKR }> = ({ okr }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: '1px solid #e5e7eb',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{okr.objective}</div>
      <GoalBadge status={okr.status} />
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
      {okr.teamName} · Owner: {okr.owner} · {okr.quarter}
    </div>
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
        <span>Overall Progress</span><b>{okr.overallProgress}%</b>
      </div>
      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${okr.overallProgress}%`, background: okr.overallProgress > 70 ? '#22c55e' : okr.overallProgress > 40 ? '#eab308' : '#ef4444' }} />
      </div>
    </div>
    {okr.keyResults.map(kr => (
      <div key={kr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
        <GoalBadge status={kr.status} />
        <span style={{ flex: 1, color: '#374151' }}>{kr.description}</span>
        <span style={{ fontWeight: 600 }}>{kr.progress}%</span>
      </div>
    ))}
  </div>
);

// ── Sprint Card ────────────────────────────────────────────────────────────

export const SprintCard: React.FC<{ sprint: SprintRecord }> = ({ sprint }) => {
  const pct = sprint.plannedPoints > 0 ? Math.round((sprint.completedPoints / sprint.plannedPoints) * 100) : 0;
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{sprint.teamName} — {sprint.name}</div>
        <SprintBadge status={sprint.status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 6 }}>
        <div>Planned: <b>{sprint.plannedPoints} pts</b></div>
        <div>Done: <b>{sprint.completedPoints} pts</b></div>
        <div>Velocity: <b>{sprint.velocity} pts</b></div>
        <div>Stories: <b>{sprint.storiesCompleted}/{sprint.storiesPlanned}</b></div>
        <div>Carried: <b>{sprint.storiesCarriedOver}</b></div>
        <div>Cycle Time: <b>{sprint.avgCycleTime}d</b></div>
      </div>
      <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444' }} />
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af' }}>
        {sprint.startDate} → {sprint.endDate} · 🚫 {sprint.blockers} blockers
      </div>
    </div>
  );
};

// ── KPI Row ────────────────────────────────────────────────────────────────

export const KPIRow: React.FC<{ kpi: TeamKPI }> = ({ kpi }) => {
  const pct = kpi.target > 0 ? Math.min(Math.round((kpi.current / kpi.target) * 100), 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{kpi.name}</span>
      <div style={{ flex: 1, height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 5, width: `${pct}%`, background: GOAL_COLORS[kpi.status] }} />
      </div>
      <span style={{ width: 60, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>{kpi.current}/{kpi.target} {kpi.unit}</span>
      <span style={{ width: 16, textAlign: 'center' }}>{kpi.trend === 'up' ? '📈' : kpi.trend === 'down' ? '📉' : '➡️'}</span>
      <GoalBadge status={kpi.status} />
    </div>
  );
};

// ── Review Card ────────────────────────────────────────────────────────────

export const ReviewCard: React.FC<{ review: PerformanceReview }> = ({ review }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 14,
    borderLeft: `4px solid ${RATING_COLORS[review.overallRating]}`,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {getRatingEmoji(review.overallRating)} {review.employeeName}
      </div>
      <span style={{
        padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
        color: RATING_COLORS[review.overallRating], background: RATING_BG[review.overallRating],
      }}>{review.overallRating} ({review.score})</span>
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
      {review.department} · Reviewer: {review.reviewer} · {review.cycle}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 6 }}>
      <div>Technical: <b>{review.technicalSkills}</b></div>
      <div>Communication: <b>{review.communication}</b></div>
      <div>Leadership: <b>{review.leadership}</b></div>
      <div>Teamwork: <b>{review.teamwork}</b></div>
      <div>Innovation: <b>{review.innovation}</b></div>
    </div>
    <div style={{ fontSize: 11, color: '#374151' }}>
      <b>Strengths:</b> {review.strengths.join(', ')}<br />
      <b>Improve:</b> {review.improvements.join(', ')}
    </div>
  </div>
);

// ── Feedback Card ──────────────────────────────────────────────────────────

export const FeedbackCard: React.FC<{ feedback: PeerFeedback }> = ({ feedback }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 14,
    border: '1px solid #e5e7eb',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {getRatingEmoji(feedback.rating)} {feedback.fromEmployee} → {feedback.toEmployee}
      </div>
      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: RATING_COLORS[feedback.rating], background: RATING_BG[feedback.rating] }}>{feedback.rating}</span>
    </div>
    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{feedback.type} · {feedback.department} · {feedback.submittedAt}</div>
    <div style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}><b>💪 Strengths:</b> {feedback.strengths}</div>
    <div style={{ fontSize: 12, color: '#374151' }}><b>🔧 Improve:</b> {feedback.improvements}</div>
    <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>
      {'⭐'.repeat(feedback.sentiment)}{'☆'.repeat(5 - feedback.sentiment)}
    </div>
  </div>
);

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: PerformanceInsight }> = ({ insight }) => {
  const colors = { positive: '#22c55e', warning: '#eab308', critical: '#ef4444', info: '#3b82f6' };
  const color = colors[insight.type];
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {insight.title}
        {insight.teamName && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>• {insight.teamName}</span>}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{insight.description}</div>
      <div style={{ fontSize: 11, color }}><b>{insight.metric}:</b> {insight.value}</div>
    </div>
  );
};
