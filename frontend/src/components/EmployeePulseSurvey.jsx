import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

/* ─────────────────────── MOCK DATA ─────────────────────── */
const SURVEYS = [
  {
    id: 1,
    title: 'Q3 2026 Employee Pulse',
    status: 'Active',
    responses: 142,
    totalInvited: 180,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    questions: 8,
    avgEngagement: 72,
    avgSatisfaction: 68,
    avgRecommendation: 7.2,
  },
  {
    id: 2,
    title: 'Q2 2026 Employee Pulse',
    status: 'Closed',
    responses: 165,
    totalInvited: 175,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    questions: 8,
    avgEngagement: 69,
    avgSatisfaction: 65,
    avgRecommendation: 6.8,
  },
  {
    id: 3,
    title: 'Q1 2026 Employee Pulse',
    status: 'Closed',
    responses: 158,
    totalInvited: 170,
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    questions: 6,
    avgEngagement: 66,
    avgSatisfaction: 63,
    avgRecommendation: 6.5,
  },
  {
    id: 4,
    title: 'Q4 2025 Employee Pulse',
    status: 'Closed',
    responses: 140,
    totalInvited: 165,
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    questions: 6,
    avgEngagement: 64,
    avgSatisfaction: 61,
    avgRecommendation: 6.2,
  },
];

const QUESTIONS = [
  {
    id: 1,
    text: 'How engaged do you feel with your work?',
    type: 'scale',
    category: 'Engagement',
  },
  {
    id: 2,
    text: 'How satisfied are you with your work-life balance?',
    type: 'scale',
    category: 'Wellbeing',
  },
  {
    id: 3,
    text: 'Do you feel recognized for your contributions?',
    type: 'scale',
    category: 'Recognition',
  },
  {
    id: 4,
    text: 'How likely are you to recommend this company as a workplace?',
    type: 'nps',
    category: 'eNPS',
  },
  {
    id: 5,
    text: "How confident are you in the company's leadership direction?",
    type: 'scale',
    category: 'Leadership',
  },
  {
    id: 6,
    text: 'Do you have the resources you need to do your job effectively?',
    type: 'scale',
    category: 'Resources',
  },
  {
    id: 7,
    text: 'How would you describe the team collaboration?',
    type: 'scale',
    category: 'Culture',
  },
  {
    id: 8,
    text: 'Any suggestions for improvement? (Optional)',
    type: 'text',
    category: 'Feedback',
  },
];

const DEPARTMENTS = [
  'Engineering',
  'Marketing',
  'Sales',
  'HR',
  'Finance',
  'Design',
  'Operations',
  'Legal',
];

const MOCK_RESPONSES = Array.from({ length: 142 }, (_, i) => ({
  id: i + 1,
  department: DEPARTMENTS[i % 8],
  responses: {
    1: Math.floor(Math.random() * 5) + 5,
    2: Math.floor(Math.random() * 6) + 4,
    3: Math.floor(Math.random() * 6) + 3,
    4: Math.floor(Math.random() * 4) + 6,
    5: Math.floor(Math.random() * 5) + 5,
    6: Math.floor(Math.random() * 6) + 4,
    7: Math.floor(Math.random() * 5) + 5,
    8: [
      'Need more flexible hours',
      'Great team culture!',
      'More training opportunities needed',
      'Love the remote work policy',
      'Better communication from management',
      'The onboarding process is excellent',
      'Would like more career growth paths',
      'Health benefits are great',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ][i % 15],
  },
  submittedAt: new Date(
    2026,
    7,
    Math.floor(Math.random() * 28) + 1,
  ).toISOString(),
}));

const SENTIMENT_KEYWORDS = {
  positive: [
    'love',
    'great',
    'excellent',
    'amazing',
    'fantastic',
    'happy',
    'appreciate',
    'thankful',
    'excited',
    'motivated',
    'supportive',
    'flexible',
    'growth',
    'opportunity',
  ],
  negative: [
    'need',
    'more',
    'better',
    'improve',
    'lack',
    'poor',
    'difficult',
    'frustrated',
    'concerned',
    'burnout',
    'stressed',
    'overworked',
    'micromanagement',
    'unclear',
  ],
  neutral: [
    'okay',
    'fine',
    'average',
    'normal',
    'decent',
    'standard',
    'regular',
    'typical',
    'usual',
    'acceptable',
  ],
};

