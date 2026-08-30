import React from 'react';
import { MethodPerformanceMetric } from '../../types/paymentAnalytics';
import { CreditCard, Landmark, Wallet, Bitcoin, Smartphone, Link, ChevronRight } from 'lucide-react';

interface PaymentMethodsMatrixProps {
    methods: MethodPerformanceMetric[];
    loading: boolean;
}

export const PaymentMethodsMatrix: React.FC<PaymentMethodsMatrixProps> = ({ methods, loading }) => {
    if (loading) {
        return <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"></div>;
    }

    const getMethodDetails = (method: string) => {
        switch (method) {
            case 'CREDIT_CARD': return { icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-500/20' };
            case 'DEBIT_CARD': return { icon: CreditCard, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-500/20' };
            case 'BANK_TRANSFER': return { icon: Landmark, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-500/20' };
            case 'CRYPTO': return { icon: Bitcoin, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-500/20' };
            case 'DIGITAL_WALLET': return { icon: Wallet, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-500/20' };
            case 'BNPL': return { icon: Smartphone, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-500/20' };
            default: return { icon: Link, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-500/20' };
        }
    };

    const sortedMethods = [...methods].sort((a, b) => b.revenue - a.revenue);
    const maxRevenue = Math.max(...sortedMethods.map(m => m.revenue), 1);

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden h-full">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Method Dominance</h3>
            </div>
            <div className="p-5 flex flex-col gap-5">
                {sortedMethods.map(m => {
                    const detail = getMethodDetails(m.method);
                    const Icon = detail.icon;
                    const pct = (m.revenue / maxRevenue) * 100;

                    return (
                        <div key={m.method} className="group cursor-pointer">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${detail.bg} group-hover:scale-110 transition-transform`}>
                                        <Icon className={`w-4 h-4 ${detail.color}`} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{m.method.replace('_', ' ')}</h4>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">${m.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.volume} txns • {m.successRate.toFixed(1)}% SR</p>
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full ${detail.bg.split(' ')[0].replace('100', '500')} ${detail.bg.split(' ')[1]?.replace('20', '500')}`}
                                    style={{ width: `${pct}%`, transition: 'width 1s ease-out' }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
