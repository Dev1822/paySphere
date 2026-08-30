/**
 * @fileoverview Employee Survey & Pulse Check Hub Page
 * @description Enterprise survey creation, pulse check campaigns, response
 * collection, and engagement analytics dashboard.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  ClipboardList, BarChart3, Users, TrendingUp, TrendingDown, Minus,
  Plus, Search, Clock, CheckCircle, Eye, MessageSquare, Activity,
  ThumbsUp, ThumbsDown, Smile, Meh, Frown, Star, Zap,
} from 'lucide-react';
import type { Survey, PulseCheck, SurveyDashboard, QuestionAnalytics } from '../../types/survey';
import {
  generateSurveys,
  generatePulseChecks,
  generateQuestionAnalytics,
  generateSurveyDashboard,
} from '../../services/surveyService';

type HubTab = 'dashboard' | 'surveys' | 'pulses' | 'analytics';

function SurveyStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-600 dark:text-gray-400' },
    ACTIVE: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
    CLOSED: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
    ANALYZING: { bg: 'bg-purple-100 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400' },
  };
  const c = config[status] || config.DRAFT;
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>{status}</span>;
}

function SentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === 'POSITIVE') return <ThumbsUp size={14} className="text-green-500" />;
  if (sentiment === 'NEGATIVE') return <ThumbsDown size={14} className="text-red-500" />;
  if (sentiment === 'NEUTRAL') return <Minus size={14} className="text-amber-500" />;
  return <Activity size={14} className="text-gray-400" />;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    POSITIVE: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', icon: <ThumbsUp size={10} /> },
    NEUTRAL: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', icon: <Minus size={10} /> },
    NEGATIVE: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', icon: <ThumbsDown size={10} /> },
    NO_DATA: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-500', icon: <Activity size={10} /> },
  };
  const c = config[sentiment] || config.NO_DATA;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.icon} {sentiment}
    </span>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

function DashboardTab({ dashboard }: { dashboard: SurveyDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <ClipboardList size={14} />
            <span className="text-[10px] uppercase font-bold">Total Surveys</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{dashboard.totalSurveys}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-200 dark:border-green-900/30">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle size={14} />
            <span className="text-[10px] uppercase font-bold">Active Surveys</span>
          </div>
          <p className="text-xl font-extrabold text-green-600">{dashboard.activeSurveys}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Zap size={14} />
            <span className="text-[10px] uppercase font-bold">Active Pulses</span>
          </div>
          <p className="text-xl font-extrabold text-blue-600">{dashboard.activePulseChecks}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-200 dark:border-purple-900/30">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Users size={14} />
            <span className="text-[10px] uppercase font-bold">Total Responses</span>
          </div>
          <p className="text-xl font-extrabold text-purple-600">{dashboard.totalResponses}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Clock size={14} />
            <span className="text-[10px] uppercase font-bold">Total Pulses</span>
          </div>
          <p className="text-xl font-extrabold text-amber-600">{dashboard.totalPulseChecks}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Surveys */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ClipboardList size={16} className="text-indigo-500" />
            Recent Surveys
          </h3>
          <div className="space-y-2">
            {dashboard.recentSurveys.map((s) => (
              <div key={s._id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg hover:shadow-sm transition">
                <div className="w-8 h-8 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={14} className="text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{s.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {s.questions.length} questions · {s.responseCount} responses · {s.completionRate}% completion
                  </p>
                </div>
                <SurveyStatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Pulse Checks */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            Recent Pulse Checks
          </h3>
          <div className="space-y-2">
            {dashboard.recentPulses.map((p) => (
              <div key={p._id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg hover:shadow-sm transition">
                <div className="w-8 h-8 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Zap size={14} className="text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{p.question}</p>
                  <p className="text-[10px] text-gray-400">
                    {p.responseCount} responses · Avg: {p.avgScore}/5
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SentimentIcon sentiment={p.sentiment} />
                  <SentimentBadge sentiment={p.sentiment} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Surveys Tab ─────────────────────────────────────────────────────────────

function SurveysTab({ surveys }: { surveys: Survey[] }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Survey | null>(null);

  const filtered = useMemo(() => {
    return surveys.filter((s) =>
      s.title.toLowerCase().includes(search.toLowerCase()),
    );
  }, [surveys, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search surveys..." className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
        </div>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> Create Survey
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((survey) => (
          <div key={survey._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{survey.title}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">{survey.type} · {survey.questions.length} questions</p>
              </div>
              <SurveyStatusBadge status={survey.status} />
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 line-clamp-2">{survey.description}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-lg font-extrabold text-indigo-600">{survey.responseCount}</p>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Responses</p>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-lg font-extrabold text-green-600">{survey.completionRate}%</p>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Completion</p>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-lg font-extrabold text-amber-600">{Math.round(survey.avgCompletionTime / 60)}m</p>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Avg Time</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-3 border-t border-gray-100 dark:border-slate-700">
              <span>{survey.isAnonymous ? 'Anonymous' : 'Identified'} · By {survey.createdBy.name}</span>
              {survey.startDate && <span>Started {new Date(survey.startDate).toLocaleDateString('en-IN')}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pulse Checks Tab ────────────────────────────────────────────────────────

function PulsesTab({ pulses }: { pulses: PulseCheck[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Zap size={16} className="text-amber-500" />
          Pulse Checks
        </h3>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> New Pulse Check
        </button>
      </div>

      <div className="space-y-3">
        {pulses.map((pulse) => (
          <div key={pulse._id} className={`bg-white dark:bg-slate-800 rounded-xl border p-5 hover:shadow-md transition ${
            pulse.status === 'ACTIVE'
              ? 'border-amber-200 dark:border-amber-900/30'
              : 'border-gray-200 dark:border-slate-700'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{pulse.question}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">{pulse.questionType.replace(/_/g, ' ')} · By {pulse.createdBy.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <SurveyStatusBadge status={pulse.status} />
                <SentimentBadge sentiment={pulse.sentiment} />
              </div>
            </div>

            {/* Score visualization */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-2xl font-extrabold text-indigo-600">{pulse.avgScore.toFixed(1)}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Avg Score</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-2xl font-extrabold text-blue-600">{pulse.responseCount}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Responses</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <SentimentIcon sentiment={pulse.sentiment} />
                  <span className={`text-2xl font-extrabold ${
                    pulse.sentiment === 'POSITIVE' ? 'text-green-600' :
                    pulse.sentiment === 'NEGATIVE' ? 'text-red-600' :
                    pulse.sentiment === 'NEUTRAL' ? 'text-amber-600' : 'text-gray-400'
                  }`}>
                    {pulse.sentiment === 'POSITIVE' ? '😊' : pulse.sentiment === 'NEGATIVE' ? '😟' : pulse.sentiment === 'NEUTRAL' ? '😐' : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Sentiment</p>
              </div>
            </div>

            {/* Emoji scale for active */}
            {pulse.status === 'ACTIVE' && pulse.questionType === 'EMOJI_1_5' && (
              <div className="flex items-center justify-center gap-4 pt-3 border-t border-gray-100 dark:border-slate-700">
                {['😟', '😕', '😐', '🙂', '😊'].map((emoji, i) => (
                  <button key={i} className="text-2xl hover:scale-125 transition-transform opacity-50 hover:opacity-100" title={`${i + 1}/5`}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────

function AnalyticsTab({ analytics }: { analytics: QuestionAnalytics[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <BarChart3 size={16} className="text-indigo-500" />
        Question Analytics
      </h3>
      <div className="space-y-4">
        {analytics.map((q) => (
          <div key={q.questionId} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{q.questionText}</h4>
                <p className="text-[10px] text-gray-400">{q.questionType.replace(/_/g, ' ')} · {q.totalResponses} responses</p>
              </div>
              {q.questionType !== 'OPEN_TEXT' && (
                <div className="text-right">
                  <p className="text-xl font-extrabold text-indigo-600">{q.avg.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">avg</p>
                </div>
              )}
            </div>

            {/* Distribution bars */}
            {q.questionType !== 'OPEN_TEXT' && Object.keys(q.distribution).length > 0 && (
              <div className="space-y-2 mb-3">
                {Object.entries(q.distribution).sort(([a], [b]) => Number(a) - Number(b)).map(([val, count]) => (
                  <div key={val} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-500 w-6 text-right">{val}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{
                        width: `${(Number(count) / q.totalResponses) * 100}%`,
                      }} />
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white w-8 text-right">{Number(count)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Text responses */}
            {q.textResponses.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Open Responses</p>
                {q.textResponses.map((text, i) => (
                  <div key={i} className="p-2 bg-gray-50 dark:bg-slate-900/50 rounded text-xs text-gray-600 dark:text-slate-400 italic">
                    "{text}"
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SurveyHubPage() {
  const [tab, setTab] = useState<HubTab>('dashboard');
  const [loading, setLoading] = useState(true);

  const surveys = useMemo(() => generateSurveys(10), []);
  const pulses = useMemo(() => generatePulseChecks(10), []);
  const analytics = useMemo(() => generateQuestionAnalytics(), []);
  const dashboard = useMemo(() => generateSurveyDashboard(), []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-gray-500 font-bold">
          <ClipboardList size={32} className="animate-bounce text-indigo-500" />
          <p>Loading Survey Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="bg-slate-900 px-6 py-8 text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <ClipboardList size={32} className="text-indigo-400" /> Survey & Pulse Check Hub
            </h1>
            <p className="text-slate-400 mt-2">Measure employee engagement, gather feedback, and track sentiment trends.</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-xs uppercase font-bold text-slate-400 mb-1">Total Responses</p>
            <p className="text-3xl font-extrabold text-indigo-400">{dashboard.totalResponses}</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 pb-2 flex-wrap">
          <button onClick={() => setTab('dashboard')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'dashboard' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <BarChart3 size={16} /> Dashboard
          </button>
          <button onClick={() => setTab('surveys')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'surveys' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <ClipboardList size={16} /> Surveys
          </button>
          <button onClick={() => setTab('pulses')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'pulses' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Zap size={16} /> Pulse Checks
          </button>
          <button onClick={() => setTab('analytics')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'analytics' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <TrendingUp size={16} /> Analytics
          </button>
        </div>

        {tab === 'dashboard' && <DashboardTab dashboard={dashboard} />}
        {tab === 'surveys' && <SurveysTab surveys={surveys} />}
        {tab === 'pulses' && <PulsesTab pulses={pulses} />}
        {tab === 'analytics' && <AnalyticsTab analytics={analytics} />}
      </div>
    </div>
  );
}
