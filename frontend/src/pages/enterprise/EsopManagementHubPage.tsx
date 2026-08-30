import React, { useState, useMemo, useEffect } from 'react';
import {
    PieChart, Activity, Users, DollarSign, Calendar, AlertTriangle, ChevronDown, CheckCircle
} from 'lucide-react';
import type {
    EquityPool, EquityGrant, VestingEvent, EsopKPIs, CapTableEntry
} from '../../types/esopManagement';
import {
    generateEquityPool, generateEquityGrants, generateVestingEvents,
    generateCapTable, computeEsopKPIs
} from '../../services/esopService';

const fmtNumber = (n: number) => n.toLocaleString();
const fmtCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EsopManagementHubPage() {
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'grants' | 'captable'>('overview');

    const pool = useMemo(() => generateEquityPool(), []);
    const grants = useMemo(() => generateEquityGrants(120), []);
    const events = useMemo(() => generateVestingEvents(), []);
    const capTable = useMemo(() => generateCapTable(), []);
    const kpis = useMemo(() => computeEsopKPIs(pool, grants, events), [pool, grants, events]);

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(t);
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-semibold text-sm">Aggregating Equity Ledger...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <div className="bg-emerald-800 dark:bg-emerald-950 px-6 py-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Enterprise Equity & ESOP Hub</h1>
                    <p className="text-emerald-200 mt-2">Manage Cap Table, Option Pools, and Global Employee Vesting Schedules.</p>
                </div>
                <div className="bg-emerald-900/50 p-4 rounded-xl border border-emerald-700 backdrop-blur">
                    <p className="text-sm text-emerald-300 font-semibold mb-1">Latest 409A Fair Market Value (FMV)</p>
                    <p className="text-3xl font-bold">{fmtCurrency(pool.latest409AValuation)} <span className="text-sm font-normal text-emerald-400">/ share</span></p>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-6 py-4 flex gap-4 border-b border-gray-200 dark:border-slate-800">
                {[
                    { id: 'overview', label: 'Pool & Summary', icon: PieChart },
                    { id: 'grants', label: 'Employee Grants Ledger', icon: Users },
                    { id: 'captable', label: 'Cap Table & Dilution', icon: Activity }
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.id ? 'bg-white dark:bg-slate-800 text-emerald-700 shadow border border-gray-200 dark:border-slate-700' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800'
                            }`}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {tab === 'overview' && (
                    <>
                        {/* KPI Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Participants', val: kpis.totalParticipants, c: 'text-blue-500' },
                                { label: 'Unvested Value (Golden Handcuffs)', val: fmtCurrency(kpis.totalUnvestedValue), c: 'text-emerald-500' },
                                { label: 'Avg Shares / Employee', val: fmtNumber(kpis.averageStakePerEmployee), c: 'text-purple-500' },
                                { label: 'Upcoming Vests (30D)', val: kpis.upcomingVestsNext30Days, c: 'text-orange-500' },
                            ].map((k, i) => (
                                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                    <p className="text-xs uppercase font-bold text-gray-500 mb-2">{k.label}</p>
                                    <p className={`text-2xl font-extrabold ${k.c}`}>{k.val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Pool Status */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <PieChart className="text-emerald-500" /> {pool.poolName} - Status
                                </h3>
                                {kpis.poolDepletionWarning && (
                                    <span className="flex items-center gap-2 text-xs font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full">
                                        <AlertTriangle size={14} /> Low Pool Warning (&lt;10% left)
                                    </span>
                                )}
                            </div>

                            <div className="mb-4 flex flex-col md:flex-row justify-between text-sm">
                                <div>
                                    <p className="text-gray-500 font-semibold mb-1">Authorized</p>
                                    <p className="text-xl font-bold dark:text-white">{fmtNumber(pool.totalAuthorizedShares)}</p>
                                </div>
                                <div>
                                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Granted / Allocated</p>
                                    <p className="text-xl font-bold dark:text-white">{fmtNumber(pool.allocatedShares)}</p>
                                </div>
                                <div>
                                    <p className="text-blue-600 dark:text-blue-400 font-semibold mb-1">Available to Grant</p>
                                    <p className="text-xl font-bold dark:text-white">{fmtNumber(pool.availableShares)}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-4 w-full bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(pool.allocatedShares / pool.totalAuthorizedShares) * 100}%` }} />
                            </div>
                        </div>

                        {/* Upcoming Vests */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                <Calendar className="text-orange-500" /> Upcoming Vesting Events (Next 30 Days)
                            </h3>
                            <div className="space-y-3">
                                {events.map(ev => (
                                    <div key={ev.eventId} className="flex justify-between items-center p-3 border border-gray-100 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded bg-orange-100 text-orange-700 flex flex-col justify-center items-center font-bold">
                                                <span className="text-xs uppercase">{new Date(ev.date).toLocaleString('default', { month: 'short' })}</span>
                                                <span className="text-sm leading-none">{new Date(ev.date).getDate()}</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm dark:text-white">{ev.employeeName}</p>
                                                <p className="text-xs text-gray-500">{ev.eventType.replace(/_/g, ' ')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-600 dark:text-emerald-400">+{fmtNumber(ev.sharesVesting)} Shares</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {tab === 'grants' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Participant</th>
                                        <th className="px-6 py-4">Grant Type</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-center">Granted</th>
                                        <th className="px-6 py-4 text-center">Vested Progress</th>
                                        <th className="px-6 py-4 text-right">In-the-Money Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {grants.slice(0, 50).map(g => (
                                        <tr key={g.grantId} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-gray-900 dark:text-gray-100">{g.employeeName}</p>
                                                <p className="text-xs text-gray-500">{g.role}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded text-xs font-bold">
                                                    {g.grantType}
                                                </span>
                                                {g.strikePrice > 0 && <p className="text-xs text-gray-500 mt-1">Strike: {fmtCurrency(g.strikePrice)}</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${g.status === 'FULLY_VESTED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                    {g.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-700 dark:text-gray-300">{fmtNumber(g.sharesGranted)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(g.sharesVested / g.sharesGranted) * 100}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold w-8 text-right text-emerald-600">{Math.round((g.sharesVested / g.sharesGranted) * 100)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-extrabold text-indigo-600 dark:text-indigo-400">
                                                {fmtCurrency(g.currentValueTotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'captable' && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                            <Activity className="text-indigo-500" /> Fully Diluted Cap Table
                        </h3>
                        <div className="space-y-4">
                            {capTable.map((ct) => (
                                <div key={ct.investorClass} className="flex justify-between items-center border-b border-gray-100 dark:border-slate-700 pb-4">
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{ct.investorClass.replace(/_/g, ' ')}</p>
                                        <p className="text-sm text-gray-500">{fmtNumber(ct.sharesHeld)} Shares</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{ct.ownershipPercentage}%</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
