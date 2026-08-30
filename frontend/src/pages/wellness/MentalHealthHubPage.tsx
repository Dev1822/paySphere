import React, { useState, useEffect, useMemo } from 'react';
import {
    Brain, AlertTriangle, HeartPulse, TrendingUp, TrendingDown,
    Users, ShieldCheck, Activity, Bell, Search, ChevronDown,
    BarChart2, ClipboardList, Smile, BookOpen, Filter, RefreshCw,
    CheckCircle, Clock, XCircle, Zap, ArrowUp, ArrowDown,
} from 'lucide-react';

import type {
    EmployeeBurnoutProfile,
    DepartmentHeatmapEntry,
    WellnessIntervention,
    EAPUtilizationMetrics,
    WellnessAlert,
    MentalHealthKPIs,
    MoodDistribution,
    MoodTrendPoint,
    DashboardTab,
    BurnoutRiskLevel,
} from '../../types/mentalHealth';

import {
    generateEmployeeBurnoutProfiles,
    generateDepartmentHeatmap,
    generateMoodTrendData,
    getMoodDistribution,
    generateInterventions,
    generateEAPMetrics,
    generateWellnessAlerts,
    computeKPIs,
    getInterventionLabel,
} from '../../services/mentalHealthService';

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: BurnoutRiskLevel }) {
    const styles: Record<BurnoutRiskLevel, string> = {
        CRITICAL: 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/40 dark:text-red-300',
        HIGH: 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/40 dark:text-orange-300',
        MODERATE: 'bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300',
        LOW: 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/40 dark:text-green-300',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${styles[level]}`}>
            {level}
        </span>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WellnessIntervention['status'] }) {
    const styles: Record<WellnessIntervention['status'], string> = {
        PROPOSED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        COMPLETED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        DECLINED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
            {status}
        </span>
    );
}

// ─── Mood Emoji ───────────────────────────────────────────────────────────────

