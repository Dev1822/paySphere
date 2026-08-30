import React, { useState, useEffect, useCallback } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import { AuditLogEntry, AuditAction } from '../../types/fraudRisk';
import {
    Search, ChevronLeft, ChevronRight, Clock, User, Shield, AlertTriangle,
    Ban, Bell, Eye, Lock, Unlock, Zap, Settings, RotateCcw, FileText,
    Filter, Download, RefreshCw, GitBranch,
} from 'lucide-react';

export const AuditTrail: React.FC = () => {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<AuditAction | 'ALL'>('ALL');
    const [targetFilter, setTargetFilter] = useState<string>('ALL');

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        const result = await FraudRiskService.getAuditTrail(search, actionFilter, targetFilter, page, 20);
        setEntries(result.entries);
        setTotal(result.total);
        setPages(result.pages);
        setLoading(false);
    }, [search, actionFilter, targetFilter, page]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const getActionIcon = (action: AuditAction) => {
        switch (action) {
            case 'ALERT_CREATED': return <AlertTriangle className="w-4 h-4" />;
            case 'ALERT_ESCALATED': return <Shield className="w-4 h-4" />;
            case 'ALERT_RESOLVED': return <Eye className="w-4 h-4" />;
            case 'ALERT_FALSE_POSITIVE': return <RotateCcw className="w-4 h-4" />;
            case 'TXN_BLOCKED': return <Ban className="w-4 h-4" />;
            case 'TXN_FLAGGED': return <AlertTriangle className="w-4 h-4" />;
            case 'ACCOUNT_FROZEN': return <Lock className="w-4 h-4" />;
            case 'ACCOUNT_UNFROZEN': return <Unlock className="w-4 h-4" />;
            case 'BLOCKLIST_ADD': return <Ban className="w-4 h-4" />;
            case 'BLOCKLIST_REMOVE': return <Unlock className="w-4 h-4" />;
            case 'RULE_ENABLED': return <Zap className="w-4 h-4" />;
            case 'RULE_DISABLED': return <Zap className="w-4 h-4" />;
            case 'RULE_CREATED': return <Zap className="w-4 h-4" />;
            case 'RULE_MODIFIED': return <Settings className="w-4 h-4" />;
            case 'INVESTIGATION_STARTED': return <Search className="w-4 h-4" />;
            case 'INVESTIGATION_COMPLETED': return <FileText className="w-4 h-4" />;
            case 'SETTINGS_CHANGED': return <Settings className="w-4 h-4" />;
            case 'MANUAL_REVIEW': return <Eye className="w-4 h-4" />;
        }
    };

    const getActionColor = (action: AuditAction) => {
        if (action.includes('BLOCKED') || action.includes('FROZEN') || action.includes('BLOCKLIST_ADD')) return 'text-rose-500 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400';
        if (action.includes('FLAGGED') || action.includes('ESCALATED') || action.includes('CREATED')) return 'text-orange-500 bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400';
        if (action.includes('RESOLVED') || action.includes('UNFROZEN') || action.includes('COMPLETED') || action.includes('REMOVE')) return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400';
        if (action.includes('ENABLED') || action.includes('STARTED')) return 'text-blue-500 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400';
        return 'text-gray-500 bg-gray-100 dark:bg-gray-500/15 dark:text-gray-400';
    };

    const getTimelineNodeColor = (action: AuditAction) => {
        if (action.includes('BLOCKED') || action.includes('FROZEN') || action.includes('BLOCKLIST_ADD')) return 'bg-rose-500';
        if (action.includes('FLAGGED') || action.includes('ESCALATED') || action.includes('CREATED')) return 'bg-orange-500';
        if (action.includes('RESOLVED') || action.includes('UNFROZEN') || action.includes('COMPLETED')) return 'bg-emerald-500';
        if (action.includes('ENABLED') || action.includes('STARTED')) return 'bg-blue-500';
        return 'bg-gray-400';
    };

    const getTargetTypeIcon = (type: string) => {
        switch (type) {
            case 'ALERT': return <AlertTriangle className="w-3 h-3" />;
            case 'TRANSACTION': return <GitBranch className="w-3 h-3" />;
            case 'CUSTOMER': return <User className="w-3 h-3" />;
            case 'BLOCKLIST': return <Ban className="w-3 h-3" />;
            case 'RULE': return <Zap className="w-3 h-3" />;
            case 'SYSTEM': return <Settings className="w-3 h-3" />;
            case 'SETTINGS': return <Settings className="w-3 h-3" />;
            default: return <FileText className="w-3 h-3" />;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-100 dark:bg-cyan-500/20 p-2.5 rounded-xl">
                            <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Audit Trail</h3>
                            <p className="text-xs text-gray-500">{total} activity logs • Immutable record</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchEntries()}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm font-medium px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Download className="w-4 h-4" /> Export
                        </button>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-3 mt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search audit logs..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white placeholder-gray-400"
                        />
                    </div>
                    <select
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value as AuditAction | 'ALL'); setPage(1); }}
                        className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    >
                        <option value="ALL">All Actions</option>
                        <option value="ALERT_CREATED">Alert Created</option>
                        <option value="ALERT_ESCALATED">Alert Escalated</option>
                        <option value="ALERT_RESOLVED">Alert Resolved</option>
                        <option value="TXN_BLOCKED">Txn Blocked</option>
                        <option value="TXN_FLAGGED">Txn Flagged</option>
                        <option value="ACCOUNT_FROZEN">Account Frozen</option>
                        <option value="BLOCKLIST_ADD">Blocklist Add</option>
                        <option value="RULE_ENABLED">Rule Enabled</option>
                        <option value="RULE_DISABLED">Rule Disabled</option>
                        <option value="INVESTIGATION_STARTED">Investigation Started</option>
                        <option value="INVESTIGATION_COMPLETED">Investigation Completed</option>
                        <option value="SETTINGS_CHANGED">Settings Changed</option>
                    </select>
                    <select
                        value={targetFilter}
                        onChange={(e) => { setTargetFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    >
                        <option value="ALL">All Targets</option>
                        <option value="ALERT">Alerts</option>
                        <option value="TRANSACTION">Transactions</option>
                        <option value="CUSTOMER">Customers</option>
                        <option value="BLOCKLIST">Blocklist</option>
                        <option value="RULE">Rules</option>
                        <option value="SYSTEM">System</option>
                    </select>
                </div>
            </div>

            {/* Timeline */}
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-6 space-y-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-4 animate-pulse">
                                <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full mt-1.5" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-64" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-96" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="p-16 text-center">
                        <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="font-semibold text-gray-900 dark:text-gray-100">No audit entries found</p>
                    </div>
                ) : (
                    <div className="p-6">
                        {entries.map((entry, idx) => (
                            <div key={entry.id} className="relative pl-8 pb-8 last:pb-0 group">
                                {/* Timeline Line */}
                                {idx < entries.length - 1 && (
                                    <div className="absolute left-[5px] top-3 bottom-0 w-0.5 bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/20 transition-colors" />
                                )}

                                {/* Timeline Node */}
                                <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ring-4 ring-white dark:ring-gray-900 ${getTimelineNodeColor(entry.action)} group-hover:ring-indigo-100 dark:group-hover:ring-indigo-500/20 transition-all`} />

                                {/* Content */}
                                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-shadow ml-2">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-1.5 rounded-lg ${getActionColor(entry.action)}`}>
                                                {getActionIcon(entry.action)}
                                            </div>
                                            <div>
                                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                    {entry.action.replace(/_/g, ' ')}
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-mono text-gray-400">{entry.targetId}</span>
                                                    <span className="text-[10px] text-gray-300 dark:text-gray-600">•</span>
                                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-400">
                                                        {getTargetTypeIcon(entry.targetType)}
                                                        {entry.targetType}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(entry.timestamp).toLocaleString('en-US', {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                        {entry.targetDescription}
                                    </p>

                                    <div className="flex items-center justify-between text-xs text-gray-400">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                <span className="font-medium text-gray-600 dark:text-gray-400">{entry.actor.split('@')[0]}</span>
                                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-gray-100 dark:bg-gray-800 rounded">{entry.actorRole}</span>
                                            </span>
                                            <span className="font-mono text-[10px]">{entry.ipAddress}</span>
                                        </div>
                                        {entry.riskImpact !== undefined && (
                                            <span className={`font-bold ${entry.riskImpact > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                Risk {entry.riskImpact > 0 ? '+' : ''}{entry.riskImpact.toFixed(1)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Value Changes */}
                                    {entry.previousValue && entry.newValue && (
                                        <div className="mt-3 flex items-center gap-2 text-xs">
                                            <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded font-mono line-through">{entry.previousValue}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded font-mono">{entry.newValue}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                    <span className="text-sm text-gray-500">
                        Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                            const startPage = Math.max(1, Math.min(page - 2, pages - 4));
                            const pageNum = startPage + i;
                            if (pageNum > pages) return null;
                            return (
                                <button key={pageNum} onClick={() => setPage(pageNum)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                        pageNum === page ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}>
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
