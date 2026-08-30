import React, { useState, useEffect } from 'react';
import { Search, Filter, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { AuditLogCategory, AuditLogFilterOptions, AuditLogSeverity } from '../../types/auditLog';

interface AuditLogFilterProps {
    onFilterChange: (filters: AuditLogFilterOptions) => void;
    isLoading?: boolean;
}

export const AuditLogFilter: React.FC<AuditLogFilterProps> = ({ onFilterChange, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const [selectedSeverities, setSelectedSeverities] = useState<AuditLogSeverity[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<AuditLogCategory[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<('SUCCESS' | 'FAILURE' | 'PENDING')[]>([]);

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            triggerFilter();
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, selectedSeverities, selectedCategories, selectedStatuses]);

    const triggerFilter = () => {
        onFilterChange({
            searchTerm: searchTerm || undefined,
            severities: selectedSeverities.length > 0 ? selectedSeverities : undefined,
            categories: selectedCategories.length > 0 ? selectedCategories : undefined,
            status: selectedStatuses.length > 0 ? selectedStatuses : undefined
        });
    };

    const severityOptions: { label: string, value: AuditLogSeverity, color: string }[] = [
        { label: 'Critical', value: 'CRITICAL', color: 'text-red-500' },
        { label: 'Error', value: 'ERROR', color: 'text-orange-500' },
        { label: 'Warning', value: 'WARNING', color: 'text-yellow-500' },
        { label: 'Info', value: 'INFO', color: 'text-blue-500' },
    ];

    const categoryOptions: { label: string, value: AuditLogCategory }[] = [
        { label: 'Authentication', value: 'AUTHENTICATION' },
        { label: 'User Management', value: 'USER_MANAGEMENT' },
        { label: 'Payment', value: 'PAYMENT_PROCESSING' },
        { label: 'Security', value: 'SECURITY_SETTINGS' },
        { label: 'System', value: 'SYSTEM_CONFIG' },
        { label: 'API Access', value: 'API_ACCESS' }
    ];

    const toggleSeverity = (v: AuditLogSeverity) => {
        setSelectedSeverities(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
    };

    const toggleCategory = (c: AuditLogCategory) => {
        setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };

    const toggleStatus = (s: 'SUCCESS' | 'FAILURE' | 'PENDING') => {
        setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedSeverities([]);
        setSelectedCategories([]);
        setSelectedStatuses([]);
    };

    const numActiveFilters = selectedSeverities.length + selectedCategories.length + selectedStatuses.length;

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm mb-6 overflow-visible">
            {/* Primary Search Bar */}
            <div className="p-4 flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by action, user, email, or IP address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-gray-200"
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isExpanded || numActiveFilters > 0
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-750'
                        }`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters {numActiveFilters > 0 && <span className="bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full text-xs">{numActiveFilters}</span>}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Expanded Filters */}
            {isExpanded && (
                <div className="px-4 pb-5 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Severity Filter */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity Status</h4>
                            <div className="flex flex-col gap-2">
                                {severityOptions.map(opt => (
                                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center justify-center w-5 h-5">
                                            <input
                                                type="checkbox"
                                                checked={selectedSeverities.includes(opt.value)}
                                                onChange={() => toggleSeverity(opt.value)}
                                                className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded-md checked:bg-indigo-600 checked:border-indigo-600 dark:border-gray-600 cursor-pointer transition-all"
                                            />
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100" />
                                        </div>
                                        <span className={`text-sm select-none text-gray-700 dark:text-gray-300 ${opt.color}`}>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Category Filter */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Event Category</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {categoryOptions.map(opt => (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center justify-center w-4 h-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedCategories.includes(opt.value)}
                                                onChange={() => toggleCategory(opt.value)}
                                                className="peer appearance-none w-4 h-4 border-2 border-gray-300 rounded checked:bg-indigo-600 checked:border-indigo-600 dark:border-gray-600 cursor-pointer transition-all"
                                            />
                                            <CheckCircle2 className="w-3 h-3 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100" />
                                        </div>
                                        <span className="text-sm select-none text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Outcome</h4>
                            <div className="flex flex-wrap gap-2">
                                {['SUCCESS', 'FAILURE', 'PENDING'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => toggleStatus(status as any)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedStatuses.includes(status as any)
                                                ? 'bg-indigo-600 text-white shadow-md'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>

                    <div className="mt-6 flex justify-end items-center gap-4">
                        {numActiveFilters > 0 && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 flex items-center gap-1 transition-colors"
                            >
                                <X className="w-4 h-4" /> Clear all filters
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Extracted CheckCircle icon since it's used inside the filter
function CheckCircle2(props: any) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
