import React, { useState } from 'react';
import { FraudRiskService } from '../../services/FraudRiskService';
import { BlocklistSubmitForm } from '../../types/fraudRisk';
import { Shield, Plus, Lock, Send, Search } from 'lucide-react';

export const IPBlocklistForm: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [form, setForm] = useState<BlocklistSubmitForm>({
        type: 'IP',
        value: '',
        reason: '',
        durationDays: 30
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await FraudRiskService.addToBlocklist(form);
        setLoading(false);
        setSuccess(true);
        setTimeout(() => {
            setSuccess(false);
            setForm({ type: 'IP', value: '', reason: '', durationDays: 30 });
        }, 3000);
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/20 dark:to-gray-900">
                <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                    <Shield className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Add to Denylist</h3>
                    <p className="text-xs text-gray-500">Block future transactions instantly</p>
                </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
                {success ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Asset Blocked Successfully</h4>
                        <p className="text-sm text-gray-500 mt-2">The security edge will now reject incoming interactions from this identifier.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Entity Type</label>
                                <select
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                                    className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                >
                                    <option value="IP">IP Address</option>
                                    <option value="EMAIL">Email Pattern</option>
                                    <option value="CARD_BIN">Card BIN / Range</option>
                                    <option value="DEVICE_ID">Device Fingerprint</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Duration</label>
                                <select
                                    value={form.durationDays}
                                    onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
                                    className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                >
                                    <option value="1">24 Hours</option>
                                    <option value="7">7 Days</option>
                                    <option value="30">30 Days</option>
                                    <option value="0">Permanent</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Identifier Value</label>
                            <input
                                required
                                type="text"
                                value={form.value}
                                onChange={(e) => setForm({ ...form, value: e.target.value })}
                                placeholder={form.type === 'IP' ? 'e.g. 192.168.1.1' : form.type === 'EMAIL' ? '*@scammers.com' : '...'}
                                className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Reason / Notes</label>
                            <textarea
                                required
                                value={form.reason}
                                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                placeholder="Provide context for audit logs..."
                                className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white flex-1 resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !form.value || !form.reason}
                            className="mt-2 w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 py-3 rounded-xl font-semibold shadow-md transition-all disabled:opacity-50"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin rounded-full" /> : <><Send className="w-4 h-4" /> Enforce Block</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
