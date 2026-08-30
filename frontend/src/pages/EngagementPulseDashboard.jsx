/**
 * Employee Engagement Pulse Dashboard (#1401)
 *
 * Engagement surveys, pulse checks, eNPS, recognition activity,
 * culture health metrics, and sentiment analysis.
 */

import { useMemo, useState } from 'react';

import { getEngagementPulseData } from '../components/engagement-pulse/engagementPulseService';
import {
  OverviewStats, SurveyCard, ResponseCard, RecognitionCard,
  DriverScoreCard, CultureHealthCard, DeptEngagementCard, InsightCard,
} from '../components/engagement-pulse/EngagementPulseCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from '../components/engagement-pulse/EngagementPulseCharts';
import { SENTIMENT_COLORS, SENTIMENT_EMOJI, formatENPS } from '../components/engagement-pulse/engagementPulseTypes';

const TABS = ['Overview', 'Surveys', 'Responses', 'eNPS & Drivers', 'Recognition', 'Culture Health', 'Departments'];

export default function EngagementPulseDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const data = useMemo(() => getEngagementPulseData(), []);

  // Chart data
  const sentimentDonut = [
    { label: '🤩 Very Positive', value: data.responses.filter(r => r.sentiment === 'Very Positive').length, color: SENTIMENT_COLORS['Very Positive'] },
    { label: '😊 Positive', value: data.responses.filter(r => r.sentiment === 'Positive').length, color: SENTIMENT_COLORS['Positive'] },
    { label: '😐 Neutral', value: data.responses.filter(r => r.sentiment === 'Neutral').length, color: SENTIMENT_COLORS['Neutral'] },
    { label: '😟 Negative', value: data.responses.filter(r => r.sentiment === 'Negative').length, color: SENTIMENT_COLORS['Negative'] },
    { label: '😤 Very Negative', value: data.responses.filter(r => r.sentiment === 'Very Negative').length, color: SENTIMENT_COLORS['Very Negative'] },
  ];

  const deptENPSBar = data.deptEngagement
    .map(d => ({ label: d.department.slice(0, 8), value: d.eNPS, color: d.eNPS > 30 ? '#22c55e' : d.eNPS > 0 ? '#eab308' : '#ef4444' }))
    .sort((a, b) => b.value - a.value);

  const cultureRadar = data.cultureHealth.map(c => ({
    axis: c.metric.slice(0, 8), value: c.score / 100,
  }));

  const recognitionDonut = [
    { label: 'Kudos', value: data.recognition.filter(r => r.type === 'Kudos').length, color: '#3b82f6' },
    { label: 'Spot Bonus', value: data.recognition.filter(r => r.type === 'Spot Bonus').length, color: '#22c55e' },
    { label: 'Peer Nomination', value: data.recognition.filter(r => r.type === 'Peer Nomination').length, color: '#8b5cf6' },
    { label: 'Manager Award', value: data.recognition.filter(r => r.type === 'Manager Award').length, color: '#f59e0b' },
    { label: 'Team Celebration', value: data.recognition.filter(r => r.type === 'Team Celebration').length, color: '#ec4899' },
    { label: 'Milestone', value: data.recognition.filter(r => r.type === 'Milestone').length, color: '#06b6d4' },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          📊 Employee Engagement Pulse
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Engagement surveys, pulse checks, eNPS, recognition activity, and culture health metrics.
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
            <DonutChart data={sentimentDonut} title="Sentiment Distribution" />
            <BarChart data={deptENPSBar} title="eNPS by Department" height={200} />
            <RadarChart data={cultureRadar} title="Culture Health Radar" />
          </div>
          <TrendLine
            trends={data.trends}
            title="Engagement Trends Over Time"
            lines={[
              { key: 'pulseScore', color: '#3b82f6', label: 'Pulse Score' },
              { key: 'responseRate', color: '#22c55e', label: 'Response Rate' },
              { key: 'recognitionCount', color: '#f59e0b', label: 'Recognition' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <BarChart
              data={data.driverScores.slice(0, 6).map(d => ({ label: d.driver.slice(0, 8), value: Math.round(d.score * 20), color: d.score >= 4 ? '#22c55e' : d.score >= 3 ? '#eab308' : '#ef4444' }))}
              title="Top Engagement Drivers (%)" height={200}
            />
            <DonutChart data={recognitionDonut} title="Recognition by Type" />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Engagement Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* Surveys Tab */}
      {activeTab === 'Surveys' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
          {data.surveys.map(s => <SurveyCard key={s.id} survey={s} />)}
        </div>
      )}

      {/* Responses Tab */}
      {activeTab === 'Responses' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={sentimentDonut} title="Sentiment Distribution" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
            {data.responses.slice(0, 24).map(r => <ResponseCard key={r.id} response={r} />)}
          </div>
        </div>
      )}

      {/* eNPS & Drivers Tab */}
      {activeTab === 'eNPS & Drivers' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <TrendLine
              trends={data.enpsTrend}
              title="eNPS Trend"
              lines={[
                { key: 'enps', color: '#3b82f6', label: 'eNPS' },
                { key: 'responseRate', color: '#22c55e', label: 'Response Rate' },
              ]}
            />
            <BarChart data={deptENPSBar} title="eNPS by Department" height={200} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>💪 Engagement Drivers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.driverScores.map(d => <DriverScoreCard key={d.driver} driver={d} />)}
            </div>
          </div>
        </div>
      )}

      {/* Recognition Tab */}
      {activeTab === 'Recognition' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={recognitionDonut} title="Recognition by Type" />
            <BarChart
              data={data.deptEngagement.map(d => ({ label: d.department.slice(0, 8), value: d.recognitionCount })).sort((a, b) => b.value - a.value)}
              title="Recognition Count by Dept" height={200}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 10 }}>
            {data.recognition.map(r => <RecognitionCard key={r.id} entry={r} />)}
          </div>
        </div>
      )}

      {/* Culture Health Tab */}
      {activeTab === 'Culture Health' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <RadarChart data={cultureRadar} title="Culture Health Radar" />
            <BarChart
              data={data.cultureHealth.map(c => ({ label: c.metric.slice(0, 8), value: c.score, color: c.score >= c.benchmark ? '#22c55e' : '#ef4444' }))}
              title="Score vs Benchmark" height={200}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {data.cultureHealth.map(c => <CultureHealthCard key={c.id} item={c} />)}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'Departments' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <HorizontalBar data={deptENPSBar} title="eNPS by Department" />
            <BarChart
              data={data.deptEngagement.map(d => ({ label: d.department.slice(0, 8), value: d.responseRate })).sort((a, b) => b.value - a.value)}
              title="Response Rate by Dept" height={200}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {data.deptEngagement.map(d => <DeptEngagementCard key={d.department} dept={d} />)}
          </div>
        </div>
      )}
    </div>
  );
}
