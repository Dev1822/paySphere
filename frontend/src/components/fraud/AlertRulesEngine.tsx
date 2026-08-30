import React, { useState, useEffect } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import { FraudRule, RuleAction, RuleMetric, AlertCategory } from '../../types/fraudRisk';
import {
    Zap, Plus, Trash2, Power, PowerOff, ChevronDown, ChevronUp, Clock,
    ShieldAlert, Target, Bell, Ban, Lock, Eye, AlertTriangle, Activity,
    TrendingUp, Settings, X, Check, GripVertical,
} from 'lucide-react';

export const AlertRulesEngine: React.FC = () => {
    const [rules, setRules] = useState<FraudRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRule, setExpandedRule] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [filterCategory, setFilterCategory] = useState<AlertCategory | 'ALL'>('ALL');
    const [filterEnabled, setFilterEnabled] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        setLoading(true);
        const data = await FraudRiskService.getRules();
        setRules(data);
        setLoading(false);
    };

    const handleToggle = async (ruleId: string, enabled: boolean) => {
        await FraudRiskService.toggleRule(ruleId, enabled);
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled, updatedAt: new Date().toISOString() } : r));
    };

    const handleDelete = async (ruleId: string) => {
        await FraudRiskService.deleteRule(ruleId);
        setRules(prev => prev.filter(r => r.id !== ruleId));
    };

    const filteredRules = rules.filter(r => {
        if (filterCategory !== 'ALL' && r.category !== filterCategory) return false;
        if (filterEnabled === 'ENABLED' && !r.enabled) return false;
        if (filterEnabled === 'DISABLED' && r.enabled) return false;
        return true;
    });

    const enabledCount = rules.filter(r => r.enabled).length;
    const totalTriggers = rules.reduce((sum, r) => sum + r.triggeredCount, 0);

    const getActionIcon = (action: RuleAction) => {
        switch (action) {
            case 'BLOCK': return <Ban className="w-3.5 h-3.5" />;
            case 'FLAG': return <AlertTriangle className="w-3.5 h-3.5" />;
            case 'NOTIFY': return <Bell className="w-3.5 h-3.5" />;
            case 'CHALLENGE': return <ShieldAlert className="w-3.5 h-3.5" />;
            case 'FREEZE_ACCOUNT': return <Lock className="w-3.5 h-3.5" />;
            case 'LOG_ONLY': return <Eye className="w-3.5 h-3.5" />;
        }
    };

    const getActionColor = (action: RuleAction) => {
        switch (action) {
            case 'BLOCK': return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/20';
            case 'FLAG': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-orange-200 dark:border-orange-500/20';
            case 'NOTIFY': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
            case 'CHALLENGE': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
            case 'FREEZE_ACCOUNT': return 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
            case 'LOG_ONLY': return 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400 border-gray-200 dark:border-gray-500/20';
        }
    };

    const formatMetric = (metric: RuleMetric) => {
        return metric.replace(/_/g, ' ');
    };

    const formatOperator = (op: string) => {
        const map: Record<string, string> = {
            GREATER_THAN: '>',
            LESS_THAN: '<',
            EQUALS: '=',
            CONTAINS: 'contains',
            IN_LIST: 'in list',
            BETWEEN: 'between',
        };
        return map[op] || op;
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 dark:bg-amber-500/20 p-2.5 rounded-xl">
                            <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Alert Rules Engine</h3>
                            <p className="text-xs text-gray-500">{enabledCount} active rules • {totalTriggers.toLocaleString()} total triggers</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-xl font-semibold shadow-md hover:opacity-90 transition-opacity text-sm"
                    >
                        <Plus className="w-4 h-4" /> Create Rule
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-750">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Rules</div>
                        <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{enabledCount}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-750">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Disabled</div>
                        <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{rules.length - enabledCount}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-750">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Triggers</div>
                        <div className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{totalTriggers.toLocaleString()}</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-3 mt-4">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value as AlertCategory | 'ALL')}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    >
                        <option value="ALL">All Categories</option>
                        <option value="VELOCITY">Velocity</option>
                        <option value="LOCATION_ANOMALY">Location Anomaly</option>
                        <option value="DEVICE_SPOOFING">Device Spoofing</option>
                        <option value="IP_MISMATCH">IP Mismatch</option>
                        <option value="HIGH_VALUE_TXN">High Value Txn</option>
                        <option value="BLACKLISTED_BIN">Blacklisted BIN</option>
                        <option value="MULTIPLE_FAILURES">Multiple Failures</option>
                    </select>
                    <select
                        value={filterEnabled}
                        onChange={(e) => setFilterEnabled(e.target.value as typeof filterEnabled)}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ENABLED">Enabled Only</option>
                        <option value="DISABLED">Disabled Only</option>
                    </select>
                </div>
            </div>

            {/* Rules List */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] overflow-y-auto custom-scrollbar">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-48 animate-pulse" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-72 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : filteredRules.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                <Zap className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                            </div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">No rules found</p>
                            <p className="text-sm text-gray-500">Adjust filters or create a new rule</p>
                        </div>
                    </div>
                ) : (
                    filteredRules.map(rule => (
                        <div key={rule.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <div className="flex items-start gap-4">
                                {/* Priority Badge */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                                    rule.enabled
                                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                                }`}>
                                    #{rule.priority}
                                </div>

                                {/* Rule Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{rule.name}</h4>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                                            rule.enabled
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 border-gray-200 dark:border-gray-700'
                                        }`}>
                                            {rule.enabled ? 'Active' : 'Disabled'}
                                        </span>
                                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full">
                                            {rule.category.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2">{rule.description}</p>

                                    {/* Conditions Preview */}
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {rule.conditions.map((cond, idx) => (
                                            <span key={cond.id} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded font-mono">
                                                {idx > 0 && <span className="text-gray-400 font-bold mr-1">{cond.connector}</span>}
                                                {formatMetric(cond.metric)} {formatOperator(cond.operator)} {cond.value}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {rule.actions.map(action => (
                                            <span
                                                key={action}
                                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${getActionColor(action)}`}
                                            >
                                                {getActionIcon(action)}
                                                {action.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" /> {rule.triggeredCount.toLocaleString()} triggers
                                        </span>
                                        {rule.lastTriggeredAt && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> Last: {new Date(rule.lastTriggeredAt).toLocaleDateString()}
                                            </span>
                                        )}
                                        <span>by {rule.createdBy.split('@')[0]}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleToggle(rule.id, !rule.enabled)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            rule.enabled
                                                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                    >
                                        {rule.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        {expandedRule === rule.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rule.id)}
                                        className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete rule"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedRule === rule.id && (
                                <div className="mt-4 ml-14 p-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-750 animate-in slide-in-from-top-1 duration-150">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Conditions Detail</h5>
                                            <div className="space-y-2">
                                                {rule.conditions.map(cond => (
                                                    <div key={cond.id} className="flex items-center gap-2 text-sm">
                                                        <span className="font-mono text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                                            {formatMetric(cond.metric)} {formatOperator(cond.operator)} {cond.value}
                                                            {cond.valueSecondary ? ` AND ${cond.valueSecondary}` : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Actions Detail</h5>
                                            <div className="space-y-2">
                                                {rule.actions.map(action => (
                                                    <div key={action} className="flex items-center gap-2 text-sm">
                                                        {getActionIcon(action)}
                                                        <span className="text-gray-700 dark:text-gray-300">{action.replace(/_/g, ' ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-400">
                                        <span>Created: {new Date(rule.createdAt).toLocaleDateString()}</span>
                                        <span>Updated: {new Date(rule.updatedAt).toLocaleDateString()}</span>
                                        <span>Rule ID: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{rule.id}</code></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create Rule Modal */}
            {showCreateForm && <CreateRuleModal onClose={() => setShowCreateForm(false)} onCreated={(rule) => { setRules(prev => [rule, ...prev]); setShowCreateForm(false); }} />}
        </div>
    );
};

// ─── Create Rule Modal ────────────────────────────────────────────────────

interface CreateRuleModalProps {
    onClose: () => void;
    onCreated: (rule: FraudRule) => void;
}

const CreateRuleModal: React.FC<CreateRuleModalProps> = ({ onClose, onCreated }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<AlertCategory>('VELOCITY');
    const [priority, setPriority] = useState(5);
    const [metric, setMetric] = useState<RuleMetric>('RISK_SCORE');
    const [operator, setOperator] = useState<'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'BETWEEN'>('GREATER_THAN');
    const [value, setValue] = useState('');
    const [valueSecondary, setValueSecondary] = useState('');
    const [actions, setActions] = useState<RuleAction[]>(['FLAG']);
    const [loading, setLoading] = useState(false);

    const toggleAction = (action: RuleAction) => {
        setActions(prev => prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !value || actions.length === 0) return;
        setLoading(true);

        const rule = await FraudRiskService.createRule({
            name,
            description,
            enabled: true,
            priority,
            category,
            conditions: [{
                id: `c_new_${Date.now()}`,
                metric,
                operator,
                value,
                valueSecondary: valueSecondary || undefined,
                connector: 'AND',
            }],
            actions,
            createdBy: 'current_user',
        });

        setLoading(false);
        onCreated(rule);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-950 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500 text-white p-2 rounded-xl shadow-lg shadow-amber-500/20">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Fraud Rule</h2>
                            <p className="text-xs text-gray-500">Define conditions and automated actions</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Rule Name</label>
                            <input
                                required
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. High Value Block"
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as AlertCategory)}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            >
                                <option value="VELOCITY">Velocity</option>
                                <option value="LOCATION_ANOMALY">Location Anomaly</option>
                                <option value="DEVICE_SPOOFING">Device Spoofing</option>
                                <option value="IP_MISMATCH">IP Mismatch</option>
                                <option value="HIGH_VALUE_TXN">High Value Txn</option>
                                <option value="BLACKLISTED_BIN">Blacklisted BIN</option>
                                <option value="MULTIPLE_FAILURES">Multiple Failures</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What does this rule detect?"
                            rows={2}
                            className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Metric</label>
                            <select
                                value={metric}
                                onChange={(e) => setMetric(e.target.value as RuleMetric)}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            >
                                <option value="RISK_SCORE">Risk Score</option>
                                <option value="TXN_AMOUNT">Txn Amount</option>
                                <option value="VELOCITY_1H">Velocity (1h)</option>
                                <option value="VELOCITY_24H">Velocity (24h)</option>
                                <option value="DISTANCE_MILES">Distance (mi)</option>
                                <option value="FAILED_ATTEMPTS">Failed Attempts</option>
                                <option value="NEW_DEVICE">New Device</option>
                                <option value="VPN_DETECTED">VPN Detected</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Operator</label>
                            <select
                                value={operator}
                                onChange={(e) => setOperator(e.target.value as typeof operator)}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            >
                                <option value="GREATER_THAN">Greater Than</option>
                                <option value="LESS_THAN">Less Than</option>
                                <option value="EQUALS">Equals</option>
                                <option value="BETWEEN">Between</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Value</label>
                            <input
                                required
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="e.g. 85"
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
                            />
                        </div>
                    </div>

                    {operator === 'BETWEEN' && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Max Value</label>
                            <input
                                type="text"
                                value={valueSecondary}
                                onChange={(e) => setValueSecondary(e.target.value)}
                                placeholder="e.g. 100"
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Priority (1=highest)</label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={priority}
                            onChange={(e) => setPriority(Number(e.target.value))}
                            className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white w-24"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Automated Actions</label>
                        <div className="flex flex-wrap gap-2">
                            {(['BLOCK', 'FLAG', 'NOTIFY', 'CHALLENGE', 'FREEZE_ACCOUNT', 'LOG_ONLY'] as RuleAction[]).map(action => (
                                <button
                                    key={action}
                                    type="button"
                                    onClick={() => toggleAction(action)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        actions.includes(action)
                                            ? getActionColorStatic(action)
                                            : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {getActionIconStatic(action)}
                                    {action.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !name || !value || actions.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 py-3 rounded-xl font-semibold shadow-md transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin rounded-full" />
                        ) : (
                            <>
                                <Check className="w-4 h-4" /> Create Rule
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

function getActionIconStatic(action: RuleAction) {
    const iconProps = "w-3.5 h-3.5";
    switch (action) {
        case 'BLOCK': return <Ban className={iconProps} />;
        case 'FLAG': return <AlertTriangle className={iconProps} />;
        case 'NOTIFY': return <Bell className={iconProps} />;
        case 'CHALLENGE': return <ShieldAlert className={iconProps} />;
        case 'FREEZE_ACCOUNT': return <Lock className={iconProps} />;
        case 'LOG_ONLY': return <Eye className={iconProps} />;
    }
}

function getActionColorStatic(action: RuleAction) {
    switch (action) {
        case 'BLOCK': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20';
        case 'FLAG': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20';
        case 'NOTIFY': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20';
        case 'CHALLENGE': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20';
        case 'FREEZE_ACCOUNT': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/20';
        case 'LOG_ONLY': return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-500/20';
    }
}
