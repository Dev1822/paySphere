import React, { useState, useMemo, useEffect } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle,
    BarChart2, Search, ChevronDown, CheckCircle, ArrowUp, ArrowDown,
    Target, Star, Briefcase, ShieldCheck, BookOpen, Activity, RefreshCw,
    Award, Filter, ChevronRight,
} from 'lucide-react';
import type {
    EmployeeCompensation, DepartmentCompSummary, PayEquityGroup,
    CompBand, MeritRecommendation, CompensationKPIs, MarketBenchmark,
    PayrollTrendPoint, BenchmarkDashboardTab, RoleLevel, MarketPosition,
} from '../../types/salaryBenchmark';
import {
    generateEmployeeCompensations, generateDeptSummaries,
    generatePayEquityGroups, generateCompBands, generateMeritRecommendations,
    computeCompKPIs, generatePayrollTrend, generateMarketBenchmarks,
} from '../../services/salaryBenchmarkService';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtINR = (v: number) =>
    v >= 10000000 ? `₹${(v / 10000000).toFixed(2)}Cr`
        : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L`
            : `₹${v.toLocaleString('en-IN')}`;

const fmtCompa = (v: number) => v.toFixed(2) + 'x';

// ─── Market Position Badge ────────────────────────────────────────────────────

const MP_STYLES: Record<MarketPosition, string> = {
    BELOW_MARKET: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700',
    AT_MARKET: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-300 dark:border-green-700',
    ABOVE_MARKET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
    PREMIUM: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700',
};
const MP_LABELS: Record<MarketPosition, string> = {
    BELOW_MARKET: '↓ Below Market',
    AT_MARKET: '✓ At Market',
    ABOVE_MARKET: '↑ Above Market',
    PREMIUM: '★ Premium',
};

function MPBadge({ pos }: { pos: MarketPosition }) {
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${MP_STYLES[pos]}`}>
            {MP_LABELS[pos]}
        </span>
    );
}

