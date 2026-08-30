import React, { useState, useEffect } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import { GeoThreatSummary, GeoThreatCountry, AlertCategory } from '../../types/fraudRisk';
import {
    Globe, MapPin, AlertTriangle, Shield, ShieldOff, Wifi, TrendingUp,
    ArrowUpRight, ArrowDownRight, Lock, Eye, BarChart3, Activity,
} from 'lucide-react';

export const GeographicThreatMap: React.FC = () => {
    const [data, setData] = useState<GeoThreatSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedCountry, setSelectedCountry] = useState<GeoThreatCountry | null>(null);
    const [sortBy, setSortBy] = useState<'threatLevel' | 'alertCount' | 'blockedCount'>('threatLevel');

    useEffect(() => {
        FraudRiskService.getGeoThreats().then(d => {
            setData(d);
            setLoading(false);
        });
    }, []);

    const sortedCountries = data
        ? [...data.countries].sort((a, b) => b[sortBy] - a[sortBy])
        : [];

    const getThreatColor = (level: number) => {
        if (level >= 80) return { bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-500/30', bar: 'bg-rose-500' };
        if (level >= 60) return { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-500/30', bar: 'bg-orange-500' };
        if (level >= 40) return { bg: 'bg-yellow-400', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-400/30', bar: 'bg-yellow-400' };
        if (level >= 20) return { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/30', bar: 'bg-blue-500' };
        return { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/30', bar: 'bg-emerald-500' };
    };

    const getThreatLabel = (level: number) => {
        if (level >= 80) return 'CRITICAL';
        if (level >= 60) return 'HIGH';
        if (level >= 40) return 'MODERATE';
        if (level >= 20) return 'LOW';
        return 'MINIMAL';
    };

    const getCountryFlag = (code: string) => {
        return code
            .toUpperCase()
            .split('')
            .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
            .join('');
    };

    const formatCategory = (cat: AlertCategory) => cat.replace(/_/g, ' ');

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-64" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const threatColors = getThreatColor(data.globalThreatIndex);

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl">
                        <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Geographic Threat Intelligence</h3>
                        <p className="text-xs text-gray-500">Cross-border fraud monitoring across {data.countries.length} regions</p>
                    </div>
                </div>
            </div>

            {/* Global Stats */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                        <div className="relative w-20 h-20 mx-auto mb-2">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-800" />
                                <circle
                                    cx="40" cy="40" r="34" fill="none" strokeWidth="6"
                                    strokeDasharray={`${(data.globalThreatIndex / 100) * 213.6} 213.6`}
                                    className={threatColors.bg}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-lg font-extrabold ${threatColors.text}`}>{data.globalThreatIndex.toFixed(0)}</span>
                            </div>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Global Threat Index</div>
                        <div className={`text-xs font-bold mt-0.5 ${threatColors.text}`}>{getThreatLabel(data.globalThreatIndex)}</div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{data.totalBlockedCountries}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">Blocked Countries</div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-2xl font-extrabold text-rose-500">{data.topThreatOrigin}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">Top Threat Origin</div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{data.crossBorderAlerts.toLocaleString()}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">Cross-Border Alerts</div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-2xl font-extrabold text-orange-500">{data.vpnProxyPercentage}%</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">VPN/Proxy Traffic</div>
                    </div>
                </div>
            </div>

            {/* Sort Controls */}
            <div className="px-6 pt-4 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Sort by:</span>
                {[
                    { key: 'threatLevel' as const, label: 'Threat Level' },
                    { key: 'alertCount' as const, label: 'Alert Count' },
                    { key: 'blockedCount' as const, label: 'Blocked' },
                ].map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setSortBy(opt.key)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                            sortBy === opt.key
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Country Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                {sortedCountries.map(country => {
                    const colors = getThreatColor(country.threatLevel);
                    const isSelected = selectedCountry?.code === country.code;

                    return (
                        <div
                            key={country.code}
                            onClick={() => setSelectedCountry(isSelected ? null : country)}
                            className={`relative p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                                isSelected
                                    ? `ring-2 ${colors.ring} border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50`
                                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{getCountryFlag(country.code)}</span>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{country.name}</h4>
                                        <span className="text-[10px] font-mono text-gray-400">{country.code}</span>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${colors.text} bg-gray-100 dark:bg-gray-800`}>
                                    {getThreatLabel(country.threatLevel)}
                                </span>
                            </div>

                            {/* Threat Level Bar */}
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                                    style={{ width: `${country.threatLevel}%` }}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div>
                                    <div className="text-lg font-extrabold text-gray-900 dark:text-white">{country.threatLevel}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Threat</div>
                                </div>
                                <div>
                                    <div className="text-lg font-extrabold text-orange-500">{country.alertCount.toLocaleString()}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Alerts</div>
                                </div>
                                <div>
                                    <div className="text-lg font-extrabold text-rose-500">{country.blockedCount}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Blocked</div>
                                </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                                <span className="text-gray-500">Top Vector: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCategory(country.topCategory)}</span></span>
                                <span className="text-gray-400">Avg: <span className="font-mono font-bold">{country.riskScoreAvg.toFixed(1)}</span></span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Selected Country Detail */}
            {selectedCountry && (
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{getCountryFlag(selectedCountry.code)}</span>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg">{selectedCountry.name} Threat Profile</h4>
                                <p className="text-sm text-gray-500">Detailed risk analysis and recommended actions</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedCountry(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-bold uppercase text-gray-400">Risk Score Avg</span>
                            </div>
                            <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{selectedCountry.riskScoreAvg.toFixed(1)}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                <span className="text-[10px] font-bold uppercase text-gray-400">Total Alerts</span>
                            </div>
                            <div className="text-2xl font-extrabold text-orange-500">{selectedCountry.alertCount.toLocaleString()}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Lock className="w-4 h-4 text-rose-500" />
                                <span className="text-[10px] font-bold uppercase text-gray-400">Blocked</span>
                            </div>
                            <div className="text-2xl font-extrabold text-rose-500">{selectedCountry.blockedCount}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-4 h-4 text-indigo-500" />
                                <span className="text-[10px] font-bold uppercase text-gray-400">Top Vector</span>
                            </div>
                            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatCategory(selectedCountry.topCategory)}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
