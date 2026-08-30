import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Info, Clock, AlertTriangle, UserCheck, CreditCard, Key, Settings, Globe } from 'lucide-react';
import { AuditLog, AuditLogCategory, AuditLogSeverity } from '../../types/auditLog';

interface AuditLogTimelineProps {
    logs: AuditLog[];
    onRowClick?: (log: AuditLog) => void;
}

export const AuditLogTimeline: React.FC<AuditLogTimelineProps> = ({ logs, onRowClick }) => {
    if (!logs || logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm min-h-[400px]">
                <ShieldAlert className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No logs found</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try adjusting your filters or search term</p>
            </div>
        );
    }

    const getSeverityIcon = (severity: AuditLogSeverity) => {
        switch (severity) {
            case 'CRITICAL': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'ERROR': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
            case 'WARNING': return <Info className="w-5 h-5 text-yellow-500" />;
            default: return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
        }
    };

    const getCategoryIcon = (category: AuditLogCategory) => {
        switch (category) {
            case 'AUTHENTICATION': return <UserCheck className="w-4 h-4 text-purple-500" />;
            case 'USER_MANAGEMENT': return <Settings className="w-4 h-4 text-indigo-500" />;
            case 'PAYMENT_PROCESSING': return <CreditCard className="w-4 h-4 text-emerald-500" />;
            case 'SECURITY_SETTINGS': return <Key className="w-4 h-4 text-rose-500" />;
            case 'SYSTEM_CONFIG': return <ShieldAlert className="w-4 h-4 text-orange-500" />;
            case 'API_ACCESS': return <Globe className="w-4 h-4 text-cyan-500" />;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 uppercase text-gray-500 dark:text-gray-400 text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 w-16">Status</th>
                            <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 w-48">Timestamp</th>
                            <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">Action & Resource</th>
                            <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 w-64">Actor</th>
                            <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 w-48 text-right">Identifier</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {logs.map((log) => (
                            <tr
                                key={log.id}
                                onClick={() => onRowClick && onRowClick(log)}
                                className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
                            >
                                {/* Status Column */}
                                <td className="px-6 py-4 align-top pt-5">
                                    <div className="flex justify-center group-hover:scale-110 transition-transform">
                                        {getSeverityIcon(log.severity)}
                                    </div>
                                </td>

                                {/* Timestamp */}
                                <td className="px-6 py-4 align-top pt-5">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900 dark:text-gray-200">
                                            {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </td>

                                {/* Action & Details */}
                                <td className="px-6 py-4 align-top pt-4">
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 shrink-0">
                                            {getCategoryIcon(log.category)}
                                        </div>
                                        <div className="flex flex-col max-w-md whitespace-normal">
                                            <span className="font-medium text-gray-900 dark:text-gray-100 mb-0.5">{log.action}</span>
                                            <span className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2">{log.description}</span>
                                            {log.status === 'FAILURE' && (
                                                <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400 px-2 py-0.5 rounded w-max">
                                                    Action Failed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4 align-top pt-4">
                                    <div className="flex items-center gap-3">
                                        <img src={log.actor.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(log.actor.name)}&background=random`} alt={log.actor.name} className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-gray-900 shadow-sm" />
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 dark:text-gray-200 text-sm">{log.actor.name}</span>
                                            <span className="text-gray-500 dark:text-gray-500 text-xs">{log.actor.email}</span>
                                        </div>
                                    </div>
                                </td>

                                {/* Identifier */}
                                <td className="px-6 py-4 align-top pt-5 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                            {log.metadata.ipAddress}
                                        </span>
                                        <span className="text-xs text-gray-400 mt-2">
                                            {log.resource.type}: {log.resource.name}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