const MOCK_SUGGESTIONS = [
  {
    text: 'Need more flexible hours',
    sentiment: 'negative',
    department: 'Engineering',
    date: '2026-08-05',
    count: 12,
  },
  {
    text: 'Great team culture!',
    sentiment: 'positive',
    department: 'Marketing',
    date: '2026-08-03',
    count: 18,
  },
  {
    text: 'More training opportunities needed',
    sentiment: 'negative',
    department: 'Sales',
    date: '2026-08-07',
    count: 8,
  },
  {
    text: 'Love the remote work policy',
    sentiment: 'positive',
    department: 'Design',
    date: '2026-08-02',
    count: 22,
  },
  {
    text: 'Better communication from management',
    sentiment: 'negative',
    department: 'Operations',
    date: '2026-08-10',
    count: 15,
  },
  {
    text: 'The onboarding process is excellent',
    sentiment: 'positive',
    department: 'HR',
    date: '2026-08-04',
    count: 9,
  },
  {
    text: 'Would like more career growth paths',
    sentiment: 'negative',
    department: 'Finance',
    date: '2026-08-08',
    count: 11,
  },
  {
    text: 'Health benefits are great',
    sentiment: 'positive',
    department: 'Legal',
    date: '2026-08-06',
    count: 7,
  },
  {
    text: 'Workload redistribution needed in my team',
    sentiment: 'negative',
    department: 'Engineering',
    date: '2026-08-09',
    count: 14,
  },
  {
    text: 'Appreciate the learning budget',
    sentiment: 'positive',
    department: 'Design',
    date: '2026-08-11',
    count: 6,
  },
];

const QUARTERLY_TRENDS = [
  { quarter: 'Q4 2025', engagement: 64, satisfaction: 61, enps: 6.2 },
  { quarter: 'Q1 2026', engagement: 66, satisfaction: 63, enps: 6.5 },
  { quarter: 'Q2 2026', engagement: 69, satisfaction: 65, enps: 6.8 },
  { quarter: 'Q3 2026', engagement: 72, satisfaction: 68, enps: 7.2 },
];

/* ─────────────────────── UTILITY FUNCTIONS ─────────────────────── */
function analyzeSentiment(text) {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  const posCount = SENTIMENT_KEYWORDS.positive.filter((w) =>
    lower.includes(w),
  ).length;
  const negCount = SENTIMENT_KEYWORDS.negative.filter((w) =>
    lower.includes(w),
  ).length;
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

function getSentimentColor(sentiment) {
  switch (sentiment) {
    case 'positive':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        icon: '😊',
      };
    case 'negative':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/30',
        icon: '😟',
      };
    default:
      return {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        icon: '😐',
      };
  }
}

