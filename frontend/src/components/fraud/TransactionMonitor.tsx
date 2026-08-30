import React, { useState, useEffect, useCallback } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import {
    Transaction,
    TransactionFilters,
    TransactionSortField,
    SortDirection,
    TransactionStatus,
    PaymentMethod,
} from '../../types/fraudRisk';
import {
    Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
    CreditCard, Building2, Wallet, Coins, Globe, AlertTriangle, CheckCircle2,
    XCircle, Clock, Ban, RotateCcw, Eye, MoreHorizontal, Download, RefreshCw,
    Activity,
} from 'lucide-react';

interface TransactionMonitorProps {
    onTransactionSelect?: (txn: Transaction) => void;
}

export const TransactionMonitor: React.FC<TransactionMonitorProps> = ({ onTransactionSelect }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<TransactionSortField>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');
    const [showFilters, setShowFilters] = useState(false);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const [filters, setFilters] = useState<TransactionFilters>({
        search: '',
        status: 'ALL',
        paymentMethod: 'ALL',
        minAmount: null,
        maxAmount: null,
        riskThreshold: null,
        countryCode: '',
        dateFrom: null,
        dateTo: null,
    });

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        const result = await FraudRiskService.getTransactions(filters, sortField, sortDir, page, 20);
        setTransactions(result.transactions);
        setTotal(result.total);
        setPages(result.pages);
        setLoading(false);
    }, [filters, sortField, sortDir, page]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const handleSort = (field: TransactionSortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
        setPage(1);
    };

    const updateFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({
            search: '', status: 'ALL', paymentMethod: 'ALL', minAmount: null, maxAmount: null,
            riskThreshold: null, countryCode: '', dateFrom: null, dateTo: null,
        });
        setPage(1);
    };

    const activeFilterCount = [
        filters.status !== 'ALL',
        filters.paymentMethod !== 'ALL',
        filters.minAmount !== null,
        filters.maxAmount !== null,
        filters.riskThreshold !== null,
        filters.countryCode !== '',
        filters.dateFrom !== null,
        filters.dateTo !== null,
    ].filter(Boolean).length;

    const getStatusIcon = (status: TransactionStatus) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
            case 'PENDING': return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
            case 'FLAGGED': return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
            case 'BLOCKED': return <Ban className="w-3.5 h-3.5 text-rose-500" />;
            case 'DECLINED': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
            case 'REVERSED': return <RotateCcw className="w-3.5 h-3.5 text-purple-500" />;
        }
    };

    const getStatusBadge = (status: TransactionStatus) => {
        const map: Record<TransactionStatus, string> = {
            COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
            PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20',
            FLAGGED: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
            BLOCKED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
            DECLINED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-red-200 dark:border-red-500/20',
            REVERSED: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
        };
        return map[status] || map.COMPLETED;
    };

    const getPaymentIcon = (method: PaymentMethod) => {
        switch (method) {
            case 'CARD': return <CreditCard className="w-4 h-4 text-gray-400" />;
            case 'BANK_TRANSFER': return <Building2 className="w-4 h-4 text-gray-400" />;
            case 'WALLET': return <Wallet className="w-4 h-4 text-gray-400" />;
            case 'CRYPTO': return <Coins className="w-4 h-4 text-gray-400" />;
            default: return <CreditCard className="w-4 h-4 text-gray-400" />;
        }
    };

    const getRiskColor = (score: number) => {
        if (score >= 85) return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10';
        if (score >= 60) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10';
        if (score >= 40) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10';
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10';
    };

    const getRiskBarWidth = (score: number) => `${Math.min(100, score)}%`;

    const getRiskBarColor = (score: number) => {
        if (score >= 85) return 'bg-rose-500';
        if (score >= 60) return 'bg-orange-500';
        if (score >= 40) return 'bg-yellow-400';
        return 'bg-emerald-500';
    };

    const SortIcon: React.FC<{ field: TransactionSortField }> = ({ field }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300 dark:text-gray-600" />;
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />;
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl">
                            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Transaction Monitor</h3>
                            <p className="text-xs text-gray-500">{total.toLocaleString()} transactions tracked</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchTransactions()}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm font-medium px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Download className="w-4 h-4" /> Export
                        </button>
                    </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex flex-col md:flex-row gap-3 mt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => updateFilter('search', e.target.value)}
                            placeholder="Search by ID, customer, merchant, email..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white placeholder-gray-400"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                            showFilters || activeFilterCount > 0
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-750 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => updateFilter('status', e.target.value as TransactionFilters['status'])}
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="FLAGGED">Flagged</option>
                                    <option value="BLOCKED">Blocked</option>
                                    <option value="DECLINED">Declined</option>
                                    <option value="REVERSED">Reversed</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment Method</label>
                                <select
                                    value={filters.paymentMethod}
                                    onChange={(e) => updateFilter('paymentMethod', e.target.value as TransactionFilters['paymentMethod'])}
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                >
                                    <option value="ALL">All Methods</option>
                                    <option value="CARD">Card</option>
                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                    <option value="WALLET">Wallet</option>
                                    <option value="CRYPTO">Crypto</option>
                                    <option value="ACH">ACH</option>
                                    <option value="SWIFT">SWIFT</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Min Amount ($)</label>
                                <input
                                    type="number"
                                    value={filters.minAmount ?? ''}
                                    onChange={(e) => updateFilter('minAmount', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="0"
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Max Amount ($)</label>
                                <input
                                    type="number"
                                    value={filters.maxAmount ?? ''}
                                    onChange={(e) => updateFilter('maxAmount', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="∞"
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Min Risk Score</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={filters.riskThreshold ?? ''}
                                    onChange={(e) => updateFilter('riskThreshold', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="0"
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Country</label>
                                <input
                                    type="text"
                                    value={filters.countryCode}
                                    onChange={(e) => updateFilter('countryCode', e.target.value.toUpperCase())}
                                    placeholder="e.g. US"
                                    maxLength={2}
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono uppercase"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Date From</label>
                                <input
                                    type="date"
                                    value={filters.dateFrom ?? ''}
                                    onChange={(e) => updateFilter('dateFrom', e.target.value || null)}
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Date To</label>
                                <input
                                    type="date"
                                    value={filters.dateTo ?? ''}
                                    onChange={(e) => updateFilter('dateTo', e.target.value || null)}
                                    className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-3">
                            <button
                                onClick={clearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                            >
                                Clear all filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                            <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Transaction
                            </th>
                            <th
                                onClick={() => handleSort('timestamp')}
                                className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                            >
                                <span className="flex items-center gap-1">Time <SortIcon field="timestamp" /></span>
                            </th>
                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Customer
                            </th>
                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Merchant
                            </th>
                            <th
                                onClick={() => handleSort('amount')}
                                className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                            >
                                <span className="flex items-center justify-end gap-1">Amount <SortIcon field="amount" /></span>
                            </th>
                            <th
                                onClick={() => handleSort('riskScore')}
                                className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                            >
                                <span className="flex items-center gap-1">Risk <SortIcon field="riskScore" /></span>
                            </th>
                            <th
                                onClick={() => handleSort('status')}
                                className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                            >
                                <span className="flex items-center justify-center gap-1">Status <SortIcon field="status" /></span>
                            </th>
                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {loading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <td key={j} className="px-6 py-4">
                                            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : transactions.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                            <Search className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-gray-100">No transactions found</p>
                                            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms</p>
                                        </div>
                                        <button
                                            onClick={clearFilters}
                                            className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                                        >
                                            Clear all filters
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            transactions.map(txn => (
                                <React.Fragment key={txn.id}>
                                    <tr
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group"
                                        onClick={() => setExpandedRow(expandedRow === txn.id ? null : txn.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {getPaymentIcon(txn.paymentMethod)}
                                                <div>
                                                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                                                        {txn.id.substring(0, 16)}
                                                    </span>
                                                    {txn.cardLast4 && (
                                                        <span className="text-xs text-gray-400 ml-2">••••{txn.cardLast4}</span>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Globe className="w-3 h-3 text-gray-300" />
                                                        <span className="text-[11px] text-gray-400 font-medium">{txn.countryCode}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(txn.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <br />
                                            <span className="text-xs text-gray-400">
                                                {new Date(txn.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]">
                                                {txn.customerName}
                                            </div>
                                            <div className="text-xs text-gray-400 truncate max-w-[160px]">
                                                {txn.customerEmail}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[140px]">
                                                {txn.merchantName}
                                            </div>
                                            <div className="text-[11px] text-gray-400">{txn.merchantCategory}</div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                ${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${getRiskBarColor(txn.riskScore)}`}
                                                        style={{ width: getRiskBarWidth(txn.riskScore) }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getRiskColor(txn.riskScore)}`}>
                                                    {txn.riskScore.toFixed(0)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadge(txn.status)}`}>
                                                {getStatusIcon(txn.status)}
                                                {txn.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onTransactionSelect?.(txn); }}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded Detail Row */}
                                    {expandedRow === txn.id && (
                                        <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                                            <td colSpan={8} className="px-6 py-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm animate-in slide-in-from-top-1 duration-150">
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">IP Address</span>
                                                        <p className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">{txn.ipAddress}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Device ID</span>
                                                        <p className="font-mono text-gray-700 dark:text-gray-300 mt-0.5 truncate">{txn.deviceId}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Payment Method</span>
                                                        <p className="text-gray-700 dark:text-gray-300 mt-0.5">{txn.paymentMethod} {txn.cardLast4 ? `(${txn.cardLast4})` : ''}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Auth Code</span>
                                                        <p className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">{txn.authCode || '—'}</p>
                                                    </div>
                                                    {txn.riskFlags.length > 0 && (
                                                        <div className="col-span-2 md:col-span-4">
                                                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Risk Flags</span>
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                {txn.riskFlags.map(flag => (
                                                                    <span
                                                                        key={flag}
                                                                        className="px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded border border-rose-200 dark:border-rose-500/20"
                                                                    >
                                                                        {flag.replace(/_/g, ' ')}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                    <span className="text-sm text-gray-500">
                        Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                            const startPage = Math.max(1, Math.min(page - 2, pages - 4));
                            const pageNum = startPage + i;
                            if (pageNum > pages) return null;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                        pageNum === page
                                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(pages, p + 1))}
                            disabled={page === pages}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