// ─── Retention Risk Badge ─────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: EmployeeCompensation['retentionRisk'] }) {
    const s: Record<typeof risk, string> = {
        LOW: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
        HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${s[risk]}`}>{risk}</span>;
}

// ─── Compa Ratio Bar ──────────────────────────────────────────────────────────

function CompaBar({ ratio }: { ratio: number }) {
    const pct = Math.min(ratio * 100, 140); // cap at 140% for display
    const color = ratio < 0.85 ? 'bg-red-500' : ratio < 1.05 ? 'bg-green-500' : ratio < 1.20 ? 'bg-blue-500' : 'bg-purple-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                {/* midline at 100% */}
                <div className="absolute left-[71.4%] top-0 bottom-0 w-px bg-gray-400 dark:bg-slate-500 z-10" />
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs font-bold w-10 text-right text-gray-700 dark:text-slate-300">{fmtCompa(ratio)}</span>
        </div>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color, delta }: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; color: string; delta?: number;
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
                    {Math.abs(delta).toFixed(1)}% vs budget
                </div>
            )}
        </div>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ kpis, trend, depts }: {
    kpis: CompensationKPIs; trend: PayrollTrendPoint[]; depts: DepartmentCompSummary[];
}) {
    const marketMix = [
        { label: 'Below Market', pct: kpis.belowMarketPct, color: '#ef4444' },
        { label: 'At Market', pct: kpis.atMarketPct, color: '#22c55e' },
        { label: 'Above Market', pct: kpis.aboveMarketPct, color: '#3b82f6' },
        { label: 'Premium', pct: kpis.premiumPct, color: '#a855f7' },
    ];
    const trendMax = Math.max(...trend.map((t) => t.totalPayroll));

    return (
        <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard icon={Users} label="Total Headcount" color="bg-blue-100 text-blue-600 dark:bg-blue-900/40"
                    value={kpis.totalHeadcount} sub="active employees" />
                <KPICard icon={DollarSign} label="Annual Payroll" color="bg-green-100 text-green-600 dark:bg-green-900/40"
                    value={fmtINR(kpis.totalAnnualPayroll)} sub="total CTC" delta={kpis.payrollVarianceVsBudget} />
                <KPICard icon={Target} label="Avg Compa Ratio" color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40"
                    value={fmtCompa(kpis.avgCompaRatio)} sub={`median: ${fmtCompa(kpis.medianCompaRatio)}`} />
                <KPICard icon={AlertTriangle} label="Below Market" color="bg-red-100 text-red-600 dark:bg-red-900/40"
                    value={`${kpis.belowMarketPct}%`} sub="need pay review" />
                <KPICard icon={ShieldCheck} label="Retention Risk" color="bg-orange-100 text-orange-600 dark:bg-orange-900/40"
                    value={kpis.retentionRiskHighCount} sub="high/critical employees" />
                <KPICard icon={Star} label="Merit Actions" color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40"
                    value={kpis.pendingMeritRecommendations} sub="pending recommendations" />
                <KPICard icon={DollarSign} label="Merit Budget" color="bg-teal-100 text-teal-600 dark:bg-teal-900/40"
                    value={fmtINR(kpis.projectedMeritBudget)} sub={`avg ${kpis.avgMeritIncreasePct}% increase`} />
                <KPICard icon={Users} label="Pay Gap Groups" color="bg-pink-100 text-pink-600 dark:bg-pink-900/40"
                    value={kpis.payGapDetectedGroups} sub="groups with detected gap" />
            </div>

            {/* Market Mix + Payroll Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Market Position Distribution */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Target size={16} /> Market Position Mix
                    </h3>
                    <div className="flex gap-2 h-8 rounded-lg overflow-hidden mb-4">
                        {marketMix.map((m) => (
                            <div key={m.label} style={{ width: `${m.pct}%`, backgroundColor: m.color }}
                                className="flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                                title={`${m.label}: ${m.pct}%`}
                            >
                                {m.pct > 10 ? `${m.pct}%` : ''}
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {marketMix.map((m) => (
                            <div key={m.label} className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
                                <span className="text-sm text-gray-700 dark:text-slate-300 flex-1">{m.label}</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white">{m.pct}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payroll Trend */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <TrendingUp size={16} /> Monthly Payroll Trend
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Total CTC disbursed per month</p>
                    <div className="flex items-end gap-1.5 h-28">
                        {trend.map((t) => (
                            <div key={t.month} className="flex flex-col items-center gap-1 flex-1">
                                <div
                                    className="w-full rounded-t bg-gradient-to-t from-indigo-600 to-indigo-400 min-h-[4px]"
                                    style={{ height: `${Math.round((t.totalPayroll / trendMax) * 100)}px` }}
                                    title={`${t.month}: ${fmtINR(t.totalPayroll)}`}
                                />
                                <span className="text-xs text-gray-400 dark:text-slate-500">{t.month}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dept Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart2 size={16} /> Department Compensation Summary
                    </h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {depts.sort((a, b) => b.avgCompaRatio - a.avgCompaRatio).map((dept) => (
                        <div key={dept.department} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/40">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-900 dark:text-white w-36 text-sm">{dept.department}</span>
                                <span className="text-xs text-gray-500 dark:text-slate-400">{dept.headcount} emp</span>
                                {dept.trendDirection === 'UP'
                                    ? <TrendingUp size={13} className="text-green-500" />
                                    : dept.trendDirection === 'DOWN'
                                        ? <TrendingDown size={13} className="text-red-500" />
                                        : <Activity size={13} className="text-yellow-500" />}
                            </div>
                            <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-slate-300">
                                <span>Avg Base: <b className="text-gray-900 dark:text-white">{fmtINR(dept.avgBaseSalary)}</b></span>
                                <span>Avg CTC: <b className="text-gray-900 dark:text-white">{fmtINR(dept.avgTotalCTC)}</b></span>
                                <span>Compa: <b className={dept.avgCompaRatio < 0.9 ? 'text-red-500' : dept.avgCompaRatio > 1.15 ? 'text-purple-500' : 'text-green-600'}>{fmtCompa(dept.avgCompaRatio)}</b></span>
                                <span className="text-red-500 font-semibold">{dept.retentionRiskHighCount} at risk</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Employees Tab ─────────────────────────────────────────────────────────────

function EmployeesTab({ employees }: { employees: EmployeeCompensation[] }) {
    const [search, setSearch] = useState('');
    const [mpFilter, setMpFilter] = useState<MarketPosition | 'ALL'>('ALL');
    const [riskFilter, setRiskFilter] = useState<EmployeeCompensation['retentionRisk'] | 'ALL'>('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const depts = ['ALL', ...Array.from(new Set(employees.map((e) => e.department))).sort()];

    const filtered = useMemo(() => employees.filter((e) => {
        const s = search.toLowerCase();
        return (
            (e.name.toLowerCase().includes(s) || e.role.toLowerCase().includes(s) || e.department.toLowerCase().includes(s)) &&
            (mpFilter === 'ALL' || e.marketPosition === mpFilter) &&
            (riskFilter === 'ALL' || e.retentionRisk === riskFilter) &&
            (deptFilter === 'ALL' || e.department === deptFilter)
        );
    }).sort((a, b) => a.compaRatio - b.compaRatio), [employees, search, mpFilter, riskFilter, deptFilter]);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, role, department…"
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                {[
                    { val: mpFilter, set: setMpFilter as (v: string) => void, opts: ['ALL', 'BELOW_MARKET', 'AT_MARKET', 'ABOVE_MARKET', 'PREMIUM'], placeholder: 'Market Position' },
                    { val: riskFilter, set: setRiskFilter as (v: string) => void, opts: ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], placeholder: 'Retention Risk' },
                    { val: deptFilter, set: setDeptFilter, opts: depts, placeholder: 'Department' },
                ].map(({ val, set, opts, placeholder }) => (
                    <div key={placeholder} className="relative">
                        <select value={val} onChange={(e) => set(e.target.value)}
                            className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                            {opts.map((o) => <option key={o} value={o}>{o === 'ALL' ? placeholder + ': All' : o.replace(/_/g, ' ')}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                ))}
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400">
                {filtered.length} of {employees.length} employees · sorted by compa ratio (lowest first)
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                            {['Employee', 'Role / Level', 'Base Salary', 'Compa Ratio', 'Market Position', 'Retention Risk', 'Review'].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {filtered.map((emp) => (
                            <React.Fragment key={emp.employeeId}>
                                <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                                    onClick={() => setExpandedId(expandedId === emp.employeeId ? null : emp.employeeId)}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                {emp.avatarInitials}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                                                    {emp.name}
                                                    {emp.isHighPerformer && <Star size={11} className="text-yellow-500 fill-yellow-500" />}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">{emp.department}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-gray-800 dark:text-slate-200">{emp.role}</p>
                                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded">{emp.level}</span>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{fmtINR(emp.baseSalary)}</td>
                                    <td className="px-4 py-3 w-36"><CompaBar ratio={emp.compaRatio} /></td>
                                    <td className="px-4 py-3"><MPBadge pos={emp.marketPosition} /></td>
                                    <td className="px-4 py-3"><RiskBadge risk={emp.retentionRisk} /></td>
                                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{emp.nextReviewDate}</td>
                                </tr>
                                {expandedId === emp.employeeId && (
                                    <tr className="bg-indigo-50 dark:bg-slate-900/60">
                                        <td colSpan={7} className="px-6 py-4">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                {[
                                                    ['Variable Pay', fmtINR(emp.variablePay)],
                                                    ['Stock (Annual Est.)', fmtINR(emp.stockValue)],
                                                    ['Total CTC', fmtINR(emp.totalCTC)],
                                                    ['Market P50', fmtINR(emp.benchmarkP50)],
                                                    ['Market P75', fmtINR(emp.benchmarkP75)],
                                                    ['Last Merit Increase', `${emp.meritIncreasePct}%`],
                                                    ['Years in Role', `${emp.yearsInRole} yrs`],
                                                    ['Compensation Type', emp.compensationType],
                                                ].map(([k, v]) => (
                                                    <div key={k}>
                                                        <p className="text-xs text-gray-400 dark:text-slate-500 uppercase font-semibold mb-0.5">{k}</p>
                                                        <p className="font-semibold text-gray-900 dark:text-white">{v}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Pay Equity Tab ───────────────────────────────────────────────────────────

function PayEquityTab({ groups }: { groups: PayEquityGroup[] }) {
    const gapGroups = groups.filter((g) => g.direction === 'GAP_DETECTED' && g.isStatisticallySignificant);
    const deptFilter = Array.from(new Set(groups.map((g) => g.department))).sort();
    const [dept, setDept] = useState('ALL');
    const filtered = dept === 'ALL' ? groups : groups.filter((g) => g.department === dept);

    return (
        <div className="space-y-6">
            {/* Alert Banner */}
            {gapGroups.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-bold text-red-700 dark:text-red-300">
                            {gapGroups.length} statistically significant pay gap{gapGroups.length > 1 ? 's' : ''} detected
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                            These groups show &gt;2% gap vs reference group with sufficient sample sizes. Immediate review recommended.
                        </p>
                    </div>
                </div>
            )}

            {/* Dept filter */}
            <div className="flex items-center gap-3">
                <Filter size={14} className="text-gray-400" />
                <select value={dept} onChange={(e) => setDept(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none">
                    <option value="ALL">All Departments</option>
                    {deptFilter.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>

            <div className="space-y-3">
                {filtered.map((g) => (
                    <div key={g.groupKey} className={`bg-white dark:bg-slate-800 rounded-xl border p-5 ${g.direction === 'GAP_DETECTED' && g.isStatisticallySignificant
                        ? 'border-red-200 dark:border-red-800'
                        : 'border-gray-200 dark:border-slate-700'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">{g.groupKey}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{g.headcount} employees · {g.gender}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {g.isStatisticallySignificant && g.direction === 'GAP_DETECTED' && (
                                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold rounded-full">⚠ Significant</span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${g.direction === 'GAP_DETECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    : g.direction === 'FAVORABLE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {g.gapVsReferenceGroup > 0 ? '+' : ''}{g.gapVsReferenceGroup}% vs reference
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {[
                                ['Avg Base', fmtINR(g.avgBaseSalary)],
                                ['Median Base', fmtINR(g.medianBaseSalary)],
                                ['Avg CTC', fmtINR(g.avgTotalCTC)],
                                ['Compa Ratio', fmtCompa(g.avgCompaRatio)],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <p className="text-xs text-gray-400 dark:text-slate-500 uppercase mb-0.5">{k}</p>
                                    <p className="font-bold text-gray-900 dark:text-white">{v}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Comp Bands Tab ───────────────────────────────────────────────────────────

function CompBandsTab({ bands }: { bands: CompBand[] }) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
                Compensation band utilization vs market P50 anchor. Outliers indicate employees outside the defined band.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bands.map((b) => {
                    const range = b.bandMax - b.bandMin;
                    const anchorPct = ((b.marketAnchor - b.bandMin) / range) * 100;
                    const midPct = 50;
                    return (
                        <div key={`${b.role}-${b.level}`}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{b.role}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">{b.department} · <span className="font-semibold">{b.level}</span></p>
                                </div>
                                {b.outlierCount > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full font-semibold">
                                        {b.outlierCount} outlier{b.outlierCount > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            {/* Band visualization */}
                            <div className="relative h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg overflow-hidden mb-2">
                                {/* utilization fill */}
                                <div className="absolute inset-y-0 left-0 bg-indigo-400 dark:bg-indigo-600 rounded-lg opacity-50"
                                    style={{ width: `${b.utilizationPct}%` }} />
                                {/* band midpoint */}
                                <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-700 dark:bg-indigo-300"
                                    style={{ left: `${midPct}%` }} />
                                {/* market anchor */}
                                <div className="absolute top-0 bottom-0 w-0.5 bg-orange-500"
                                    style={{ left: `${Math.min(Math.max(anchorPct, 1), 99)}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-3">
                                <span>{fmtINR(b.bandMin)}</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Mid: {fmtINR(b.bandMid)}</span>
                                <span>{fmtINR(b.bandMax)}</span>
                            </div>
                            <div className="flex gap-4 text-xs">
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400" /> Utilization: {b.utilizationPct}%</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Market P50: {fmtINR(b.marketAnchor)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Merit Recommendations Tab ────────────────────────────────────────────────

function MeritTab({ recs }: { recs: MeritRecommendation[] }) {
    const [priorityFilter, setPriorityFilter] = useState<MeritRecommendation['priority'] | 'ALL'>('ALL');
    const filtered = priorityFilter === 'ALL' ? recs : recs.filter((r) => r.priority === priorityFilter);
    const totalCost = filtered.reduce((s, r) => s + r.estimatedCost, 0);

    const priorityStyles: Record<MeritRecommendation['priority'], string> = {
        CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
        LOW: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    };

    const urgencyBadge = (u: MeritRecommendation['urgency']) =>
        u === 'IMMEDIATE' ? 'text-red-600 dark:text-red-400' : u === 'NEXT_CYCLE' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex gap-3 flex-wrap">
                    {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                        <button key={p} onClick={() => setPriorityFilter(p)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${priorityFilter === p
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-indigo-400'}`}>
                            {p}
                        </button>
                    ))}
                </div>
                <div className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    Total Budget Impact: <span className="text-indigo-600 dark:text-indigo-400">{fmtINR(totalCost)}</span>
                </div>
            </div>

            <div className="space-y-3">
                {filtered.map((rec) => (
                    <div key={rec.employeeId} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                    {rec.name.split(' ').map((n) => n[0]).join('')}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">{rec.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">{rec.department} · {rec.role} · {rec.level}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityStyles[rec.priority]}`}>{rec.priority}</span>
                                <span className={`text-xs font-semibold ${urgencyBadge(rec.urgency)}`}>{rec.urgency.replace('_', ' ')}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase mb-1">Current Base</p>
                                <p className="font-bold text-gray-900 dark:text-white">{fmtINR(rec.currentBaseSalary)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase mb-1">Increase</p>
                                <p className="font-bold text-green-600 dark:text-green-400">+{rec.recommendedIncreasePct}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase mb-1">New Salary</p>
                                <p className="font-bold text-gray-900 dark:text-white">{fmtINR(rec.recommendedNewSalary)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase mb-1">Cost Impact</p>
                                <p className="font-bold text-indigo-600 dark:text-indigo-400">{fmtINR(rec.estimatedCost)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase mb-1">Reason</p>
                                <p className="font-semibold text-gray-700 dark:text-slate-300 text-xs">{rec.reason.replace(/_/g, ' ')}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Benchmarks Tab ───────────────────────────────────────────────────────────

function BenchmarksTab({ benchmarks }: { benchmarks: MarketBenchmark[] }) {
    const [deptFilter, setDeptFilter] = useState('ALL');
    const depts = ['ALL', ...Array.from(new Set(benchmarks.map((b) => b.department))).sort()];
    const filtered = deptFilter === 'ALL' ? benchmarks.slice(0, 30) : benchmarks.filter((b) => b.department === deptFilter).slice(0, 20);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Filter size={14} className="text-gray-400" />
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none">
                    {depts.map((d) => <option key={d} value={d}>{d === 'ALL' ? 'All Departments' : d}</option>)}
                </select>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                            {['Role', 'Level', 'P25', 'P50 (Median)', 'P75', 'P90', 'Source', 'Sample'].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {filtered.map((b, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                                <td className="px-4 py-3">
                                    <p className="font-semibold text-gray-900 dark:text-white">{b.role}</p>
                                    <p className="text-xs text-gray-400">{b.department}</p>
                                </td>
                                <td className="px-4 py-3"><span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded font-semibold">{b.level}</span></td>
                                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{fmtINR(b.p25)}</td>
                                <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{fmtINR(b.p50)}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{fmtINR(b.p75)}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{fmtINR(b.p90)}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{b.source}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{b.sampleSize}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SalaryBenchmarkingHubPage() {
    const [tab, setTab] = useState<BenchmarkDashboardTab>('overview');
    const [loading, setLoading] = useState(true);

    const employees = useMemo(() => generateEmployeeCompensations(60), []);
    const benchmarks = useMemo(() => generateMarketBenchmarks(), []);
    const depts = useMemo(() => generateDeptSummaries(employees), [employees]);
    const equityGroups = useMemo(() => generatePayEquityGroups(employees), [employees]);
    const compBands = useMemo(() => generateCompBands(), []);
    const meritRecs = useMemo(() => generateMeritRecommendations(employees), [employees]);
    const payrollTrend = useMemo(() => generatePayrollTrend(), []);
    const kpis = useMemo(() => computeCompKPIs(employees, meritRecs), [employees, meritRecs]);

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(t);
    }, []);

    const TABS: { id: BenchmarkDashboardTab; label: string; icon: React.ElementType }[] = [
        { id: 'overview', label: 'Overview', icon: BarChart2 },
        { id: 'benchmarks', label: 'Market Benchmarks', icon: Target },
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'equity', label: 'Pay Equity', icon: ShieldCheck },
        { id: 'bands', label: 'Comp Bands', icon: Briefcase },
        { id: 'merit', label: 'Merit Actions', icon: Award },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Loading Compensation Intelligence Hub…</p>
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
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <DollarSign size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                Salary Benchmarking & Compensation Intelligence Hub
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Real-time market positioning · pay equity · merit planning</p>
                        </div>
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>
                {/* Tabs */}
                <div className="mt-4 flex gap-1 overflow-x-auto">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setTab(id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === id
                                ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 lg:p-8">
                {tab === 'overview' && <OverviewTab kpis={kpis} trend={payrollTrend} depts={depts} />}
                {tab === 'benchmarks' && <BenchmarksTab benchmarks={benchmarks} />}
                {tab === 'employees' && <EmployeesTab employees={employees} />}
                {tab === 'equity' && <PayEquityTab groups={equityGroups} />}
                {tab === 'bands' && <CompBandsTab bands={compBands} />}
                {tab === 'merit' && <MeritTab recs={meritRecs} />}
            </div>
        </div>
    );
}