function getENPSCategory(score) {
  if (score >= 8)
    return {
      label: 'Excellent',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
    };
  if (score >= 6)
    return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-500/20' };
  if (score >= 4)
    return {
      label: 'Needs Work',
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
    };
  return { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20' };
}

/* ─────────────────────── SVG CHART COMPONENTS ─────────────────────── */
function GaugeChart({ value, max = 10, size = 100, label }) {
  const radius = (size - 12) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference - (value / max) * circumference;
  const color =
    value >= 8
      ? '#22c55e'
      : value >= 6
        ? '#3b82f6'
        : value >= 4
          ? '#f59e0b'
          : '#ef4444';
  return (
    <div className="text-center">
      <svg
        width={size}
        height={size / 2 + 10}
        viewBox={`0 0 ${size} ${size / 2 + 10}`}
      >
        <path
          d={`M 6 ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2 + 4}`}
          fill="none"
          stroke="#374151"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M 6 ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2 + 4}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
        />
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fill={color}
          fontSize="18"
          fontWeight="bold"
        >
          {value.toFixed(1)}
        </text>
      </svg>
      <div className="text-[10px] text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function BarChart({ data, maxValue = 10, height = 200 }) {
  const barWidth = Math.floor(300 / data.length);
  return (
    <svg
      viewBox={`0 0 300 ${height}`}
      className="w-full"
      style={{ height: `${height}px` }}
    >
      {data.map((d, i) => {
        const barHeight = (d.value / maxValue) * (height - 30);
        const color =
          d.value >= 8
            ? '#22c55e'
            : d.value >= 6
              ? '#3b82f6'
              : d.value >= 4
                ? '#f59e0b'
                : '#ef4444';
        return (
          <g key={i}>
            <rect
              x={i * barWidth + 8}
              y={height - barHeight - 20}
              width={barWidth - 16}
              height={barHeight}
              rx="4"
              fill={color}
              opacity="0.8"
            />
            <text
              x={i * barWidth + barWidth / 2}
              y={height - barHeight - 25}
              textAnchor="middle"
              fill={color}
              fontSize="10"
              fontWeight="bold"
            >
              {d.value.toFixed(1)}
            </text>
            <text
              x={i * barWidth + barWidth / 2}
              y={height - 5}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="8"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TrendLine({ data, keys, colors, height = 120 }) {
  const allVals = data.flatMap((d) => keys.map((k) => d[k]));
  const max = Math.max(...allVals);
  const min = Math.min(...allVals);
  const range = max - min || 1;
  const width = 300;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: `${height}px` }}
    >
      {keys.map((key, ki) => {
        const points = data
          .map(
            (d, i) =>
              `${(i / (data.length - 1)) * width},${height - 20 - ((d[key] - min) / range) * (height - 40)}`,
          )
          .join(' ');
        return (
          <polyline
            key={ki}
            points={points}
            fill="none"
            stroke={colors[ki]}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {data.map((d, i) => (
        <text
          key={i}
          x={(i / (data.length - 1)) * width}
          y={height - 4}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize="8"
        >
          {d.quarter}
        </text>
      ))}
    </svg>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function EmployeePulseSurvey() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedSurvey, setSelectedSurvey] = useState(SURVEYS[0]);
  const [deptFilter, setDeptFilter] = useState('All');

  const currentResponses = useMemo(
    () =>
      MOCK_RESPONSES.filter(
        (r) => deptFilter === 'All' || r.department === deptFilter,
      ),
    [deptFilter],
  );

  const questionAverages = useMemo(() => {
    return QUESTIONS.filter((q) => q.type !== 'text').map((q) => {
      const values = currentResponses
        .map((r) => r.responses[q.id])
        .filter(Boolean);
      return {
        ...q,
        avg:
          values.length > 0
            ? (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
            : 0,
        count: values.length,
      };
    });
  }, [currentResponses]);

  const departmentBreakdown = useMemo(() => {
    const map = {};
    DEPARTMENTS.forEach((d) => {
      map[d] = { count: 0, scores: {} };
    });
    currentResponses.forEach((r) => {
      map[r.department].count++;
      QUESTIONS.filter((q) => q.type !== 'text').forEach((q) => {
        if (!map[r.department].scores[q.id])
          map[r.department].scores[q.id] = [];
        map[r.department].scores[q.id].push(r.responses[q.id]);
      });
    });
    return Object.entries(map)
      .filter(([, v]) => v.count > 0)
      .map(([dept, v]) => {
        const avg = Object.values(v.scores).flat();
        const overall =
          avg.length > 0
            ? (avg.reduce((s, v) => s + v, 0) / avg.length).toFixed(1)
            : 0;
        return { dept, count: v.count, overall: parseFloat(overall) };
      })
      .sort((a, b) => b.overall - a.overall);
  }, [currentResponses]);

  const sentimentBreakdown = useMemo(() => {
    const counts = { positive: 0, negative: 0, neutral: 0 };
    MOCK_SUGGESTIONS.forEach((s) => counts[s.sentiment]++);
    return [
      {
        label: 'Positive',
        value: counts.positive,
        color: '#22c55e',
        icon: '😊',
      },
      {
        label: 'Negative',
        value: counts.negative,
        color: '#ef4444',
        icon: '😟',
      },
      { label: 'Neutral', value: counts.neutral, color: '#3b82f6', icon: '😐' },
    ];
  }, []);

  const filteredSuggestions = useMemo(
    () =>
      MOCK_SUGGESTIONS.filter(
        (s) => deptFilter === 'All' || s.department === deptFilter,
      ),
    [deptFilter],
  );

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'questions', label: '❓ Question Analysis' },
    { id: 'departments', label: '🏢 Departments' },
    { id: 'sentiment', label: '😊 Sentiment' },
    { id: 'trends', label: '📈 Trends' },
  ];

  return (
    <>
      <Helmet>
        <title>Employee Pulse Survey — PaySphere</title>
      </Helmet>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📋 Employee Pulse Survey</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Anonymous feedback, sentiment analysis, and team pulse tracking
              </p>
            </div>
            <ThemeToggle />
          </div>

          {/* SURVEY SELECTOR */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {SURVEYS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSurvey(s)}
                className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${selectedSurvey.id === s.id ? 'bg-purple-600 text-white border-purple-600 shadow-lg' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                <div>{s.title}</div>
                <div className="text-[10px] mt-1 opacity-70">
                  {s.status === 'Active' ? '🟢 Active' : '⚫ Closed'} ·{' '}
                  {s.responses}/{s.totalInvited} responses
                </div>
              </button>
            ))}
          </div>

          {/* TAB NAV */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══════════ OVERVIEW TAB ═══════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
                  <div className="text-3xl font-black text-purple-500">
                    {selectedSurvey.responses}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Responses</div>
                  <div className="text-[10px] text-gray-400">
                    of {selectedSurvey.totalInvited} invited (
                    {Math.round(
                      (selectedSurvey.responses / selectedSurvey.totalInvited) *
                        100,
                    )}
                    %)
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
                  <GaugeChart
                    value={selectedSurvey.avgEngagement / 10}
                    label="Engagement"
                  />
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
                  <GaugeChart
                    value={selectedSurvey.avgSatisfaction / 10}
                    label="Satisfaction"
                  />
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
                  <GaugeChart
                    value={selectedSurvey.avgRecommendation}
                    label="eNPS Score"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* QUESTION AVERAGES */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">
                    📊 Question Averages
                  </h3>
                  <BarChart
                    data={questionAverages.map((q) => ({
                      label: q.category,
                      value: parseFloat(q.avg),
                    }))}
                    height={200}
                  />
                </div>

                {/* SENTIMENT OVERVIEW */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">
                    😊 Sentiment Overview
                  </h3>
                  <div className="space-y-3">
                    {sentimentBreakdown.map((s) => (
                      <div key={s.label} className="flex items-center gap-3">
                        <span className="text-lg">{s.icon}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">{s.label}</span>
                            <span
                              className="font-bold"
                              style={{ color: s.color }}
                            >
                              {s.value} suggestions
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${(s.value / MOCK_SUGGESTIONS.length) * 100}%`,
                                backgroundColor: s.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RESPONSE RATE */}
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">
                  📈 Response Rate by Department
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DEPARTMENTS.map((dept) => {
                    const deptResponses = MOCK_RESPONSES.filter(
                      (r) => r.department === dept,
                    ).length;
                    const deptTotal = 20 + (dept.length % 5); // Deterministic total for purity
                    const rate = Math.round((deptResponses / deptTotal) * 100);
                    return (
                      <div
                        key={dept}
                        className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center"
                      >
                        <div className="text-xs text-gray-500">{dept}</div>
                        <div
                          className={`text-lg font-bold ${rate >= 80 ? 'text-emerald-500' : rate >= 60 ? 'text-blue-500' : 'text-amber-500'}`}
                        >
                          {rate}%
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {deptResponses}/{deptTotal}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ QUESTIONS TAB ═══════════ */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {QUESTIONS.map((q) => {
                const values = currentResponses
                  .map((r) => r.responses[q.id])
                  .filter(Boolean);
                const avg =
                  values.length > 0
                    ? (
                        values.reduce((s, v) => s + v, 0) / values.length
                      ).toFixed(1)
                    : 'N/A';
                const distribution = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                  (n) => ({
                    score: n,
                    count: values.filter((v) => v === n).length,
                    pct:
                      values.length > 0
                        ? Math.round(
                            (values.filter((v) => v === n).length /
                              values.length) *
                              100,
                          )
                        : 0,
                  }),
                );
                const color =
                  parseFloat(avg) >= 8
                    ? '#22c55e'
                    : parseFloat(avg) >= 6
                      ? '#3b82f6'
                      : parseFloat(avg) >= 4
                        ? '#f59e0b'
                        : '#ef4444';
                return (
                  <div
                    key={q.id}
                    className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold">
                          {q.category}
                        </span>
                        <h4 className="text-sm font-bold mt-1">{q.text}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black" style={{ color }}>
                          {avg}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {values.length} responses
                        </div>
                      </div>
                    </div>
                    {q.type === 'text' ? (
                      <div className="mt-3 space-y-1">
                        {MOCK_SUGGESTIONS.filter(
                          (s) =>
                            s.department ===
                            (deptFilter === 'All' ? s.department : deptFilter),
                        )
                          .slice(0, 3)
                          .map((s, i) => {
                            const sc = getSentimentColor(s.sentiment);
                            return (
                              <div
                                key={i}
                                className={`p-2 rounded-lg text-xs ${sc.bg} ${sc.border} border`}
                              >
                                {sc.icon} "{s.text}"{' '}
                                <span className="text-gray-400">
                                  — {s.department}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-1 items-end h-16">
                        {distribution.map((d) => (
                          <div key={d.score} className="flex-1 text-center">
                            <div
                              className="mx-auto rounded-t"
                              style={{
                                width: '80%',
                                height: `${Math.max(d.pct * 0.6, 2)}px`,
                                backgroundColor:
                                  d.score >= 8
                                    ? '#22c55e'
                                    : d.score >= 6
                                      ? '#3b82f6'
                                      : d.score >= 4
                                        ? '#f59e0b'
                                        : '#ef4444',
                                opacity: 0.8,
                              }}
                            />
                            <div className="text-[8px] text-gray-500 mt-1">
                              {d.score}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════════ DEPARTMENTS TAB ═══════════ */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-2">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
                >
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              {departmentBreakdown.map((d) => (
                <div
                  key={d.dept}
                  className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">{d.dept}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {d.count} responses
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${d.overall >= 8 ? 'bg-emerald-500/20 text-emerald-400' : d.overall >= 6 ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}
                      >
                        {d.overall.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{
                        width: `${(d.overall / 10) * 100}%`,
                        backgroundColor:
                          d.overall >= 8
                            ? '#22c55e'
                            : d.overall >= 6
                              ? '#3b82f6'
                              : '#f59e0b',
                      }}
                    />
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400">
                    {d.overall >= 8
                      ? '🌟 Excellent engagement'
                      : d.overall >= 6
                        ? '👍 Good, room to improve'
                        : '⚠️ Needs attention'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════════ SENTIMENT TAB ═══════════ */}
          {activeTab === 'sentiment' && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-2">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm"
                >
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              {filteredSuggestions.map((s, i) => {
                const sc = getSentimentColor(s.sentiment);
                return (
                  <div
                    key={i}
                    className={`bg-white dark:bg-gray-900 p-4 rounded-2xl border ${sc.border} shadow-sm`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xl">{sc.icon}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">"{s.text}"</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}
                          >
                            {s.sentiment}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            🏢 {s.department}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            📅 {s.date}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            👥 {s.count} similar
                          </span>
                        </div>
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
                <h3 className="text-sm font-bold mb-4">
                  📈 Quarterly Trends (Last 4 Quarters)
                </h3>
                <TrendLine
                  data={QUARTERLY_TRENDS}
                  keys={['engagement', 'satisfaction', 'enps']}
                  colors={['#22c55e', '#3b82f6', '#a855f7']}
                  height={150}
                />
                <div className="flex justify-center gap-6 mt-3">
                  <div className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-1 rounded bg-emerald-500" />{' '}
                    Engagement
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-1 rounded bg-blue-500" /> Satisfaction
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-1 rounded bg-purple-500" /> eNPS
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📋 Key Insights</h3>
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        📈 Upward Trend:
                      </span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">
                        Engagement improved by 12.5% over 4 quarters (64→72).
                        Consistent quarter-over-quarter growth.
                      </span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        😊 Sentiment:
                      </span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">
                        60% of written feedback is positive. Remote work policy
                        and team culture are top positives.
                      </span>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        ⚠️ Action Areas:
                      </span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">
                        Flexible hours, training opportunities, and management
                        communication are recurring themes in negative feedback.
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">🏆 Top Themes</h3>
                  <div className="space-y-2">
                    {[
                      {
                        theme: 'Remote Work Policy',
                        sentiment: 'positive',
                        count: 22,
                        icon: '🏠',
                      },
                      {
                        theme: 'Team Culture',
                        sentiment: 'positive',
                        count: 18,
                        icon: '🤝',
                      },
                      {
                        theme: 'Flexible Hours',
                        sentiment: 'negative',
                        count: 12,
                        icon: '⏰',
                      },
                      {
                        theme: 'Career Growth',
                        sentiment: 'negative',
                        count: 11,
                        icon: '📈',
                      },
                      {
                        theme: 'Training',
                        sentiment: 'negative',
                        count: 8,
                        icon: '📚',
                      },
                      {
                        theme: 'Health Benefits',
                        sentiment: 'positive',
                        count: 7,
                        icon: '🏥',
                      },
                    ].map((t) => {
                      const sc = getSentimentColor(t.sentiment);
                      return (
                        <div
                          key={t.theme}
                          className="flex items-center gap-3 p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
                        >
                          <span>{t.icon}</span>
                          <span className="flex-1 text-xs font-medium">
                            {t.theme}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}
                          >
                            {t.sentiment}
                          </span>
                          <span className="text-xs text-gray-500">
                            {t.count}x
                          </span>
                        </div>
                      );
                    })}
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
