import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

/* ─────────────────────── MOCK DATA ─────────────────────── */
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Design', 'Operations', 'Legal'];

const MOCK_EMPLOYEES = [
  { id: 1, name: 'Priya Sharma', department: 'Engineering', role: 'Senior Developer', avatar: '👩‍💻', ptoBalance: 18, ptoUsed: 12, overtimeHours: 45, lastLeaveDate: '2026-06-15', stressLevel: 72, engagementScore: 85, tenure: 3.2 },
  { id: 2, name: 'Rahul Verma', department: 'Marketing', role: 'Marketing Lead', avatar: '👨‍💼', ptoBalance: 22, ptoUsed: 8, overtimeHours: 20, lastLeaveDate: '2026-07-20', stressLevel: 45, engagementScore: 92, tenure: 5.1 },
  { id: 3, name: 'Ananya Patel', department: 'Design', role: 'UX Designer', avatar: '👩‍🎨', ptoBalance: 15, ptoUsed: 15, overtimeHours: 55, lastLeaveDate: '2026-05-10', stressLevel: 88, engagementScore: 70, tenure: 1.8 },
  { id: 4, name: 'Vikram Singh', department: 'Finance', role: 'Financial Analyst', avatar: '👨‍💻', ptoBalance: 20, ptoUsed: 10, overtimeHours: 30, lastLeaveDate: '2026-07-01', stressLevel: 55, engagementScore: 88, tenure: 4.0 },
  { id: 5, name: 'Neha Gupta', department: 'HR', role: 'HR Manager', avatar: '👩‍💼', ptoBalance: 25, ptoUsed: 5, overtimeHours: 10, lastLeaveDate: '2026-08-01', stressLevel: 30, engagementScore: 95, tenure: 6.5 },
  { id: 6, name: 'Arjun Mehta', department: 'Engineering', role: 'Tech Lead', avatar: '👨‍💻', ptoBalance: 12, ptoUsed: 18, overtimeHours: 62, lastLeaveDate: '2026-04-20', stressLevel: 92, engagementScore: 65, tenure: 2.5 },
  { id: 7, name: 'Sneha Reddy', department: 'Sales', role: 'Sales Executive', avatar: '👩‍💼', ptoBalance: 16, ptoUsed: 14, overtimeHours: 38, lastLeaveDate: '2026-06-28', stressLevel: 68, engagementScore: 78, tenure: 1.5 },
  { id: 8, name: 'Karthik Nair', department: 'Operations', role: 'Operations Manager', avatar: '👨‍💼', ptoBalance: 21, ptoUsed: 9, overtimeHours: 25, lastLeaveDate: '2026-07-15', stressLevel: 42, engagementScore: 90, tenure: 4.8 },
  { id: 9, name: 'Pooja Joshi', department: 'Legal', role: 'Legal Counsel', avatar: '👩‍⚖️', ptoBalance: 19, ptoUsed: 11, overtimeHours: 35, lastLeaveDate: '2026-06-05', stressLevel: 62, engagementScore: 82, tenure: 3.0 },
  { id: 10, name: 'Aditya Kumar', department: 'Engineering', role: 'DevOps Engineer', avatar: '👨‍💻', ptoBalance: 14, ptoUsed: 16, overtimeHours: 50, lastLeaveDate: '2026-05-25', stressLevel: 85, engagementScore: 72, tenure: 2.0 },
  { id: 11, name: 'Deepika Menon', department: 'Marketing', role: 'Content Strategist', avatar: '👩‍💻', ptoBalance: 24, ptoUsed: 6, overtimeHours: 15, lastLeaveDate: '2026-08-05', stressLevel: 28, engagementScore: 96, tenure: 7.0 },
  { id: 12, name: 'Rohit Das', department: 'Sales', role: 'Regional Head', avatar: '👨‍💼', ptoBalance: 10, ptoUsed: 20, overtimeHours: 48, lastLeaveDate: '2026-05-18', stressLevel: 78, engagementScore: 75, tenure: 2.8 },
  { id: 13, name: 'Meera Iyer', department: 'Design', role: 'Design Lead', avatar: '👩‍🎨', ptoBalance: 23, ptoUsed: 7, overtimeHours: 18, lastLeaveDate: '2026-07-28', stressLevel: 38, engagementScore: 93, tenure: 5.5 },
  { id: 14, name: 'Sanjay Rao', department: 'Finance', role: 'CFO Office', avatar: '👨‍💼', ptoBalance: 17, ptoUsed: 13, overtimeHours: 42, lastLeaveDate: '2026-06-10', stressLevel: 65, engagementScore: 80, tenure: 3.8 },
  { id: 15, name: 'Ishita Banerjee', department: 'Engineering', role: 'Frontend Dev', avatar: '👩‍💻', ptoBalance: 20, ptoUsed: 10, overtimeHours: 28, lastLeaveDate: '2026-07-12', stressLevel: 48, engagementScore: 87, tenure: 2.2 },
];

