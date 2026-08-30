import React, { useState, useEffect, useCallback } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import { CustomerRiskProfile, CustomerTier, SortDirection } from '../../types/fraudRisk';
import {
    Users, Search, ChevronLeft, ChevronRight, Shield, AlertTriangle,
    Globe, Cpu, TrendingUp, Activity, Eye, ArrowUp, ArrowDown, ArrowUpDown,
    User, CreditCard, MapPin, Tag, Ban, CheckCircle2, AlertCircle,
    BarChart3, Clock,
} from 'lucide-react';

export const CustomerRiskProfiler: React.FC = () => {
    const [profiles, setProfiles] = useState<CustomerRiskProfile[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState<CustomerTier | 'ALL'>('ALL');
    const [sortField, setSortField] = useState<'overallRiskScore' | 'alertCount' | 'totalTransactionVolume' | 'lastActivity'>('overallRiskScore');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');
    const [selectedProfile, setSelectedProfile] = useState<CustomerRiskProfile | null>(null);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        const result = await FraudRiskService.getCustomerProfiles(search, tierFilter, sortField, sortDir, page, 15);
        setProfiles(result.profiles);
        setTotal(result.total);
        setPages(result.pages);
        setLoading(false);
    }, [search, tierFilter, sortField, sortDir, page]);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
        setPage(1);
    };

    const getTierBadge = (tier: CustomerTier) => {
        switch (tier) {
            case 'STANDARD': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
            case 'ELEVATED': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
            case 'HIGH_RISK': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-orange-200 dark:border-orange-500/20';
            case 'BLOCKED': return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/20';
        }
    };

    const getTierIcon = (tier: CustomerTier) => {
        switch (tier) {
            case 'STANDARD': return <CheckCircle2 className="w-3 h-3" />;
            case 'ELEVATED': return <AlertCircle className="w-3 h-3" />;
            case 'HIGH_RISK': return <AlertTriangle className="w-3 h-3" />;
            case 'BLOCKED': return <Ban className="w-3 h-3" />;
        }
    };

    const getRiskScoreColor = (score: number) => {
        if (score >= 85) return 'text-rose-600 dark:text-rose-400';
        if (score >= 60) return 'text-orange-600 dark:text-orange-400';
        if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-emerald-600 dark:text-emerald-400';
    };

    const getRiskBarColor = (score: number) => {
        if (score >= 85) return 'bg-rose-500';
        if (score >= 60) return 'bg-orange-500';
        if (score >= 40) return 'bg-yellow-400';
        return 'bg-emerald-500';
    };

    const getScoreBreakdownColor = (score: number) => {
        if (score >= 70) return { ring: 'stroke-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' };
        if (score >= 40) return { ring: 'stroke-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' };
        return { ring: 'stroke-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' };
    };

    const SortIcon: React.FC<{ field: typeof sortField }> = ({ field }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300 dark:text-gray-600" />;
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />;
    };

    const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;
        const width = 120;
        const height = 30;
        const points = data.map((v, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((v - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg width={width} height={height} className="overflow-visible">
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 dark:bg-purple-500/20 p-2.5 rounded-xl">
                            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Customer Risk Profiler</h3>
                            <p className="text-xs text-gray-500">{total} customer profiles • AI-powered risk scoring</p>
                        </div>
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
                            placeholder="Search customers by name, email, or ID..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white placeholder-gray-400"
                        />
                    </div>
                    <select
                        value={tierFilter}
                        onChange={(e) => { setTierFilter(e.target.value as CustomerTier | 'ALL'); setPage(1); }}
                        className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    >
                        <option value="ALL">All Tiers</option>
                        <option value="STANDARD">Standard</option>
                        <option value="ELEVATED">Elevated</option>
                        <option value="HIGH_RISK">High Risk</option>
                        <option value="BLOCKED">Blocked</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                            <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer</th>
                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Tier</th>
                            <th
                                onClick={() => handleSort('overallRiskScore')}
                                className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 select-none"
                            >
                                <span className="flex items-center gap-1">Risk Score <SortIcon field="overallRiskScore" /></span>
                            </th>
                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Score Breakdown</th>
                            <th
                                onClick={() => handleSort('alertCount')}
                                className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 select-none"
                            >
                                <span className="flex items-center justify-center gap-1">Alerts <SortIcon field="alertCount" /></span>
                            </th>
                            <th
                                onClick={() => handleSort('totalTransactionVolume')}
                                className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 select-none"
                            >
                                <span className="flex items-center justify-end gap-1">Volume <SortIcon field="totalTransactionVolume" /></span>
                            </th>
                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Risk Trend</th>
                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <td key={j} className="px-6 py-4">
                                            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : profiles.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <Users className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                                        <p className="font-semibold text-gray-900 dark:text-gray-100">No customers found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            profiles.map(profile => (
                                <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                                                {profile.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{profile.name}</div>
                                                <div className="text-xs text-gray-400 truncate max-w-[160px]">{profile.email}</div>
                                                <div className="text-[10px] font-mono text-gray-400">{profile.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getTierBadge(profile.tier)}`}>
                                            {getTierIcon(profile.tier)}
                                            {profile.tier.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg font-extrabold ${getRiskScoreColor(profile.overallRiskScore)}`}>
                                                {profile.overallRiskScore.toFixed(0)}
                                            </span>
                                            <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${getRiskBarColor(profile.overallRiskScore)}`}
                                                    style={{ width: `${profile.overallRiskScore}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5">
                                            {[
                                                { label: 'V', score: profile.velocityScore },
                                                { label: 'G', score: profile.geoRiskScore },
                                                { label: 'D', score: profile.deviceRiskScore },
                                                { label: 'B', score: profile.behavioralScore },
                                            ].map(item => {
                                                const colors = getScoreBreakdownColor(item.score);
                                                return (
                                                    <div key={item.label} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${colors.bg} ${colors.text}`} title={`${item.label}: ${item.score.toFixed(0)}`}>
                                                        {item.label}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{profile.alertCount}</span>
                                            <span className="text-[10px] text-gray-400">
                                                <span className="text-rose-500">{profile.openAlerts} open</span> • <span className="text-emerald-500">{profile.resolvedAlerts} resolved</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                            ${profile.totalTransactionVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                        <div className="text-[10px] text-gray-400">{profile.totalTransactions} txns</div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <MiniSparkline
                                            data={profile.riskTimeline.slice(-14).map(p => p.score)}
                                            color={profile.overallRiskScore >= 60 ? '#F97316' : '#10B981'}
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <button
                                            onClick={() => setSelectedProfile(selectedProfile?.id === profile.id ? null : profile)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                    <span className="text-sm text-gray-500">
                        Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, total)} of {total}
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

            {/* Detail Panel */}
            {selectedProfile && (
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                                {selectedProfile.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedProfile.name}</h4>
                                <p className="text-sm text-gray-500">{selectedProfile.email} • <span className={`font-bold ${getRiskScoreColor(selectedProfile.overallRiskScore)}`}>Risk: {selectedProfile.overallRiskScore.toFixed(0)}/100</span></p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedProfile(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">✕</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[
                            { label: 'Velocity Score', value: selectedProfile.velocityScore.toFixed(0), icon: Activity, color: getRiskScoreColor(selectedProfile.velocityScore) },
                            { label: 'Geo Risk Score', value: selectedProfile.geoRiskScore.toFixed(0), icon: Globe, color: getRiskScoreColor(selectedProfile.geoRiskScore) },
                            { label: 'Device Risk Score', value: selectedProfile.deviceRiskScore.toFixed(0), icon: Cpu, color: getRiskScoreColor(selectedProfile.deviceRiskScore) },
                            { label: 'Behavioral Score', value: selectedProfile.behavioralScore.toFixed(0), icon: TrendingUp, color: getRiskScoreColor(selectedProfile.behavioralScore) },
                        ].map(item => (
                            <div key={item.label} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2 mb-2">
                                    <item.icon className="w-4 h-4 text-gray-400" />
                                    <span className="text-[10px] font-bold uppercase text-gray-400">{item.label}</span>
                                </div>
                                <div className={`text-2xl font-extrabold ${item.color}`}>{item.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedProfile.totalTransactions}</div>
                            <div className="text-[10px] font-bold uppercase text-gray-400">Transactions</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">${selectedProfile.avgTransactionAmount.toFixed(0)}</div>
                            <div className="text-[10px] font-bold uppercase text-gray-400">Avg Amount</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedProfile.deviceCount}</div>
                            <div className="text-[10px] font-bold uppercase text-gray-400">Devices Used</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">{selectedProfile.uniqueCountries}</div>
                            <div className="text-[10px] font-bold uppercase text-gray-400">Countries</div>
                        </div>
                    </div>

                    {selectedProfile.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {selectedProfile.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700">
                                    <Tag className="w-3 h-3" />{tag.replace(/_/g, ' ')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
