import React, { useState, useMemo, useEffect } from 'react';
import {
    Users, Activity, ChevronRight, ShieldAlert, Award, Star, TrendingUp, AlertTriangle, Crosshair, Map
} from 'lucide-react';
import type {
    TalentProfile, SuccessorCandidate, KeyRole, SuccessionKPIs,
    NineBoxDistribution, NineBoxCategory
} from '../../types/successionPlanning';
import {
    generateTalentProfiles, generateNineBoxDistribution,
    generateKeyRoles, generateSuccessionKPIs
} from '../../services/successionPlanningService';

function KPICard({ label, value, subtext, icon: Icon, color }: any) {
    return (
        <div className={`p-5 rounded-xl border flex flex-col gap-3 ${color}`}>
            <div className="flex justify-between items-center opacity-80">
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                <Icon size={18} />
            </div>
            <div>
                <h3 className="text-3xl font-extrabold">{value}</h3>
                <p className="text-xs mt-1 font-semibold">{subtext}</p>
            </div>
        </div>
    );
}

function ReadinessBadge({ level }: { level: string }) {
    const styles: any = {
        'READY_NOW': 'bg-green-100 text-green-700',
        'READY_1_TO_2_YEARS': 'bg-blue-100 text-blue-700',
        'READY_3_PLUS_YEARS': 'bg-purple-100 text-purple-700',
        'EMERGENCY_ONLY': 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[level]}`}>{level.replace(/_/g, ' ')}</span>;
}

function SuccessionBenchTab({ keyRoles }: { keyRoles: KeyRole[] }) {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <ShieldAlert className="text-indigo-500" /> Critical Role Bench Strength
                </h3>

                <div className="space-y-4">
                    {keyRoles.map(kr => (
                        <div key={kr.roleId} className="border border-gray-200 dark:border-slate-700 rounded-lg p-5">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{kr.title}</h4>
                                    <p className="text-sm text-gray-500">{kr.department} · Incumbent: <span className="font-semibold text-gray-700 dark:text-gray-300">{kr.incumbentName}</span></p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs uppercase text-gray-500">Bench Score</span>
                                        <span className={`font-extrabold ${kr.benchStrengthScore > 75 ? 'text-green-500' : kr.benchStrengthScore > 40 ? 'text-yellow-500' : 'text-red-500'}`}>{kr.benchStrengthScore}%</span>
                                    </div>
                                    {kr.incumbentFlightRisk === 'CRITICAL' && (
                                        <div className="bg-red-100 text-red-700 px-3 py-1 rounded-lg flex items-center justify-center flex-col">
                                            <AlertTriangle size={14} />
                                            <span className="text-[10px] font-bold uppercase">Flight Risk</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {kr.successors.length === 0 ? (
                                <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-sm font-semibold flex items-center gap-2">
                                    <AlertTriangle size={16} /> Vulnerability Alert: No identified successors for this critical role.
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-4">
                                    <p className="text-xs uppercase font-bold text-gray-500 mb-3">Identified Successors ({kr.successors.length})</p>
                                    <div className="space-y-3">
                                        {kr.successors.map(suc => (
                                            <div key={suc.candidateId} className="flex justify-between items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-lg shadow-sm">
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{suc.name}</p>
                                                    <p className="text-xs text-gray-500">{suc.currentRole}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <ReadinessBadge level={suc.readiness} />
                                                    <div className="hidden md:flex flex-col items-end">
                                                        <span className="text-[10px] uppercase text-gray-500 font-bold">AI Fit Score</span>
                                                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{suc.fitScore}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function NineBoxGridTab({ profiles, distribution }: { profiles: TalentProfile[], distribution: NineBoxDistribution[] }) {
    const gridMap = {
        'HIGH': {
            'NEEDS_IMPROVEMENT': 'INCONSISTENT_PLAYER',
            'MEETS_EXPECTATIONS': 'HIGH_POTENTIAL',
            'EXCEEDS_EXPECTATIONS': 'STAR'
        },
        'MEDIUM': {
            'NEEDS_IMPROVEMENT': 'POTENTIAL_GEM',
            'MEETS_EXPECTATIONS': 'CORE_PLAYER',
            'EXCEEDS_EXPECTATIONS': 'HIGH_IMPACT_PERFORMER'
        },
        'LOW': {
            'NEEDS_IMPROVEMENT': 'UNDERPERFORMER',
            'MEETS_EXPECTATIONS': 'EFFECTIVE_PROFESSIONAL',
            'EXCEEDS_EXPECTATIONS': 'SOLID_PROFESSIONAL'
        }
    };

    const colors: User = {
        'STAR': 'bg-emerald-100 border-emerald-300 text-emerald-800',
        'HIGH_POTENTIAL': 'bg-green-100 border-green-300 text-green-800',
        'HIGH_IMPACT_PERFORMER': 'bg-lime-100 border-lime-300 text-lime-800',
        'CORE_PLAYER': 'bg-blue-100 border-blue-300 text-blue-800',
        'SOLID_PROFESSIONAL': 'bg-cyan-100 border-cyan-300 text-cyan-800',
        'EFFECTIVE_PROFESSIONAL': 'bg-sky-100 border-sky-300 text-sky-800',
        'INCONSISTENT_PLAYER': 'bg-yellow-100 border-yellow-300 text-yellow-800',
        'POTENTIAL_GEM': 'bg-orange-100 border-orange-300 text-orange-800',
        'UNDERPERFORMER': 'bg-red-100 border-red-300 text-red-800',
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Map className="text-indigo-500" /> Enterprise 9-Box Talent Grid
                </h3>
                <p className="text-sm text-gray-500 mb-6">Mapping talent based on Performance (X-Axis) and Potential (Y-Axis).</p>

                <div className="flex">
                    <div className="flex flex-col justify-around pr-4 items-center w-12 text-xs font-bold text-gray-400 -rotate-90 whitespace-nowrap">
                        <span>POTENTIAL &rarr;</span>
                    </div>

                    <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-2 h-[600px]">
                        {['HIGH', 'MEDIUM', 'LOW'].map((pot) => (
                            ['NEEDS_IMPROVEMENT', 'MEETS_EXPECTATIONS', 'EXCEEDS_EXPECTATIONS'].map((perf) => {
                                const cat = (gridMap as any)[pot][perf];
                                const dist = distribution.find(d => d.category === cat);
                                return (
                                    <div key={`${pot}-${perf}`} className={`border-2 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition cursor-pointer ${colors[cat as keyof typeof colors]}`}>
                                        <div>
                                            <h4 className="font-extrabold text-sm uppercase tracking-wide opacity-90">{cat.replace(/_/g, ' ')}</h4>
                                            <p className="text-xs font-medium opacity-75 mt-1">{dist?.count || 0} Employees ({dist?.percentage || 0}%)</p>
                                        </div>
                                        <div className="text-right mt-4 flex justify-end">
                                            <div className="bg-white/50 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center font-bold">
                                                {dist?.count || 0}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ))}
                    </div>
                </div>
                <div className="pl-12 pt-4 flex justify-around text-xs font-bold text-gray-400">
                    <span>Needs Improvement</span>
                    <span>Meets Expectations</span>
                    <span>Exceeds / Outstanding</span>
                </div>
                <div className="pl-12 pt-2 text-center text-xs font-bold text-gray-400">
                    PERFORMANCE &rarr;
                </div>
            </div>
        </div>
    )
}

export default function SuccessionPlanningHubPage() {
    const [tab, setTab] = useState<'bench' | 'ninebox'>('bench');

    const profiles = useMemo(() => generateTalentProfiles(150), []);
    const kpis = useMemo(() => generateSuccessionKPIs(), []);
    const keyRoles = useMemo(() => generateKeyRoles(), []);
    const distribution = useMemo(() => generateNineBoxDistribution(profiles), [profiles]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <div className="bg-indigo-700 dark:bg-indigo-900 border-b border-indigo-800 px-6 py-6 text-white">
                <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                    <Star className="text-yellow-400" /> AI-Driven Succession Planning & Talent Matrix
                </h1>
                <p className="text-indigo-200 mt-2 text-sm max-w-2xl">
                    Identify, assess, and develop future leaders. Ensure business continuity by maintaining robust bench strength for critical enterprise roles.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    <KPICard label="Critical Roles" value={kpis.totalKeyRoles} subtext={`${kpis.highRiskCriticalRoles} at High Flight Risk`} icon={Crosshair} color="bg-indigo-800/50 border-indigo-600/50" />
                    <KPICard label="Roles at Risk" value={kpis.rolesWithoutReadySuccessors} subtext="No Ready-Now Successors" icon={AlertTriangle} color="bg-rose-900/40 border-rose-700/50 text-rose-100" />
                    <KPICard label="Bench Strength" value={`${kpis.overallBenchStrength}%`} subtext="Enterprise Readiness Average" icon={TrendingUp} color="bg-indigo-800/50 border-indigo-600/50" />
                    <KPICard label="Internal Fill Rate" value={`${kpis.internalFillRateProjected}%`} subtext="Projected YTD" icon={Users} color="bg-indigo-800/50 border-indigo-600/50" />
                </div>
            </div>

            <div className="border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex gap-2">
                <button onClick={() => setTab('bench')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${tab === 'bench' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <ShieldAlert size={16} /> Succession Bench
                </button>
                <button onClick={() => setTab('ninebox')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${tab === 'ninebox' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Map size={16} /> 9-Box Talent Grid
                </button>
            </div>

            <div className="p-6 max-w-7xl mx-auto">
                {tab === 'bench' && <SuccessionBenchTab keyRoles={keyRoles} />}
                {tab === 'ninebox' && <NineBoxGridTab profiles={profiles} distribution={distribution} />}
            </div>
        </div>
    );
}