const WELLNESS_RECOMMENDATIONS = [
  { category: 'Urgent', icon: '🚨', title: 'Mandatory Time-Off', desc: 'Employees with >40 overtime hours should take 3 consecutive days off within 2 weeks.', affected: ['Arjun Mehta', 'Ananya Patel', 'Aditya Kumar', 'Rohit Das'] },
  { category: 'High', icon: '⚠️', title: 'Manager 1:1 Check-in', desc: 'Schedule wellness-focused 1:1s for employees with stress level >75.', affected: ['Priya Sharma', 'Arjun Mehta', 'Ananya Patel', 'Aditya Kumar', 'Rohit Das'] },
  { category: 'Medium', icon: '💡', title: 'PTO Utilization Reminder', desc: 'Employees using <40% PTO balance should plan leave in next quarter.', affected: ['Neha Gupta', 'Deepika Menon', 'Rahul Verma'] },
  { category: 'Info', icon: '📊', title: 'Team Wellness Workshop', desc: 'Schedule quarterly wellness workshops for high-stress departments (Engineering, Sales).', affected: [] },
  { category: 'Medium', icon: '🏃', title: 'Workload Redistribution', desc: 'Redistribute tasks from over-utilized team members to improve work-life balance.', affected: ['Ananya Patel', 'Aditya Kumar'] },
];

const MONTHLY_TRENDS = [
  { month: 'Mar', avgStress: 45, avgEngagement: 88, avgOvertime: 22 },
  { month: 'Apr', avgStress: 52, avgEngagement: 84, avgOvertime: 28 },
  { month: 'May', avgStress: 60, avgEngagement: 80, avgOvertime: 35 },
  { month: 'Jun', avgStress: 65, avgEngagement: 77, avgOvertime: 38 },
  { month: 'Jul', avgStress: 58, avgEngagement: 82, avgOvertime: 30 },
  { month: 'Aug', avgStress: 50, avgEngagement: 86, avgOvertime: 25 },
];

/* ─────────────────────── UTILITY FUNCTIONS ─────────────────────── */
function getBurnoutRisk(emp) {
  if (emp.stressLevel >= 80 || emp.overtimeHours >= 50) return { level: 'Critical', color: '#ef4444', bg: 'bg-red-500/20', text: 'text-red-400' };
  if (emp.stressLevel >= 65 || emp.overtimeHours >= 35) return { level: 'High', color: '#f59e0b', bg: 'bg-amber-500/20', text: 'text-amber-400' };
  if (emp.stressLevel >= 45 || emp.overtimeHours >= 20) return { level: 'Moderate', color: '#3b82f6', bg: 'bg-blue-500/20', text: 'text-blue-400' };
  return { level: 'Low', color: '#22c55e', bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
}

function getWellnessScore(emp) {
  const ptoRatio = (30 - emp.ptoUsed) / 30;
  const stressInverse = (100 - emp.stressLevel) / 100;
  const overtimeInverse = Math.max(0, 1 - emp.overtimeHours / 80);
  return Math.round((ptoRatio * 25 + stressInverse * 40 + overtimeInverse * 20 + (emp.engagementScore / 100) * 15));
}

function getDaysSinceLastLeave(dateStr) {
  const last = new Date(dateStr);
  const now = new Date('2026-08-28');
  return Math.floor((now - last) / (1000 * 60 * 60 * 24));
}

/* ─────────────────────── SVG CHART COMPONENTS ─────────────────────── */
function StressBar({ value, max = 100 }) {
  const color = value >= 80 ? '#ef4444' : value >= 65 ? '#f59e0b' : value >= 45 ? '#3b82f6' : '#22c55e';
  return (
    <div className="w-full bg-gray-700 rounded-full h-2">
      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
    </div>
  );
}

function MiniLineChart({ data, dataKey, color, height = 60 }) {
  const max = Math.max(...data.map(d => d[dataKey]));
  const min = Math.min(...data.map(d => d[dataKey]));
  const range = max - min || 1;
  const width = 200;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d[dataKey] - min) / range) * (height - 10) - 5}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }}>
      <defs>
        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${dataKey})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScoreRing({ score, size = 80 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#374151" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="16" fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: 'center' }}>{score}</text>
    </svg>
  );
}

