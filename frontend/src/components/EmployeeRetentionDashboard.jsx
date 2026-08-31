import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

/* ─────────────────── MOCK DATA ─────────────────── */
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Design', 'Operations', 'Legal'];

const MOCK_EMPLOYEES = [
  { id: 1, name: 'Priya Sharma', dept: 'Engineering', role: 'Senior Developer', joinDate: '2022-03-15', status: 'Active', lastReview: 88, salary: 1800000, age: 29 },
  { id: 2, name: 'Rahul Verma', dept: 'Marketing', role: 'Marketing Lead', joinDate: '2020-06-01', status: 'Active', lastReview: 92, salary: 1500000, age: 34 },
  { id: 3, name: 'Ananya Patel', dept: 'Design', role: 'UX Designer', joinDate: '2024-10-12', status: 'Active', lastReview: 70, salary: 1100000, age: 26 },
  { id: 4, name: 'Vikram Singh', dept: 'Finance', role: 'Financial Analyst', joinDate: '2021-09-20', status: 'Active', lastReview: 85, salary: 1350000, age: 31 },
  { id: 5, name: 'Neha Gupta', dept: 'HR', role: 'HR Manager', joinDate: '2019-01-10', status: 'Active', lastReview: 95, salary: 1600000, age: 37 },
  { id: 6, name: 'Arjun Mehta', dept: 'Engineering', role: 'Tech Lead', joinDate: '2023-04-01', status: 'Active', lastReview: 65, salary: 2100000, age: 32 },
  { id: 7, name: 'Sneha Reddy', dept: 'Sales', role: 'Sales Executive', joinDate: '2025-01-15', status: 'Active', lastReview: 78, salary: 900000, age: 24 },
  { id: 8, name: 'Karthik Nair', dept: 'Operations', role: 'Ops Manager', joinDate: '2018-11-22', status: 'Active', lastReview: 90, salary: 1700000, age: 40 },
  { id: 9, name: 'Pooja Joshi', dept: 'Legal', role: 'Legal Counsel', joinDate: '2021-07-05', status: 'Active', lastReview: 82, salary: 1900000, age: 33 },
  { id: 10, name: 'Aditya Kumar', dept: 'Engineering', role: 'DevOps Engineer', joinDate: '2024-03-18', status: 'Active', lastReview: 72, salary: 1200000, age: 27 },
  { id: 11, name: 'Deepika Menon', dept: 'Marketing', role: 'Content Strategist', joinDate: '2017-05-09', status: 'Active', lastReview: 96, salary: 1400000, age: 38 },
  { id: 12, name: 'Rohit Das', dept: 'Sales', role: 'Regional Head', joinDate: '2022-08-14', status: 'Active', lastReview: 75, salary: 1650000, age: 35 },
  { id: 13, name: 'Meera Iyer', dept: 'Design', role: 'Design Lead', joinDate: '2019-12-03', status: 'Active', lastReview: 93, salary: 1550000, age: 36 },
  { id: 14, name: 'Sanjay Rao', dept: 'Finance', role: 'CFO Office', joinDate: '2020-02-28', status: 'Active', lastReview: 80, salary: 2200000, age: 42 },
  { id: 15, name: 'Ishita Banerjee', dept: 'Engineering', role: 'Frontend Dev', joinDate: '2023-09-01', status: 'Active', lastReview: 87, salary: 1050000, age: 25 },
  { id: 16, name: 'Vivek Tiwari', dept: 'Engineering', role: 'QA Engineer', joinDate: '2025-04-10', status: 'Active', lastReview: 68, salary: 850000, age: 23 },
  { id: 17, name: 'Shruti Kulkarni', dept: 'Sales', role: 'Account Executive', joinDate: '2021-11-17', status: 'Active', lastReview: 88, salary: 1100000, age: 28 },
  { id: 18, name: 'Ravi Shankar', dept: 'Operations', role: 'Logistics Lead', joinDate: '2024-06-20', status: 'Departed', lastReview: 60, salary: 950000, age: 30, exitDate: '2026-08-28' },
  { id: 19, name: 'Kavita Deshmukh', dept: 'HR', role: 'Recruiter', joinDate: '2023-01-09', status: 'Active', lastReview: 84, salary: 900000, age: 27 },
  { id: 20, name: 'Manish Pandey', dept: 'Finance', role: 'Accounts Payable', joinDate: '2025-07-01', status: 'Active', lastReview: 74, salary: 750000, age: 24 },
];