const MOOD_EMOJI = ['', '😞', '😟', '😐', '🙂', '😄'];
const MOOD_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
    icon: Icon, label, value, sub, color, delta,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
    delta?: number;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon size={18} />
                </span>
            </div>
            <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                {sub && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{sub}</p>}
            </div>
            {delta !== undefined && (
                <div className={`flex items-center gap-1 text-xs font-semibold ${delta >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {delta >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {Math.abs(delta).toFixed(1)} vs last period
                </div>
            )}
        </div>
    );
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function MoodSparkline({ data }: { data: number[] }) {
    const max = 5, min = 1;
    const w = 60, h = 24;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        return `${x},${y}`;
    });
    const latest = data[data.length - 1];
    const color = latest >= 4 ? '#22c55e' : latest === 3 ? '#eab308' : '#ef4444';
    return (
        <svg width={w} height={h} className="shrink-0">
            <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts.join(' ')} />
        </svg>
    );
}

// ─── Risk Score Bar ───────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
    const color = score >= 75 ? 'bg-red-500' : score >= 55 ? 'bg-orange-500' : score >= 30 ? 'bg-yellow-500' : 'bg-green-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 w-6 text-right">{score}</span>
        </div>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
    kpis,
    alerts,
    onAlertDismiss,
}: {
    kpis: MentalHealthKPIs;
    alerts: WellnessAlert[];
    onAlertDismiss: (id: string) => void;
}) {
    const unread = alerts.filter((a) => !a.isRead);
    const severityIcon = (s: WellnessAlert['severity']) =>
        s === 'critical' ? <AlertTriangle size={16} className="text-red-500" /> :
            s === 'warning' ? <AlertTriangle size={16} className="text-yellow-500" /> :
                <Bell size={16} className="text-blue-400" />;

    const severityBg = (s: WellnessAlert['severity']) =>
        s === 'critical' ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800' :
            s === 'warning' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800' :
                'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800';

    return (
        <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    icon={AlertTriangle} label="Critical Risk" color="bg-red-100 text-red-600 dark:bg-red-900/40"
                    value={kpis.criticalRiskCount} sub="immediate action required"
                />
                <KPICard
                    icon={Users} label="Total At-Risk" color="bg-orange-100 text-orange-600 dark:bg-orange-900/40"
                    value={kpis.totalAtRisk} sub={`${kpis.highRiskCount} HIGH + ${kpis.criticalRiskCount} CRITICAL`}
                />
                <KPICard
                    icon={Smile} label="Avg Mood Score" color="bg-teal-100 text-teal-600 dark:bg-teal-900/40"
                    value={`${kpis.avgCompanyMoodScore}/5`} sub="company-wide" delta={kpis.moodScoreDelta}
                />
                <KPICard
                    icon={ShieldCheck} label="Active Interventions" color="bg-blue-100 text-blue-600 dark:bg-blue-900/40"
                    value={kpis.activeInterventions} sub={`${kpis.interventionSuccessRate}% success rate`}
                />
                <KPICard
                    icon={HeartPulse} label="EAP Utilization" color="bg-purple-100 text-purple-600 dark:bg-purple-900/40"
                    value={`${kpis.eapUtilizationRate}%`} sub="of workforce in 30d"
                />
                <KPICard
                    icon={Clock} label="Avg Overtime" color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40"
                    value={`${kpis.avgOvertimeHoursCompany}h`} sub="last 30 days / employee"
                />
                <KPICard
                    icon={Activity} label="Absenteeism Rate" color="bg-pink-100 text-pink-600 dark:bg-pink-900/40"
                    value={`${kpis.absenteeismRate}%`} sub="this quarter"
                />
                <KPICard
                    icon={CheckCircle} label="Check-in Rate" color="bg-green-100 text-green-600 dark:bg-green-900/40"
                    value={`${kpis.checkInParticipationRate}%`} sub="weekly participation"
                />
            </div>

            {/* Active Alerts */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Bell size={16} className="text-red-500" />
                        Wellness Alerts
                        {unread.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">{unread.length}</span>
                        )}
                    </h3>
                </div>
                <div className="p-4 space-y-3">
                    {alerts.map((alert) => (
                        <div key={alert.id} className={`rounded-lg border p-4 ${severityBg(alert.severity)} ${alert.isRead ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                    {severityIcon(alert.severity)}
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{alert.title}</p>
                                        <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{alert.message}</p>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                            {alert.affectedCount} affected {alert.department ? `· ${alert.department}` : ''}
                                        </p>
                                    </div>
                                </div>
                                {!alert.isRead && (
                                    <button
                                        onClick={() => onAlertDismiss(alert.id)}
                                        className="shrink-0 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Dismiss
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Heatmap Tab ──────────────────────────────────────────────────────────────

function HeatmapTab({ data }: { data: DepartmentHeatmapEntry[] }) {
    const sorted = [...data].sort((a, b) => b.avgRiskScore - a.avgRiskScore);

    const trendIcon = (t: DepartmentHeatmapEntry['trendDirection']) =>
        t === 'worsening' ? <TrendingUp size={14} className="text-red-500" /> :
            t === 'improving' ? <TrendingDown size={14} className="text-green-500" /> :
                <Activity size={14} className="text-yellow-500" />;

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart2 size={16} /> Department Burnout Heatmap
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Sorted by average burnout risk score</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {sorted.map((dept) => {
                        const barColor =
                            dept.avgRiskScore >= 65 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                dept.avgRiskScore >= 45 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                                    dept.avgRiskScore >= 25 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                        'bg-gradient-to-r from-green-500 to-green-400';

                        return (
                            <div key={dept.department} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-gray-900 dark:text-white text-sm w-36">{dept.department}</span>
                                        <span className="text-xs text-gray-500 dark:text-slate-400">{dept.headcount} employees</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="flex items-center gap-1">{trendIcon(dept.trendDirection)} {dept.trendDirection}</span>
                                        <span className="text-red-600 dark:text-red-400 font-semibold">{dept.criticalCount} critical</span>
                                        <span className="text-orange-600 dark:text-orange-400 font-semibold">{dept.highCount} high</span>
                                        <span className="font-bold text-gray-900 dark:text-white w-12 text-right">
                                            {dept.avgRiskScore.toFixed(0)}/100
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                        style={{ width: `${dept.avgRiskScore}%` }}
                                    />
                                </div>
                                <div className="flex gap-6 mt-2 text-xs text-gray-400 dark:text-slate-500">
                                    <span>Mood: {dept.avgMoodScore.toFixed(1)}/5</span>
                                    <span>Avg OT: {dept.avgOvertimeHours.toFixed(0)}h/mo</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab({ employees }: { employees: EmployeeBurnoutProfile[] }) {
    const [search, setSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState<BurnoutRiskLevel | 'ALL'>('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const departments = ['ALL', ...Array.from(new Set(employees.map((e) => e.department))).sort()];

    const filtered = useMemo(() => {
        return employees.filter((e) => {
            const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
                e.department.toLowerCase().includes(search.toLowerCase());
            const matchRisk = riskFilter === 'ALL' || e.riskLevel === riskFilter;
            const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
            return matchSearch && matchRisk && matchDept;
        }).sort((a, b) => b.riskScore - a.riskScore);
    }, [employees, search, riskFilter, deptFilter]);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search employee or department…"
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="relative">
                    <select
                        value={riskFilter}
                        onChange={(e) => setRiskFilter(e.target.value as BurnoutRiskLevel | 'ALL')}
                        className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="ALL">All Risk Levels</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MODERATE">Moderate</option>
                        <option value="LOW">Low</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative">
                    <select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400">
                Showing {filtered.length} of {employees.length} employees
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Employee</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Risk</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Score</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Mood (14d)</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">OT Hours</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Intervention</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {filtered.map((emp) => (
                            <>
                                <tr
                                    key={emp.employeeId}
                                    className="hover:bg-gray-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                                    onClick={() => setExpandedId(expandedId === emp.employeeId ? null : emp.employeeId)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                {emp.avatarInitials}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{emp.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">{emp.department}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3"><RiskBadge level={emp.riskLevel} /></td>
                                    <td className="px-4 py-3 hidden md:table-cell w-28"><RiskBar score={emp.riskScore} /></td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <div className="flex items-center gap-2">
                                            <MoodSparkline data={emp.moodTrend} />
                                            <span className="text-base">{MOOD_EMOJI[emp.latestMood]}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <span className={`font-semibold ${emp.overtimeHoursLast30d > 40 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-slate-300'}`}>
                                            {emp.overtimeHoursLast30d}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {emp.activeIntervention ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-300 font-semibold">
                                                <CheckCircle size={12} /> Active
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400 dark:text-slate-500">None</span>
                                        )}
                                    </td>
                                </tr>
                                {expandedId === emp.employeeId && (
                                    <tr key={`${emp.employeeId}-expanded`} className="bg-blue-50 dark:bg-slate-900/50">
                                        <td colSpan={6} className="px-6 py-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Job Title</p>
                                                    <p className="text-sm text-gray-900 dark:text-white">{emp.jobTitle}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Last Check-in</p>
                                                    <p className="text-sm text-gray-900 dark:text-white">
                                                        {new Date(emp.lastCheckInDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Absenteeism</p>
                                                    <p className="text-sm text-gray-900 dark:text-white">{emp.absenteeismRate}%</p>
                                                </div>
                                                {emp.flaggedSignals.length > 0 && (
                                                    <div className="md:col-span-3">
                                                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-2">Flagged Signals</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {emp.flaggedSignals.map((s) => (
                                                                <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-lg">
                                                                    <AlertTriangle size={10} /> {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Interventions Tab ────────────────────────────────────────────────────────

function InterventionsTab({ interventions }: { interventions: WellnessIntervention[] }) {
    const [statusFilter, setStatusFilter] = useState<WellnessIntervention['status'] | 'ALL'>('ALL');

    const filtered = useMemo(() =>
        interventions.filter((i) => statusFilter === 'ALL' || i.status === statusFilter)
        , [interventions, statusFilter]);

    const counts = useMemo(() => ({
        PROPOSED: interventions.filter((i) => i.status === 'PROPOSED').length,
        ACTIVE: interventions.filter((i) => i.status === 'ACTIVE').length,
        COMPLETED: interventions.filter((i) => i.status === 'COMPLETED').length,
        DECLINED: interventions.filter((i) => i.status === 'DECLINED').length,
    }), [interventions]);

    const priorityColor: Record<WellnessIntervention['priority'], string> = {
        URGENT: 'text-red-600 dark:text-red-400',
        HIGH: 'text-orange-600 dark:text-orange-400',
        MEDIUM: 'text-yellow-600 dark:text-yellow-400',
        LOW: 'text-green-600 dark:text-green-400',
    };

    return (
        <div className="space-y-4">
            {/* Summary pills */}
            <div className="flex flex-wrap gap-3">
                {(['ALL', 'PROPOSED', 'ACTIVE', 'COMPLETED', 'DECLINED'] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${statusFilter === s
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-400'
                            }`}
                    >
                        {s} {s !== 'ALL' && `(${counts[s]})`}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filtered.map((inv) => (
                    <div key={inv.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                    {inv.employeeName.split(' ').map((n) => n[0]).join('')}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">{inv.employeeName}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">{inv.department} · {inv.employeeId}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`text-xs font-bold uppercase ${priorityColor[inv.priority]}`}>
                                    {inv.priority}
                                </span>
                                <StatusBadge status={inv.status} />
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase font-semibold mb-1">Intervention Type</p>
                                <p className="font-semibold text-gray-900 dark:text-white">{getInterventionLabel(inv.type)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase font-semibold mb-1">Assigned To</p>
                                <p className="font-semibold text-gray-900 dark:text-white">{inv.assignedTo}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase font-semibold mb-1">Proposed Date</p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    {new Date(inv.proposedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </p>
                            </div>
                        </div>

                        <p className="mt-3 text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                            {inv.notes}
                        </p>

                        {inv.outcome && (
                            <p className="mt-2 text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle size={12} /> {inv.outcome}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Mood Tab ─────────────────────────────────────────────────────────────────

function MoodTab({
    trend,
    distribution,
}: {
    trend: MoodTrendPoint[];
    distribution: MoodDistribution[];
}) {
    const recent = trend.slice(-30);
    const maxCount = Math.max(...recent.map((p) => p.avgScore));
    const minCount = Math.min(...recent.map((p) => p.avgScore));

    return (
        <div className="space-y-6">
            {/* Distribution */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Smile size={16} /> Mood Distribution (Last Check-in Cycle)
                </h3>
                <div className="space-y-3">
                    {distribution.map((d) => (
                        <div key={d.score} className="flex items-center gap-3">
                            <span className="text-xl w-8 text-center">{MOOD_EMOJI[d.score]}</span>
                            <span className="text-sm text-gray-700 dark:text-slate-300 w-24">{d.label}</span>
                            <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${d.percentage}%`, backgroundColor: d.color }}
                                />
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white w-16 text-right">
                                {d.count} ({d.percentage}%)
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 30-day trend (SVG line chart) */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                    <TrendingUp size={16} /> 30-Day Mood Trend
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Company-wide average daily mood score</p>
                <div className="relative" style={{ height: 140 }}>
                    <svg width="100%" height="140" viewBox={`0 0 ${recent.length * 20} 140`} preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {/* Area fill */}
                        <polygon
                            fill="url(#moodGrad)"
                            points={[
                                ...recent.map((p, i) => {
                                    const x = i * 20 + 10;
                                    const y = 130 - ((p.avgScore - 1) / 4) * 110;
                                    return `${x},${y}`;
                                }),
                                `${(recent.length - 1) * 20 + 10},130`,
                                `10,130`,
                            ].join(' ')}
                        />
                        {/* Line */}
                        <polyline
                            fill="none"
                            stroke="#14b8a6"
                            strokeWidth="2"
                            points={recent.map((p, i) => {
                                const x = i * 20 + 10;
                                const y = 130 - ((p.avgScore - 1) / 4) * 110;
                                return `${x},${y}`;
                            }).join(' ')}
                        />
                        {/* Dots */}
                        {recent.map((p, i) => {
                            const x = i * 20 + 10;
                            const y = 130 - ((p.avgScore - 1) / 4) * 110;
                            return <circle key={i} cx={x} cy={y} r="2.5" fill="#14b8a6" />;
                        })}
                    </svg>
                    {/* Y-labels */}
                    <div className="absolute top-0 right-0 flex flex-col justify-between h-full text-xs text-gray-400 dark:text-slate-500 pr-1">
                        <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
                    </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1">
                    <span>{recent[0]?.date}</span>
                    <span>{recent[recent.length - 1]?.date}</span>
                </div>
            </div>
        </div>
    );
}

// ─── EAP Tab ──────────────────────────────────────────────────────────────────

function EAPTab({ eap }: { eap: EAPUtilizationMetrics }) {
    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 text-center">
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{eap.totalSessions}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Total Sessions (YTD)</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 text-center">
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{eap.sessionsThisMonth}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Sessions This Month</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 text-center">
                    <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{eap.uniqueEmployeesServed}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Unique Employees Served</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 text-center">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{eap.utilizationRate}%</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Workforce Utilization Rate</p>
                </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BookOpen size={16} /> Sessions by Category
                </h3>
                <div className="space-y-4">
                    {eap.byCategory.map((cat) => (
                        <div key={cat.category} className="flex items-center gap-3">
                            <span className="text-lg w-8 text-center">{cat.icon}</span>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700 dark:text-slate-300">{cat.category}</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{cat.sessions} sessions</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                                        style={{ width: `${cat.percentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Monthly trend */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Activity size={16} /> Monthly Utilization Trend (12 months)
                </h3>
                <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                    {eap.monthlyTrend.map((m) => {
                        const h = Math.round((m.sessions / 80) * 80);
                        return (
                            <div key={m.month} className="flex flex-col items-center gap-1">
                                <div
                                    className="w-full rounded-t-sm bg-gradient-to-t from-purple-600 to-purple-400 dark:from-purple-700 dark:to-purple-500 min-h-[4px]"
                                    style={{ height: `${h}px` }}
                                    title={`${m.sessions} sessions`}
                                />
                                <span className="text-xs text-gray-400 dark:text-slate-500">{m.month}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MentalHealthHubPage() {
    const [tab, setTab] = useState<DashboardTab>('overview');
    const [loading, setLoading] = useState(true);
    const [alerts, setAlerts] = useState<WellnessAlert[]>([]);

    const employees = useMemo(() => generateEmployeeBurnoutProfiles(40), []);
    const heatmap = useMemo(() => generateDepartmentHeatmap(), []);
    const moodTrend = useMemo(() => generateMoodTrendData(90), []);
    const moodDist = useMemo(() => getMoodDistribution(), []);
    const eap = useMemo(() => generateEAPMetrics(), []);
    const interventions = useMemo(() => generateInterventions(employees), [employees]);
    const kpis = useMemo(() => computeKPIs(employees, interventions, eap), [employees, interventions, eap]);

    useEffect(() => {
        setAlerts(generateWellnessAlerts());
        const t = setTimeout(() => setLoading(false), 600);
        return () => clearTimeout(t);
    }, []);

    const handleDismissAlert = (id: string) => {
        setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a));
    };

    const TABS: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
        { id: 'overview', label: 'Overview', icon: BarChart2 },
        { id: 'heatmap', label: 'Dept Heatmap', icon: Activity },
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'interventions', label: 'Interventions', icon: ClipboardList },
        { id: 'mood', label: 'Mood Analytics', icon: Smile },
        { id: 'eap', label: 'EAP Program', icon: HeartPulse },
    ];

    const unreadCount = alerts.filter((a) => !a.isRead).length;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Loading Mental Health Hub…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center">
                            <Brain size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                Mental Health & Burnout Prevention Hub
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Real-time workforce wellbeing intelligence</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                                <Bell size={13} className="text-red-600 dark:text-red-400" />
                                <span className="text-xs font-bold text-red-700 dark:text-red-300">{unreadCount} alerts</span>
                            </div>
                        )}
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <RefreshCw size={13} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mt-4 flex gap-1 overflow-x-auto">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === id
                                ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 lg:p-8">
                {tab === 'overview' && <OverviewTab kpis={kpis} alerts={alerts} onAlertDismiss={handleDismissAlert} />}
                {tab === 'heatmap' && <HeatmapTab data={heatmap} />}
                {tab === 'employees' && <EmployeesTab employees={employees} />}
                {tab === 'interventions' && <InterventionsTab interventions={interventions} />}
                {tab === 'mood' && <MoodTab trend={moodTrend} distribution={moodDist} />}
                {tab === 'eap' && <EAPTab eap={eap} />}
            </div>
        </div>
    );
}
