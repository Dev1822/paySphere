/**
 * Employee Engagement Pulse — Card Components
 *
 * StatCard, SurveyCard, ResponseCard, RecognitionCard, DriverScoreCard,
 * CultureHealthCard, DeptEngagementCard, InsightCard, OverviewStats.
 */

import React from 'react';
import {
  PulseSurvey, PulseResponse, RecognitionEntry, DriverScore,
  CultureHealth, DepartmentEngagement, EngagementInsight,
  EngagementSummary,
  SENTIMENT_COLORS, SENTIMENT_BG, SENTIMENT_EMOJI,
  RECOGNITION_COLORS, DRIVER_ICONS,
  formatENPS, formatSentiment, getENPSLabel,
} from './engagementPulseTypes';

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

export const OverviewStats: React.FC<{ summary: EngagementSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="eNPS Score" value={formatENPS(summary.overallENPS)} icon="📊" color={summary.overallENPS > 30 ? '#22c55e' : summary.overallENPS > 0 ? '#eab308' : '#ef4444'} subtitle={getENPSLabel(summary.overallENPS)} />
    <StatCard label="Avg Sentiment" value={`${summary.avgSentimentScore}/5`} icon={SENTIMENT_EMOJI[formatSentiment(summary.avgSentimentScore)]} />
    <StatCard label="Response Rate" value={`${summary.avgResponseRate}%`} icon="📋" color={summary.avgResponseRate > 75 ? '#22c55e' : '#eab308'} />
    <StatCard label="Total Responses" value={summary.totalResponses} icon="💬" />
    <StatCard label="Culture Health" value={`${summary.cultureHealthScore}/100`} icon="🏛️" color={summary.cultureHealthScore > 70 ? '#22c55e' : '#eab308'} />
    <StatCard label="Recognition" value={summary.recognitionCount} icon="🏆" color="#f59e0b" />
    <StatCard label="Top Driver" value={summary.topDriver} icon="💪" color="#22c55e" />
    <StatCard label="Active Surveys" value={summary.activeSurveys} icon="📝" color="#3b82f6" />
  </div>
);

// ── Survey Card ────────────────────────────────────────────────────────────

export const SurveyCard: React.FC<{ survey: PulseSurvey }> = ({ survey }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: `1px solid ${survey.isActive ? '#22c55e30' : '#e5e7eb'}`,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{survey.name}</div>
      {survey.isActive && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>● Active</span>}
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
      {survey.type} · {survey.questions} questions · {survey.startDate} → {survey.endDate}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
      <div>Responses: <b>{survey.responses}/{survey.totalInvited}</b></div>
      <div>Response Rate: <b>{survey.responseRate}%</b></div>
      <div>Avg Score: <b>{survey.avgScore}/5</b></div>
    </div>
    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 3, width: `${survey.responseRate}%`, background: survey.responseRate > 75 ? '#22c55e' : '#eab308' }} />
    </div>
  </div>
);

// ── Response Card ──────────────────────────────────────────────────────────

export const ResponseCard: React.FC<{ response: PulseResponse }> = ({ response }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 14,
    border: `1px solid ${SENTIMENT_COLORS[response.sentiment]}30`,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {SENTIMENT_EMOJI[response.sentiment]} {response.employeeName}
      </div>
      <span style={{ fontSize: 11, color: '#9ca3af' }}>{response.department}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 4 }}>
      <div>Sentiment: <b style={{ color: SENTIMENT_COLORS[response.sentiment] }}>{response.sentiment}</b></div>
      <div>Score: <b>{response.score}/5</b></div>
      <div>eNPS: <b style={{ color: response.enpsScore > 0 ? '#22c55e' : '#ef4444' }}>{formatENPS(response.enpsScore)}</b></div>
    </div>
    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>
      💪 Top: {response.topDriver} · 🔧 Bottom: {response.bottomDriver}
    </div>
    {response.comment && (
      <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', borderRadius: 6, padding: '6px 10px', marginTop: 4, fontStyle: 'italic' }}>
        "{response.comment}"
      </div>
    )}
  </div>
);

