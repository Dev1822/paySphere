/**
 * @fileoverview Helpdesk & Ticketing Hub Page
 * @description Enterprise helpdesk with SLA tracking, priority routing,
 * ticket threads, and analytics dashboard.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Headphones, Clock, AlertTriangle, CheckCircle, XCircle, Search,
  Plus, MessageSquare, User, ChevronRight, BarChart3, Ticket,
  Shield, ArrowUpRight, RotateCcw, Eye, Filter,
} from 'lucide-react';
import type { Ticket as TicketType, TicketPriority, TicketStatus } from '../../types/ticketHub';
import {
  generateTicketCategories,
  generateTickets,
  generateTicketComments,
  generateTicketDashboard,
} from '../../services/ticketHubService';

type HubTab = 'dashboard' | 'tickets' | 'sla';

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config: Record<string, { bg: string; text: string }> = {
    LOW: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-600 dark:text-gray-400' },
    MEDIUM: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    HIGH: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
    URGENT: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400 animate-pulse' },
  };
  const c = config[priority] || config.MEDIUM;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    OPEN: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', icon: <Ticket size={10} /> },
    IN_PROGRESS: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', icon: <Clock size={10} /> },
    WAITING_ON_EMPLOYEE: { bg: 'bg-purple-100 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', icon: <User size={10} /> },
    WAITING_ON_THIRD_PARTY: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', icon: <ArrowUpRight size={10} /> },
    RESOLVED: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', icon: <CheckCircle size={10} /> },
    CLOSED: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-600 dark:text-gray-400', icon: <XCircle size={10} /> },
    REOPENED: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', icon: <RotateCcw size={10} /> },
  };
  const c = config[status] || config.OPEN;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.icon} {status.replace(/_/g, ' ')}
    </span>
  );
}

function SLAIndicator({ dueAt, breached }: { dueAt: string | null; breached: boolean }) {
  if (!dueAt) return <span className="text-[10px] text-gray-400">N/A</span>;
  const remaining = new Date(dueAt).getTime() - Date.now();
  const hours = Math.round(remaining / 3600000);

  if (breached || hours < 0) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold">
        <AlertTriangle size={10} /> BREACHED
      </span>
    );
  }
  if (hours < 4) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-orange-600 font-bold">
        <Clock size={10} /> {hours}h left
      </span>
    );
  }
  return (
    <span className="text-[10px] text-green-600 font-semibold">
      {hours}h remaining
    </span>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

function DashboardTab({ dashboard }: { dashboard: ReturnType<typeof generateTicketDashboard> }) {
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Headphones size={14} />
            <span className="text-[10px] uppercase font-bold">Total Tickets</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{dashboard.totalTickets}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Ticket size={14} />
            <span className="text-[10px] uppercase font-bold">Open</span>
          </div>
          <p className="text-xl font-extrabold text-blue-600">{dashboard.openTickets}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Clock size={14} />
            <span className="text-[10px] uppercase font-bold">In Progress</span>
          </div>
          <p className="text-xl font-extrabold text-amber-600">{dashboard.inProgressTickets}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-200 dark:border-green-900/30">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle size={14} />
            <span className="text-[10px] uppercase font-bold">Resolved</span>
          </div>
          <p className="text-xl font-extrabold text-green-600">{dashboard.resolvedTickets}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle size={14} />
            <span className="text-[10px] uppercase font-bold">SLA Breached</span>
          </div>
          <p className="text-xl font-extrabold text-red-600">{dashboard.breachedTickets}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-500" />
            Tickets by Priority
          </h3>
          <div className="space-y-3">
            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => {
              const count = dashboard.ticketsByPriority[p] || 0;
              const total = dashboard.totalTickets || 1;
              return (
                <div key={p} className="flex items-center gap-3">
                  <PriorityBadge priority={p} />
                  <div className="flex-1 bg-gray-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${(count / total) * 100}%`,
                      backgroundColor: p === 'URGENT' ? '#ef4444' : p === 'HIGH' ? '#f97316' : p === 'MEDIUM' ? '#3b82f6' : '#9ca3af',
                    }} />
                  </div>
                  <span className="text-xs font-extrabold text-gray-900 dark:text-white w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield size={16} className="text-indigo-500" />
            By Category
          </h3>
          <div className="space-y-2">
            {dashboard.ticketsByCategory.map((cat) => (
              <div key={cat._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-900/50 transition">
                <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex-1 truncate">{cat.name}</span>
                <span className="text-xs font-extrabold text-gray-900 dark:text-white">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution Metrics */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-indigo-500" />
            Resolution Metrics
          </h3>
          <div className="space-y-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
              <p className="text-3xl font-extrabold text-indigo-600">{dashboard.avgResolutionHours}h</p>
              <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">Avg Resolution Time</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                <p className="text-lg font-extrabold text-green-600">{dashboard.resolvedTickets}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Resolved</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <p className="text-lg font-extrabold text-red-600">{dashboard.breachedTickets}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Breached</p>
              </div>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
              <p className="text-lg font-extrabold text-amber-600">
                {dashboard.totalTickets > 0 ? Math.round((dashboard.resolvedTickets / dashboard.totalTickets) * 100) : 0}%
              </p>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Resolution Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Ticket size={16} className="text-indigo-500" />
            Recent Tickets
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-5 py-3">Ticket</th>
                <th className="px-5 py-3">Requester</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">SLA</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {dashboard.recentTickets.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-5 py-3">
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">{t.ticketNumber}</p>
                    <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{t.subject}</p>
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold">{t.requesterId.fullName}</td>
                  <td className="px-5 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3"><SLAIndicator dueAt={t.resolutionDueAt} breached={t.slaBreached} /></td>
                  <td className="px-5 py-3 text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tickets Tab ─────────────────────────────────────────────────────────────