const TREND_DATA = [
  { year: '2022', hires: 28, exits: 6, retention: 89 },
  { year: '2023', hires: 35, exits: 8, retention: 87 },
  { year: '2024', hires: 30, exits: 10, retention: 85 },
  { year: '2025', hires: 22, exits: 5, retention: 91 },
  { year: '2026', hires: 18, exits: 3, retention: 94 },
];

const EXIT_REASONS = [
  { reason: 'Better opportunity', count: 14, pct: 35 },
  { reason: 'Relocation', count: 6, pct: 15 },
  { reason: 'Career change', count: 5, pct: 12 },
  { reason: 'Compensation', count: 4, pct: 10 },
  { reason: 'Work culture', count: 3, pct: 8 },
  { reason: 'Personal reasons', count: 3, pct: 8 },
  { reason: 'Contract ended', count: 3, pct: 7 },
  { reason: 'Performance', count: 2, pct: 5 },
];

/* ─────────────────── UTILITIES ─────────────────── */
function tenureMonths(joinDate) {
  const joined = new Date(joinDate);
  const now = new Date('2026-08-30');
  return Math.floor((now - joined) / (1000 * 60 * 60 * 24 * 30.44));
}

function tenureBand(months) {
  if (months < 6) return { label: '<6mo', color: '#ef4444' };
  if (months < 12) return { label: '6-12mo', color: '#f59e0b' };
  if (months < 24) return { label: '1-2yr', color: '#3b82f6' };
  if (months < 36) return { label: '2-3yr', color: '#8b5cf6' };
  if (months < 60) return { label: '3-5yr', color: '#22c55e' };
  return { label: '5yr+', color: '#06b6d4' };
}

