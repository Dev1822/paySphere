/**
 * Employee Wellness Pulse — Card Components
 *
 * StatCard, WellnessScoreCard, BurnoutAlertCard, ProgramCard,
 * InsightCard, MoodEntryCard, DepartmentWellnessCard, OverviewStats.
 */

import React from 'react';
import {
  WellnessScore, BurnoutAlert, WellnessProgram, WellnessInsight,
  MoodEntry, DepartmentWellness, WellnessSummary,
  formatScore, formatMoodEmoji,
  MOOD_COLORS, MOOD_BG, MOOD_EMOJI, BURNOUT_COLORS, BURNOUT_BG,
  ENGAGEMENT_COLORS, DIMENSION_ICONS,
  MoodLevel, BurnoutRisk, WellnessDimension,
} from './wellnessPulseTypes';

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

export const OverviewStats: React.FC<{ summary: WellnessSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Wellness Score" value={`${summary.avgWellnessScore}/100`} icon="💚" color={summary.avgWellnessScore > 65 ? '#22c55e' : '#eab308'} />
    <StatCard label="Avg Mood" value={`${formatMoodEmoji(summary.avgMood)} ${summary.avgMood}/5`} icon="😊" />
    <StatCard label="Avg Stress" value={`${summary.avgStress}/10`} icon="🔥" color={summary.avgStress > 6 ? '#ef4444' : '#22c55e'} />
    <StatCard label="Engagement" value={`${summary.avgEngagement}/100`} icon="⚡" color="#8b5cf6" />
    <StatCard label="Work-Life" value={`${summary.avgWorkLifeBalance}/10`} icon="⚖️" color={summary.avgWorkLifeBalance > 6 ? '#22c55e' : '#f97316'} />
    <StatCard label="Burnout Risk" value={summary.burnoutAtRisk} icon="🚨" color={summary.burnoutAtRisk > 3 ? '#ef4444' : '#eab308'} subtitle="at risk" />
    <StatCard label="Check-ins" value={summary.activeCheckIns} icon="📋" subtitle="this period" />
    <StatCard label="Program Participation" value={`${summary.programParticipationRate}%`} icon="🎯" />
  </div>
);

// ── Wellness Score Card ────────────────────────────────────────────────────

