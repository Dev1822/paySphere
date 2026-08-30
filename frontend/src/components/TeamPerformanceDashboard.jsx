import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

/* ─────────────────────── MOCK DATA ─────────────────────── */
const TEAMS = [
  { id: 1, name: 'Engineering', lead: 'Arjun Mehta', members: 24, avatar: '⚙️' },
  { id: 2, name: 'Marketing', lead: 'Rahul Verma', members: 12, avatar: '📣' },
  { id: 3, name: 'Sales', lead: 'Rohit Das', members: 18, avatar: '💼' },
  { id: 4, name: 'Design', lead: 'Ananya Patel', members: 8, avatar: '🎨' },
  { id: 5, name: 'Finance', lead: 'Vikram Singh', members: 10, avatar: '💰' },
  { id: 6, name: 'HR', lead: 'Neha Gupta', members: 6, avatar: '👥' },
];

const OKRS = [
  { id: 1, team: 'Engineering', objective: 'Ship v3.0 platform by Q4', keyResults: [
    { id: 'kr1', text: 'Complete 100% API migration', progress: 82, target: 100, status: 'on-track' },
    { id: 'kr2', text: 'Achieve 99.9% uptime SLA', progress: 99.7, target: 99.9, status: 'at-risk' },
    { id: 'kr3', text: 'Reduce P95 latency to <200ms', progress: 75, target: 100, status: 'on-track' },
    { id: 'kr4', text: 'Launch 5 new microservices', progress: 3, target: 5, status: 'behind' },
  ], overallProgress: 64, quarter: 'Q3 2026' },
  { id: 2, team: 'Marketing', objective: 'Double inbound pipeline by year-end', keyResults: [
    { id: 'kr5', text: 'Generate 2,000 MQLs per month', progress: 1650, target: 2000, status: 'on-track' },
    { id: 'kr6', text: 'Launch 3 new campaign channels', progress: 2, target: 3, status: 'on-track' },
    { id: 'kr7', text: 'Increase blog traffic 40%', progress: 32, target: 40, status: 'on-track' },
    { id: 'kr8', text: 'Achieve 5% landing page conversion', progress: 4.2, target: 5, status: 'at-risk' },
  ], overallProgress: 72, quarter: 'Q3 2026' },
  { id: 3, team: 'Sales', objective: 'Close $2M in new ARR', keyResults: [
    { id: 'kr9', text: 'Close 40 new enterprise deals', progress: 28, target: 40, status: 'on-track' },
    { id: 'kr10', text: 'Achieve 120% quota attainment', progress: 105, target: 120, status: 'on-track' },
    { id: 'kr11', text: 'Reduce sales cycle to 45 days', progress: 52, target: 45, status: 'behind' },
    { id: 'kr12', text: 'Increase deal size 25%', progress: 18, target: 25, status: 'on-track' },
  ], overallProgress: 78, quarter: 'Q3 2026' },
  { id: 4, team: 'Design', objective: 'Launch new design system', keyResults: [
    { id: 'kr13', text: 'Create 50+ component library', progress: 42, target: 50, status: 'on-track' },
    { id: 'kr14', text: 'Achieve 90% design consistency score', progress: 85, target: 90, status: 'on-track' },
    { id: 'kr15', text: 'Reduce design-to-dev handoff time 50%', progress: 35, target: 50, status: 'on-track' },
  ], overallProgress: 80, quarter: 'Q3 2026' },
];

