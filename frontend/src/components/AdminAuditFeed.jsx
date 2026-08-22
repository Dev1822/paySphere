/**
 * AdminAuditFeed.jsx - Tenant Admin Dashboard
 *
 * Recent audit log feed showing all mutations across the tenant.
 * Displays actor, action, resource, timestamp, and details.
 * Supports filtering by action type and actor.
 */
import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

const ACTION_STYLES = {
  CREATE: { icon: '➕', color: 'text-emerald-600 dark:text-emerald-400' },
  UPDATE: { icon: '✏️', color: 'text-blue-600 dark:text-blue-400' },
  DELETE: { icon: '🗑️', color: 'text-red-600 dark:text-red-400' },
  APPROVE: { icon: '✅', color: 'text-emerald-600 dark:text-emerald-400' },
  REJECT: { icon: '❌', color: 'text-red-600 dark:text-red-400' },
  LOGIN: { icon: '🔑', color: 'text-purple-600 dark:text-purple-400' },
  EXPORT: { icon: '📤', color: 'text-amber-600 dark:text-amber-400' },
  IMPORT: { icon: '📥', color: 'text-amber-600 dark:text-amber-400' },
  PAYROLL_RUN: { icon: '💰', color: 'text-green-600 dark:text-green-400' },
  default: { icon: '📋', color: 'text-gray-600 dark:text-gray-400' },
};

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminAuditFeed({ limit = 20 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/audit-logs', {
        params: { limit, page: 1 },
      });
      setLogs(res.data.logs || res.data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map((l) => l.action));
    return ['all', ...Array.from(actions)];
  }, [logs]);

  const filtered = useMemo(() => {
    let result = [...logs];
    if (actionFilter !== 'all') {
      result = result.filter((l) => l.action === actionFilter);
    }
    if (actorFilter.trim()) {
      const q = actorFilter.toLowerCase();
      result = result.filter(
        (l) =>
          (l.userId?.fullName || '').toLowerCase().includes(q) ||
          (l.userId?.email || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, actionFilter, actorFilter]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📋 Audit Trail
            <span className="text-xs font-normal text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {filtered.length} entries
            </span>
          </h2>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a === 'all' ? 'All Actions' : a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Filter by actor..."
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none flex-1"
          />
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-gray-50 dark:divide-slate-800/50 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
            <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading audit trail...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
            No audit entries found.
          </div>
        ) : (
          filtered.map((log, idx) => {
            const actionStyle = ACTION_STYLES[log.action] || ACTION_STYLES.default;
            return (
              <div key={log._id || idx} className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                    {actionStyle.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {log.userId?.fullName || 'System'}
                      </span>
                      <span className={`text-xs font-semibold uppercase ${actionStyle.color}`}>
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {log.resourceType}
                      </span>
                    </div>
                    {log.details && (
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">
                        {formatTime(log.createdAt)}
                      </span>
                      {log.ip && (
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                          {log.ip}
                        </span>
                      )}
                      {log.result && (
                        <span className={`text-[10px] font-semibold uppercase ${
                          log.result === 'success' ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {log.result}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
