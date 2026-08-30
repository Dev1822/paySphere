import React, { useState, useEffect } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import { RiskDistribution, TrendDataPoint } from '../../types/fraudRisk';
import { BarChart3, TrendingUp, Activity, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const RiskScoreDistribution: React.FC = () => {
    const [data, setData] = useState<RiskDistribution | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'distribution' | 'trend'>('distribution');

    useEffect(() => {
        FraudRiskService.getRiskDistribution().then(d => {
            setData(d);
            setLoading(false);
        });
    }, []);

    if (loading || !data) {
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 animate-pulse">
                <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-48 mb-6" />
                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            </div>
        );
    }

    const maxCount = Math.max(...data.buckets.map(b => b.count));

    const trendLast7 = data.trendData.slice(-7);
    const trendPrev7 = data.trendData.slice(-14, -7);
    const avgLast7 = trendLast7.reduce((s, t) => s + t.avgScore, 0) / 7;
    const avgPrev7 = trendPrev7.reduce((s, t) => s + t.avgScore, 0) / 7;
    const trendDirection = avgLast7 > avgPrev7 ? 'up' : 'down';
    const trendDelta = Math.abs(avgLast7 - avgPrev7).toFixed(1);

    const maxTrendAlerts = Math.max(...data.trendData.map(t => t.alertCount));

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-violet-100 dark:bg-violet-500/20 p-2.5 rounded-xl">
                            <BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Risk Score Analytics</h3>
                            <p className="text-xs text-gray-500">{data.totalTransactions.toLocaleString()} transactions analyzed</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5">
                        <button
                            onClick={() => setActiveView('distribution')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                activeView === 'distribution' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            Distribution
                        </button>
                        <button
                            onClick={() => setActiveView('trend')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                activeView === 'trend' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            30-Day Trend
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-750">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg Score</div>
                        <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{data.avgScore}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-750">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Median</div>
                        <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{data.medianScore}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-750">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">P95 Score</div>
                        <div className="text-xl font-extrabold text-rose-500 mt-0.5">{data.p95Score}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-750">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">7d Trend</div>
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xl font-extrabold text-gray-900 dark:text-white">{data.avgScore}</span>
                            {trendDirection === 'up' ? (
                                <ArrowUpRight className="w-5 h-5 text-rose-500" />
                            ) : (
                                <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                            )}
                        </div>
                        <div className={`text-xs font-bold ${trendDirection === 'up' ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {trendDirection === 'up' ? '+' : '-'}{trendDelta} vs prior week
                        </div>
                    </div>
                </div>

                {/* Distribution View */}
                {activeView === 'distribution' && (
                    <div className="space-y-3">
                        {data.buckets.map(bucket => (
                            <div key={bucket.range} className="flex items-center gap-4 group">
                                <span className="w-16 text-xs font-mono text-gray-500 text-right shrink-0">{bucket.range}</span>
                                <div className="flex-1 h-8 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden relative">
                                    <div
                                        className="h-full rounded-lg transition-all duration-500 group-hover:opacity-90 flex items-center"
                                        style={{
                                            width: `${maxCount > 0 ? (bucket.count / maxCount) * 100 : 0}%`,
                                            backgroundColor: bucket.color,
                                            minWidth: bucket.count > 0 ? '2px' : '0px',
                                        }}
                                    />
                                    {bucket.count > 0 && (
                                        <div className="absolute inset-0 flex items-center px-3">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 drop-shadow-sm">
                                                {bucket.count.toLocaleString()} <span className="font-normal text-gray-500 dark:text-gray-400">({bucket.percentage}%)</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="w-8 text-right shrink-0">
                                    <span className="text-[10px] font-bold" style={{ color: bucket.color }}>{bucket.percentage}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Trend View */}
                {activeView === 'trend' && (
                    <div>
                        {/* SVG Trend Chart */}
                        <div className="relative h-48 mb-4">
                            <svg className="w-full h-full" viewBox="0 0 800 180" preserveAspectRatio="none">
                                {/* Grid Lines */}
                                {[0, 25, 50, 75, 100].map(val => (
                                    <g key={val}>
                                        <line x1="0" y1={180 - (val / 100 * 160) - 10} x2="800" y2={180 - (val / 100 * 160) - 10}
                                            stroke="currentColor" strokeWidth="0.5" className="text-gray-100 dark:text-gray-800" />
                                        <text x="-5" y={180 - (val / 100 * 160) - 10 + 4} textAnchor="end"
                                            className="text-[9px] fill-gray-300 dark:fill-gray-600 font-mono">{val}</text>
                                    </g>
                                ))}

                                {/* Alert Count Bars */}
                                {data.trendData.map((point, i) => {
                                    const barWidth = 800 / data.trendData.length;
                                    const barHeight = (point.alertCount / maxTrendAlerts) * 140;
                                    return (
                                        <rect
                                            key={`bar-${i}`}
                                            x={i * barWidth + barWidth * 0.15}
                                            y={180 - barHeight - 10}
                                            width={barWidth * 0.7}
                                            height={barHeight}
                                            rx="2"
                                            className="fill-indigo-100 dark:fill-indigo-500/10"
                                        />
                                    );
                                })}

                                {/* Score Line */}
                                <polyline
                                    points={data.trendData.map((point, i) => {
                                        const x = (i / (data.trendData.length - 1)) * 800;
                                        const y = 180 - (point.avgScore / 100 * 160) - 10;
                                        return `${x},${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="#8B5CF6"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {/* Score Dots */}
                                {data.trendData.map((point, i) => {
                                    const x = (i / (data.trendData.length - 1)) * 800;
                                    const y = 180 - (point.avgScore / 100 * 160) - 10;
                                    return (
                                        <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill="#8B5CF6" stroke="white" strokeWidth="1.5" className="dark:stroke-gray-900" />
                                    );
                                })}

                                {/* Blocked Line */}
                                <polyline
                                    points={data.trendData.map((point, i) => {
                                        const x = (i / (data.trendData.length - 1)) * 800;
                                        const y = 180 - (point.blockedCount / maxTrendAlerts * 140) - 10;
                                        return `${x},${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="#EF4444"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                    strokeLinecap="round"
                                />

                                {/* X-axis labels */}
                                {data.trendData.filter((_, i) => i % 5 === 0 || i === data.trendData.length - 1).map((point, i) => {
                                    const idx = data.trendData.indexOf(point);
                                    const x = (idx / (data.trendData.length - 1)) * 800;
                                    return (
                                        <text key={`xlabel-${i}`} x={x} y="178" textAnchor="middle"
                                            className="text-[8px] fill-gray-300 dark:fill-gray-600 font-mono">
                                            {point.date.substring(5)}
                                        </text>
                                    );
                                })}
                            </svg>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-violet-500 rounded-full" />
                                <span className="text-gray-500">Avg Risk Score</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-0.5 bg-rose-500 rounded-full" style={{ borderTop: '2px dashed #EF4444', height: 0 }} />
                                <span className="text-gray-500">Blocked Txns</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-3 bg-indigo-100 dark:bg-indigo-500/10 rounded" />
                                <span className="text-gray-500">Alert Volume</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
