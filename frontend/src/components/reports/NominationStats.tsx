/**
 * @fileoverview Nomination Stats Component
 * @description KPI cards, category breakdown, and top nominee spotlight for
 * the Recognition Hub dashboard.
 */
import React from 'react';
import {
  Award, TrendingUp, Users, Clock, Star, Trophy, Zap, Heart, Globe, Lightbulb,
} from 'lucide-react';
import type { NominationDashboard, NominationCategory, LeaderboardEntry } from '../../types/nomination';

const ICON_MAP: Record<string, React.ReactNode> = {
  lightbulb: <Lightbulb size={16} />,
  users: <Users size={16} />,
  heart: <Heart size={16} />,
  star: <Star size={16} />,
  zap: <Zap size={16} />,
  globe: <Globe size={16} />,
};

interface NominationStatsProps {
  dashboard: NominationDashboard;
  categories: NominationCategory[];
  leaderboard: LeaderboardEntry[];
}

export default function NominationStats({ dashboard, categories, leaderboard }: NominationStatsProps) {
  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex justify-between items-center text-gray-500 mb-2">
            <span className="text-xs uppercase font-bold">Total Nominations</span>
            <Award size={18} />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{dashboard.totalNominations}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-200 dark:border-blue-900/30">
          <div className="flex justify-between items-center text-blue-600 mb-2">
            <span className="text-xs uppercase font-bold">This Month</span>
            <TrendingUp size={18} />
          </div>
          <p className="text-2xl font-extrabold text-blue-700">{dashboard.monthNominations}</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-xl border border-amber-200 dark:border-amber-900/30">
          <div className="flex justify-between items-center text-amber-600 mb-2">
            <span className="text-xs uppercase font-bold">Pending Approval</span>
            <Clock size={18} />
          </div>
          <p className="text-2xl font-extrabold text-amber-700">{dashboard.pendingApprovals}</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-xl border border-purple-200 dark:border-purple-900/30">
          <div className="flex justify-between items-center text-purple-600 mb-2">
            <span className="text-xs uppercase font-bold">Categories</span>
            <Star size={18} />
          </div>
          <p className="text-2xl font-extrabold text-purple-700">{dashboard.totalCategories}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Nominee Spotlight */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={20} />
            <h3 className="text-sm font-bold uppercase tracking-wider">Top Nominee This Month</h3>
          </div>
          {dashboard.topNominee?.employee ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-extrabold">
                  {dashboard.topNominee.employee.fullName.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-extrabold">{dashboard.topNominee.employee.fullName}</p>
                  <p className="text-sm text-amber-100">{dashboard.topNominee.employee.department}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-extrabold">{dashboard.topNominee.totalPoints}</p>
                  <p className="text-[10px] uppercase font-bold text-amber-100">Points</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-extrabold">{dashboard.topNominee.count}</p>
                  <p className="text-[10px] uppercase font-bold text-amber-100">Nominations</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-amber-100 text-sm">No nominations yet this month.</p>
          )}
        </div>

        {/* Leaderboard Top 3 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            Leaderboard Top 3
          </h3>
          <div className="space-y-3">
            {topThree.map((entry, i) => (
              <div key={entry._id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-gray-200 text-gray-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.employeeName}</p>
                  <p className="text-[10px] text-gray-400">{entry.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-amber-600">{entry.totalPoints}</p>
                  <p className="text-[10px] text-gray-400">{entry.nominationCount} noms</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Star size={16} className="text-indigo-500" />
            Recognition Categories
          </h3>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat._id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:shadow-sm transition"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                >
                  {ICON_MAP[cat.icon] || <Star size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{cat.name}</p>
                  <p className="text-[10px] text-gray-400">{cat.pointsPerNomination} pts · {cat.maxNominationsPerMonth}/mo</p>
                </div>
                {cat.requiresManagerApproval && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
                    Approval
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
