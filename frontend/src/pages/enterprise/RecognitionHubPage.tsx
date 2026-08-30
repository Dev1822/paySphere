/**
 * @fileoverview Recognition Hub Page
 * @description Enterprise-grade peer recognition hub with value-based nominations,
 * approval workflows, monthly cycles, and leaderboard analytics.
 */
import React, { useState, useMemo } from 'react';
import {
  Award, Star, TrendingUp, Users, Trophy, Calendar, ChevronRight,
  Plus, CheckCircle, XCircle, Clock, BarChart3,
} from 'lucide-react';
import type { Nomination } from '../../types/nomination';
import {
  generateNominationCategories,
  generateNominations,
  generateLeaderboard,
  generateCycles,
  generateNominationDashboard,
} from '../../services/nominationService';
import NominationStats from '../../components/reports/NominationStats';
import NominationBoard from '../../components/reports/NominationBoard';

type HubTab = 'dashboard' | 'nominations' | 'leaderboard' | 'cycles';

function CycleStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    OPEN: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
    DRAFT: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-400' },
    CLOSED: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
    FINALIZED: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
  };
  const c = config[status] || config.DRAFT;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

// ─── Leaderboard Tab ─────────────────────────────────────────────────────────

function LeaderboardTab({ leaderboard }: { leaderboard: ReturnType<typeof generateLeaderboard> }) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            All-Time Leaderboard
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-5 py-3 w-12">Rank</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3 text-center">Nominations</th>
                <th className="px-5 py-3 text-center">Categories</th>
                <th className="px-5 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {leaderboard.map((entry, i) => (
                <tr
                  key={entry._id}
                  className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition ${
                    i < 3 ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''
                  }`}
                >
                  <td className="px-5 py-3">
                    {i < 3 ? (
                      <span className="text-lg">{medals[i]}</span>
                    ) : (
                      <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {entry.employeeName.charAt(0)}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{entry.employeeName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">{entry.department}</td>
                  <td className="px-5 py-3 text-center font-bold text-gray-900 dark:text-white">{entry.nominationCount}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-[10px] font-bold">
                      {entry.categoryCount} types
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-lg font-extrabold text-amber-600">{entry.totalPoints}</span>
                    <span className="text-[10px] text-gray-400 ml-1">pts</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Cycles Tab ──────────────────────────────────────────────────────────────

function CyclesTab({ cycles }: { cycles: ReturnType<typeof generateCycles> }) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar size={16} className="text-indigo-500" />
          Recognition Cycles
        </h3>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> New Cycle
        </button>
      </div>

      <div className="space-y-3">
        {cycles.map((cycle) => (
          <div
            key={cycle._id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{cycle.title}</h4>
                <p className="text-[10px] text-gray-400">
                  {monthNames[cycle.month - 1]} {cycle.year} · {new Date(cycle.startDate).toLocaleDateString('en-IN')} — {new Date(cycle.endDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <CycleStatusBadge status={cycle.status} />
            </div>

            {cycle.status === 'FINALIZED' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-extrabold text-indigo-600">{cycle.totalNominations}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Nominations</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-extrabold text-amber-600">{cycle.totalPointsAwarded}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Points Awarded</p>
                </div>
              </div>
            )}

            {cycle.status === 'OPEN' && (
              <div className="flex items-center gap-2 mt-2">
                <button className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition">
                  Finalize Cycle
                </button>
                <button className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition">
                  View Nominations
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Hub Page ───────────────────────────────────────────────────────────

export default function RecognitionHubPage() {
  const [tab, setTab] = useState<HubTab>('dashboard');
  const [loading, setLoading] = useState(true);

  const categories = useMemo(() => generateNominationCategories(), []);
  const nominations = useMemo(() => generateNominations(35), []);
  const leaderboard = useMemo(() => generateLeaderboard(), []);
  const cycles = useMemo(() => generateCycles(), []);
  const dashboard = useMemo(() => generateNominationDashboard(), []);

  // Simulate loading
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const handleApprove = (id: string) => {
    // In production: POST /api/nominations/:id/approve
    console.log('Approve:', id);
  };

  const handleReject = (id: string) => {
    // In production: POST /api/nominations/:id/reject
    console.log('Reject:', id);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-gray-500 font-bold">
          <Award size={32} className="animate-bounce text-amber-500" />
          <p>Loading Recognition Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 px-6 py-8 text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Award size={32} /> Recognition Hub
            </h1>
            <p className="text-amber-100 mt-2">Celebrate achievements, recognize values, and build a culture of appreciation.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <p className="text-xs uppercase font-bold text-amber-100 mb-1">Monthly Nominations</p>
            <p className="text-3xl font-extrabold">{dashboard.monthNominations}</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 pb-2 flex-wrap">
          <button
            onClick={() => setTab('dashboard')}
            className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${
              tab === 'dashboard' ? 'bg-white dark:bg-slate-800 shadow text-amber-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 size={16} /> Dashboard
          </button>
          <button
            onClick={() => setTab('nominations')}
            className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${
              tab === 'nominations' ? 'bg-white dark:bg-slate-800 shadow text-amber-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Award size={16} /> Nominations
          </button>
          <button
            onClick={() => setTab('leaderboard')}
            className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${
              tab === 'leaderboard' ? 'bg-white dark:bg-slate-800 shadow text-amber-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Trophy size={16} /> Leaderboard
          </button>
          <button
            onClick={() => setTab('cycles')}
            className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${
              tab === 'cycles' ? 'bg-white dark:bg-slate-800 shadow text-amber-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar size={16} /> Cycles
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'dashboard' && (
          <NominationStats dashboard={dashboard} categories={categories} leaderboard={leaderboard} />
        )}
        {tab === 'nominations' && (
          <NominationBoard
            nominations={nominations}
            categories={categories}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
        {tab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} />}
        {tab === 'cycles' && <CyclesTab cycles={cycles} />}
      </div>
    </div>
  );
}
