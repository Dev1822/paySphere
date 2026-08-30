/**
 * Workforce Cost Forecast Dashboard
 *
 * Projects total compensation costs forward with:
 *   - Interactive projection configuration (hiring, attrition, salary revisions)
 *   - Monthly cost projection line/area chart
 *   - Headcount projection chart
 *   - Department and role cost breakdown
 *   - Scenario comparison (side-by-side projections)
 *   - Current cost summary with statutory estimates
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine,
} from 'recharts';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const TABS = ['Forecast', 'Summary', 'Compare'];
const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#22c55e', '#3b82f6', '#f97316', '#ef4444', '#ec4899', '#14b8a6'];

export default function WorkforceCostForecast() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Forecast');
  const [loading, setLoading] = useState(false);

  // Forecast params
  const [params, setParams] = useState({
    months: 12,
    monthlyHires: 0,
    annualAttritionRate: 10,
    includeStatutory: true,
    salaryRevision: null,
  });

  const [forecast, setForecast] = useState(null);
  const [summary, setSummary] = useState(null);

  // Compare state
  const [scenarios, setScenarios] = useState([
    { name: 'Conservative (5%)', type: 'uniform', uniformPercent: 5 },
    { name: 'Standard (10%)', type: 'uniform', uniformPercent: 10 },
    { name: 'Aggressive (15%)', type: 'uniform', uniformPercent: 15 },
  ]);
  const [comparison, setComparison] = useState(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/workforce-cost-forecast', params);
      setForecast(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [params]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/workforce-cost-forecast/summary');
      setSummary(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchComparison = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/workforce-cost-forecast/compare', {
        scenarios,
        months: params.months,
        monthlyHires: params.monthlyHires,
        annualAttritionRate: params.annualAttritionRate,
      });
      setComparison(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [scenarios, params]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const addScenario = () => {
    setScenarios([...scenarios, { name: `Scenario ${scenarios.length + 1}`, type: 'uniform', uniformPercent: 10 }]);
  };

  const removeScenario = (idx) => {
    if (scenarios.length <= 1) return;
    setScenarios(scenarios.filter((_, i) => i !== idx));
  };

  const updateScenario = (idx, field, val) => {
    const updated = [...scenarios];
    updated[idx] = { ...updated[idx], [field]: field === 'uniformPercent' ? Number(val) || 0 : val };
    setScenarios(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar activePage="Cost Forecast" setActivePage={() => {}} isSidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AccountBalanceIcon className="text-blue-500" /> Workforce Cost Forecast
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* ═══════════ FORECAST TAB ═══════════ */}
          {activeTab === 'Forecast' && (
            <div className="space-y-6">
              {/* Configuration Panel */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Projection Assumptions</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Months</label>
                    <input type="number" min={1} max={36} value={params.months}
                      onChange={(e) => setParams({ ...params, months: Number(e.target.value) || 12 })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Monthly Hires</label>
                    <input type="number" min={0} max={50} value={params.monthlyHires}
                      onChange={(e) => setParams({ ...params, monthlyHires: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Annual Attrition %</label>
                    <input type="number" min={0} max={50} value={params.annualAttritionRate}
                      onChange={(e) => setParams({ ...params, annualAttritionRate: Number(e.target.value) || 10 })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                      <input type="checkbox" checked={params.includeStatutory}
                        onChange={(e) => setParams({ ...params, includeStatutory: e.target.checked })}
                        className="rounded border-gray-300 dark:border-slate-600" />
                      Include Statutory (PF/ESI/Gratuity)
                    </label>
                  </div>
                </div>

                {/* Salary Revision */}
                <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-2">Salary Revision</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: 'None', value: null },
                      { label: 'Uniform 5%', value: { type: 'uniform', uniformPercent: 5 } },
                      { label: 'Uniform 10%', value: { type: 'uniform', uniformPercent: 10 } },
                      { label: 'Uniform 15%', value: { type: 'uniform', uniformPercent: 15 } },
                      { label: 'Uniform 20%', value: { type: 'uniform', uniformPercent: 20 } },
                    ].map((opt) => (
                      <button key={opt.label}
                        onClick={() => setParams({ ...params, salaryRevision: opt.value })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          JSON.stringify(params.salaryRevision) === JSON.stringify(opt.value)
                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-blue-300'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={fetchForecast} disabled={loading}
                  className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors">
                  {loading ? 'Computing...' : 'Run Forecast'}
                </button>
              </div>

              {/* Results */}
              {forecast && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <FCostCard label="Current Monthly Payroll" value={`₹${forecast.summary.currentMonthlyPayroll?.toLocaleString()}`} color="blue" />
                    <FCostCard label="Projected Annual Cost" value={`₹${forecast.summary.projectedAnnualPayroll?.toLocaleString()}`} color="violet" />
                    <FCostCard label="Current → Projected HC" value={`${forecast.summary.currentHeadcount} → ${forecast.summary.projectedHeadcount}`} color="green" />
                    <FCostCard label="Avg Monthly Total" value={`₹${forecast.summary.avgMonthlyCost?.toLocaleString()}`} color="amber" />
                  </div>

                  {/* Projection Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cost Projection */}
                    <ChartCard title="Monthly Cost Projection">
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={forecast.projection}>
                          <defs>
                            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                          <Area type="monotone" dataKey="totalMonthlyCost" stroke="#6366f1" fill="url(#colorCost)" strokeWidth={2} name="Total Cost" />
                          <Area type="monotone" dataKey="monthlyPayroll" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" strokeWidth={1.5} name="Payroll Only" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    {/* Headcount Projection */}
                    <ChartCard title="Headcount Projection">
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={forecast.projection}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} />
                          <Legend />
                          <Bar yAxisId="right" dataKey="newHires" fill="#22c55e" name="New Hires" radius={[2, 2, 0, 0]} />
                          <Bar yAxisId="right" dataKey="separations" fill="#ef4444" name="Separations" radius={[2, 2, 0, 0]} />
                          <Line yAxisId="left" type="monotone" dataKey="headcount" stroke="#6366f1" strokeWidth={2} dot={false} name="Headcount" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  {/* Cumulative Cost */}
                  <ChartCard title="Cumulative Cost Projection">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={forecast.projection}>
                        <defs>
                          <linearGradient id="colorCumCost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                        <Area type="monotone" dataKey="cumulativeCost" stroke="#8b5cf6" fill="url(#colorCumCost)" strokeWidth={2} name="Cumulative Cost" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Department Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Cost by Department">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={(forecast.departmentBreakdown || []).slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="department" tick={{ fontSize: 9 }} stroke="#94a3b8" width={80} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                          <Legend />
                          <Bar dataKey="currentMonthlyPayroll" fill="#94a3b8" name="Current" radius={[0, 2, 2, 0]} />
                          <Bar dataKey="revisedMonthlyPayroll" fill="#6366f1" name="Revised" radius={[0, 2, 2, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Department Cost Table">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-slate-700">
                              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-slate-400">Department</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-slate-400">HC</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-slate-400">Current</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-slate-400">Revised</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-slate-400">Hike Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(forecast.departmentBreakdown || []).map((d) => (
                              <tr key={d.department} className="border-b border-gray-100 dark:border-slate-800">
                                <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{d.department}</td>
                                <td className="py-2 px-3 text-right text-gray-600 dark:text-slate-400">{d.headcount}</td>
                                <td className="py-2 px-3 text-right text-gray-600 dark:text-slate-400">₹{d.currentMonthlyPayroll?.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">₹{d.revisedMonthlyPayroll?.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">
                                  <span className={d.totalHikeCost > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500'}>
                                    {d.totalHikeCost > 0 ? '+₹' : ''}{d.totalHikeCost?.toLocaleString()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ChartCard>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══════════ SUMMARY TAB ═══════════ */}
          {activeTab === 'Summary' && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <FCostCard label="Headcount" value={summary.summary.headcount} color="blue" />
                <FCostCard label="Monthly Payroll" value={`₹${summary.summary.totalMonthlyPayroll?.toLocaleString()}`} color="violet" />
                <FCostCard label="Annual Payroll" value={`₹${summary.summary.totalAnnualPayroll?.toLocaleString()}`} color="green" />
                <FCostCard label="Total Cost + Statutory" value={`₹${summary.summary.totalCostWithStatutory?.toLocaleString()}`} color="amber" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <FCostCard label="Average Salary" value={`₹${summary.summary.avgSalary?.toLocaleString()}`} color="blue" />
                <FCostCard label="Median Salary" value={`₹${summary.summary.medianSalary?.toLocaleString()}`} color="violet" />
                <FCostCard label="Min Salary" value={`₹${summary.summary.minSalary?.toLocaleString()}`} color="red" />
                <FCostCard label="Max Salary" value={`₹${summary.summary.maxSalary?.toLocaleString()}`} color="green" />
              </div>

              {/* Statutory Breakdown */}
              <ChartCard title="Statutory Contributions (Monthly)">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">₹{summary.summary.statutory?.pf?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Provident Fund</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">₹{summary.summary.statutory?.esi?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">ESI</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">₹{summary.summary.statutory?.gratuity?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Gratuity Accrual</p>
                  </div>
                </div>
              </ChartCard>

              {/* Department Cost Share */}
              <ChartCard title="Department Cost Distribution">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={summary.departmentCosts || []} dataKey="monthlyPayroll" nameKey="department" cx="50%" cy="50%" outerRadius={100} label={({ department, percentage }) => `${department} (${percentage}%)`}>
                        {(summary.departmentCosts || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {(summary.departmentCosts || []).map((d, i) => (
                      <div key={d.department} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-gray-700 dark:text-slate-300 flex-1">{d.department}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">₹{d.monthlyPayroll?.toLocaleString()}</span>
                        <span className="text-xs text-gray-500 dark:text-slate-400 w-10 text-right">{d.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
            </div>
          )}

          {/* ═══════════ COMPARE TAB ═══════════ */}
          {activeTab === 'Compare' && (
            <div className="space-y-6">
              {/* Scenario Editor */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Scenarios to Compare</h3>
                  <button onClick={addScenario} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    <AddIcon fontSize="small" /> Add Scenario
                  </button>
                </div>
                <div className="space-y-3">
                  {scenarios.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                      <input type="text" value={s.name} onChange={(e) => updateScenario(idx, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm" />
                      <select value={s.type} onChange={(e) => updateScenario(idx, 'type', e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm">
                        <option value="uniform">Uniform %</option>
                      </select>
                      <input type="number" min={0} max={100} value={s.uniformPercent || 0}
                        onChange={(e) => updateScenario(idx, 'uniformPercent', e.target.value)}
                        className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm" />
                      <span className="text-xs text-gray-500">%</span>
                      {scenarios.length > 1 && (
                        <button onClick={() => removeScenario(idx)} className="text-red-400 hover:text-red-600">
                          <DeleteOutlineIcon fontSize="small" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={fetchComparison} disabled={loading}
                  className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors">
                  {loading ? 'Comparing...' : 'Compare Scenarios'}
                </button>
              </div>

              {/* Comparison Results */}
              {comparison && (
                <>
                  {/* Comparison Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Baseline (No Revision)</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">₹{comparison.baseline?.annualProjected?.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Annual projected</p>
                    </div>
                    {comparison.comparisons?.map((c, i) => (
                      <div key={c.name} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700"
                        style={{ borderLeftColor: COLORS[i % COLORS.length], borderLeftWidth: 4 }}>
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{c.name}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">₹{c.projectedAnnualTotal?.toLocaleString()}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">+₹{c.projectedAnnualIncrement?.toLocaleString()} vs baseline</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Avg hike: {c.avgHikePercent}%</p>
                      </div>
                    ))}
                  </div>

                  {/* Comparison Chart */}
                  <ChartCard title="Scenario Projections">
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }} formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                        <Legend />
                        <Line type="monotone" dataKey="cumulativeCost" data={comparison.comparisons?.[0]?.projection || []} stroke={COLORS[0]} strokeWidth={2} name={comparison.comparisons?.[0]?.name || 'S1'} dot={false} />
                        {comparison.comparisons?.[1] && (
                          <Line type="monotone" dataKey="cumulativeCost" data={comparison.comparisons[1].projection} stroke={COLORS[1]} strokeWidth={2} name={comparison.comparisons[1].name} dot={false} />
                        )}
                        {comparison.comparisons?.[2] && (
                          <Line type="monotone" dataKey="cumulativeCost" data={comparison.comparisons[2].projection} stroke={COLORS[2]} strokeWidth={2} name={comparison.comparisons[2].name} dot={false} />
                        )}
                        {comparison.comparisons?.[3] && (
                          <Line type="monotone" dataKey="cumulativeCost" data={comparison.comparisons[3].projection} stroke={COLORS[3]} strokeWidth={2} name={comparison.comparisons[3].name} dot={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function FCostCard({ label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    violet: 'bg-violet-50 dark:bg-violet-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
    amber: 'bg-amber-50 dark:bg-amber-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
  };
  return (
    <div className={`${colorMap[color] || colorMap.blue} rounded-xl p-4 border border-gray-200 dark:border-slate-700`}>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
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