const SPRINTS = [
  { id: 1, name: 'Sprint 22', team: 'Engineering', startDate: '2026-08-04', endDate: '2026-08-18', status: 'Active', planned: 45, completed: 32, inProgress: 8, blocked: 5, velocity: 38, pointsDelivered: 156 },
  { id: 2, name: 'Sprint 21', team: 'Engineering', startDate: '2026-07-21', endDate: '2026-08-04', status: 'Completed', planned: 42, completed: 40, inProgress: 0, blocked: 2, velocity: 40, pointsDelivered: 168 },
  { id: 3, name: 'Sprint 20', team: 'Engineering', startDate: '2026-07-07', endDate: '2026-07-21', status: 'Completed', planned: 38, completed: 35, inProgress: 0, blocked: 3, velocity: 35, pointsDelivered: 147 },
  { id: 4, name: 'Sprint 19', team: 'Engineering', startDate: '2026-06-23', endDate: '2026-07-07', status: 'Completed', planned: 40, completed: 36, inProgress: 0, blocked: 4, velocity: 36, pointsDelivered: 150 },
  { id: 5, name: 'Mkt Sprint 8', team: 'Marketing', startDate: '2026-08-01', endDate: '2026-08-15', status: 'Active', planned: 20, completed: 14, inProgress: 4, blocked: 2, velocity: 18, pointsDelivered: 72 },
  { id: 6, name: 'Sales Sprint Q3', team: 'Sales', startDate: '2026-07-01', endDate: '2026-09-30', status: 'Active', planned: 60, completed: 42, inProgress: 12, blocked: 6, velocity: 50, pointsDelivered: 210 },
];

const TEAM_HEALTH = [
  { team: 'Engineering', engagement: 72, satisfaction: 68, workload: 85, collaboration: 78, burnoutRisk: 62 },
  { team: 'Marketing', engagement: 88, satisfaction: 82, workload: 65, collaboration: 90, burnoutRisk: 35 },
  { team: 'Sales', engagement: 75, satisfaction: 70, workload: 90, collaboration: 72, burnoutRisk: 68 },
  { team: 'Design', engagement: 92, satisfaction: 88, workload: 55, collaboration: 95, burnoutRisk: 25 },
  { team: 'Finance', engagement: 80, satisfaction: 75, workload: 70, collaboration: 76, burnoutRisk: 40 },
  { team: 'HR', engagement: 85, satisfaction: 80, workload: 60, collaboration: 88, burnoutRisk: 30 },
];

const VELOCITY_HISTORY = [
  { sprint: 'S19', engineering: 36, marketing: 15, sales: 42 },
  { sprint: 'S20', engineering: 35, marketing: 17, sales: 45 },
  { sprint: 'S21', engineering: 40, marketing: 18, sales: 48 },
  { sprint: 'S22', engineering: 38, marketing: 18, sales: 50 },
];

/* ─────────────────────── SVG CHART COMPONENTS ─────────────────────── */
function ProgressRing({ value, size = 70, strokeWidth = 6, label }) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 75 ? '#22c55e' : value >= 50 ? '#3b82f6' : value >= 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="text-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#374151" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="14" fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: 'center' }}>{value}%</text>
      </svg>
      {label && <div className="text-[10px] text-gray-500 mt-1">{label}</div>}
    </div>
  );
}

