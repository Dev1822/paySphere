import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

/* ─────────────────────── MOCK DATA ─────────────────────── */
const EMPLOYEES = [
  { id: 1, name: 'Priya Sharma', dept: 'Engineering', avatar: '👩‍💻', role: 'Senior Developer' },
  { id: 2, name: 'Rahul Verma', dept: 'Marketing', avatar: '👨‍💼', role: 'Marketing Lead' },
  { id: 3, name: 'Ananya Patel', dept: 'Design', avatar: '👩‍🎨', role: 'UX Designer' },
  { id: 4, name: 'Vikram Singh', dept: 'Finance', avatar: '👨‍💻', role: 'Financial Analyst' },
  { id: 5, name: 'Neha Gupta', dept: 'HR', avatar: '👩‍💼', role: 'HR Manager' },
  { id: 6, name: 'Arjun Mehta', dept: 'Engineering', avatar: '👨‍💻', role: 'Tech Lead' },
  { id: 7, name: 'Sneha Reddy', dept: 'Sales', avatar: '👩‍💼', role: 'Sales Executive' },
  { id: 8, name: 'Karthik Nair', dept: 'Operations', avatar: '👨‍💼', role: 'Ops Manager' },
  { id: 9, name: 'Pooja Joshi', dept: 'Legal', avatar: '👩‍⚖️', role: 'Legal Counsel' },
  { id: 10, name: 'Aditya Kumar', dept: 'Engineering', avatar: '👨‍💻', role: 'DevOps Engineer' },
  { id: 11, name: 'Deepika Menon', dept: 'Marketing', avatar: '👩‍💻', role: 'Content Strategist' },
  { id: 12, name: 'Rohit Das', dept: 'Sales', avatar: '👨‍💼', role: 'Regional Head' },
];

const BADGES = [
  { id: 'team-player', name: 'Team Player', icon: '🤝', color: '#3b82f6', desc: 'Collaborated exceptionally with cross-functional teams' },
  { id: 'innovator', name: 'Innovator', icon: '💡', color: '#a855f7', desc: 'Brought creative solutions to challenging problems' },
  { id: 'above-beyond', name: 'Above & Beyond', icon: '🚀', color: '#f59e0b', desc: 'Exceeded expectations on a critical deliverable' },
  { id: 'mentor', name: 'Mentor', icon: '🎓', color: '#22c55e', desc: 'Guided and supported team members in their growth' },
  { id: 'speed-demon', name: 'Speed Demon', icon: '⚡', color: '#ef4444', desc: 'Delivered results ahead of schedule with high quality' },
  { id: 'customer-hero', name: 'Customer Hero', icon: '🦸', color: '#06b6d4', desc: 'Went the extra mile for customer satisfaction' },
  { id: 'problem-solver', name: 'Problem Solver', icon: '🧩', color: '#f97316', desc: 'Resolved a critical issue that impacted the entire team' },
  { id: 'culture-champion', name: 'Culture Champion', icon: '🌟', color: '#ec4899', desc: 'Embodied company values and inspired others' },
];

