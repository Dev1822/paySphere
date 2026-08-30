/**
 * Team Performance Analytics Dashboard (#1398)
 *
 * Team KPIs, OKR tracking, sprint velocity, peer feedback,
 * performance reviews, and goal completion analytics.
 */

import { useMemo, useState } from 'react';

import { getTeamPerformanceData } from '../components/team-performance/teamPerfService';
import {
  OverviewStats, TeamCard, OKRCard, SprintCard, KPIRow,
  ReviewCard, FeedbackCard, InsightCard,
} from '../components/team-performance/TeamPerfCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from '../components/team-performance/TeamPerfCharts';
import { DEPT_COLORS, RATING_COLORS } from '../components/team-performance/teamPerfTypes';

const TABS = ['Overview', 'Teams', 'OKRs', 'Sprints', 'Reviews', 'Feedback'];

export default function TeamPerformanceDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const data = useMemo(() => getTeamPerformanceData(), []);

  // Chart data
  const teamPerfBar = data.teams
    .map(t => ({ label: t.name.replace(' ', '\n').slice(0, 10), value: t.avgPerformanceScore, color: DEPT_COLORS[t.department] || '#3b82f6' }))
    .sort((a, b) => b.value - a.value);

  const teamHealthBar = data.teams
    .map(t => ({ label: t.name.slice(0, 10), value: t.teamHealthScore, color: t.teamHealthScore > 75 ? '#22c55e' : t.teamHealthScore > 60 ? '#eab308' : '#ef4444' }))
    .sort((a, b) => b.value - a.value);

  const ratingDonut = [
    { label: 'Outstanding', value: data.reviews.filter(r => r.overallRating === 'Outstanding').length, color: RATING_COLORS['Outstanding'] },
    { label: 'Exceeds', value: data.reviews.filter(r => r.overallRating === 'Exceeds Expectations').length, color: RATING_COLORS['Exceeds Expectations'] },
    { label: 'Meets', value: data.reviews.filter(r => r.overallRating === 'Meets Expectations').length, color: RATING_COLORS['Meets Expectations'] },
    { label: 'Needs Improvement', value: data.reviews.filter(r => r.overallRating === 'Needs Improvement').length, color: RATING_COLORS['Needs Improvement'] },
  ];

  const deptRadar = data.teams.slice(0, 6).map(t => ({
    axis: t.name.slice(0, 8), value: t.avgPerformanceScore / 100,
  }));

  const velocityRadar = data.teams.slice(0, 6).map(t => ({
    axis: t.name.slice(0, 8), value: t.sprintVelocity / 60,
  }));

  const sprintCompleted = data.sprints
    .filter(s => s.status === 'Completed')
    .slice(0, 10)
    .map(s => ({ label: s.name.slice(0, 6), value: s.velocity, color: '#3b82f6' }));

  const filteredKPIs = selectedTeam
    ? data.kpis.filter(k => k.teamName === selectedTeam)
    : data.kpis;

  const filteredSprints = selectedTeam
    ? data.sprints.filter(s => s.teamName === selectedTeam)
    : data.sprints;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          📊 Team Performance Analytics
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Team KPIs, OKR tracking, sprint velocity, peer feedback, and performance reviews.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
            color: activeTab === tab ? '#2563EB' : '#6b7280',
            background: activeTab === tab ? '#eff6ff' : 'transparent',
            borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
            marginBottom: -2,
          }}>{tab}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <OverviewStats summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <BarChart data={teamPerfBar} title="Performance Score by Team" height={220} />
            <DonutChart data={ratingDonut} title="Review Rating Distribution" />
            <RadarChart data={deptRadar} title="Team Performance Radar" />
          </div>
          <TrendLine
            trends={data.trends}
            title="Performance Trends Over Time"
            lines={[
              { key: 'avgPerformance', color: '#3b82f6', label: 'Performance' },
              { key: 'avgEngagement', color: '#22c55e', label: 'Engagement' },
              { key: 'goalCompletionRate', color: '#8b5cf6', label: 'Goal Completion' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <HorizontalBar data={teamHealthBar} title="Team Health Score" />
            <BarChart data={sprintCompleted} title="Sprint Velocity (Completed)" height={200} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Performance Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'Teams' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {data.teams.map(t => <TeamCard key={t.id} team={t} />)}
        </div>
      )}

      {/* OKRs Tab */}
      {activeTab === 'OKRs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 12 }}>
          {data.okrs.map(o => <OKRCard key={o.id} okr={o} />)}
        </div>
      )}

      {/* Sprints Tab */}
      {activeTab === 'Sprints' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <select
              value={selectedTeam || ''}
              onChange={e => setSelectedTeam(e.target.value || null)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, color: '#374151', background: '#fff', outline: 'none' }}
            >
              <option value="">All Teams</option>
              {data.teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
            {filteredSprints.sort((a, b) => b.sprintNumber - a.sprintNumber).map(s => (
              <SprintCard key={s.id} sprint={s} />
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <BarChart data={sprintCompleted} title="Velocity Trend (Completed Sprints)" height={200} />
          </div>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'Reviews' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={ratingDonut} title="Rating Distribution" />
            <RadarChart data={deptRadar} title="Performance by Team" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 10 }}>
            {data.reviews.sort((a, b) => b.score - a.score).map(r => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'Feedback' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <RadarChart data={velocityRadar} title="Sprint Velocity by Team" />
            <DonutChart
              data={[
                { label: 'Peer', value: data.peerFeedback.filter(f => f.type === 'Peer').length, color: '#3b82f6' },
                { label: 'Manager', value: data.peerFeedback.filter(f => f.type === 'Manager').length, color: '#22c55e' },
                { label: 'Self', value: data.peerFeedback.filter(f => f.type === 'Self').length, color: '#8b5cf6' },
                { label: '360', value: data.peerFeedback.filter(f => f.type === '360').length, color: '#f59e0b' },
              ]}
              title="Feedback by Type"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 10 }}>
            {data.peerFeedback.slice(0, 20).map(f => (
              <FeedbackCard key={f.id} feedback={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
