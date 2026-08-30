import React, { useState, useMemo, useEffect } from 'react';
import {
    Users, Building2, Shuffle, ShieldCheck, Heart, AlertTriangle,
    BarChart, ArrowRight, CheckCircle, Search, ChevronDown, Activity,
    PieChart, GitMerge, ListChecks, DollarSign, Clock, Download
} from 'lucide-react';
import type {
    AcquisitionTarget, HarmonizationKPIs, RedundancyRecord,
    TalentRetentionProfile, BenefitMapping, IntegrationTimelineEvent
} from '../../types/maHarmonization';
import {
    generateAcquisitionTarget, generateHarmonizationKPIs, generateRedundancyAnalysis,
    generateTalentRetentionProfiles, generateBenefitMappings, generateIntegrationTimeline
} from '../../services/maHarmonizationService';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) => `$${v.toLocaleString()}`;
const fmtAbsCurrency = (v: number) => `$${Math.abs(v).toLocaleString()}`;

// ─── Badges ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        'DUE_DILIGENCE': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        'DAY_ONE_PLANNING': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        'INTEGRATION_ACTIVE': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        'HARMONIZED': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
}

function RiskBadge({ risk }: { risk: string }) {
    const styles: Record<string, string> = {
        'LOW': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        'MEDIUM': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
        'HIGH': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        'CRITICAL': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${styles[risk]}`}>
            {risk}
        </span>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({
    target, kpis, timeline
}: {
    target: AcquisitionTarget; kpis: HarmonizationKPIs; timeline: IntegrationTimelineEvent[]
}) {
    return (
        <div className="space-y-6">
            {/* Target Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Target Company</span>
                        <StatusBadge status={target.status} />
                    </div>
                    <h2 className="text-3xl font-extrabold">{target.targetName}</h2>
                    <p className="text-blue-100 mt-1">{target.industry} · {target.headcount} Employees · {fmtCurrency(target.dealValue)} Deal Value</p>
                </div>
                <div className="w-full md:w-64 bg-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-blue-100">Integration Progress</span>
                        <span className="font-bold text-white">{target.overallProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${target.overallProgress}%` }} />
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Redundant Roles', value: kpis.redundantRolesIdentified, icon: Shuffle, color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200' },
                    { label: 'Retained Critical Talent', value: `${kpis.retainedCriticalTalentPct}%`, icon: ShieldCheck, color: 'text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200' },
                    { label: 'Severance Spend', value: fmtCurrency(kpis.severanceBudgetUsed), icon: DollarSign, color: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200' },
                    { label: 'Culture Score', value: `${kpis.cultureIntegrationScore}/100`, icon: Heart, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200' }
                ].map((k, i) => (
                    <div key={i} className={`rounded-xl border p-5 ${k.color} flex flex-col gap-3`}>
                        <div className="flex justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider opacity-70">{k.label}</span>
                            <k.icon size={16} />
                        </div>
                        <p className="text-3xl font-extrabold">{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                    <Clock size={18} /> High-Level Integration Timeline
                </h3>
                <div className="space-y-6">
                    {timeline.map((te, i) => (
                        <div key={te.id} className="flex gap-4 relative">
                            {i !== timeline.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-gray-200 dark:bg-slate-700" />
                            )}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${te.status === 'COMPLETED' ? 'bg-green-500' :
                                    te.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                                        te.status === 'AT_RISK' ? 'bg-red-500' : 'bg-gray-300 dark:bg-slate-600'
                                }`}>
                                {te.status === 'COMPLETED' ? <CheckCircle size={12} className="text-white" /> : <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div className="pt-0.5 pb-2">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-bold text-gray-900 dark:text-white text-sm">{te.milestone}</span>
                                    <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">{te.date}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">Owner: {te.owner}</span>
                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">Status: {te.status}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Redundancy Tab ───────────────────────────────────────────────────────────
function RedundancyTab({ records }: { records: RedundancyRecord[] }) {
    const totalSeverance = records.reduce((s, r) => s + r.estimatedSeveranceImpact, 0);
    const totalRedundant = records.reduce((s, r) => s + r.redundancyCount, 0);

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 text-white rounded-xl p-6 flex items-center justify-between shadow-md">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2"><GitMerge size={20} className="text-orange-500" /> Target Operating Model & Redundancy</h3>
                    <p className="text-sm text-gray-400 mt-1">Identifying overlapping roles between Acquirer and Target organizations.</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-bold text-orange-400">{totalRedundant}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Total Redundant Roles</p>
                    <p className="text-sm mt-1">{fmtCurrency(totalSeverance)} Severance Impact</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase text-xs">Role / Dept</th>
                            <th className="px-6 py-3 text-center font-semibold text-gray-500 uppercase text-xs">Acquirer HC</th>
                            <th className="px-6 py-3 text-center font-semibold text-gray-500 uppercase text-xs">Target HC</th>
                            <th className="px-6 py-3 text-center font-semibold text-indigo-500 uppercase text-xs">Target Op Model</th>
                            <th className="px-6 py-3 text-center font-semibold text-red-500 uppercase text-xs">Redundancy</th>
                            <th className="px-6 py-3 text-center font-semibold text-gray-500 uppercase text-xs">Decision</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {records.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900 dark:text-white">{r.role}</p>
                                    <p className="text-xs text-gray-500">{r.department}</p>
                                </td>
                                <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">{r.acquirerHeadcount}</td>
                                <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">{r.targetHeadcount}</td>
                                <td className="px-6 py-4 text-center font-extrabold text-indigo-600 dark:text-indigo-400">{r.targetOperatingModel}</td>
                                <td className="px-6 py-4 text-center">
                                    {r.redundancyCount > 0 ? (
                                        <span className="inline-flex items-center justify-center bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
                                            -{r.redundancyCount}
                                        </span>
                                    ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${r.decision === 'LAYOFF' ? 'bg-red-100 text-red-600' :
                                            r.decision === 'REDEPLOY' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {r.decision}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Talent Retention Tab ─────────────────────────────────────────────────────
function RetentionTab({ profiles }: { profiles: TalentRetentionProfile[] }) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => profiles.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.role.toLowerCase().includes(search.toLowerCase())
    ), [profiles, search]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users size={18} className="text-indigo-500" /> Target Critical Talent Retention
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Identify and retain flight-risk employees from the acquired company.</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search talent..."
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => (
                    <div key={p.employeeId} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                                <p className="text-xs text-gray-500">{p.role} · {p.department}</p>
                            </div>
                            <RiskBadge risk={p.flightRisk} />
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Criticality</span>
                                <span className={`font-semibold ${p.criticality === 'MUST_RETAIN' ? 'text-purple-600' : 'text-gray-700'}`}>{p.criticality.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Retention Bonus</span>
                                <span className="font-bold text-green-600">{fmtCurrency(p.retentionBonus)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Sentiment Match</span>
                                <span className="font-bold">{p.sentimentScore}/5.0</span>
                            </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                            <StatusBadge status={p.status} />
                            <button className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                                View Offer Strategy →
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Benefits Harmonization Tab ──────────────────────────────────────────────
function BenefitsTab({ mappings }: { mappings: BenefitMapping[] }) {
    const totalCostImpact = mappings.reduce((s, m) => s + m.costImpactPerEmployee, 0);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ListChecks size={18} className="text-blue-500" /> Benefit Harmonization Mapping
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Comparing Target vs Acquirer benefits and calculating integration cost delta per employee.</p>
                </div>
                <div className="text-right">
                    <p className={`text-2xl font-bold ${totalCostImpact > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {totalCostImpact > 0 ? '+' : '-'}{fmtAbsCurrency(totalCostImpact)}
                    </p>
                    <p className="text-xs text-gray-500 uppercase">Per Employee Impact Delta</p>
                </div>
            </div>

            <div className="space-y-4">
                {mappings.map((m, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{m.category}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${m.harmonizationAction === 'MIGRATE_TO_ACQUIRER' ? 'bg-indigo-100 text-indigo-700' :
                                    m.harmonizationAction === 'KEEP_SEPARATE' ? 'bg-gray-100 text-gray-700' : 'bg-pink-100 text-pink-700'
                                }`}>
                                {m.harmonizationAction.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="flex-1 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-lg">
                                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-1">Target Benefit</p>
                                <p className="text-sm text-gray-900 dark:text-white font-medium">{m.targetBenefit}</p>
                            </div>
                            <div className="flex items-center justify-center shrink-0">
                                <ArrowRight className="text-gray-400" />
                            </div>
                            <div className="flex-1 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg">
                                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">Acquirer Benefit</p>
                                <p className="text-sm text-gray-900 dark:text-white font-medium">{m.acquirerBenefit}</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-end border-t border-gray-100 dark:border-slate-700 pt-4">
                            <div className="w-1/2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">Integration Progress</span>
                                    <span className="font-bold text-gray-700 dark:text-gray-300">{m.completionStatus}%</span>
                                </div>
                                <div className="h-2 w-full bg-gray-200 dark:bg-slate-700 rounded-full">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${m.completionStatus}%` }} />
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase mb-1">Cost Delta per Employee</p>
                                <p className={`font-bold ${m.costImpactPerEmployee > 0 ? 'text-red-500' : m.costImpactPerEmployee < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                                    {m.costImpactPerEmployee > 0 ? '+' : ''}{fmtCurrency(m.costImpactPerEmployee)}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MAHarmonizationHubPage() {
    const [tab, setTab] = useState<'overview' | 'redundancy' | 'talent' | 'benefits'>('overview');
    const [loading, setLoading] = useState(true);

    const target = useMemo(() => generateAcquisitionTarget(), []);
    const kpis = useMemo(() => generateHarmonizationKPIs(), []);
    const redundancy = useMemo(() => generateRedundancyAnalysis(), []);
    const talent = useMemo(() => generateTalentRetentionProfiles(), []);
    const benefits = useMemo(() => generateBenefitMappings(), []);
    const timeline = useMemo(() => generateIntegrationTimeline(), []);

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(t);
    }, []);

    const TABS = [
        { id: 'overview', label: 'M&A Overview', icon: PieChart },
        { id: 'redundancy', label: 'Org Redundancy', icon: GitMerge },
        { id: 'talent', label: 'Talent Retention', icon: Users },
        { id: 'benefits', label: 'Benefits Harmonization', icon: ListChecks },
    ] as const;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-gray-500">Initializing M&A Data Room...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 font-sans">
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2 rounded-lg text-white">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold tracking-tight">Post-Merger HR Hub</h1>
                        <p className="text-sm text-gray-500">Project Phoenix — {target.targetName} Integration</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-800 text-sm font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                        <Download size={16} /> Export Deal Deck
                    </button>
                </div>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex gap-2 overflow-x-auto">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${tab === t.id
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            <div className="p-6 max-w-7xl mx-auto">
                {tab === 'overview' && <OverviewTab target={target} kpis={kpis} timeline={timeline} />}
                {tab === 'redundancy' && <RedundancyTab records={redundancy} />}
                {tab === 'talent' && <RetentionTab profiles={talent} />}
                {tab === 'benefits' && <BenefitsTab mappings={benefits} />}
            </div>
        </div>
    );
}
