/**
 * Pulse Survey Analytics Dashboard
 *
 * Rich analytics view for pulse survey data with Recharts visualizations:
 *   - Engagement scorecard with trend indicators
 *   - Response timeline (area chart)
 *   - Department breakdown (bar chart + table)
 *   - Response heatmap (day-of-week + hour-of-day)
 *   - Sentiment trend (multi-line area chart)
 *   - Survey comparison table
 *   - Per-question drill-down (distribution bars + sentiment donut)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, ReferenceLine,
} from 'recharts';
import PollIcon from '@mui/icons-material/Poll';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import InsightsIcon from '@mui/icons-material/Insights';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StarIcon from '@mui/icons-material/Star';

const SENTIMENT_COLORS = {
  positive: '#22c55e',
  neutral: '#eab308',
  negative: '#ef4444',
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#60a5fa', '#38bdf8', '#2dd4bf'];

const TABS = ['Overview', 'Departments', 'Sentiment', 'Heatmap', 'Compare', 'Questions'];

export default function PulseSurveyAnalytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [sentimentTrend, setSentimentTrend] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [scorecard, setScorecard] = useState(null);
  const [questionData, setQuestionData] = useState(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get('/api/pulse-surveys/analytics/overview');
      setOverview(res.data.overview || null);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get('/api/pulse-surveys/analytics/departments');
      setDepartments(res.data.departments || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  }, []);

  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await api.get('/api/pulse-surveys/analytics/heatmap');
      setHeatmap(res.data.heatmap || null);
    } catch (err) {
      console.error('Failed to fetch heatmap:', err);
    }
  }, []);

  const fetchSentimentTrend = useCallback(async () => {
    try {
      const res = await api.get('/api/pulse-surveys/analytics/sentiment-trend');
      setSentimentTrend(res.data.sentimentTrend || []);
    } catch (err) {
      console.error('Failed to fetch sentiment trend:', err);
    }
  }, []);

  const fetchComparison = useCallback(async () => {
    try {
      const res = await api.get('/api/pulse-surveys/analytics/comparison');
      setComparison(res.data.comparison || []);
    } catch (err) {
      console.error('Failed to fetch comparison:', err);
    }
  }, []);

  const fetchScorecard = useCallback(async () => {
    try {
      const res = await api.get('/api/pulse-surveys/analytics/scorecard');
      setScorecard(res.data.scorecard || null);
    } catch (err) {
      console.error('Failed to fetch scorecard:', err);
    }
  }, []);

  const fetchQuestionAnalytics = useCallback(async (surveyId) => {
    try {
      const res = await api.get(`/api/pulse-surveys/analytics/questions/${surveyId}`);
      setQuestionData(res.data || null);
      setSelectedSurveyId(surveyId);
    } catch (err) {
      console.error('Failed to fetch question analytics:', err);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.allSettled([
        fetchOverview(),
        fetchDepartments(),
        fetchHeatmap(),
        fetchSentimentTrend(),
        fetchComparison(),
        fetchScorecard(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [fetchOverview, fetchDepartments, fetchHeatmap, fetchSentimentTrend, fetchComparison, fetchScorecard]);

  const trendIcon = (direction) => {
    if (direction === 'improving') return <TrendingUpIcon className="text-green-500" />;
    if (direction === 'declining') return <TrendingDownIcon className="text-red-500" />;
    return <TrendingFlatIcon className="text-gray-400" />;
  };

  // Prepared chart data
  const departmentChartData = useMemo(() =>
    departments
      .filter((d) => d.totalResponses > 0)
      .sort((a, b) => b.totalResponses - a.totalResponses)
      .slice(0, 10)
      .map((d) => ({
        name: d.department.length > 12 ? d.department.slice(0, 12) + '…' : d.department,
        responses: d.totalResponses,
        satisfaction: d.avgSatisfaction || 0,
        employees: d.employeeCount,
      })),
    [departments],
  );

  const responseRateChartData = useMemo(() =>
    departments
      .filter((d) => d.surveysTargeting > 0)
      .sort((a, b) => b.responseRate - a.responseRate)
      .slice(0, 10)
      .map((d) => ({
        name: d.department.length > 10 ? d.department.slice(0, 10) + '…' : d.department,
        rate: d.responseRate,
        fill: d.responseRate > 70 ? '#22c55e' : d.responseRate > 40 ? '#eab308' : '#ef4444',
      })),
    [departments],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar activePage="Pulse Surveys" setActivePage={() => {}} isSidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <InsightsIcon className="text-violet-500" /> Survey Analytics
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4 lg:p-8">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedSurveyId(null); setQuestionData(null); }}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500"></div>
            </div>
          ) : (
            <>
              {/* ═══════════ OVERVIEW TAB ═══════════ */}
              {activeTab === 'Overview' && (
                <div className="space-y-6">
                  {/* Scorecard */}
                  {scorecard && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <ScorecardCard
                        label="Engagement Score"
                        value={`${scorecard.engagementScore}`}
                        suffix="/100"
                        delta={scorecard.engagementDelta}
                        color="violet"
                      />
                      <ScorecardCard
                        label="Avg Rating"
                        value={scorecard.currentAvgRating ?? '—'}
                        suffix="/5"
                        delta={scorecard.ratingDelta}
                        direction={scorecard.trendDirection}
                        color="blue"
                      />
                      <ScorecardCard
                        label="Participation Rate"
                        value={`${scorecard.participationRate}`}
                        suffix="%"
                        color="green"
                      />
                      <ScorecardCard
                        label="Total Responses"
                        value={scorecard.totalResponses}
                        color="amber"
                      />
                    </div>
                  )}

                  {/* Response Timeline */}
                  {overview?.responseTimeline && overview.responseTimeline.length > 0 && (
                    <ChartCard title="Response Timeline (12 Weeks)">
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={overview.responseTimeline}>
                          <defs>
                            <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                          />
                          <Area type="monotone" dataKey="responses" stroke="#6366f1" fill="url(#colorResponses)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  {/* Top Surveys */}
                  {overview?.topSurveys && overview.topSurveys.length > 0 && (
                    <ChartCard title="Top Surveys by Responses">
                      <div className="space-y-2">
                        {overview.topSurveys.map((s, idx) => {
                          const maxCount = overview.topSurveys[0]?.responseCount || 1;
                          const pct = Math.round((s.responseCount / maxCount) * 100);
                          return (
                            <div key={s._id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg p-2 transition-colors"
                              onClick={() => { fetchQuestionAnalytics(s._id); setActiveTab('Questions'); }}
                            >
                              <span className="text-xs font-bold text-gray-400 dark:text-slate-500 w-6">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.title}</span>
                                  <StatusBadge status={s.status} />
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                                  <div className="h-2 rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">{s.responseCount}</span>
                            </div>
                          );
                        })}
                      </div>
                    </ChartCard>
                  )}
                </div>
              )}

              {/* ═══════════ DEPARTMENTS TAB ═══════════ */}
              {activeTab === 'Departments' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Response Count by Dept */}
                    <ChartCard title="Responses by Department">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={departmentChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                          />
                          <Bar dataKey="responses" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    {/* Response Rate by Dept */}
                    <ChartCard title="Response Rate by Department">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={responseRateChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                          />
                          <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                            {responseRateChartData.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  {/* Department Table */}
                  <ChartCard title="Department Details">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700">
                            <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Department</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Employees</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Surveys</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Responses</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Avg Rating</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Response Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {departments.sort((a, b) => b.totalResponses - a.totalResponses).map((dept) => (
                            <tr key={dept.department} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{dept.department}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">{dept.employeeCount}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">{dept.surveysTargeting}</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{dept.totalResponses}</td>
                              <td className="py-3 px-4 text-right">
                                {dept.avgSatisfaction ? (
                                  <span className={`font-semibold ${dept.avgSatisfaction >= 4 ? 'text-green-600 dark:text-green-400' : dept.avgSatisfaction >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {dept.avgSatisfaction} <StarIcon fontSize="inherit" className="inline" />
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  dept.responseRate > 70 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : dept.responseRate > 40 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                }`}>
                                  {dept.responseRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </div>
              )}

              {/* ═══════════ SENTIMENT TAB ═══════════ */}
              {activeTab === 'Sentiment' && (
                <div className="space-y-6">
                  {sentimentTrend.length > 0 ? (
                    <>
                      <ChartCard title="Satisfaction Trend">
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={sentimentTrend}>
                            <defs>
                              <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                            <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" domain={[0, 5]} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                            />
                            <Legend />
                            <Area yAxisId="left" type="monotone" dataKey="avgSatisfaction" stroke="#6366f1" fill="rgba(99,102,241,0.1)" strokeWidth={2} name="Avg Rating" />
                            <Line yAxisId="right" type="monotone" dataKey="positivePercentage" stroke="#22c55e" strokeWidth={2} dot={false} name="Positive %" />
                            <Line yAxisId="right" type="monotone" dataKey="negativePercentage" stroke="#ef4444" strokeWidth={2} dot={false} name="Negative %" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      {/* Sentiment Summary */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {sentimentTrend.length > 0 && (() => {
                          const latest = sentimentTrend[sentimentTrend.length - 1];
                          return (
                            <>
                              <SentimentStatCard label="Positive Responses" value={`${latest.positivePercentage}%`} color="green" />
                              <SentimentStatCard label="Neutral Responses" value={`${latest.neutralPercentage}%`} color="amber" />
                              <SentimentStatCard label="Negative Responses" value={`${latest.negativePercentage}%`} color="red" />
                            </>
                          );
                        })()}
                      </div>

                      {/* Stacked area: positive/neutral/negative over time */}
                      <ChartCard title="Sentiment Distribution Over Time">
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={sentimentTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="positivePercentage" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.4} name="Positive" />
                            <Area type="monotone" dataKey="neutralPercentage" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.4} name="Neutral" />
                            <Area type="monotone" dataKey="negativePercentage" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} name="Negative" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </>
                  ) : (
                    <EmptyState message="No sentiment data available yet. Publish a survey and collect responses to see trends." />
                  )}
                </div>
              )}

              {/* ═══════════ HEATMAP TAB ═══════════ */}
              {activeTab === 'Heatmap' && (
                <div className="space-y-6">
                  {heatmap ? (
                    <>
                      {/* Peak times */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <ScorecardCard label="Total Responses" value={heatmap.totalResponses} color="violet" />
                        <ScorecardCard label="Peak Day" value={heatmap.peakDay.label} color="green" />
                        <ScorecardCard label="Peak Hour" value={heatmap.peakHour.label} color="blue" />
                        <ScorecardCard label="Avg Per Day" value={Math.round(heatmap.totalResponses / 7)} color="amber" />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Day of Week */}
                        <ChartCard title="Responses by Day of Week">
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={heatmap.dayOfWeek}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                              />
                              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartCard>

                        {/* Hour of Day */}
                        <ChartCard title="Responses by Hour of Day">
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={heatmap.hourOfDay}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={2} />
                              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                              />
                              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartCard>
                      </div>

                      {/* Visual Heatmap Grid */}
                      <ChartCard title="Response Intensity Heatmap">
                        <div className="grid grid-cols-24 gap-0.5">
                          {heatmap.hourOfDay.map((h) => {
                            const maxCount = Math.max(...heatmap.hourOfDay.map((x) => x.count), 1);
                            const intensity = h.count / maxCount;
                            const bgColor = intensity === 0
                              ? 'bg-gray-100 dark:bg-slate-800'
                              : intensity < 0.25
                                ? 'bg-violet-200 dark:bg-violet-900/40'
                                : intensity < 0.5
                                  ? 'bg-violet-300 dark:bg-violet-800/50'
                                  : intensity < 0.75
                                    ? 'bg-violet-400 dark:bg-violet-700/60'
                                    : 'bg-violet-600 dark:bg-violet-500/70';
                            return (
                              <div
                                key={h.hour}
                                className={`aspect-square rounded-sm ${bgColor} transition-colors`}
                                title={`${h.label}: ${h.count} responses`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-slate-400">
                          <span>00:00</span>
                          <span>12:00</span>
                          <span>23:00</span>
                        </div>
                      </ChartCard>
                    </>
                  ) : (
                    <EmptyState message="No heatmap data available yet. Collect responses to see timing patterns." />
                  )}
                </div>
              )}

              {/* ═══════════ COMPARE TAB ═══════════ */}
              {activeTab === 'Compare' && (
                <div className="space-y-6">
                  {comparison.length > 0 ? (
                    <>
                      <ChartCard title="Survey Response Rates">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={comparison.map((c) => ({
                            name: c.title.length > 20 ? c.title.slice(0, 20) + '…' : c.title,
                            responseRate: c.responseRate,
                            satisfaction: c.avgSatisfaction || 0,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
                            />
                            <Legend />
                            <Bar dataKey="responseRate" fill="#6366f1" name="Response Rate %" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="satisfaction" fill="#22c55e" name="Avg Satisfaction" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>

                      {/* Comparison Table */}
                      <ChartCard title="Survey Comparison Details">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-slate-700">
                                <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Survey</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Status</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Questions</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Responses</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Rate</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Avg Rating</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-slate-400">Days Open</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comparison.sort((a, b) => b.responseRate - a.responseRate).map((c) => (
                                <tr
                                  key={c._id}
                                  className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                  onClick={() => { fetchQuestionAnalytics(c._id); setActiveTab('Questions'); }}
                                >
                                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{c.title}</td>
                                  <td className="py-3 px-4 text-center"><StatusBadge status={c.status} /></td>
                                  <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">{c.questionCount}</td>
                                  <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{c.responseCount}</td>
                                  <td className="py-3 px-4 text-right">
                                    <span className={`font-semibold ${
                                      c.responseRate > 70 ? 'text-green-600 dark:text-green-400'
                                      : c.responseRate > 40 ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-red-600 dark:text-red-400'
                                    }`}>{c.responseRate}%</span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {c.avgSatisfaction ? (
                                      <span className="font-semibold text-violet-600 dark:text-violet-400">{c.avgSatisfaction}</span>
                                    ) : '—'}
                                  </td>
                                  <td className="py-3 px-4 text-right text-gray-600 dark:text-slate-400">{c.daysOpen}d</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </ChartCard>
                    </>
                  ) : (
                    <EmptyState message="No published surveys to compare." />
                  )}
                </div>
              )}

              {/* ═══════════ QUESTIONS TAB ═══════════ */}
              {activeTab === 'Questions' && (
                <div className="space-y-6">
                  {!questionData ? (
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select a Survey</h2>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                        Choose a survey from the Overview or Compare tab to see per-question analytics.
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {comparison.map((c) => (
                          <div
                            key={c._id}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-violet-400 dark:hover:border-violet-600 cursor-pointer transition-colors"
                            onClick={() => fetchQuestionAnalytics(c._id)}
                          >
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">{c.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                              {c.questionCount} questions · {c.responseCount} responses · {c.responseRate}% rate
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => { setQuestionData(null); setSelectedSurveyId(null); }}
                        className="text-sm text-violet-600 dark:text-violet-400 hover:underline mb-4"
                      >
                        ← Back to survey list
                      </button>
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 mb-6">
                        <h3 className="font-bold text-gray-900 dark:text-white">{questionData.survey?.title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-slate-400">
                          <span>{questionData.responseCount}/{questionData.totalEmployees} responses</span>
                          <span>{questionData.responseRate}% response rate</span>
                          <StatusBadge status={questionData.survey?.status} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        {questionData.questions?.map((q, idx) => (
                          <div key={q.questionId} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">Q{idx + 1}. {q.text}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                  {q.type.replace('_', ' ')} · {q.totalAnswers} answers · {q.responseRate}% response rate
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                {q.type.replace('_', ' ')}
                              </span>
                            </div>

                            {q.type === 'rating' && (
                              <div>
                                {/* Stats row */}
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                  <MiniStat label="Average" value={q.avg} />
                                  <MiniStat label="Median" value={q.median} />
                                  <MiniStat label="Std Dev" value={q.stdDev} />
                                  <MiniStat label="Range" value={`${q.minRating}–${q.maxRating}`} />
                                </div>

                                {/* Distribution bars */}
                                <div className="space-y-2">
                                  {Object.entries(q.distribution || {}).reverse().map(([rating, data]) => (
                                    <div key={rating} className="flex items-center gap-2">
                                      <span className="text-xs w-4 text-right font-medium text-gray-600 dark:text-slate-400">{rating}</span>
                                      <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-3">
                                        <div
                                          className="h-3 rounded-full bg-violet-500 transition-all"
                                          style={{ width: `${data.percentage}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500 dark:text-slate-400 w-16">
                                        {data.count} ({data.percentage}%)
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Sentiment breakdown */}
                                {q.sentimentBreakdown && (
                                  <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
                                    <SentimentPill label="Positive" data={q.sentimentBreakdown.positive} color="green" />
                                    <SentimentPill label="Neutral" data={q.sentimentBreakdown.neutral} color="amber" />
                                    <SentimentPill label="Negative" data={q.sentimentBreakdown.negative} color="red" />
                                  </div>
                                )}
                              </div>
                            )}

                            {(q.type === 'multiple_choice' || q.type === 'yes_no') && (
                              <div>
                                {q.options?.map((opt) => (
                                  <div key={opt.option} className="flex items-center gap-3 mb-2">
                                    <span className="text-sm text-gray-700 dark:text-slate-300 w-32 truncate">{opt.option}</span>
                                    <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-3">
                                      <div
                                        className="h-3 rounded-full bg-violet-500 transition-all"
                                        style={{ width: `${opt.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-slate-400 w-16">
                                      {opt.count} ({opt.percentage}%)
                                    </span>
                                  </div>
                                ))}
                                {q.topOption && (
                                  <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-2">
                                    🏆 Top choice: {q.topOption} ({q.topOptionPercentage}%)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
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

function ScorecardCard({ label, value, suffix, delta, direction, color }) {
  const colorMap = {
    violet: 'bg-violet-50 dark:bg-violet-900/20',
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
    amber: 'bg-amber-50 dark:bg-amber-900/20',
  };
  const textColorMap = {
    violet: 'text-violet-600 dark:text-violet-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={`${colorMap[color] || colorMap.violet} rounded-xl p-4 border border-gray-200 dark:border-slate-700`}>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}{suffix && <span className="text-sm font-normal text-gray-500 dark:text-slate-400">{suffix}</span>}
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
      {delta !== undefined && delta !== null && (
        <div className="flex items-center gap-1 mt-1">
          {direction ? trendIcon(direction) : (
            delta > 0 ? <TrendingUpIcon fontSize="small" className="text-green-500" />
            : delta < 0 ? <TrendingDownIcon fontSize="small" className="text-red-500" />
            : <TrendingFlatIcon fontSize="small" className="text-gray-400" />
          )}
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
            {delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(1) : delta}
          </span>
        </div>
      )}
    </div>
  );
}

function SentimentStatCard({ label, value, color }) {
  const colorMap = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30',
  };
  return (
    <div className={`${colorMap[color]} rounded-xl p-4 border`}>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
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

function StatusBadge({ status }) {
  const map = {
    active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    draft: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    closed: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.closed}`}>
      {status}
    </span>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2 text-center">
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase">{label}</p>
    </div>
  );
}

function SentimentPill({ label, data, color }) {
  const colorMap = {
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className={`text-sm ${colorMap[color]}`}>
      <span className="font-semibold">{data?.percentage || 0}%</span>
      <span className="text-gray-500 dark:text-slate-400 ml-1">{label}</span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <PollIcon className="text-4xl text-gray-300 dark:text-slate-600 mb-3" />
      <p className="text-gray-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
