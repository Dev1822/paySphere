import React from 'react';
import { FraudAlert } from '../../types/fraudRisk';
import { ShieldAlert, Info, AlertTriangle, ExternalLink, Globe, Cpu, User, Crosshair, Map, ShieldHalf, Play, Bell, X, Activity, Server, FileText, Lock, Target } from 'lucide-react';

interface InvestigationModalProps {
    alert: FraudAlert | null;
    onClose: () => void;
}

export const FraudInvestigationModal: React.FC<InvestigationModalProps> = ({ alert, onClose }) => {
    if (!alert) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-950 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">

                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-rose-500 p-2.5 rounded-xl text-white shadow-lg shadow-rose-500/20">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                Deep Investigation <span className="text-xs font-mono bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400">{alert.id}</span>
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Automated AI Risk Profile Analysis</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100/50 hover:bg-gray-200 dark:bg-gray-800/50 dark:hover:bg-gray-700 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Left Panel: Primary Info */}
                        <div className="md:col-span-1 space-y-6">
                            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 flex items-center gap-2">
                                    <User className="w-4 h-4" /> Identity Graph
                                </h4>
                                <div className="space-y-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                                    <div>
                                        <span className="block text-[10px] uppercase text-gray-400">Customer ID</span>
                                        <span className="text-sm font-semibold">{alert.customerId}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase text-gray-400">Email Linkage</span>
                                        <span className="text-sm text-indigo-600 dark:text-indigo-400">{alert.customerEmail}</span>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <span className="block text-[10px] uppercase text-gray-400 mb-1">Global Risk Score</span>
                                    <div className="flex items-end gap-2">
                                        <span className={`text-4xl font-extrabold ${alert.riskScore > 70 ? 'text-rose-500' : alert.riskScore > 40 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                            {alert.riskScore.toFixed(0)}
                                        </span>
                                        <span className="text-gray-400 text-sm mb-1">/ 100</span>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl font-bold shadow-md hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                                <Lock className="w-4 h-4" /> Enforce Hard Block
                            </button>
                            <button className="w-full border-2 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                                Dismiss (False Positive)
                            </button>
                        </div>

                        {/* Right Panel: Forensics */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="grid grid-cols-2 gap-4">

                                {/* Location Data */}
                                <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 flex items-center gap-2">
                                        <Globe className="w-4 h-4" /> Geolocation Triangulation
                                    </h4>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex justify-between border-b border-gray-50 dark:border-gray-800 pb-1">
                                            <span className="text-gray-500">Origin IP</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-300">{alert.location.ipAddress}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-gray-50 dark:border-gray-800 pb-1">
                                            <span className="text-gray-500">Region</span>
                                            <span className="font-medium">{alert.location.city}, {alert.location.country}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-gray-50 dark:border-gray-800 pb-1">
                                            <span className="text-gray-500">ASN Edge</span>
                                            <span className="font-medium">{alert.location.asn}</span>
                                        </li>
                                        <li className="flex justify-between pt-1">
                                            <span className="text-gray-500">Proxy/VPN Detected</span>
                                            {alert.location.isVpnOrProxy ? (
                                                <span className="text-rose-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> YES</span>
                                            ) : (
                                                <span className="text-emerald-500 font-bold">NO</span>
                                            )}
                                        </li>
                                    </ul>
                                </div>

                                {/* Device Fingerprint */}
                                <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 flex items-center gap-2">
                                        <Cpu className="w-4 h-4" /> Device Fingerprint
                                    </h4>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex justify-between border-b border-gray-50 dark:border-gray-800 pb-1">
                                            <span className="text-gray-500">Device ID</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-300 truncate w-32 text-right">{alert.device.deviceId}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-gray-50 dark:border-gray-800 pb-1">
                                            <span className="text-gray-500">Platform</span>
                                            <span className="font-medium">{alert.device.deviceType}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-gray-50 dark:border-gray-800 pb-1">
                                            <span className="text-gray-500">Software</span>
                                            <span className="font-medium">{alert.device.os} • {alert.device.browser}</span>
                                        </li>
                                        <li className="flex justify-between pt-1">
                                            <span className="text-gray-500">Emulator Flags</span>
                                            {alert.device.isEmulator ? (
                                                <span className="text-rose-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> YES</span>
                                            ) : (
                                                <span className="text-emerald-500 font-bold">NO</span>
                                            )}
                                        </li>
                                    </ul>
                                </div>

                            </div>

                            <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-5 rounded-2xl">
                                <h4 className="text-rose-800 dark:text-rose-400 font-bold flex items-center gap-2 mb-2">
                                    <Activity className="w-5 h-5" /> Behavioral Analysis Narrative
                                </h4>
                                <p className="text-rose-700 dark:text-rose-300 text-sm leading-relaxed">
                                    {alert.description} This alert was triggered by rule engine <span className="font-mono bg-white/50 dark:bg-black/20 px-1 rounded">RUL-{alert.category}</span>.
                                    Subsequent automated action taken: <strong>{alert.automatedActionTaken}</strong>.
                                    It is recommended to verify the customer's billing address against the physical location block in {alert.location.country}.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