function retentionRisk(emp) {
  const months = tenureMonths(emp.joinDate);
  let score = 0;
  if (months < 6) score += 30;
  else if (months < 12) score += 15;
  if (emp.lastReview < 70) score += 35;
  else if (emp.lastReview < 80) score += 15;
  if (months > 48 && emp.lastReview > 90) score += 10;
  if (score >= 50) return { label: 'High', color: '#ef4444', bg: 'bg-red-500/20', text: 'text-red-400' };
  if (score >= 25) return { label: 'Medium', color: '#f59e0b', bg: 'bg-amber-500/20', text: 'text-amber-400' };
  return { label: 'Low', color: '#22c55e', bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
}

function formatCurrency(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}K`;
}

/* ─────────────────── SVG CHARTS ─────────────────── */
function DonutChart({ segments, size = 130 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let acc = 0;
  const r = (size - 18) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = `${pct * circ} ${circ}`;
        const offset = -(acc * circ);
        acc += pct;
        return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={dash} strokeDashoffset={offset} />;
      })}
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" fill="#e5e7eb" fontSize="16" fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: 'center' }}>{total}</text>
    </svg>
  );
}

function BarChart({ data, height = 120, colorKey = 'retention' }) {
  const max = Math.max(...data.map(d => d[colorKey]), 1);
  const barW = Math.floor(300 / data.length);
  return (
    <svg viewBox={`0 0 300 ${height}`} className="w-full" style={{ height: `${height}px` }}>
      {data.map((d, i) => {
        const h = (d[colorKey] / max) * (height - 25);
        const c = colorKey === 'retention' ? '#22c55e' : colorKey === 'hires' ? '#3b82f6' : '#ef4444';
        return (
          <g key={i}>
            <rect x={i * barW + 10} y={height - h - 18} width={barW - 20} height={h} rx="4" fill={c} opacity="0.8" />
            <text x={i * barW + barW / 2} y={height - h - 22} textAnchor="middle" fill={c} fontSize="10" fontWeight="bold">{d[colorKey]}</text>
            <text x={i * barW + barW / 2} y={height - 4} textAnchor="middle" fill="#9ca3af" fontSize="9">{d.year}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SparkLine({ data, color = '#3b82f6', width = 180, height = 40 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 5 - ((v - min) / range) * (height - 10)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: `${height}px` }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-24 truncate">{label}</span>
      <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

/* ─────────────────── MAIN COMPONENT ─────────────────── */
export default function EmployeeRetentionDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [deptFilter, setDeptFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');

  const enriched = useMemo(() =>
    MOCK_EMPLOYEES.filter(e => e.status === 'Active').map(e => ({
      ...e,
      tenure: tenureMonths(e.joinDate),
      band: tenureBand(tenureMonths(e.joinDate)),
      risk: retentionRisk(e),
    })),
    []
  );

  const filtered = useMemo(() =>
    enriched.filter(e => {
      if (deptFilter !== 'All' && e.dept !== deptFilter) return false;
      if (riskFilter !== 'All' && e.risk.label !== riskFilter) return false;
      return true;
    }),
    [enriched, deptFilter, riskFilter]
  );

  const stats = useMemo(() => {
    const active = enriched.length;
    const highRisk = enriched.filter(e => e.risk.label === 'High').length;
    const medRisk = enriched.filter(e => e.risk.label === 'Medium').length;
    const avgTenure = Math.round(enriched.reduce((s, e) => s + e.tenure, 0) / active);
    const avgReview = Math.round(enriched.reduce((s, e) => s + e.lastReview, 0) / active);
    const totalPayroll = enriched.reduce((s, e) => s + e.salary, 0);
    const avgSalary = Math.round(totalPayroll / active);
    const under1yr = enriched.filter(e => e.tenure < 12).length;
    return { active, highRisk, medRisk, avgTenure, avgReview, totalPayroll, avgSalary, under1yr };
  }, [enriched]);

  const deptStats = useMemo(() => {
    const map = {};
    DEPARTMENTS.forEach(d => { map[d] = { count: 0, totalTenure: 0, totalReview: 0, totalSalary: 0, highRisk: 0 }; });
    enriched.forEach(e => {
      map[e.dept].count++;
      map[e.dept].totalTenure += e.tenure;
      map[e.dept].totalReview += e.lastReview;
      map[e.dept].totalSalary += e.salary;
      if (e.risk.label === 'High') map[e.dept].highRisk++;
    });
    return Object.entries(map)
      .filter(([, v]) => v.count > 0)
      .map(([dept, v]) => ({
        dept,
        count: v.count,
        avgTenure: Math.round(v.totalTenure / v.count),
        avgReview: Math.round(v.totalReview / v.count),
        avgSalary: Math.round(v.totalSalary / v.count),
        highRisk: v.highRisk,
      }))
      .sort((a, b) => b.avgTenure - a.avgTenure);
  }, [enriched]);

  const tenureBands = useMemo(() => {
    const bands = {};
    enriched.forEach(e => {
      const b = e.band.label;
      bands[b] = (bands[b] || 0) + 1;
    });
    const order = ['<6mo', '6-12mo', '1-2yr', '2-3yr', '3-5yr', '5yr+'];
    return order.filter(b => bands[b]).map(b => ({ label: b, value: bands[b], color: tenureBand(0).color }));
  }, [enriched]);

  const riskSegments = useMemo(() => [
    { label: 'High', value: stats.highRisk, color: '#ef4444' },
    { label: 'Medium', value: stats.medRisk, color: '#f59e0b' },
    { label: 'Low', value: stats.active - stats.highRisk - stats.medRisk, color: '#22c55e' },
  ], [stats]);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'employees', label: '👥 Employees' },
    { id: 'departments', label: '🏢 Departments' },
    { id: 'analytics', label: '📈 Analytics' },
  ];

  return (
    <>
      <Helmet><title>Retention Analytics — PaySphere</title></Helmet>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📈 Retention & Tenure Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Workforce stability, tenure distribution, and attrition risk scoring</p>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══ OVERVIEW ═══ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Avg Tenure</div>
                  <div className="text-2xl font-bold text-blue-500 mt-1">{stats.avgTenure}mo</div>
                  <div className="text-[10px] text-gray-400">{stats.under1yr} employees under 1yr</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">🔴 High Risk</div>
                  <div className="text-2xl font-bold text-red-500 mt-1">{stats.highRisk}</div>
                  <div className="text-[10px] text-gray-400">of {stats.active} active</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Avg Performance</div>
                  <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.avgReview}</div>
                  <div className="text-[10px] text-gray-400">review score</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Total Payroll</div>
                  <div className="text-2xl font-bold text-purple-500 mt-1">{formatCurrency(stats.totalPayroll)}</div>
                  <div className="text-[10px] text-gray-400">avg {formatCurrency(stats.avgSalary)}/yr</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* RISK DONUT */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">⚠️ Risk Distribution</h3>
                  <div className="flex justify-center"><DonutChart segments={riskSegments} size={130} /></div>
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {riskSegments.map(s => (
                      <div key={s.label} className="flex items-center gap-1 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-500 dark:text-gray-400">{s.label}: {s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TENURE BANDS */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📅 Tenure Bands</h3>
                  <div className="space-y-2">
                    {tenureBands.map(b => {
                      const c = tenureBand(b.label === '<6mo' ? 0 : b.label === '6-12mo' ? 9 : b.label === '1-2yr' ? 18 : b.label === '2-3yr' ? 30 : b.label === '3-5yr' ? 42 : 60);
                      return <HBar key={b.label} label={b.label} value={b.value} max={Math.max(...tenureBands.map(x => x.value))} color={c.color} />;
                    })}
                  </div>
                </div>

                {/* ANNUAL RETENTION TREND */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📈 Retention Trend</h3>
                  <BarChart data={TREND_DATA} height={110} colorKey="retention" />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-2">
                    <span>2022: 89%</span>
                    <span className="font-bold text-emerald-400">2026: 94%</span>
                  </div>
                </div>
              </div>

              {/* HIRE VS EXIT */}
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">🔄 Hires vs Exits (5 years)</h3>
                <BarChart data={TREND_DATA} height={100} colorKey="hires" />
                <div className="flex justify-center gap-6 mt-2">
                  <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-blue-500" /> Hires</div>
                  <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-red-500" /> Exits</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ EMPLOYEES ═══ */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  <option value="All">All Risk Levels</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map(e => (
                  <div key={e.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold">{e.name}</h4>
                        <div className="text-[10px] text-gray-500">{e.role} · {e.dept}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.risk.bg} ${e.risk.text}`}>{e.risk.label} Risk</span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs font-bold" style={{ color: e.band.color }}>{e.band.label}</div>
                        <div className="text-[9px] text-gray-400">Tenure</div>
                      </div>
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className={`text-xs font-bold ${e.lastReview >= 85 ? 'text-emerald-400' : e.lastReview >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{e.lastReview}</div>
                        <div className="text-[9px] text-gray-400">Review</div>
                      </div>
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs font-bold text-blue-400">{formatCurrency(e.salary)}</div>
                        <div className="text-[9px] text-gray-400">Salary</div>
                      </div>
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-xs font-bold text-gray-400">Since {e.joinDate.slice(0, 4)}</div>
                        <div className="text-[9px] text-gray-400">Joined</div>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-sm text-gray-400">No employees match the current filters.</div>
                )}
              </div>
            </div>
          )}

          {/* ═══ DEPARTMENTS ═══ */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              {deptStats.map(d => (
                <div key={d.dept} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">{d.dept}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400">{d.count} employees</span>
                      {d.highRisk > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">{d.highRisk} at risk</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <div className="text-lg font-bold text-blue-500">{d.avgTenure}mo</div>
                      <div className="text-[9px] text-gray-400">Avg Tenure</div>
                    </div>
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <div className={`text-lg font-bold ${d.avgReview >= 85 ? 'text-emerald-500' : d.avgReview >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{d.avgReview}</div>
                      <div className="text-[9px] text-gray-400">Avg Review</div>
                    </div>
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <div className="text-lg font-bold text-purple-500">{formatCurrency(d.avgSalary)}</div>
                      <div className="text-[9px] text-gray-400">Avg Salary</div>
                    </div>
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <div className="text-lg font-bold text-indigo-500">{d.count}</div>
                      <div className="text-[9px] text-gray-400">Headcount</div>
                    </div>
                  </div>
                  {/* TENURE BAR */}
                  <div className="mt-3 flex gap-1">
                    {enriched.filter(e => e.dept === d.dept).map(e => (
                      <div key={e.id} className="h-2 rounded-full flex-1" style={{ backgroundColor: e.band.color }} title={`${e.name}: ${e.band.label}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ ANALYTICS ═══ */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EXIT REASONS */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-4">🔍 Top Exit Reasons</h3>
                  <div className="space-y-2.5">
                    {EXIT_REASONS.map((r, i) => (
                      <HBar key={i} label={r.reason} value={r.count} max={14}
                        color={i < 2 ? '#ef4444' : i < 5 ? '#f59e0b' : '#6b7280'} />
                    ))}
                  </div>
                </div>

                {/* KEY INSIGHTS */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">💡 Key Insights</h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">📈 Improving:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">Retention rose from 85% (2024) to 94% (2026) — a 9-point improvement in two years.</span>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                      <span className="font-bold text-red-600 dark:text-red-400">⚠️ Watch:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">{stats.highRisk} employees flagged high-risk. 35% of exits cite better opportunities — benchmark compensation quarterly.</span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <span className="font-bold text-blue-600 dark:text-blue-400">📊 Tenure:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">{stats.under1yr} employees under 1 year — ensure onboarding rigor to prevent early attrition.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DEPARTMENT RISK HEATMAP */}
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-4">🗺️ Department Risk Heatmap</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="text-left py-2 px-3">Department</th>
                        <th className="text-center py-2 px-3">Headcount</th>
                        <th className="text-center py-2 px-3">Avg Tenure</th>
                        <th className="text-center py-2 px-3">Avg Review</th>
                        <th className="text-center py-2 px-3">Risk Score</th>
                        <th className="text-center py-2 px-3">Retention Health</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {deptStats.map(d => {
                        const health = d.highRisk === 0 && d.avgReview >= 80 ? 'Healthy' : d.highRisk <= 1 ? 'Good' : 'At Risk';
                        const hColor = health === 'Healthy' ? '#22c55e' : health === 'Good' ? '#3b82f6' : '#ef4444';
                        return (
                          <tr key={d.dept} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-2.5 px-3 font-medium">{d.dept}</td>
                            <td className="py-2.5 px-3 text-center">{d.count}</td>
                            <td className="py-2.5 px-3 text-center">{d.avgTenure}mo</td>
                            <td className="py-2.5 px-3 text-center">{d.avgReview}</td>
                            <td className="py-2.5 px-3 text-center">{d.highRisk}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${hColor}20`, color: hColor }}>{health}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TENURE-REVIEW SCATTER */}
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">🎯 Tenure vs Performance</h3>
                <div className="flex flex-wrap gap-4 justify-center">
                  {enriched.map(e => (
                    <div key={e.id} className="text-center group relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-transform hover:scale-125 ${e.risk.bg} ${e.risk.text}`} style={{ borderColor: e.risk.color }}>
                        {e.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-1">{e.tenure}mo · {e.lastReview}</div>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {e.name} — {e.dept}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1 text-[10px] text-gray-400"><div className="w-2 h-2 rounded-full bg-red-500" /> High risk</div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400"><div className="w-2 h-2 rounded-full bg-amber-500" /> Medium risk</div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Low risk</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
