/**
 * HelpdeskTicketList.jsx - HR Ticket Management
 *
 * Displays escalated HR support tickets with status, priority, and timestamps.
 * HR admins can filter by status and priority, and update ticket status.
 */
import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

const PRIORITY_STYLES = {
  Low:    { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  Medium: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  High:   { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  Urgent: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

const STATUS_STYLES = {
  'Open':        { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  'In Progress': { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  'Resolved':    { bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  'Closed':      { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' },
};

export default function HelpdeskTicketList({ refreshTrigger }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, [refreshTrigger]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/helpdesk/tickets').catch(() => ({ data: { tickets: [] } }));
      setTickets(res.data.tickets || []);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...tickets];
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [tickets, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'Open').length,
    inProgress: tickets.filter((t) => t.status === 'In Progress').length,
    resolved: tickets.filter((t) => t.status === 'Resolved').length,
  }), [tickets]);

  const updateStatus = async (ticketId, newStatus) => {
    try {
      await api.patch(`/api/helpdesk/tickets/${ticketId}`, { status: newStatus });
      setTickets((prev) =>
        prev.map((t) => (t._id === ticketId ? { ...t, status: newStatus } : t))
      );
      setSelectedTicket(null);
    } catch (err) {
      alert('Failed to update ticket status.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🎫 HR Support Tickets
          </h3>
          <button onClick={fetchTickets} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-3">
          {[
            { label: 'Open', value: stats.open, color: 'emerald' },
            { label: 'In Progress', value: stats.inProgress, color: 'blue' },
            { label: 'Resolved', value: stats.resolved, color: 'purple' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <div className={`w-2 h-2 rounded-full bg-${s.color}-500`} />
              {s.label}: <span className="font-semibold text-gray-700 dark:text-slate-300">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            <option value="all">All Priority</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Ticket List */}
      <div className="divide-y divide-gray-50 dark:divide-slate-800/50 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            Loading tickets...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-sm text-gray-500 dark:text-slate-400">No tickets matching your filters.</p>
          </div>
        ) : (
          filtered.map((ticket) => {
            const pStyle = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.Medium;
            const sStyle = STATUS_STYLES[ticket.status] || STATUS_STYLES['Open'];
            return (
              <div
                key={ticket._id}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                onClick={() => setSelectedTicket(selectedTicket?._id === ticket._id ? null : ticket)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pStyle.bg} ${pStyle.text}`}>
                        {ticket.priority}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${sStyle.dot}`} />
                        <span className={`text-[10px] font-semibold uppercase ${sStyle.text}`}>
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {ticket.subject}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                      {ticket.originalQuery}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                      {ticket.employeeId?.fullName || 'Employee'} · {new Date(ticket.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {selectedTicket?._id === ticket._id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-3">
                    {ticket.aiResponse && (
                      <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                        <div className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">
                          AI Response
                        </div>
                        <p className="text-xs text-gray-700 dark:text-slate-300">{ticket.aiResponse}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {['Open', 'In Progress', 'Resolved', 'Closed'].map((status) => (
                        <button
                          key={status}
                          onClick={(e) => { e.stopPropagation(); updateStatus(ticket._id, status); }}
                          disabled={ticket.status === status}
                          className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                            ticket.status === status
                              ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed'
                              : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-400'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
