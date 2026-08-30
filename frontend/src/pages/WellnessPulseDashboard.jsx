/**
 * Employee Wellness Pulse Dashboard (#1392)
 *
 * Employee wellbeing tracking, mood analytics, burnout risk assessment,
 * engagement scoring, and wellness program participation.
 */

import { useMemo, useState } from 'react';

import { getWellnessPulseData } from '../components/wellness-pulse/wellnessPulseService';
import {
  OverviewStats, WellnessScoreCard, BurnoutAlertCard,
  ProgramCard, InsightCard, MoodEntryCard, DeptWellnessCard,
} from '../components/wellness-pulse/WellnessPulseCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from '../components/wellness-pulse/WellnessPulseCharts';
import {
  MOOD_COLORS, BURNOUT_COLORS, ENGAGEMENT_COLORS,
  MOOD_EMOJI,
} from '../components/wellness-pulse/wellnessPulseTypes';

const TABS = ['Overview', 'Employees', 'Mood Tracker', 'Burnout Alerts', 'Programs', 'Departments'];

export default function WellnessPulseDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');

  const data = useMemo(() => getWellnessPulseData(), []);

  // Chart data
  const moodDonut = [
    { label: '😢 Very Low', value: data.moodEntries.filter(m => m.mood === 'Very Low').length, color: MOOD_COLORS['Very Low'] },
    { label: '😟 Low', value: data.moodEntries.filter(m => m.mood === 'Low').length, color: MOOD_COLORS['Low'] },
    { label: '😐 Neutral', value: data.moodEntries.filter(m => m.mood === 'Neutral').length, color: MOOD_COLORS['Neutral'] },
    { label: '😊 High', value: data.moodEntries.filter(m => m.mood === 'High').length, color: MOOD_COLORS['High'] },
    { label: '😄 Very High', value: data.moodEntries.filter(m => m.mood === 'Very High').length, color: MOOD_COLORS['Very High'] },
  ];

  const burnoutDonut = [
    { label: 'Low', value: data.wellnessScores.filter(w => w.burnoutRisk === 'Low').length, color: BURNOUT_COLORS['Low'] },
    { label: 'Moderate', value: data.wellnessScores.filter(w => w.burnoutRisk === 'Moderate').length, color: BURNOUT_COLORS['Moderate'] },
    { label: 'High', value: data.wellnessScores.filter(w => w.burnoutRisk === 'High').length, color: BURNOUT_COLORS['High'] },
    { label: 'Critical', value: data.wellnessScores.filter(w => w.burnoutRisk === 'Critical').length, color: BURNOUT_COLORS['Critical'] },
  ];

  const engagementDonut = [
    { label: 'Disengaged', value: data.wellnessScores.filter(w => w.engagementTier === 'Disengaged').length, color: ENGAGEMENT_COLORS['Disengaged'] },
    { label: 'Passive', value: data.wellnessScores.filter(w => w.engagementTier === 'Passive').length, color: ENGAGEMENT_COLORS['Passive'] },
    { label: 'Engaged', value: data.wellnessScores.filter(w => w.engagementTier === 'Engaged').length, color: ENGAGEMENT_COLORS['Engaged'] },
    { label: 'Highly Engaged', value: data.wellnessScores.filter(w => w.engagementTier === 'Highly Engaged').length, color: ENGAGEMENT_COLORS['Highly Engaged'] },
  ];

  const deptWellnessBar = data.deptWellness
    .map(d => ({ label: d.department.slice(0, 8), value: d.avgWellnessScore, color: d.avgWellnessScore > 65 ? '#22c55e' : d.avgWellnessScore > 50 ? '#eab308' : '#ef4444' }))
    .sort((a, b) => a.value - b.value);

  const deptStressBar = data.deptWellness
    .map(d => ({ label: d.department.slice(0, 8), value: d.avgStress, color: d.avgStress > 6 ? '#ef4444' : d.avgStress > 4 ? '#eab308' : '#22c55e' }))
    .sort((a, b) => b.value - a.value);

  const wellnessRadar = data.deptWellness.slice(0, 6).map(d => ({
    axis: d.department.slice(0, 8),
    value: d.avgWellnessScore / 100,
  }));

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          💚 Employee Wellness Pulse
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Track employee wellbeing, mood analytics, burnout risk, engagement scores, and wellness program participation.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
            color: activeTab === tab ? '#16a34a' : '#6b7280',
            background: activeTab === tab ? '#f0fdf4' : 'transparent',
            borderBottom: activeTab === tab ? '2px solid #16a34a' : '2px solid transparent',
            marginBottom: -2,
          }}>{tab}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <OverviewStats summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <DonutChart data={moodDonut} title="Mood Distribution" />
            <DonutChart data={burnoutDonut} title="Burnout Risk" />
            <DonutChart data={engagementDonut} title="Engagement Tiers" />
          </div>
          <TrendLine
            trends={data.trends}
            title="Wellness Trends Over Time"
            lines={[
              { key: 'avgWellnessScore', color: '#22c55e', label: 'Wellness' },
              { key: 'avgEngagement', color: '#8b5cf6', label: 'Engagement' },
              { key: 'avgStress', color: '#ef4444', label: 'Stress' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <BarChart data={deptWellnessBar} title="Wellness by Department" height={200} />
            <HorizontalBar data={deptStressBar.slice(0, 6)} title="Stress by Department" />
          </div>
          {/* Insights */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Wellness Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === 'Employees' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {data.wellnessScores.sort((a, b) => a.overallScore - b.overallScore).map(s => (
            <WellnessScoreCard key={s.id} score={s} />
          ))}
        </div>
      )}

      {/* Mood Tracker Tab */}
      {activeTab === 'Mood Tracker' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={moodDonut} title="Mood Distribution" />
            <RadarChart data={wellnessRadar} title="Department Wellness Radar" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {data.moodEntries.slice(0, 30).map(entry => (
              <MoodEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Burnout Alerts Tab */}
      {activeTab === 'Burnout Alerts' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={burnoutDonut} title="Burnout Risk Distribution" />
            <BarChart
              data={data.deptWellness.map(d => ({
                label: d.department.slice(0, 8), value: d.burnoutCount,
                color: d.burnoutCount > 2 ? '#ef4444' : d.burnoutCount > 0 ? '#eab308' : '#22c55e',
              }))}
              title="Burnout Count by Department"
              height={200}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.burnoutAlerts.sort((a, b) => b.burnoutScore - a.burnoutScore).map(a => (
              <BurnoutAlertCard key={a.id} alert={a} />
            ))}
          </div>
        </div>
      )}

      {/* Programs Tab */}
      {activeTab === 'Programs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {data.programs.map(p => <ProgramCard key={p.id} program={p} />)}
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'Departments' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <BarChart data={deptWellnessBar} title="Wellness Score by Department" height={220} />
            <RadarChart data={wellnessRadar} title="Department Comparison Radar" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {data.deptWellness.map(d => <DeptWellnessCard key={d.department} dept={d} />)}
          </div>
        </div>
      )}
    </div>
  );
}