export const WellnessScoreCard: React.FC<{ score: WellnessScore }> = ({ score }) => {
  const burnoutColor = BURNOUT_COLORS[score.burnoutRisk];
  const engColor = ENGAGEMENT_COLORS[score.engagementTier];
  const dims: { key: WellnessDimension; val: number }[] = [
    { key: 'Physical', val: score.physical },
    { key: 'Mental', val: score.mental },
    { key: 'Emotional', val: score.emotional },
    { key: 'Social', val: score.social },
    { key: 'Financial', val: score.financial },
    { key: 'Professional', val: score.professional },
  ];

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{score.employeeName}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{score.department}</div>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800,
          color: score.overallScore > 70 ? '#22c55e' : score.overallScore > 50 ? '#eab308' : '#ef4444',
        }}>{score.overallScore}</div>
      </div>

      {/* Dimension bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        {dims.map(d => (
          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>{DIMENSION_ICONS[d.key]}</span>
            <div style={{ flex: 1, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, width: `${d.val}%`,
                background: d.val > 70 ? '#22c55e' : d.val > 50 ? '#eab308' : '#ef4444',
              }} />
            </div>
            <span style={{ fontSize: 10, color: '#9ca3af', width: 20, textAlign: 'right' }}>{d.val}</span>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontWeight: 600,
          color: burnoutColor, background: BURNOUT_BG[score.burnoutRisk],
        }}>🔥 {score.burnoutRisk}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontWeight: 600,
          color: engColor, background: `${engColor}15`,
        }}>⚡ {score.engagementTier}</span>
        {score.streakDays > 0 && (
          <span style={{ padding: '2px 8px', borderRadius: 10, fontWeight: 600, color: '#f59e0b', background: '#fefce8' }}>
            🔥 {score.streakDays}d streak
          </span>
        )}
      </div>
    </div>
  );
};

// ── Burnout Alert Card ─────────────────────────────────────────────────────

export const BurnoutAlertCard: React.FC<{ alert: BurnoutAlert }> = ({ alert }) => {
  const color = BURNOUT_COLORS[alert.riskLevel];
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      borderLeft: `4px solid ${color}`,
      opacity: alert.acknowledged ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{alert.employeeName}</div>
        <span style={{
          padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          color, background: BURNOUT_BG[alert.riskLevel],
        }}>🔥 {alert.riskLevel} ({alert.burnoutScore})</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        {alert.department} · Detected {alert.detectedAt}
        {alert.acknowledged && <span style={{ color: '#22c55e', marginLeft: 8 }}>✓ Acknowledged</span>}
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
        <b>Factors:</b> {alert.primaryFactors.join(' · ')}
      </div>
      <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
        💡 {alert.recommendation}
      </div>
    </div>
  );
};

// ── Program Card ───────────────────────────────────────────────────────────

export const ProgramCard: React.FC<{ program: WellnessProgram }> = ({ program }) => {
  const pct = program.capacity > 0 ? Math.round((program.enrolled / program.capacity) * 100) : 0;
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      border: `1px solid ${program.isActive ? '#22c55e30' : '#e5e7eb'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{program.name}</div>
        {program.isActive && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>● Active</span>}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{program.description}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
        <div><span style={{ color: '#9ca3af' }}>Enrolled:</span> <b>{program.enrolled}/{program.capacity}</b></div>
        <div><span style={{ color: '#9ca3af' }}>Completed:</span> <b>{program.completed}</b></div>
        <div><span style={{ color: '#9ca3af' }}>Rating:</span> <b>{program.avgSatisfaction > 0 ? `⭐ ${program.avgSatisfaction}` : '—'}</b></div>
      </div>
      <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#eab308' : '#3b82f6' }} />
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af' }}>
        👤 {program.facilitator} · {program.startDate} → {program.endDate}
      </div>
    </div>
  );
};

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: WellnessInsight }> = ({ insight }) => {
  const colors = { positive: '#22c55e', warning: '#eab308', critical: '#ef4444', info: '#3b82f6' };
  const color = colors[insight.type];
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 14,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{insight.title}</div>
        <span style={{ fontSize: 12 }}>{insight.trend === 'up' ? '📈' : insight.trend === 'down' ? '📉' : '➡️'}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{insight.description}</div>
      <div style={{ fontSize: 11, color }}>
        <b>{insight.metric}:</b> {insight.value}
      </div>
    </div>
  );
};

// ── Mood Entry Card ────────────────────────────────────────────────────────

export const MoodEntryCard: React.FC<{ entry: MoodEntry }> = ({ entry }) => {
  const moodColor = MOOD_COLORS[entry.mood];
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 12,
      border: `1px solid ${moodColor}30`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{MOOD_EMOJI[entry.mood]} {entry.employeeName}</div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{entry.department}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 4 }}>
        <div>Mood: <b style={{ color: moodColor }}>{entry.moodScore}/5</b></div>
        <div>Stress: <b style={{ color: entry.stressLevel > 7 ? '#ef4444' : '#22c55e' }}>{entry.stressLevel}/10</b></div>
        <div>WLB: <b style={{ color: entry.workLifeBalance > 6 ? '#22c55e' : '#f97316' }}>{entry.workLifeBalance}/10</b></div>
      </div>
      {entry.note && (
        <div style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', borderRadius: 6, padding: '4px 8px', marginTop: 4 }}>
          📝 {entry.note}
        </div>
      )}
    </div>
  );
};

// ── Department Wellness Card ───────────────────────────────────────────────

export const DeptWellnessCard: React.FC<{ dept: DepartmentWellness }> = ({ dept }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: '1px solid #e5e7eb',
  }}>
    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{dept.department}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
      <div>Wellness: <b style={{ color: dept.avgWellnessScore > 65 ? '#22c55e' : '#eab308' }}>{dept.avgWellnessScore}/100</b></div>
      <div>Engagement: <b>{dept.avgEngagement}/100</b></div>
      <div>Avg Mood: <b>{formatMoodEmoji(dept.avgMood)} {dept.avgMood}/5</b></div>
      <div>Avg Stress: <b style={{ color: dept.avgStress > 6 ? '#ef4444' : '#22c55e' }}>{dept.avgStress}/10</b></div>
      <div>Burnout: <b style={{ color: dept.burnoutCount > 0 ? '#ef4444' : '#22c55e' }}>{dept.burnoutCount}</b> employees</div>
      <div>Participation: <b>{dept.participationRate}%</b></div>
    </div>
    <div style={{ marginTop: 8, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3, width: `${dept.avgWellnessScore}%`,
        background: dept.avgWellnessScore > 70 ? '#22c55e' : dept.avgWellnessScore > 50 ? '#eab308' : '#ef4444',
      }} />
    </div>
  </div>
);