const MOCK_KUDOS = [
  { id: 1, from: EMPLOYEES[1], to: EMPLOYEES[0], badge: BADGES[0], message: 'Thank you for always being the first to jump in and help with code reviews. Your patience and thoroughness make the whole team better!', date: '2026-08-27', reactions: { '❤️': 5, '👏': 8, '🔥': 3 } },
  { id: 2, from: EMPLOYEES[5], to: EMPLOYEES[2], badge: BADGES[1], message: 'The new dashboard design concept you presented was brilliant! Love how you simplified the complex data flows into intuitive visual patterns.', date: '2026-08-26', reactions: { '❤️': 12, '👏': 6, '✨': 4 } },
  { id: 3, from: EMPLOYEES[0], to: EMPLOYEES[3], badge: BADGES[2], message: 'The Q3 financial model you built saved us from a potential budget overrun. Incredible attention to detail and proactive communication!', date: '2026-08-25', reactions: { '❤️': 7, '👏': 11, '🎉': 5 } },
  { id: 4, from: EMPLOYEES[4], to: EMPLOYEES[6], badge: BADGES[5], message: 'You handled that escalated client call with such grace and professionalism. Turned a potential churn into a renewed 2-year contract!', date: '2026-08-24', reactions: { '❤️': 9, '👏': 14, '💪': 6 } },
  { id: 5, from: EMPLOYEES[9], to: EMPLOYEES[9], badge: BADGES[3], message: 'The onboarding docs and video tutorials you created for new DevOps hires are the gold standard. Three new hires cited them as their best resource!', date: '2026-08-23', reactions: { '❤️': 6, '👏': 9, '📚': 3 } },
  { id: 6, from: EMPLOYEES[7], to: EMPLOYEES[4], badge: BADGES[7], message: 'The team retreat you organized was outstanding! Everyone came back energized and more connected. You truly are our culture champion.', date: '2026-08-22', reactions: { '❤️': 15, '👏': 12, '🎉': 8 } },
  { id: 7, from: EMPLOYEES[3], to: EMPLOYEES[10], badge: BADGES[4], message: 'Content calendar delivered a week early with all assets ready for review. Your efficiency and quality are unmatched!', date: '2026-08-21', reactions: { '❤️': 4, '👏': 7, '⚡': 5 } },
  { id: 8, from: EMPLOYEES[6], to: EMPLOYEES[11], badge: BADGES[6], message: 'You identified the pipeline bottleneck that was slowing down the entire sales team. Saved us thousands in lost productivity!', date: '2026-08-20', reactions: { '❤️': 8, '👏': 10, '🧩': 4 } },
  { id: 9, from: EMPLOYEES[8], to: EMPLOYEES[5], badge: BADGES[2], message: 'Leading the API migration project under tight deadlines while mentoring two junior devs — that is truly above and beyond!', date: '2026-08-19', reactions: { '❤️': 11, '👏': 13, '🚀': 7 } },
  { id: 10, from: EMPLOYEES[2], to: EMPLOYEES[1], badge: BADGES[7], message: 'Your brand refresh campaign boosted social engagement by 200%. You embody our creative spirit and company values every day!', date: '2026-08-18', reactions: { '❤️': 10, '👏': 8, '🌟': 6 } },
  { id: 11, from: EMPLOYEES[10], to: EMPLOYEES[0], badge: BADGES[1], message: 'The API rate limiting solution you designed was elegant and performant. Saved us from scaling issues before they happened!', date: '2026-08-17', reactions: { '❤️': 6, '💡': 9, '👏': 5 } },
  { id: 12, from: EMPLOYEES[11], to: EMPLOYEES[8], badge: BADGES[0], message: 'Pooja, your cross-team compliance workshops have been a game-changer. Legal and Sales are finally aligned on contract terms!', date: '2026-08-16', reactions: { '❤️': 7, '🤝': 11, '👏': 4 } },
];

const RECOGNITION_STATS = {
  totalKudos: 348,
  thisMonth: 42,
  avgReactions: 8.2,
  topBadge: 'Team Player',
  badgesAwarded: 285,
  streaks: [
    { employee: 'Priya Sharma', days: 14, avatar: '👩‍💻' },
    { employee: 'Rahul Verma', days: 11, avatar: '👨‍💼' },
    { employee: 'Neha Gupta', days: 9, avatar: '👩‍💼' },
  ]
};

const MONTHLY_TRENDS = [
  { month: 'Mar', kudos: 28, badges: 22 },
  { month: 'Apr', kudos: 32, badges: 27 },
  { month: 'May', kudos: 38, badges: 31 },
  { month: 'Jun', kudos: 35, badges: 29 },
  { month: 'Jul', kudos: 40, badges: 33 },
  { month: 'Aug', kudos: 42, badges: 35 },
];