// ── Recognition Card ───────────────────────────────────────────────────────

export const RecognitionCard: React.FC<{ entry: RecognitionEntry }> = ({ entry }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 14,
    borderLeft: `4px solid ${RECOGNITION_COLORS[entry.type]}`,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {entry.from} → {entry.to}
      </div>
      <span style={{
        padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
        color: RECOGNITION_COLORS[entry.type], background: `${RECOGNITION_COLORS[entry.type]}15`,
      }}>{entry.type}</span>
    </div>
    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{entry.message}</div>
    <div style={{ fontSize: 11, color: '#6b7280' }}>
      🏅 {entry.points} points · {entry.department} · {entry.createdAt}
    </div>
  </div>
);

// ── Driver Score Card ──────────────────────────────────────────────────────

export const DriverScoreCard: React.FC<{ driver: DriverScore }> = ({ driver }) => {
  const pct = (driver.score / 5) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{DRIVER_ICONS[driver.driver]}</span>
      <span style={{ width: 150, fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{driver.driver}</span>
      <div style={{ flex: 1, height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 5, width: `${pct}%`,
          background: driver.score >= 4 ? '#22c55e' : driver.score >= 3 ? '#eab308' : '#ef4444',
        }} />
      </div>
      <span style={{ width: 30, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>{driver.score.toFixed(1)}</span>
      <span style={{ width: 16, textAlign: 'center' }}>{driver.trend === 'up' ? '📈' : driver.trend === 'down' ? '📉' : '➡️'}</span>
    </div>
  );
};

// ── Culture Health Card ────────────────────────────────────────────────────

export const CultureHealthCard: React.FC<{ item: CultureHealth }> = ({ item }) => {
  const scoreColor = item.score >= item.benchmark ? '#22c55e' : item.score >= item.benchmark * 0.9 ? '#eab308' : '#ef4444';
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 14,
      border: `1px solid ${scoreColor}30`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{item.metric}</div>
        <span style={{ fontSize: 10, color: '#6b7280' }}>{item.category}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor }}>{item.score}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>/ 100 (benchmark: {item.benchmark})</span>
        <span style={{ fontSize: 12 }}>{item.trend === 'up' ? '📈' : item.trend === 'down' ? '📉' : '➡️'}</span>
      </div>
      <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${item.score}%`, background: scoreColor }} />
      </div>
    </div>
  );
};

// ── Dept Engagement Card ───────────────────────────────────────────────────

export const DeptEngagementCard: React.FC<{ dept: DepartmentEngagement }> = ({ dept }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{dept.department}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
      <div>eNPS: <b style={{ color: dept.eNPS > 30 ? '#22c55e' : dept.eNPS > 0 ? '#eab308' : '#ef4444' }}>{formatENPS(dept.eNPS)}</b></div>
      <div>Sentiment: <b>{dept.avgSentiment.toFixed(1)}/5</b></div>
      <div>Response Rate: <b>{dept.responseRate}%</b></div>
      <div>Recognition: <b>{dept.recognitionCount}</b></div>
      <div>Top Driver: <b>{dept.topDriver}</b></div>
      <div>Employees: <b>{dept.totalEmployees}</b></div>
    </div>
  </div>
);

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: EngagementInsight }> = ({ insight }) => {
  const colors = { positive: '#22c55e', warning: '#eab308', critical: '#ef4444', info: '#3b82f6' };
  const color = colors[insight.type];
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{insight.title}</div>
        <span style={{ fontSize: 12 }}>{insight.trend === 'up' ? '📈' : insight.trend === 'down' ? '📉' : '➡️'}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{insight.description}</div>
      <div style={{ fontSize: 11, color }}><b>{insight.metric}:</b> {insight.value}</div>
    </div>
  );
};
