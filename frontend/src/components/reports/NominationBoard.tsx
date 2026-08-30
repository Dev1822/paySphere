/**
 * @fileoverview Nomination Board Component
 * @description A scrollable feed of peer nominations with category filters,
 * reaction display, and approve/reject actions for managers.
 */
import React, { useMemo, useState } from 'react';
import {
  Award, Heart, ThumbsUp, MessageCircle, Clock, CheckCircle, XCircle, Filter,
  ChevronDown, Star, Zap, Users, Globe, Lightbulb,
} from 'lucide-react';
import type { Nomination, NominationCategory, NominationStatus } from '../../types/nomination';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  lightbulb: <Lightbulb size={14} />,
  users: <Users size={14} />,
  heart: <Heart size={14} />,
  star: <Star size={14} />,
  zap: <Zap size={14} />,
  globe: <Globe size={14} />,
};

function StatusPill({ status }: { status: NominationStatus }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    APPROVED: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', icon: <CheckCircle size={10} /> },
    PENDING_APPROVAL: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', icon: <Clock size={10} /> },
    REJECTED: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', icon: <XCircle size={10} /> },
    EXPIRED: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-400', icon: <Clock size={10} /> },
  };
  const c = config[status] || config.PENDING_APPROVAL;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.icon} {status.replace(/_/g, ' ')}
    </span>
  );
}

function NominationCard({ nomination, onApprove, onReject }: {
  nomination: Nomination;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const category = nomination.categoryId;
  const isPending = nomination.status === 'PENDING_APPROVAL';
  const isExpanded = false; // Could be a controlled state

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition">
      {/* Category header bar */}
      <div
        className="h-1"
        style={{ backgroundColor: typeof category === 'object' ? category.color : '#6366f1' }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ backgroundColor: typeof category === 'object' ? category.color : '#6366f1' }}
            >
              {typeof category === 'object' && CATEGORY_ICONS[category.icon] ? CATEGORY_ICONS[category.icon] : <Star size={16} />}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {nomination.title}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {typeof category === 'object' ? category.name : 'Recognition'} · {nomination.pointsAwarded} pts
              </p>
            </div>
          </div>
          <StatusPill status={nomination.status} />
        </div>

        {/* Nominee & nominator */}
        <div className="flex items-center gap-4 mb-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600">
              {typeof nomination.nomineeId === 'object' ? nomination.nomineeId.fullName.charAt(0) : '?'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {typeof nomination.nomineeId === 'object' ? nomination.nomineeId.fullName : 'Unknown'}
              </p>
              <p className="text-[10px] text-gray-400">Nominee</p>
            </div>
          </div>
          <span className="text-gray-300 dark:text-slate-600">←</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-900 flex items-center justify-center text-[10px] font-bold text-gray-500">
              {typeof nomination.nominatorId === 'object' ? nomination.nominatorId.fullName.charAt(0) : '?'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {typeof nomination.nominatorId === 'object' ? nomination.nominatorId.fullName : 'Unknown'}
              </p>
              <p className="text-[10px] text-gray-400">Nominator</p>
            </div>
          </div>
        </div>

        {/* Reason */}
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed mb-3 line-clamp-3">
          {nomination.reason}
        </p>

        {nomination.impactDescription && (
          <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20">
            <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase mb-1">Impact</p>
            <p className="text-xs text-green-800 dark:text-green-300">{nomination.impactDescription}</p>
          </div>
        )}

        {/* Footer: reactions, comments, actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {/* Reactions */}
            {nomination.reactions.length > 0 && (
              <div className="flex items-center gap-1">
                {nomination.reactions.map((r, i) => (
                  <span key={i} className="bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
                    {r.emoji} {r.count}
                  </span>
                ))}
              </div>
            )}
            <span className="flex items-center gap-1">
              <ThumbsUp size={12} /> {nomination.reactionCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} /> {nomination.commentCount}
            </span>
          </div>

          {/* Manager actions */}
          {isPending && onApprove && onReject && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onReject(nomination._id)}
                className="px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                Reject
              </button>
              <button
                onClick={() => onApprove(nomination._id)}
                className="px-3 py-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
              >
                Approve
              </button>
            </div>
          )}

          <span className="text-[10px] text-gray-400">
            {new Date(nomination.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
    </div>
  );
}

interface NominationBoardProps {
  nominations: Nomination[];
  categories: NominationCategory[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function NominationBoard({ nominations, categories, onApprove, onReject }: NominationBoardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filtered = useMemo(() => {
    return nominations.filter((n) => {
      if (selectedCategory !== 'all' && n.categoryId?._id !== selectedCategory) return false;
      if (selectedStatus !== 'all' && n.status !== selectedStatus) return false;
      return true;
    });
  }, [nominations, selectedCategory, selectedStatus]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Filter size={14} />
          <span className="font-bold">Filter:</span>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} nominations</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((nomination) => (
          <NominationCard
            key={nomination._id}
            nomination={nomination}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <Award size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">No nominations match the current filters.</p>
        </div>
      )}
    </div>
  );
}
