import React, { useState, useEffect } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import { FraudSettings } from '../../types/fraudRisk';
import {
    Settings, Save, Bell, Shield, Globe, Cpu, Brain, Clock, Mail,
    Webhook, AlertTriangle, CheckCircle2, Loader2, Sliders, ToggleLeft,
    ToggleRight, X, Plus,
} from 'lucide-react';

export const FraudSettingsPanel: React.FC = () => {
    const [settings, setSettings] = useState<FraudSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newCountry, setNewCountry] = useState('');

    useEffect(() => {
        FraudRiskService.getSettings().then(s => {
            setSettings(s);
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        await FraudRiskService.updateSettings(settings);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const update = <K extends keyof FraudSettings>(key: K, value: FraudSettings[K]) => {
        if (!settings) return;
        setSettings({ ...settings, [key]: value });
    };

    const toggleSetting = (key: keyof FraudSettings) => {
        if (!settings) return;
        update(key, !settings[key] as any);
    };

    if (loading || !settings) {
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 animate-pulse">
                <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-48 mb-6" />
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-100 dark:bg-gray-800 p-2.5 rounded-xl">
                            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Fraud Detection Settings</h3>
                            <p className="text-xs text-gray-500">Global configuration and thresholds</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all ${
                            saved
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90'
                        } disabled:opacity-50`}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-8 max-h-[600px] overflow-y-auto custom-scrollbar">
                {/* Risk Thresholds */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Sliders className="w-4 h-4 text-indigo-500" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider">Risk Thresholds</h4>
                    </div>
                    <div className="space-y-5">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-gray-700 dark:text-gray-300">Global Alert Threshold</label>
                                <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{settings.globalThreshold}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.globalThreshold}
                                onChange={(e) => update('globalThreshold', Number(e.target.value))}
                                className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>0 (None)</span>
                                <span>100 (Maximum)</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-gray-700 dark:text-gray-300">Auto-Block Threshold</label>
                                <span className="text-sm font-mono font-bold text-rose-600 dark:text-rose-400">{settings.autoBlockThreshold}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.autoBlockThreshold}
                                onChange={(e) => update('autoBlockThreshold', Number(e.target.value))}
                                className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full appearance-none cursor-pointer accent-rose-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>Low (Block frequently)</span>
                                <span>High (Block rarely)</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-gray-700 dark:text-gray-300">Challenge Threshold</label>
                                <span className="text-sm font-mono font-bold text-orange-600 dark:text-orange-400">{settings.challengeThreshold}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.challengeThreshold}
                                onChange={(e) => update('challengeThreshold', Number(e.target.value))}
                                className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full appearance-none cursor-pointer accent-orange-500"
                            />
                        </div>
                    </div>
                </section>

                {/* Velocity Settings */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider">Velocity Rules</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Velocity Window (minutes)</label>
                            <input
                                type="number"
                                min={1}
                                value={settings.velocityWindowMinutes}
                                onChange={(e) => update('velocityWindowMinutes', Number(e.target.value))}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Max Transactions / Window</label>
                            <input
                                type="number"
                                min={1}
                                value={settings.maxVelocityPerWindow}
                                onChange={(e) => update('maxVelocityPerWindow', Number(e.target.value))}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
                            />
                        </div>
                    </div>
                </section>

                {/* Toggle Settings */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-emerald-500" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider">Detection Features</h4>
                    </div>
                    <div className="space-y-3">
                        {[
                            { key: 'geoRestrictionEnabled' as const, label: 'Geo-Restriction', desc: 'Block transactions from restricted countries' },
                            { key: 'vpnBlockingEnabled' as const, label: 'VPN Blocking', desc: 'Block or flag transactions from VPN/proxy' },
                            { key: 'emulatorDetectionEnabled' as const, label: 'Emulator Detection', desc: 'Detect and flag emulator environments' },
                            { key: 'emailVerificationRequired' as const, label: 'Email Verification', desc: 'Require verified email for transactions' },
                            { key: 'threeDSecureEnabled' as const, label: '3D Secure', desc: 'Enforce 3D Secure authentication' },
                            { key: 'escalationAutoAssign' as const, label: 'Auto-Assign Escalations', desc: 'Auto-assign escalated alerts to analysts' },
                        ].map(item => (
                            <div
                                key={item.key}
                                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-750 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => toggleSetting(item.key)}
                            >
                                <div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.label}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                                </div>
                                {settings[item.key] ? (
                                    <ToggleRight className="w-8 h-8 text-emerald-500" />
                                ) : (
                                    <ToggleLeft className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Restricted Countries */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-4 h-4 text-rose-500" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider">Restricted Countries</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {settings.restrictedCountries.map(code => (
                            <span
                                key={code}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-lg text-sm font-bold"
                            >
                                {code}
                                <button
                                    onClick={() => update('restrictedCountries', settings.restrictedCountries.filter(c => c !== code))}
                                    className="text-rose-400 hover:text-rose-600 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCountry}
                            onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                            placeholder="ISO 3166-1 alpha-2"
                            maxLength={2}
                            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono uppercase w-40"
                        />
                        <button
                            onClick={() => {
                                if (newCountry.length === 2 && !settings.restrictedCountries.includes(newCountry)) {
                                    update('restrictedCountries', [...settings.restrictedCountries, newCountry]);
                                    setNewCountry('');
                                }
                            }}
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </section>

                {/* ML Model */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-4 h-4 text-violet-500" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider">ML Model Configuration</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Algorithm</label>
                            <select
                                value={settings.riskScoreAlgorithm}
                                onChange={(e) => update('riskScoreAlgorithm', e.target.value as FraudSettings['riskScoreAlgorithm'])}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            >
                                <option value="RULE_BASED">Rule-Based</option>
                                <option value="ML_ENSEMBLE">ML Ensemble</option>
                                <option value="NEURAL_NETWORK">Neural Network</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Model Version</label>
                            <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-gray-500">
                                {settings.modelVersion}
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-750">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            Last retrained: {new Date(settings.lastModelRetrainedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                </section>

                {/* Notifications */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-4 h-4 text-amber-500" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider">Notifications</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Webhook URL</label>
                            <div className="flex items-center gap-2">
                                <Webhook className="w-4 h-4 text-gray-400 shrink-0" />
                                <input
                                    type="url"
                                    value={settings.notificationWebhook}
                                    onChange={(e) => update('notificationWebhook', e.target.value)}
                                    className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Notification Emails</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {settings.notificationEmails.map(email => (
                                    <span
                                        key={email}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm font-medium"
                                    >
                                        <Mail className="w-3 h-3" />
                                        {email}
                                        <button
                                            onClick={() => update('notificationEmails', settings.notificationEmails.filter(e => e !== email))}
                                            className="text-blue-400 hover:text-blue-600 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="Add email address"
                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                />
                                <button
                                    onClick={() => {
                                        if (newEmail && newEmail.includes('@') && !settings.notificationEmails.includes(newEmail)) {
                                            update('notificationEmails', [...settings.notificationEmails, newEmail]);
                                            setNewEmail('');
                                        }
                                    }}
                                    className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Investigation Settings */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider">Investigation SLA</h4>
                    </div>
                    <div className="flex flex-col gap-1.5 w-64">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Max Investigation Hours</label>
                        <input
                            type="number"
                            min={1}
                            value={settings.maxInvestigationHours}
                            onChange={(e) => update('maxInvestigationHours', Number(e.target.value))}
                            className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
                        />
                    </div>
                </section>
            </div>
        </div>
    );
};