function HealthBar({ value, color, label }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function VelocityChart({ data, height = 120 }) {
  const max = Math.max(...data.flatMap(d => [d.engineering, d.marketing, d.sales]));
  const barW = Math.floor(280 / data.length);
  return (
    <svg viewBox="0 0 280 120" className="w-full" style={{ height: `${height}px` }}>
      {data.map((d, i) => {
        const x = i * barW + 8;
        const bw = (barW - 24) / 3;
        const hEng = (d.engineering / max) * 80;
        const hMkt = (d.marketing / max) * 80;
        const hSales = (d.sales / max) * 80;
        return (
          <g key={i}>
            <rect x={x} y={100 - hEng} width={bw} height={hEng} rx="3" fill="#a855f7" opacity="0.8" />
            <rect x={x + bw + 2} y={100 - hMkt} width={bw} height={hMkt} rx="3" fill="#22c55e" opacity="0.8" />
            <rect x={x + (bw + 2) * 2} y={100 - hSales} width={bw} height={hSales} rx="3" fill="#3b82f6" opacity="0.8" />
            <text x={x + barW / 2 - 8} y={115} textAnchor="middle" fill="#9ca3af" fontSize="8">{d.sprint}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function TeamPerformanceDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTeam, setSelectedTeam] = useState('All');

  const filteredOKRs = useMemo(() =>
    selectedTeam === 'All' ? OKRS : OKRS.filter(o => o.team === selectedTeam),
    [selectedTeam]
  );

  const filteredSprints = useMemo(() =>
    selectedTeam === 'All' ? SPRINTS : SPRINTS.filter(s => s.team === selectedTeam),
    [selectedTeam]
  );

  const activeSprints = SPRINTS.filter(s => s.status === 'Active');
  const avgOKR = Math.round(OKRS.reduce((s, o) => s + o.overallProgress, 0) / OKRS.length);
  const avgHealth = Math.round(TEAM_HEALTH.reduce((s, t) => s + t.engagement, 0) / TEAM_HEALTH.length);
  const totalStories = activeSprints.reduce((s, sp) => s + sp.planned, 0);
  const completedStories = activeSprints.reduce((s, sp) => s + sp.completed, 0);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'okrs', label: '🎯 OKR Tracker' },
    { id: 'sprints', label: '🏃 Sprint Analytics' },
    { id: 'health', label: '💚 Team Health' },
  ];

  return (
    <>
      <Helmet><title>Team Performance Dashboard — PaySphere</title></Helmet>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📊 Team Performance Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">OKR tracking, sprint analytics, velocity trends, and team health metrics</p>
            </div>
            <ThemeToggle />
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-purple-500">{avgOKR}%</div>
              <div className="text-xs text-gray-500">Avg OKR Progress</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-emerald-500">{activeSprints.length}</div>
              <div className="text-xs text-gray-500">Active Sprints</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-blue-500">{completedStories}/{totalStories}</div>
              <div className="text-xs text-gray-500">Stories Completed</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-amber-500">{avgHealth}%</div>
              <div className="text-xs text-gray-500">Avg Team Engagement</div>
            </div>
          </div>

          {/* TEAM FILTER + TAB NAV */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
              <option value="All">All Teams</option>
              {TEAMS.map(t => <option key={t.id} value={t.name}>{t.avatar} {t.name}</option>)}
            </select>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════ OVERVIEW TAB ═══════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TEAMS.slice(0, 6).map(team => {
                  const okr = OKRS.find(o => o.team === team.name);
                  const health = TEAM_HEALTH.find(h => h.team === team.name);
                  const sprint = SPRINTS.find(s => s.team === team.name && s.status === 'Active');
                  return (
                    <div key={team.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{team.avatar}</span>
                        <div>
                          <h4 className="text-sm font-bold">{team.name}</h4>
                          <div className="text-[10px] text-gray-500">{team.lead} · {team.members} members</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {okr ? <ProgressRing value={okr.overallProgress} size={60} label="OKR" /> : <div className="text-xs text-gray-400">No OKRs</div>}
                        {health && (
                          <div className="flex-1 ml-4 space-y-1">
                            <HealthBar value={health.engagement} color="#a855f7" label="Engagement" />
                            <HealthBar value={health.collaboration} color="#22c55e" label="Collaboration" />
                          </div>
                        )}
                      </div>
                      {sprint && (
                        <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px]">
                          <span className="font-bold text-purple-400">{sprint.name}</span> · {sprint.completed}/{sprint.planned} stories · {sprint.velocity} velocity
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">📈 Team Velocity Trends</h3>
                <VelocityChart data={VELOCITY_HISTORY} height={120} />
                <div className="flex justify-center gap-6 mt-2">
                  <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-purple-500" /> Engineering</div>
                  <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-emerald-500" /> Marketing</div>
                  <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-blue-500" /> Sales</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ OKR TAB ═══════════ */}
          {activeTab === 'okrs' && (
            <div className="space-y-4">
              {filteredOKRs.map(okr => (
                <div key={okr.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-[10px] text-purple-400 uppercase font-bold">{okr.team} · {okr.quarter}</div>
                      <h3 className="text-sm font-bold mt-1">{okr.objective}</h3>
                    </div>
                    <ProgressRing value={okr.overallProgress} size={60} />
                  </div>
                  <div className="space-y-3">
                    {okr.keyResults.map(kr => {
                      const pct = typeof kr.target === 'number' && kr.target > 1 ? Math.min(Math.round((kr.progress / kr.target) * 100), 100) : Math.round(kr.progress);
                      const statusColors = { 'on-track': 'text-emerald-400 bg-emerald-500/20', 'at-risk': 'text-amber-400 bg-amber-500/20', 'behind': 'text-red-400 bg-red-500/20' };
                      const barColors = { 'on-track': '#22c55e', 'at-risk': '#f59e0b', 'behind': '#ef4444' };
                      return (
                        <div key={kr.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 dark:text-gray-300">{kr.text}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColors[kr.status]}`}>{kr.status}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColors[kr.status] }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: barColors[kr.status] }}>{pct}%</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">{kr.progress} / {kr.target}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════════ SPRINTS TAB ═══════════ */}
          {activeTab === 'sprints' && (
            <div className="space-y-4">
              {filteredSprints.map(sprint => {
                const completionPct = sprint.planned > 0 ? Math.round((sprint.completed / sprint.planned) * 100) : 0;
                return (
                  <div key={sprint.id} className={`bg-white dark:bg-gray-900 p-5 rounded-2xl border shadow-sm ${sprint.status === 'Active' ? 'border-purple-500/50 ring-1 ring-purple-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">{sprint.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sprint.status === 'Active' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>{sprint.status}</span>
                        <span className="text-[10px] text-gray-500">{sprint.team}</span>
                      </div>
                      <div className="text-xs text-gray-500">{sprint.startDate} → {sprint.endDate}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-lg font-bold text-emerald-500">{sprint.completed}</div>
                        <div className="text-[10px] text-gray-500">Completed</div>
                      </div>
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-lg font-bold text-blue-500">{sprint.inProgress}</div>
                        <div className="text-[10px] text-gray-500">In Progress</div>
                      </div>
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-lg font-bold text-red-500">{sprint.blocked}</div>
                        <div className="text-[10px] text-gray-500">Blocked</div>
                      </div>
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-lg font-bold text-purple-500">{sprint.velocity}</div>
                        <div className="text-[10px] text-gray-500">Velocity</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                        <div className="h-3 rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-400">{completionPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════════ HEALTH TAB ═══════════ */}
          {activeTab === 'health' && (
            <div className="space-y-4">
              {TEAM_HEALTH.map(h => {
                const overallScore = Math.round((h.engagement + h.satisfaction + h.collaboration + (100 - h.burnoutRisk) + (100 - h.workload)) / 5);
                return (
                  <div key={h.team} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{TEAMS.find(t => t.name === h.team)?.avatar}</span>
                        <h3 className="text-sm font-bold">{h.team}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProgressRing value={overallScore} size={50} strokeWidth={4} />
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Health Score</div>
                          <div className={`text-sm font-bold ${overallScore >= 75 ? 'text-emerald-400' : overallScore >= 50 ? 'text-blue-400' : 'text-amber-400'}`}>{overallScore}/100</div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <HealthBar value={h.engagement} color="#a855f7" label="Engagement" />
                      <HealthBar value={h.satisfaction} color="#3b82f6" label="Satisfaction" />
                      <HealthBar value={h.workload} color={h.workload >= 80 ? '#ef4444' : '#22c55e'} label="Workload" />
                      <HealthBar value={h.collaboration} color="#06b6d4" label="Collaboration" />
                      <HealthBar value={h.burnoutRisk} color={h.burnoutRisk >= 60 ? '#ef4444' : '#22c55e'} label="Burnout Risk" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
