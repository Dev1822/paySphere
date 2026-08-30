import React, { useEffect, useState } from 'react';
import { FraudRiskService } from '../services/FraudRiskService';
import { ComprehensiveFraudPayload } from '../types/fraudRisk';
import { RiskMatrix } from '../components/fraud/RiskMatrix';
import { FraudAlertsTimeline } from '../components/fraud/FraudAlertsTimeline';
import { IPBlocklistForm } from '../components/fraud/IPBlocklistForm';
import { TransactionMonitor } from '../components/fraud/TransactionMonitor';
import { AlertRulesEngine } from '../components/fraud/AlertRulesEngine';
import { GeographicThreatMap } from '../components/fraud/GeographicThreatMap';
import { CustomerRiskProfiler } from '../components/fraud/CustomerRiskProfiler';
import { AuditTrail } from '../components/fraud/AuditTrail';
import { RiskScoreDistribution } from '../components/fraud/RiskScoreDistribution';
import { FraudSettingsPanel } from '../components/fraud/FraudSettingsPanel';
import {
    ShieldHalf, AlertTriangle, Crosshair, Map, Play, Bell, Activity,
    CreditCard, Zap, Globe, Users, Clock, BarChart3, Settings,
    TrendingUp, ShieldCheck, Eye,
} from 'lucide-react';

type TabId = 'overview' | 'transactions' | 'rules' | 'geography' | 'customers' | 'audit' | 'analytics' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: ShieldHalf },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'rules', label: 'Rules Engine', icon: Zap },
    { id: 'geography', label: 'Geography', icon: Globe },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'audit', label: 'Audit Trail', icon: Clock },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export default function FraudRiskDashboard() {
    const [data, setData] = useState<ComprehensiveFraudPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    useEffect(() => {
        FraudRiskService.getDashboardData().then(d => {
            setData(d);
            setLoading(false);
        });
    }, []);

    const topCard = (title: string, value: string | number, desc: string, icon: React.ElementType, color: string) => {
        const Icon = icon;
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl ${color.replace('text', 'bg')}`} />
                <div className={`p-3 rounded-xl mb-4 w-min ${color.replace('text', 'bg').replace('500', '100')} dark:${color.replace('text', 'bg').replace('500', '500/20')}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h4 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</h4>
                <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1 mb-2">{value}</div>
                <p className="text-sm font-medium text-gray-400">{desc}</p>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 xl:p-10 font-sans">
            <div className="max-w-[1700px] mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-gradient-to-br from-rose-500 to-orange-500 p-3 rounded-xl text-white shadow-lg shadow-rose-500/30">
                                <ShieldHalf className="w-8 h-8" />
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                                Fraud & Risk Command Center
                            </h1>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-3 max-w-2xl leading-relaxed">
                            Real-time monitoring of behavioral anomalies, velocity metrics, and AI-driven predictive risk scoring across all international gateways.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Play className="w-4 h-4" /> Run Simulation
                        </button>
                        <button className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl font-semibold shadow-xl shadow-gray-900/10 hover:opacity-90 transition-opacity">
                            <Bell className="w-4 h-4" /> Alert Rules
                        </button>
                    </div>
                </div>

                {/* Global KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {topCard('Critical Threats (24h)', data?.metrics.criticalAlerts24h || 0, 'Requires immediate action', AlertTriangle, 'text-rose-500')}
                    {topCard('Active Investigations', data?.metrics.activeInvestigations || 0, 'Tickets assigned to agents', Crosshair, 'text-orange-500')}
                    {topCard('Avg Resolution Time', `${data?.metrics.avgResolutionMinutes || 0} min`, '-12% improved SLA', Activity, 'text-emerald-500')}
                    {topCard('Top Risk Vector', data?.metrics.topRiskVector.replace('_', ' ') || '-', 'Global behavioral trend', Map, 'text-indigo-500')}
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-1.5 mb-8 overflow-x-auto custom-scrollbar shadow-sm">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in duration-200">
                    {/* ─── Overview Tab ─────────────────────────────────────── */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                            <div className="xl:col-span-7 flex flex-col gap-8">
                                <FraudAlertsTimeline alerts={data?.alerts || []} />
                            </div>
                            <div className="xl:col-span-5 flex flex-col gap-8">
                                <div className="h-[450px]">
                                    <RiskMatrix matrix={data?.matrix || []} loading={loading} />
                                </div>
                                <div className="h-[500px]">
                                    <IPBlocklistForm />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Transactions Tab ────────────────────────────────── */}
                    {activeTab === 'transactions' && (
                        <TransactionMonitor />
                    )}

                    {/* ─── Rules Engine Tab ────────────────────────────────── */}
                    {activeTab === 'rules' && (
                        <AlertRulesEngine />
                    )}

                    {/* ─── Geography Tab ───────────────────────────────────── */}
                    {activeTab === 'geography' && (
                        <GeographicThreatMap />
                    )}

                    {/* ─── Customers Tab ──────────────────────────────────── */}
                    {activeTab === 'customers' && (
                        <CustomerRiskProfiler />
                    )}

                    {/* ─── Audit Trail Tab ────────────────────────────────── */}
                    {activeTab === 'audit' && (
                        <AuditTrail />
                    )}

                    {/* ─── Analytics Tab ──────────────────────────────────── */}
                    {activeTab === 'analytics' && (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                            <div className="xl:col-span-8">
                                <RiskScoreDistribution />
                            </div>
                            <div className="xl:col-span-4">
                                <RiskMatrix matrix={data?.matrix || []} loading={loading} />
                            </div>
                        </div>
                    )}

                    {/* ─── Settings Tab ────────────────────────────────────── */}
                    {activeTab === 'settings' && (
                        <div className="max-w-4xl">
                            <FraudSettingsPanel />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
