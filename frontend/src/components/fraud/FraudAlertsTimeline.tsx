import React from 'react';
import { FraudAlert, RiskSeverity } from '../../types/fraudRisk';
import { ShieldAlert, Info, AlertTriangle, AlertOctagon, ExternalLink, Globe, Cpu } from 'lucide-react';

interface FraudAlertsTimelineProps {
    alerts: FraudAlert[];
}

export const FraudAlertsTimeline: React.FC<FraudAlertsTimelineProps> = ({ alerts }) => {
    const getSeverityBadge = (sev: RiskSeverity) => {
        const map = {
            SAFE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
            LOW: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
            MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
            HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
            CRITICAL: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
        };
        return map[sev] || map.SAFE;
    };

    const getStatusBadge = (status: string) => {
        if (status === 'OPEN') return 'border-orange-200 text-orange-600 dark:border-orange-500/30 dark:text-orange-400';
        if (status === 'INVESTIGATING') return 'border-blue-200 text-blue-600 dark:border-blue-500/30 dark:text-blue-400';
        if (status === 'ESCALATED') return 'border-rose-200 text-rose-600 dark:border-rose-500/30 dark:text-rose-400';
        if (status === 'RESOLVED') return 'border-emerald-200 text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-400';
        return 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'; // false positive
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg flex items-center gap-2">
                    <AlertOctagon className="w-5 h-5 text-rose-500" /> Live Threat Intel
                </h3>
                <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">View All Tickets</button>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {alerts.map((a, i) => (
                    <div key={a.id} className="group relative pl-6 border-l-2 border-gray-100 dark:border-gray-800 hover:border-indigo-500 transition-colors pb-6 last:pb-0">
                        {/* Node point */}
                        <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full ring-4 ring-white dark:ring-gray-900 bg-gray-300 dark:bg-gray-600 group-hover:bg-indigo-500 transition-colors" />

                        <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-100 dark:border-gray-750 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${getSeverityBadge(a.severity)}`}>
                                            {a.severity} RISK
                                        </span>
                                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{a.id.substring(0, 12)}</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{a.category.replace(/_/g, ' ')}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${getStatusBadge(a.status)}`}>
                                        {a.status}
                                    </span>
                                    <p className="text-xs text-gray-400 mt-1">{new Date(a.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800 shadow-inner">
                                {a.description}
                            </p>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="flex gap-2">
                                    <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                                    <div className="flex flex-col text-gray-500">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{a.location.ipAddress}</span>
                                        <span>{a.location.country} {a.location.isVpnOrProxy ? '(VPN)' : ''}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Cpu className="w-4 h-4 text-gray-400 shrink-0" />
                                    <div className="flex flex-col text-gray-500">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{a.device.deviceId.substring(0, 8)}</span>
                                        <span>{a.device.deviceType} • {a.device.os}</span>
                                    </div>
                                </div>
                            </div>

                            {a.automatedActionTaken !== 'NONE' && (
                                <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-750 pt-3">
                                    <span className="text-xs font-semibold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                        <ShieldAlert className="w-3 h-3" /> System Action: {a.automatedActionTaken}
                                    </span>
                                    <button className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
                                        Investigate <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
