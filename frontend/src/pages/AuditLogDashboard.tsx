import React, { useEffect, useState } from 'react';
import { AuditLogService } from '../services/AuditLogService';
import { AuditLogFilter } from '../components/audit/AuditLogFilter';
import { AuditLogTimeline } from '../components/audit/AuditLogTimeline';
import { AuditLog, AuditLogFilterOptions } from '../types/auditLog';
import { ShieldCheck, ActivitySquare, AlertOctagon, Activity, FileDown, Eye, X } from 'lucide-react';

export const AuditLogDashboard: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<AuditLogFilterOptions>({});
    const [stats, setStats] = useState({ total: 0, warning: 0, critical: 0, today: 0 });
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await AuditLogService.getLogs(filters, page, 50);
            setLogs(data.data);
            setTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        const s = await AuditLogService.getLogstats();
        setStats(s);
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [filters, page]);

    const handleFilterChange = (newFilters: AuditLogFilterOptions) => {
        setFilters(newFilters);
        setPage(1); // Reset to page 1
    };

    const exportCSV = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Timestamp,Actor,Email,Action,Severity,IP\n"
            + logs.map(e => `${e.timestamp},${e.actor.name},${e.actor.email},${e.action},${e.severity},${e.metadata.ipAddress}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "audit_logs.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-10 font-sans text-gray-900 dark:text-gray-100 flex justify-center">
            <div className="max-w-7xl w-full">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-indigo-600/10 p-2 rounded-lg">
                                <ShieldCheck className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight">Security & Audit Logs</h1>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 max-w-2xl text-sm leading-relaxed">
                            Comprehensive timeline of all system activities, authentication events, and critical configuration changes across the PaySphere infrastructure.
                        </p>
                    </div>

                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        <FileDown className="w-4 h-4" />
                        Export Selected (CSV)
                    </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Events', val: stats.total.toLocaleString(), icon: ActivitySquare, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
                        { label: 'Events Today', val: stats.today.toLocaleString(), icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
                        { label: 'Security Warnings', val: stats.warning.toLocaleString(), icon: AlertOctagon, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/40' },
                        { label: 'Critical Errors', val: stats.critical.toLocaleString(), icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                            <div className={`p-3 rounded-full ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</h3>
                                <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{stat.val}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <AuditLogFilter onFilterChange={handleFilterChange} isLoading={loading} />

                {/* Timeline */}
                <AuditLogTimeline logs={logs} onRowClick={setSelectedLog} />

                {/* Pagination Skeleton (simplified for speed) */}
                {!loading && total > 50 && (
                    <div className="mt-6 flex justify-between items-center bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
                        <span className="text-sm text-gray-500">Showing {logs.length} of {total} results</span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 text-gray-800 dark:text-white dark:border-gray-700"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white dark:border-gray-700"
                            >
                                Next Page
                            </button>
                        </div>
                    </div>
                )}

            </div>

            {/* Action Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden shadow-indigo-900/20 border border-gray-200 dark:border-gray-800">
                        <div className="flex justifying-between items-center p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                            <div className="flex gap-3 items-center w-full">
                                <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
                                    <Eye className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h2 className="text-lg font-bold">Event Details</h2>
                                <div className="flex-1" />
                                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">Actor</h4>
                                    <div className="flex items-center gap-2">
                                        <img src={selectedLog.actor.avatarUrl} className="w-6 h-6 rounded-full" alt="avatar" />
                                        <span className="font-medium text-sm">{selectedLog.actor.name}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">{selectedLog.actor.email}</p>
                                </div>

                                <div>
                                    <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">Timing</h4>
                                    <p className="text-sm font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                                    <p className="text-sm text-gray-500 mt-1">Timezone: {selectedLog.metadata.location?.timezone || 'Unknown'}</p>
                                </div>

                                <div>
                                    <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">Action Identifier</h4>
                                    <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-1.5 rounded inline-block text-indigo-600 dark:text-indigo-400">
                                        {selectedLog.action}
                                    </p>
                                </div>

                                <div>
                                    <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">Resource Affected</h4>
                                    <p className="text-sm">{selectedLog.resource.type} • <span className="font-medium text-gray-900 dark:text-gray-100">{selectedLog.resource.name}</span></p>
                                </div>
                            </div>

                            <hr className="my-6 border-gray-100 dark:border-gray-800" />

                            <div>
                                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Request Metadata</h4>
                                <div className="bg-gray-900 text-gray-200 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                                    <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex justify-end bg-gray-50 dark:bg-gray-800/40">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
                            >
                                Close Audit
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AuditLogDashboard;
