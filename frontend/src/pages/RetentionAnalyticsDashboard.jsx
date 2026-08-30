/**
 * Retention Analytics Dashboard
 *
 * Talent retention insights with:
 *   - Flight risk heat map per employee
 *   - Attrition trend line chart
 *   - Compensation benchmark (percentile bar charts, histogram)
 *   - Tenure distribution donut
 *   - Department risk breakdown
 *   - Retention scorecard with insights
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine, ScatterChart, Scatter,
} from 'recharts';
import SecurityIcon from '@mui/icons-material/Security';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const RISK_COLORS = {
  Critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-900/30', text: 'text-red-700 dark:text-red-300', bar: '#ef4444' },
  High: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-900/30', text: 'text-orange-700 dark:text-orange-300', bar: '#f97316' },
  Medium: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-900/30', text: 'text-amber-700 dark:text-amber-300', bar: '#eab308' },
  Low: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-900/30', text: 'text-green-700 dark:text-green-300', bar: '#22c55e' },
};

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'];

const TABS = ['Dashboard', 'Flight Risk', 'Attrition', 'Compensation', 'Benchmark'];

export default function RetentionAnalyticsDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [loading, setLoading] = useState(true);

  const [dashboard, setDashboard] = useState(null);
  const [flightRisk, setFlightRisk] = useState(null);
  const [attrition, setAttrition] = useState(null);
  const [compensation, setCompensation] = useState(null);
  const [sortBy, setSortBy] = useState('score');
  const [filterDept, setFilterDept] = useState('All');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/api/retention-analytics/dashboard');
      setDashboard(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchFlightRisk = useCallback(async () => {
    try {
      const res = await api.get('/api/retention-analytics/flight-risk');
      setFlightRisk(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchAttrition = useCallback(async () => {
    try {
      const res = await api.get('/api/retention-analytics/attrition-trends');
      setAttrition(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchCompensation = useCallback(async () => {
    try {
      const res = await api.get('/api/retention-analytics/compensation-benchmark');
      setCompensation(res.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.allSettled([fetchDashboard(), fetchFlightRisk(), fetchAttrition(), fetchCompensation()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchDashboard, fetchFlightRisk, fetchAttrition, fetchCompensation]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!flightRisk?.employees) return [];
    let list = flightRisk.employees;
    if (filterDept !== 'All') list = list.filter((e) => e.department === filterDept);
    if (sortBy === 'score') list = [...list].sort((a, b) => b.flightRiskScore - a.flightRiskScore);
    else if (sortBy === 'salary') list = [...list].sort((a, b) => a.monthlySalary - b.monthlySalary);
    else if (sortBy === 'tenure') list = [...list].sort((a, b) => a.tenureMonths - b.tenureMonths);
    else list = [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
    return list;
  }, [flightRisk, sortBy, filterDept]);

  const departments = useMemo(() =>
    flightRisk?.departments?.map((d) => d.department).filter(Boolean).sort() || [],
    [flightRisk],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar activePage="Retention Analytics" setActivePage={() => {}} isSidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <SecurityIcon className="text-emerald-500" /> Retention Analytics
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <>
              {/* ═══════════ DASHBOARD TAB ═══════════ */}
              {activeTab === 'Dashboard' && dashboard && (
                <div className="space-y-6">
                  {/* Scorecard */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard icon={<PeopleIcon />} label="Active Headcount" value={dashboard.dashboard.activeCount} color="blue" />
                    <MetricCard icon={<SecurityIcon />} label="Retention Rate" value={`${dashboard.dashboard.retentionRate}%`} color="green" />
                    <MetricCard icon={<AccessTimeIcon />} label="Avg Tenure" value={`${dashboard.dashboard.avgTenure}mo`} color="violet" />
                    <MetricCard icon={<AttachMoneyIcon />} label="Avg Salary" value={`₹${(dashboard.dashboard.avgSalary || 0).toLocaleString()}`} color="amber" />
                  </div>

                  {/* Insights */}
                  {dashboard.insights && dashboard.insights.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">📋 Key Insights</h3>
                      <div className="space-y-2">
                        {dashboard.insights.map((ins, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                            ins.type === 'critical' ? 'bg-red-50 dark:bg-red-900/20' :
                            ins.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20' :
                            'bg-green-50 dark:bg-green-900/20'
                          }`}>
                            <InfoOutlinedIcon fontSize="small" className={
                              ins.type === 'critical' ? 'text-red-500 mt-0.5' :
                              ins.type === 'warning' ? 'text-amber-500 mt-0.5' :
                              'text-green-500 mt-0.5'
                            } />
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{ins.title}</p>
                              <p className="text-xs text-gray-600 dark:text-slate-400">{ins.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Tenure Distribution */}
                    <ChartCard title="Tenure Distribution">
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={dashboard.tenureDistribution || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {(dashboard.tenureDistribution || []).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    {/* High-Risk Departments */}
                    <ChartCard title="High-Risk Departments">
                      {dashboard.highRiskDepartments?.length > 0 ? (
                        <div className="space-y-3">
                          {dashboard.highRiskDepartments.map((dept) => (
                            <div key={dept.department} className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <WarningAmberIcon className="text-red-500" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{dept.department}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                  {dept.headcount} employees · {dept.attritionRate}% attrition rate
                                </p>
                              </div>
                              <span className="text-xs font-bold text-red-600 dark:text-red-400">{dept.attritionRate}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No high-risk departments detected.</p>
                      )}
                    </ChartCard>
                  </div>

                  {/* Flight Risk Summary */}
                  {flightRisk?.summary && (
                    <ChartCard title="Flight Risk Distribution">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { label: 'Critical', count: flightRisk.summary.criticalRisk, color: 'red' },
                          { label: 'High', count: flightRisk.summary.highRisk, color: 'orange' },
                          { label: 'Medium', count: flightRisk.summary.mediumRisk, color: 'amber' },
                          { label: 'Low', count: flightRisk.summary.lowRisk, color: 'green' },
                        ].map((r) => {
                          const pct = flightRisk.summary.total > 0 ? Math.round((r.count / flightRisk.summary.total) * 100) : 0;
                          return (
                            <div key={r.label} className={`rounded-xl p-4 border ${RISK_COLORS[r.label].bg} ${RISK_COLORS[r.label].border}`}>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">{r.count}</p>
                              <p className={`text-xs font-semibold ${RISK_COLORS[r.label].text}`}>{r.label} Risk ({pct}%)</p>
                            </div>
                          );
                        })}
                      </div>
                    </ChartCard>
                  )}
                </div>
              )}

              {/* ═══════════ FLIGHT RISK TAB ═══════════ */}
              {activeTab === 'Flight Risk' && flightRisk && (
                <div className="space-y-6">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm">
                      <option value="All">All Departments</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm">
                      <option value="score">Sort by Risk Score</option>
                      <option value="salary">Sort by Salary</option>
                      <option value="tenure">Sort by Tenure</option>
                      <option value="name">Sort by Name</option>
                    </select>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{filteredEmployees.length} employees</span>
                  </div>

                  {/* Risk Scatter */}
                  <ChartCard title="Flight Risk vs Salary">
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" dataKey="monthlySalary" name="Salary" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="number" dataKey="flightRiskScore" name="Risk" tick={{ fontSize: 11 }} stroke="#94a3b8" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                          formatter={(value, name) => [name === 'Risk' ? `${value}/100` : `₹${Number(value).toLocaleString()}`, name]}
                        />
                        <ReferenceLine y={60} stroke="#f97316" strokeDasharray="5 5" label={{ value: 'High Risk', position: 'right', fontSize: 10 }} />
                        <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="5 5" />
                        <Scatter data={filteredEmployees} fill="#6366f1" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Employee Risk Table */}
                  <ChartCard title="Employee Flight Risk Scores">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700">
                            <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-slate-400">Employee</th>
                            <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-slate-400">Department</th>
                            <th className="text-right py-3 px-3 font-semibold text-gray-600 dark:text-slate-400">Salary</th>
                            <th className="text-right py-3 px-3 font-semibold text-gray-600 dark:text-slate-400">Tenure</th>
                            <th className="text-right py-3 px-3 font-semibold text-gray-600 dark:text-slate-400">Last Raise</th>
                            <th className="text-center py-3 px-3 font-semibold text-gray-600 dark:text-slate-400">Risk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEmployees.slice(0, 50).map((emp) => (
                            <tr key={emp._id} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-3 px-3">
                                <p className="font-medium text-gray-900 dark:text-white">{emp.fullName}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{emp.role || '—'}</p>
                              </td>
                              <td className="py-3 px-3 text-gray-600 dark:text-slate-400">{emp.department}</td>
                              <td className="py-3 px-3 text-right text-gray-900 dark:text-white">₹{emp.monthlySalary?.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right text-gray-600 dark:text-slate-400">{emp.tenureMonths}mo</td>
                              <td className="py-3 px-3 text-right text-gray-600 dark:text-slate-400">{emp.factors?.monthsSinceLastRaise || '—'}mo</td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                                    <div className="h-2 rounded-full transition-all" style={{ width: `${emp.flightRiskScore}%`, backgroundColor: RISK_COLORS[emp.riskLevel]?.bar || '#6366f1' }} />
                                  </div>
                                  <span className={`text-xs font-bold ${RISK_COLORS[emp.riskLevel]?.text || ''}`}>{emp.flightRiskScore}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </div>
              )}

              {/* ═══════════ ATTRITION TAB ═══════════ */}
              {activeTab === 'Attrition' && attrition && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <MetricCard icon={<TrendingDownIcon />} label="Total Separations" value={attrition.summary.totalSeparations} color="red" />
                    <MetricCard icon={<PeopleIcon />} label="Current Active" value={attrition.summary.totalActive} color="blue" />
                    <MetricCard icon={<TrendingUpIcon />} label="Attrition Rate" value={`${attrition.summary.overallAttritionRate}%`} color="amber" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Attrition Trend */}
                    <ChartCard title="Monthly Attrition Trend">
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={attrition.trend || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="separations" fill="#ef4444" name="Separations" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="left" dataKey="newHires" fill="#22c55e" name="New Hires" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="attritionRate" stroke="#f97316" strokeWidth={2} dot={false} name="Rate %" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    {/* Department Attrition */}
                    <ChartCard title="Separations by Department">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={(attrition.departmentBreakdown || []).slice(0, 8)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="department" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} />
                          <Bar dataKey="separations" radius={[4, 4, 0, 0]}>
                            {(attrition.departmentBreakdown || []).slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  {/* Headcount vs Separations timeline */}
                  <ChartCard title="Headcount & New Hires Over Time">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={attrition.trend || []}>
                        <defs>
                          <linearGradient id="colorHC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} />
                        <Area type="monotone" dataKey="totalHeadcount" stroke="#3b82f6" fill="url(#colorHC)" strokeWidth={2} name="Headcount" />
                        <Area type="monotone" dataKey="newHires" stroke="#22c55e" fill="rgba(34,197,94,0.15)" strokeWidth={2} name="New Hires" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}

              {/* ═══════════ COMPENSATION TAB ═══════════ */}
              {activeTab === 'Compensation' && compensation && (
                <div className="space-y-6">
                  {/* Overall Percentiles */}
                  {compensation.overall && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      <MetricCard label="P10" value={`₹${compensation.overall.p10?.toLocaleString()}`} color="blue" />
                      <MetricCard label="P25" value={`₹${compensation.overall.p25?.toLocaleString()}`} color="violet" />
                      <MetricCard label="Median" value={`₹${compensation.overall.median?.toLocaleString()}`} color="green" />
                      <MetricCard label="P75" value={`₹${compensation.overall.p75?.toLocaleString()}`} color="amber" />
                      <MetricCard label="P90" value={`₹${compensation.overall.p90?.toLocaleString()}`} color="red" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Salary Histogram */}
                    <ChartCard title="Salary Distribution">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={compensation.histogram || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="range" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {(compensation.histogram || []).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    {/* Department Salary Comparison */}
                    <ChartCard title="Department Median Salaries">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={(compensation.departments || []).slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="department" tick={{ fontSize: 9 }} stroke="#94a3b8" width={80} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                          <Bar dataKey="median" fill="#6366f1" radius={[0, 4, 4, 0]} name="Median Salary" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  {/* Department Table */}
                  <ChartCard title="Department Compensation Details">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700">
                            <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Department</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Count</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Min</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Median</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Max</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Compa-Ratio</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Spread</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(compensation.departments || []).map((d) => (
                            <tr key={d.department} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{d.department}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">{d.count}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">₹{d.min?.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">₹{d.median?.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">₹{d.max?.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right">
                                <span className={`font-semibold ${d.avgCompaRatio > 1.1 ? 'text-green-600 dark:text-green-400' : d.avgCompaRatio < 0.9 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                  {d.avgCompaRatio}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">{d.salarySpread}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </div>
              )}

              {/* ═══════════ BENCHMARK TAB ═══════════ */}
              {activeTab === 'Benchmark' && compensation && (
                <div className="space-y-6">
                  {/* Role Salary Comparison */}
                  <ChartCard title="Salary by Role (Top 20)">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={(compensation.roles || []).slice(0, 20)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="role" tick={{ fontSize: 9 }} stroke="#94a3b8" width={120} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                        <Legend />
                        <Bar dataKey="min" fill="#94a3b8" name="Min" radius={[0, 2, 2, 0]} />
                        <Bar dataKey="median" fill="#6366f1" name="Median" radius={[0, 2, 2, 0]} />
                        <Bar dataKey="max" fill="#22c55e" name="Max" radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Level Salary Progression */}
                  {compensation.levels && compensation.levels.length > 0 && (
                    <ChartCard title="Salary by Job Level">
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={compensation.levels}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="level" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                          <Legend />
                          <Bar dataKey="min" fill="#94a3b8" name="Min" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="median" fill="#6366f1" name="Median" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="max" fill="#22c55e" name="Max" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="mean" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="Mean" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };
  return (
    <div className={`${colorMap[color] || colorMap.blue} rounded-xl p-4 border border-gray-200 dark:border-slate-700`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-sm opacity-70">{icon}</span>}
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}
