import React, { useState, useEffect } from 'react';
import { PaymentAnalyticsService } from '../services/PaymentAnalyticsService';
import { AnalyticsFilter, ComprehensiveAnalyticsPayload } from '../types/paymentAnalytics';
import { AnalyticsCharts } from '../components/analytics/AnalyticsCharts';
import { PaymentMethodsMatrix } from '../components/analytics/PaymentMethodsMatrix';
import {
    BarChart4, ArrowUpRight, ArrowDownRight, DollarSign, Activity, Settings2, Sliders, Calendar, Download, Zap, Users
} from 'lucide-react';

export default function PaymentAnalyticsDashboard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ComprehensiveAnalyticsPayload | null>(null);
    const [filters, setFilters] = useState<AnalyticsFilter>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const payload = await PaymentAnalyticsService.fetchAnalytics(filters);
            setData(payload);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters]);

    const StatCard = ({ title, value, prefix = "", suffix = "", subtext, icon: Icon, colorClass, isCurrency = false }: any) => (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]}`}>
                    <Icon className={`w-6 h-6 ${colorClass.split(' text-')[1] ? 'text-' + colorClass.split(' text-')[1] : colorClass.split(' ')[0].replace('bg-', 'text-').replace('100', '600')}`} />
                </div>
            </div>
            <div>
                <h4 className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">{title}</h4>
                <div className="flex items-baseline gap-1">
                    <span className="text-gray-900 dark:text-white text-3xl font-extrabold tracking-tight">
                        {prefix}{isCurrency ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}{suffix}
                    </span>
                </div>
                {(subtext) && <p className="text-emerald-500 text-xs font-medium mt-2 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {subtext}</p>}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 xl:p-10 text-gray-900 dark:text-gray-100 font-sans">
            <div className="max-w-[1600px] mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                                <BarChart4 className="w-8 h-8" />
                            </div>
                            <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400">
                                Data & Analytics
                            </h1>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-2xl font-medium mt-2">
                            Advanced visualization and real-time computation of payment vectors, processing latency, and authorization rates.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            Last 90 Days
                        </button>
                        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 active:scale-95">
                            <Download className="w-4 h-4" />
                            Export PDF
                        </button>
                    </div>
                </div>

                {/* Global Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Net Processing Volume"
                        value={data?.metrics.totalNetRevenue || 0}
                        prefix="$"
                        isCurrency={true}
                        icon={DollarSign}
                        colorClass="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600"
                        subtext="+14.2% vs prior period"
                    />
                    <StatCard
                        title="Global Auth Rate"
                        value={data?.metrics.approvalRate ? data.metrics.approvalRate.toFixed(1) : 0}
                        suffix="%"
                        icon={Zap}
                        colorClass="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600"
                        subtext="Optimized routing active"
                    />
                    <StatCard
                        title="Processing Fees"
                        value={data?.metrics.totalFees || 0}
                        prefix="$"
                        isCurrency={true}
                        icon={Activity}
                        colorClass="bg-orange-100 dark:bg-orange-500/20 text-orange-600"
                    />
                    <StatCard
                        title="Dispute Count"
                        value={data?.metrics.disputeCount || 0}
                        icon={Users}
                        colorClass="bg-red-100 dark:bg-red-500/20 text-red-600"
                        subtext="Below 0.05% threshold limit"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 z-10 relative">

                    <div className="lg:col-span-2 flex flex-col gap-8">
                        <AnalyticsCharts timeSeries={data?.timeSeries || []} loading={loading} />
                    </div>

                    <div className="lg:col-span-1">
                        <PaymentMethodsMatrix methods={data?.methodPerformance || []} loading={loading} />
                    </div>
                </div>

                {/* Recent Transactions Interactive Table Outline (Completing the lines) */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6">Critical Anomalies Log</h3>
                    {loading ? (
                        <div className="animate-pulse flex flex-col gap-3">
                            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>)}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-800">
                                    <tr>
                                        <th className="pb-3 pl-4">ID / Time</th>
                                        <th className="pb-3">Method</th>
                                        <th className="pb-3">Customer Code</th>
                                        <th className="pb-3 text-right pr-4">Net Result</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                                    {data?.recentTransactions.slice(0, 8).map(txn => (
                                        <tr key={txn.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                            <td className="py-4 pl-4">
                                                <span className="block font-mono font-medium text-gray-900 dark:text-gray-200">{txn.id.substring(0, 18)}</span>
                                                <span className="block text-gray-400 text-xs mt-1">{new Date(txn.timestamp).toLocaleString()}</span>
                                            </td>
                                            <td>
                                                <span className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                                                    {txn.method}
                                                </span>
                                            </td>
                                            <td className="text-gray-600 dark:text-gray-400">{txn.customerName}</td>
                                            <td className="text-right pr-4 font-bold text-gray-900 dark:text-white">
                                                ${txn.netAmount.toFixed(2)}
                                                {txn.status === 'FAILED' && <span className="block text-red-500 text-xs font-normal">Declined</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