function DonutChart({ segments, size = 120 }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let acc = 0;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dashArray = `${pct * circumference} ${circumference}`;
        const dashOffset = -(acc * circumference);
        acc += pct;
        return <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={seg.color} strokeWidth="12" strokeDasharray={dashArray} strokeDashoffset={dashOffset} />;
      })}
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" fill="#e5e7eb" fontSize="14" fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: 'center' }}>{total}</text>
    </svg>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function EmployeeWellnessDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');

  const enrichedEmployees = useMemo(() =>
    MOCK_EMPLOYEES.map(emp => ({
      ...emp,
      burnoutRisk: getBurnoutRisk(emp),
      wellnessScore: getWellnessScore(emp),
      daysSinceLeave: getDaysSinceLastLeave(emp.lastLeaveDate),
      ptoUtilization: Math.round((emp.ptoUsed / 30) * 100),
    })),
    []
  );

  const filteredEmployees = useMemo(() =>
    enrichedEmployees.filter(emp => {
      if (searchTerm && !emp.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (deptFilter !== 'All' && emp.department !== deptFilter) return false;
      if (riskFilter !== 'All' && emp.burnoutRisk.level !== riskFilter) return false;
      return true;
    }),
    [enrichedEmployees, searchTerm, deptFilter, riskFilter]
  );

  const stats = useMemo(() => {
    const total = enrichedEmployees.length;
    const critical = enrichedEmployees.filter(e => e.burnoutRisk.level === 'Critical').length;
    const high = enrichedEmployees.filter(e => e.burnoutRisk.level === 'High').length;
    const avgStress = Math.round(enrichedEmployees.reduce((s, e) => s + e.stressLevel, 0) / total);
    const avgEngagement = Math.round(enrichedEmployees.reduce((s, e) => s + e.engagementScore, 0) / total);
    const avgWellness = Math.round(enrichedEmployees.reduce((s, e) => s + e.wellnessScore, 0) / total);
    const totalOvertime = enrichedEmployees.reduce((s, e) => s + e.overtimeHours, 0);
    return { total, critical, high, avgStress, avgEngagement, avgWellness, totalOvertime };
  }, [enrichedEmployees]);

  const deptStats = useMemo(() => {
    const map = {};
    DEPARTMENTS.forEach(d => { map[d] = { count: 0, stress: 0, engagement: 0, overtime: 0 }; });
    enrichedEmployees.forEach(e => {
      map[e.department].count++;
      map[e.department].stress += e.stressLevel;
      map[e.department].engagement += e.engagementScore;
      map[e.department].overtime += e.overtimeHours;
    });
    return Object.entries(map)
      .filter(([, v]) => v.count > 0)
      .map(([dept, v]) => ({
        dept,
        count: v.count,
        avgStress: Math.round(v.stress / v.count),
        avgEngagement: Math.round(v.engagement / v.count),
        avgOvertime: Math.round(v.overtime / v.count),
      }))
      .sort((a, b) => b.avgStress - a.avgStress);
  }, [enrichedEmployees]);

  const riskDistribution = useMemo(() => {
    const counts = { Critical: 0, High: 0, Moderate: 0, Low: 0 };
    enrichedEmployees.forEach(e => counts[e.burnoutRisk.level]++);
    return [
      { label: 'Critical', value: counts.Critical, color: '#ef4444' },
      { label: 'High', value: counts.High, color: '#f59e0b' },
      { label: 'Moderate', value: counts.Moderate, color: '#3b82f6' },
      { label: 'Low', value: counts.Low, color: '#22c55e' },
    ];
  }, [enrichedEmployees]);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'employees', label: '👥 Employees' },
    { id: 'departments', label: '🏢 Departments' },
    { id: 'recommendations', label: '💡 Recommendations' },
    { id: 'trends', label: '📈 Trends' },
  ];

  return (
    <>
      <Helmet>
        <title>Employee Wellness Dashboard — PaySphere</title>
      </Helmet>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🩺 Employee Wellness Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track burnout risk, PTO utilization, and team wellbeing metrics</p>
            </div>
            <ThemeToggle />
          </div>

          {/* TAB NAV */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══════════ OVERVIEW TAB ═══════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Avg Wellness Score</div>
                  <div className="flex items-center gap-3 mt-2">
                    <ScoreRing score={stats.avgWellness} size={60} />
                    <div className={`text-lg font-bold ${stats.avgWellness >= 70 ? 'text-emerald-500' : stats.avgWellness >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{stats.avgWellness}/100</div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400">🔴 Critical Risk</div>
                  <div className="text-2xl font-bold text-red-500 mt-1">{stats.critical}</div>
                  <div className="text-[10px] text-gray-400">of {stats.total} employees</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400">⚠️ High Risk</div>
                  <div className="text-2xl font-bold text-amber-500 mt-1">{stats.high}</div>
                  <div className="text-[10px] text-gray-400">need attention</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500 dark:text-gray-400">⏱️ Total Overtime</div>
                  <div className="text-2xl font-bold text-blue-500 mt-1">{stats.totalOvertime}h</div>
                  <div className="text-[10px] text-gray-400">across all teams</div>
                </div>
              </div>

              {/* SECOND ROW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">🎯 Risk Distribution</h3>
                  <div className="flex justify-center"><DonutChart segments={riskDistribution} size={140} /></div>
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {riskDistribution.map(s => (
                      <div key={s.label} className="flex items-center gap-1 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-500 dark:text-gray-400">{s.label}: {s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📊 Top Stress Departments</h3>
                  <div className="space-y-3">
                    {deptStats.slice(0, 5).map(d => (
                      <div key={d.dept}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 dark:text-gray-300">{d.dept}</span>
                          <span className={`font-bold ${d.avgStress >= 65 ? 'text-red-400' : d.avgStress >= 45 ? 'text-amber-400' : 'text-emerald-400'}`}>{d.avgStress}%</span>
                        </div>
                        <StressBar value={d.avgStress} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📈 Wellness Trend (6 months)</h3>
                  <MiniLineChart data={MONTHLY_TRENDS} dataKey="avgStress" color="#ef4444" height={80} />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                    {MONTHLY_TRENDS.map(t => <span key={t.month}>{t.month}</span>)}
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-red-400">● Stress</span><span className="text-gray-400">{MONTHLY_TRENDS[MONTHLY_TRENDS.length - 1].avgStress}%</span></div>
                    <div className="flex justify-between"><span className="text-emerald-400">● Engagement</span><span className="text-gray-400">{MONTHLY_TRENDS[MONTHLY_TRENDS.length - 1].avgEngagement}%</span></div>
                    <div className="flex justify-between"><span className="text-blue-400">● Overtime</span><span className="text-gray-400">{MONTHLY_TRENDS[MONTHLY_TRENDS.length - 1].avgOvertime}h avg</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ EMPLOYEES TAB ═══════════ */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <input type="text" placeholder="Search employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm w-64" />
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  <option value="All">All Risk Levels</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map(emp => (
                  <div key={emp.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{emp.avatar}</div>
                        <div>
                          <h4 className="text-sm font-bold">{emp.name}</h4>
                          <div className="text-[10px] text-gray-500">{emp.role} · {emp.department}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.burnoutRisk.bg} ${emp.burnoutRisk.text}`}>{emp.burnoutRisk.level}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <ScoreRing score={emp.wellnessScore} size={50} />
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Stress</span><span className="font-bold">{emp.stressLevel}%</span></div>
                        <StressBar value={emp.stressLevel} />
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Engagement</span><span className="font-bold">{emp.engagementScore}%</span></div>
                        <StressBar value={emp.engagementScore} />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs font-bold">{emp.ptoBalance}d</div>
                        <div className="text-[9px] text-gray-500">PTO Left</div>
                      </div>
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs font-bold text-amber-500">{emp.overtimeHours}h</div>
                        <div className="text-[9px] text-gray-500">Overtime</div>
                      </div>
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs font-bold">{emp.daysSinceLeave}d</div>
                        <div className="text-[9px] text-gray-500">Since Leave</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ DEPARTMENTS TAB ═══════════ */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              {deptStats.map(d => (
                <div key={d.dept} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">{d.dept}</h3>
                    <span className="text-xs text-gray-500">{d.count} employees</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Avg Stress</div>
                      <div className={`text-lg font-bold ${d.avgStress >= 65 ? 'text-red-500' : d.avgStress >= 45 ? 'text-amber-500' : 'text-emerald-500'}`}>{d.avgStress}%</div>
                      <StressBar value={d.avgStress} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Avg Engagement</div>
                      <div className="text-lg font-bold text-blue-500">{d.avgEngagement}%</div>
                      <StressBar value={d.avgEngagement} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Avg Overtime</div>
                      <div className={`text-lg font-bold ${d.avgOvertime >= 40 ? 'text-red-500' : d.avgOvertime >= 25 ? 'text-amber-500' : 'text-emerald-500'}`}>{d.avgOvertime}h</div>
                      <StressBar value={d.avgOvertime} max={80} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════════ RECOMMENDATIONS TAB ═══════════ */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {WELLNESS_RECOMMENDATIONS.map((rec, i) => {
                const severityColors = { Urgent: 'border-red-500 bg-red-500/10', High: 'border-amber-500 bg-amber-500/10', Medium: 'border-blue-500 bg-blue-500/10', Info: 'border-gray-500 bg-gray-500/10' };
                return (
                  <div key={i} className={`p-5 rounded-2xl border ${severityColors[rec.category]}`}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{rec.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold">{rec.title}</h4>
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-[10px] font-bold">{rec.category}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{rec.desc}</p>
                        {rec.affected.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rec.affected.map(name => <span key={name} className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[10px]">{name}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════════ TRENDS TAB ═══════════ */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-4">📉 6-Month Wellness Trends</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-red-400 font-bold mb-2">🔴 Average Stress Level</div>
                    <svg viewBox="0 0 200 100" className="w-full" style={{ height: '120px' }}>
                      <defs><linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0" /></linearGradient></defs>
                      <polygon points={`0,100 ${MONTHLY_TRENDS.map((t, i) => `${(i / 5) * 200},${100 - t.avgStress}`).join(' ')} 200,100`} fill="url(#stressGrad)" />
                      <polyline points={MONTHLY_TRENDS.map((t, i) => `${(i / 5) * 200},${100 - t.avgStress}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="2" />
                    </svg>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">{MONTHLY_TRENDS.map(t => <span key={t.month}>{t.month}</span>)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-emerald-400 font-bold mb-2">🟢 Engagement Score</div>
                    <svg viewBox="0 0 200 100" className="w-full" style={{ height: '120px' }}>
                      <defs><linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" /></linearGradient></defs>
                      <polygon points={`0,100 ${MONTHLY_TRENDS.map((t, i) => `${(i / 5) * 200},${100 - (t.avgEngagement - 70) * 3.33}`).join(' ')} 200,100`} fill="url(#engGrad)" />
                      <polyline points={MONTHLY_TRENDS.map((t, i) => `${(i / 5) * 200},${100 - (t.avgEngagement - 70) * 3.33}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth="2" />
                    </svg>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">{MONTHLY_TRENDS.map(t => <span key={t.month}>{t.month}</span>)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-400 font-bold mb-2">🔵 Overtime Hours (avg)</div>
                    <svg viewBox="0 0 200 100" className="w-full" style={{ height: '120px' }}>
                      <defs><linearGradient id="otGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
                      <polygon points={`0,100 ${MONTHLY_TRENDS.map((t, i) => `${(i / 5) * 200},${100 - t.avgOvertime * 2}`).join(' ')} 200,100`} fill="url(#otGrad)" />
                      <polyline points={MONTHLY_TRENDS.map((t, i) => `${(i / 5) * 200},${100 - t.avgOvertime * 2}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" />
                    </svg>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">{MONTHLY_TRENDS.map(t => <span key={t.month}>{t.month}</span>)}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">📋 Key Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                    <span className="font-bold text-red-600 dark:text-red-400">Burnout Alert:</span> <span className="text-gray-600 dark:text-gray-300">3 employees are in critical burnout risk. Engineering and Sales departments show highest stress levels.</span>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Positive Trend:</span> <span className="text-gray-600 dark:text-gray-300">Overall wellness scores improved by 15% from May to August. Stress levels decreased after the Q2 wellness initiative.</span>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <span className="font-bold text-amber-600 dark:text-amber-400">PTO Gap:</span> <span className="text-gray-600 dark:text-gray-300">5 employees have used less than 50% of their PTO balance. Mandatory leave policy should be considered.</span>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <span className="font-bold text-blue-600 dark:text-blue-400">Overtime Spike:</span> <span className="text-gray-600 dark:text-gray-300">Total overtime across the company is {stats.totalOvertime}h. Engineering accounts for the highest with 185h.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
