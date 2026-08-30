import React from 'react';
import { TimeSeriesDataPoint } from '../../types/paymentAnalytics';
import { LineChart, LayoutTemplate, Activity, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';

interface AnalyticsChartsProps {
    timeSeries: TimeSeriesDataPoint[];
    loading: boolean;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ timeSeries, loading }) => {
    if (loading) {
        return (
            <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center border border-gray-200 dark:border-gray-700">
                <Activity className="w-10 h-10 text-gray-300 dark:text-gray-600 animate-spin" />
            </div>
        );
    }

    if (timeSeries.length === 0) {
        return (
            <div className="h-96 bg-white dark:bg-gray-900 rounded-2xl flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800 shadow-sm">
                <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
                <h4 className="text-gray-600 dark:text-gray-300 font-medium">No Data Available</h4>
                <p className="text-gray-400 text-sm mt-1">Adjust filters to view analytics</p>
            </div>
        );
    }

    // Simplified custom chart rendering for rich UI without raw recharts dependency
    // Renders a high contrast CSS-based bar/line overlay visualization

    const maxRevenue = Math.max(...timeSeries.map(d => d.grossRevenue), 1);
    const maxVolume = Math.max(...timeSeries.map(d => d.volume), 1);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col h-[480px]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                        <LineChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">Revenue & Volume Overlay</h3>
                        <p className="text-xs text-gray-500">Daily performance metrics across selected range</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <span className="flex items-center text-xs text-gray-500 font-medium"><div className="w-3 h-3 bg-indigo-500 rounded mr-2" /> Gross Revenue</span>
                    <span className="flex items-center text-xs text-gray-500 font-medium"><div className="w-3 h-3 bg-emerald-400 rounded mr-2" /> Volume</span>
                </div>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-end pt-12 relative">
                {/* Y Axis Guides */}
                <div className="absolute inset-x-6 top-6 bottom-12 flex flex-col justify-between pointer-events-none">
                    {[1, 0.75, 0.5, 0.25, 0].map((step, i) => (
                        <div key={i} className="flex items-end w-full border-b border-gray-100 dark:border-gray-800/60 pb-1 h-0">
                            <span className="text-[10px] text-gray-400 -translate-y-2 absolute left-0 bg-white dark:bg-gray-900 pr-2 z-10">
                                ${((maxRevenue * step) / 1000).toFixed(1)}k
                            </span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-end h-full gap-1 z-10 mx-10 mt-4">
                    {timeSeries.slice(-30).map((pt, i) => {
                        const revHeight = (pt.grossRevenue / maxRevenue) * 100;
                        const volHeight = (pt.volume / maxVolume) * 100;
                        return (
                            <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                                {/* Hover Tooltip */}
                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs p-2 rounded shadow-xl z-50 pointer-events-none w-max max-w-[150px]">
                                    <div className="font-bold mb-1 border-b border-gray-700 pb-1">{pt.timeIndex}</div>
                                    <div className="text-emerald-400">Rev: ${(pt.grossRevenue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                    <div className="text-indigo-300">Vol: {pt.volume} txns</div>
                                </div>

                                {/* Volume Bar Overlay (Background) */}
                                <div
                                    className="w-full bg-emerald-100 dark:bg-emerald-500/20 rounded-t-sm absolute bottom-0 transition-all duration-500"
                                    style={{ height: `${Math.max(volHeight, 1)}%` }}
                                />

                                {/* Revenue Bar Overlay (Foreground) */}
                                <div
                                    className="w-full max-w-[12px] bg-indigo-500 rounded-t-sm absolute bottom-0 transition-all duration-500 group-hover:bg-indigo-400"
                                    style={{ height: `${Math.max(revHeight, 1)}%` }}
                                />
                            </div>
                        )
                    })}
                </div>
                <div className="flex justify-between mt-4 text-[10px] text-gray-400 uppercase font-bold tracking-wider mx-10">
                    <span>{timeSeries.length > 0 && timeSeries.slice(-30)[0].timeIndex}</span>
                    <span>{timeSeries.length > 0 && timeSeries.slice(-1)[0].timeIndex}</span>
                </div>
            </div>
        </div>
    );
};