function TicketsTab({ tickets, categories }: { tickets: TicketType[]; categories: ReturnType<typeof generateTicketCategories> }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [comments, setComments] = useState<ReturnType<typeof generateTicketComments>>([]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.ticketNumber.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const handleTicketClick = (ticket: TicketType) => {
    setSelectedTicket(ticket);
    setComments(generateTicketComments(ticket._id, 4));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..."
            className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none">
          <option value="all">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none">
          <option value="all">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> New Ticket
        </button>
        <span className="text-xs text-gray-400">{filtered.length} tickets</span>
      </div>

      {/* Ticket Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-5 py-3">Ticket</th>
                <th className="px-5 py-3">Requester</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Assignee</th>
                <th className="px-5 py-3">SLA</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.slice(0, 20).map((t) => (
                <tr key={t._id} className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition ${t.slaBreached ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                  <td className="px-5 py-3">
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">{t.ticketNumber}</p>
                    <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{t.subject}</p>
                  </td>
                  <td className="px-5 py-3 text-xs">{t.requesterId.fullName}</td>
                  <td className="px-5 py-3">
                    {typeof t.categoryId === 'object' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: t.categoryId.color + '20', color: t.categoryId.color }}>
                        {t.categoryId.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3 text-xs text-gray-500">{t.assigneeName || '—'}</td>
                  <td className="px-5 py-3"><SLAIndicator dueAt={t.resolutionDueAt} breached={t.slaBreached} /></td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleTicketClick(t)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition" title="View">
                      <Eye size={12} className="text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Detail Panel */}
      {selectedTicket && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setSelectedTicket(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-slate-950 shadow-2xl border-l border-gray-200 dark:border-slate-800 flex flex-col">
            <div className="bg-slate-900 px-6 py-5 text-white flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-extrabold">{selectedTicket.ticketNumber}</span>
                    <PriorityBadge priority={selectedTicket.priority} />
                    <StatusBadge status={selectedTicket.status} />
                  </div>
                  <p className="text-sm text-slate-300 mt-1">{selectedTicket.subject}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span>By: {selectedTicket.requesterId.fullName}</span>
                    <span>Assigned: {selectedTicket.assigneeName || 'Unassigned'}</span>
                    <span>{new Date(selectedTicket.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-2 rounded-lg hover:bg-slate-800 transition">
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-slate-400">{selectedTicket.description}</p>
              </div>

              {selectedTicket.resolutionNote && (
                <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900/20">
                  <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase mb-1">Resolution</p>
                  <p className="text-sm text-green-800 dark:text-green-300">{selectedTicket.resolutionNote}</p>
                </div>
              )}

              <h4 className="text-xs font-bold text-gray-500 uppercase">Conversation</h4>
              {comments.map((c) => (
                <div key={c._id} className={`p-3 rounded-lg ${c.isSystemEvent ? 'bg-gray-100 dark:bg-slate-900 text-center' : c.isInternal ? 'bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/20' : 'bg-blue-50 dark:bg-blue-900/10'}`}>
                  {c.isSystemEvent ? (
                    <p className="text-[10px] text-gray-400 italic">{c.content}</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{c.authorName}</span>
                        <span className="text-[9px] text-gray-400 uppercase">{c.authorType}</span>
                        {c.isInternal && <span className="text-[9px] font-bold text-yellow-600 bg-yellow-100 px-1 rounded">Internal</span>}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{c.content}</p>
                      <p className="text-[9px] text-gray-400 mt-1">{new Date(c.createdAt).toLocaleString('en-IN')}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SLA Tab ─────────────────────────────────────────────────────────────────

function SLATab({ policies }: { policies: ReturnType<typeof generateSLAPolicies> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield size={16} className="text-indigo-500" />
          SLA Policies
        </h3>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> Add Policy
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {policies.map((policy) => (
          <div key={policy._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{policy.name}</h4>
                <PriorityBadge priority={policy.priority} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-lg font-extrabold text-blue-600">{policy.firstResponseHours}h</p>
                <p className="text-[9px] text-gray-400 uppercase font-bold">First Response</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-lg font-extrabold text-indigo-600">{policy.resolutionHours}h</p>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Resolution</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-lg font-extrabold text-amber-600">{policy.escalationAfterHours}h</p>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Escalation</p>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-gray-400">
              {policy.businessHoursOnly ? 'Business hours only' : '24/7'} · Escalation: {policy.escalationContact || 'Default'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HelpdeskHubPage() {
  const [tab, setTab] = useState<HubTab>('dashboard');
  const [loading, setLoading] = useState(true);

  const categories = useMemo(() => generateTicketCategories(), []);
  const tickets = useMemo(() => generateTickets(35), []);
  const dashboard = useMemo(() => generateTicketDashboard(), []);
  const slaPolicies = useMemo(() => generateSLAPolicies(), []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-gray-500 font-bold">
          <Headphones size={32} className="animate-bounce text-indigo-500" />
          <p>Loading Helpdesk Hub...</p>
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
              <Headphones size={32} className="text-indigo-400" /> Helpdesk & Ticketing Hub
            </h1>
            <p className="text-slate-400 mt-2">Manage employee support requests with SLA tracking and priority routing.</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-xs uppercase font-bold text-slate-400 mb-1">SLA Breached</p>
            <p className="text-3xl font-extrabold text-red-400">{dashboard.breachedTickets}</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 pb-2 flex-wrap">
          <button onClick={() => setTab('dashboard')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'dashboard' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <BarChart3 size={16} /> Dashboard
          </button>
          <button onClick={() => setTab('tickets')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'tickets' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Ticket size={16} /> Tickets
          </button>
          <button onClick={() => setTab('sla')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'sla' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Shield size={16} /> SLA Policies
          </button>
        </div>

        {tab === 'dashboard' && <DashboardTab dashboard={dashboard} />}
        {tab === 'tickets' && <TicketsTab tickets={tickets} categories={categories} />}
        {tab === 'sla' && <SLATab policies={slaPolicies} />}
      </div>
    </div>
  );
}