/* ─────────────────────── SVG CHART COMPONENTS ─────────────────────── */
function TrendChart({ data, height = 100 }) {
  const maxK = Math.max(...data.map(d => d.kudos));
  const width = 300;
  const kudosPoints = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - 15 - (d.kudos / maxK) * (height - 30)}`).join(' ');
  const badgePoints = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - 15 - (d.badges / maxK) * (height - 30)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }}>
      <defs>
        <linearGradient id="kudosGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" /><stop offset="100%" stopColor="#a855f7" stopOpacity="0" /></linearGradient>
        <linearGradient id="badgeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" /></linearGradient>
      </defs>
      <polygon points={`0,${height - 15} ${kudosPoints} ${width},${height - 15}`} fill="url(#kudosGrad)" />
      <polyline points={kudosPoints} fill="none" stroke="#a855f7" strokeWidth="2" />
      <polygon points={`0,${height - 15} ${badgePoints} ${width},${height - 15}`} fill="url(#badgeGrad)" />
      <polyline points={badgePoints} fill="none" stroke="#22c55e" strokeWidth="2" />
      {data.map((d, i) => <text key={i} x={(i / (data.length - 1)) * width} y={height - 2} textAnchor="middle" fill="#9ca3af" fontSize="8">{d.month}</text>)}
    </svg>
  );
}

function BadgeBar({ count, max, color, label, icon }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">{label}</span>
          <span className="font-bold" style={{ color }}>{count}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function EmployeeRecognitionWall() {
  const [activeTab, setActiveTab] = useState('wall');
  const [filterBadge, setFilterBadge] = useState('all');
  const [showNewKudo, setShowNewKudo] = useState(false);
  const [newKudo, setNewKudo] = useState({ to: '', badge: '', message: '' });

  const filteredKudos = useMemo(() =>
    filterBadge === 'all' ? MOCK_KUDOS : MOCK_KUDOS.filter(k => k.badge.id === filterBadge),
    [filterBadge]
  );

  const leaderBoard = useMemo(() => {
    const counts = {};
    MOCK_KUDOS.forEach(k => {
      counts[k.to.id] = (counts[k.to.id] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, count]) => ({ ...EMPLOYEES.find(e => e.id === parseInt(id)), kudos: count }))
      .sort((a, b) => b.kudos - a.kudos)
      .slice(0, 10);
  }, []);

  const badgeCounts = useMemo(() => {
    const counts = {};
    BADGES.forEach(b => { counts[b.id] = 0; });
    MOCK_KUDOS.forEach(k => { counts[k.badge.id]++; });
    return counts;
  }, []);

  const maxBadgeCount = Math.max(...Object.values(badgeCounts));

  const tabs = [
    { id: 'wall', label: '🏆 Recognition Wall' },
    { id: 'leaderboard', label: '🥇 Leaderboard' },
    { id: 'badges', label: '🎖️ Badges' },
    { id: 'analytics', label: '📊 Analytics' },
  ];

  const handleSubmitKudo = () => {
    if (!newKudo.to || !newKudo.badge || !newKudo.message) return;
    alert(`Kudo sent to ${EMPLOYEES.find(e => e.id === parseInt(newKudo.to))?.name}! 🎉`);
    setShowNewKudo(false);
    setNewKudo({ to: '', badge: '', message: '' });
  };

  return (
    <>
      <Helmet><title>Employee Recognition Wall — PaySphere</title></Helmet>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🏆 Employee Recognition Wall</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Celebrate achievements, give peer kudos, and track recognition across the team</p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button onClick={() => setShowNewKudo(true)} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-500/25">
                ✨ Give Kudos
              </button>
            </div>
          </div>

          {/* QUICK STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-purple-500">{RECOGNITION_STATS.totalKudos}</div>
              <div className="text-xs text-gray-500">Total Kudos</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-emerald-500">{RECOGNITION_STATS.thisMonth}</div>
              <div className="text-xs text-gray-500">This Month</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-amber-500">{RECOGNITION_STATS.badgesAwarded}</div>
              <div className="text-xs text-gray-500">Badges Awarded</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-blue-500">🔥 {RECOGNITION_STATS.streaks[0].days}d</div>
              <div className="text-xs text-gray-500">Top Streak</div>
              <div className="text-[10px] text-gray-400">{RECOGNITION_STATS.streaks[0].avatar} {RECOGNITION_STATS.streaks[0].employee}</div>
            </div>
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

          {/* ═══════════ WALL TAB ═══════════ */}
          {activeTab === 'wall' && (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button onClick={() => setFilterBadge('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterBadge === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                  All Kudos
                </button>
                {BADGES.map(b => (
                  <button key={b.id} onClick={() => setFilterBadge(b.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${filterBadge === b.id ? 'text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}
                    style={filterBadge === b.id ? { backgroundColor: b.color } : {}}>
                    {b.icon} {b.name}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                {filteredKudos.map(k => (
                  <div key={k.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{k.to.avatar}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{k.from.avatar}</span>
                          <span className="text-xs text-gray-500">{k.from.name} recognized</span>
                          <span className="text-lg">{k.to.avatar}</span>
                          <span className="text-sm font-bold">{k.to.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: k.badge.color }}>
                            {k.badge.icon} {k.badge.name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mt-2 italic">"{k.message}"</p>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] text-gray-500">📅 {k.date}</span>
                          <div className="flex gap-2">
                            {Object.entries(k.reactions).map(([emoji, count]) => (
                              <button key={emoji} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                                {emoji} <span className="text-gray-400">{count}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ LEADERBOARD TAB ═══════════ */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-4">🥇 Most Recognized Employees</h3>
                <div className="space-y-3">
                  {leaderBoard.map((emp, i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const medalColors = ['text-amber-400', 'text-gray-300', 'text-amber-600'];
                    return (
                      <div key={emp.id} className={`flex items-center gap-4 p-3 rounded-xl transition ${i < 3 ? 'bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                        <div className={`text-xl ${i < 3 ? medalColors[i] : 'text-gray-500'} font-bold w-8 text-center`}>{i < 3 ? medals[i] : `#${i + 1}`}</div>
                        <div className="text-2xl">{emp.avatar}</div>
                        <div className="flex-1">
                          <div className="text-sm font-bold">{emp.name}</div>
                          <div className="text-[10px] text-gray-500">{emp.role} · {emp.dept}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-purple-500">{emp.kudos}</div>
                          <div className="text-[10px] text-gray-500">kudos received</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">🔥 Recognition Streaks</h3>
                <div className="grid grid-cols-3 gap-3">
                  {RECOGNITION_STATS.streaks.map((s, i) => (
                    <div key={i} className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <div className="text-2xl">{s.avatar}</div>
                      <div className="text-xs font-bold mt-1">{s.employee}</div>
                      <div className="text-lg font-black text-amber-500">🔥 {s.days} days</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ BADGES TAB ═══════════ */}
          {activeTab === 'badges' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {BADGES.map(b => (
                  <div key={b.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center hover:shadow-md transition">
                    <div className="text-4xl mb-2">{b.icon}</div>
                    <h4 className="text-sm font-bold">{b.name}</h4>
                    <div className="text-xl font-black mt-1" style={{ color: b.color }}>{badgeCounts[b.id]}</div>
                    <p className="text-[10px] text-gray-400 mt-2">{b.desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">📊 Badge Distribution</h3>
                <div className="space-y-3">
                  {BADGES.map(b => (
                    <BadgeBar key={b.id} count={badgeCounts[b.id]} max={maxBadgeCount} color={b.color} label={b.name} icon={b.icon} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ ANALYTICS TAB ═══════════ */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-4">📈 Monthly Kudos & Badges Trend</h3>
                <TrendChart data={MONTHLY_TRENDS} height={140} />
                <div className="flex justify-center gap-6 mt-3">
                  <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-purple-500" /> Kudos</div>
                  <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-emerald-500" /> Badges</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">🏢 Department Recognition</h3>
                  <div className="space-y-2">
                    {Object.entries(
                      MOCK_KUDOS.reduce((acc, k) => { acc[k.to.dept] = (acc[k.to.dept] || 0) + 1; return acc; }, {})
                    ).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
                      <div key={dept} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-24">{dept}</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                          <div className="h-2 rounded-full bg-purple-500" style={{ width: `${(count / MOCK_KUDOS.length) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-purple-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📋 Key Insights</h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                      <span className="font-bold text-purple-600">🏆 Top Badge:</span> <span className="text-gray-600 dark:text-gray-300"> "Team Player" leads with the most awards — collaboration is our strongest value.</span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <span className="font-bold text-emerald-600">📈 Growth:</span> <span className="text-gray-600 dark:text-gray-300"> Kudos increased 50% from March to August (28→42). Recognition culture is thriving!</span>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <span className="font-bold text-amber-600">🏢 Top Team:</span> <span className="text-gray-600 dark:text-gray-300"> Engineering leads in recognition volume. Priya Sharma holds the longest active streak at 14 days.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ NEW KUDO MODAL ═══════════ */}
      {showNewKudo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewKudo(false)}>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">✨ Give Kudos</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">To:</label>
                <select value={newKudo.to} onChange={e => setNewKudo({ ...newKudo, to: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  <option value="">Select employee...</option>
                  {EMPLOYEES.map(e => <option key={e.id} value={e.id}>{e.avatar} {e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Badge:</label>
                <div className="grid grid-cols-4 gap-2">
                  {BADGES.map(b => (
                    <button key={b.id} onClick={() => setNewKudo({ ...newKudo, badge: b.id })}
                      className={`p-2 rounded-xl text-center transition border ${newKudo.badge === b.id ? 'border-purple-500 bg-purple-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}>
                      <div className="text-xl">{b.icon}</div>
                      <div className="text-[9px] text-gray-500 mt-1">{b.name}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Message:</label>
                <textarea value={newKudo.message} onChange={e => setNewKudo({ ...newKudo, message: e.target.value })}
                  placeholder="Write your kudos message..."
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm h-24 resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewKudo(false)} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold">Cancel</button>
                <button onClick={handleSubmitKudo} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700">Send Kudos 🎉</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
