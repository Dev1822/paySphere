import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import GavelIcon from '@mui/icons-material/Gavel';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function PTOComplianceDashboard() {
    const [data, setData] = useState({ rules: [], policies: [] });
    const [loading, setLoading] = useState(true);
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [ruleForm, setRuleForm] = useState({
        stateCode: '', allowsUseItOrLoseIt: false, allowsAccrualCap: true,
        maxAccrualCapMultiplier: 1.5, mandatesTerminationPayout: false
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/pto/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSaveRule = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/pto/rules', ruleForm);
            alert('Compliance rule saved!');
            setShowRuleForm(false);
            fetchData();
        } catch (err) { alert('Failed to save rule.'); }
    };

    const handleRunAccrual = async (policyId) => {
        if (!window.confirm('Run PTO accrual batch for this policy?')) return;
        try {
            const res = await api.post('/api/pto/run-accrual', { policyId, paychecksPerYear: 26 });
            alert(`Processed ${res.data.processed} accruals. ${res.data.cappedCount} employees hit state caps.`);
        } catch (err) { alert('Accrual batch failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="PTO" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BeachAccessIcon className="text-blue-500" /> PTO Accrual & State Compliance
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                        <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            <strong>Compliance Guardrail Active:</strong> Accruals will automatically halt when employees hit state-mandated caps (e.g., California 1.5x cap). Termination payouts will be automatically injected into F&F for mandated states.
                        </p>
                    </div>

                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">State Compliance Rules</h2>
                        <button onClick={() => setShowRuleForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                            <AddIcon fontSize="small" /> Add State Rule
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">State</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Use-it-or-Lose-it</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Accrual Cap</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Mandates Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : data.rules.map(r => (
                                    <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{r.stateCode}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.allowsUseItOrLoseIt ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                                {r.allowsUseItOrLoseIt ? 'Allowed' : 'Prohibited'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-slate-300">
                                            {r.allowsAccrualCap ? `${r.maxAccrualCapMultiplier}x Annual` : 'None'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {r.mandatesTerminationPayout ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Mandated</span>
                                            ) : (
                                                <span className="text-gray-400">No</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Active PTO Policies</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.policies.map(p => (
                                <div key={p._id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <h3 className="font-bold text-gray-900 dark:text-white">{p.name}</h3>
                                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">{p.tiers.length} Tiers | {p.accrualFrequency}</p>
                                    <button onClick={() => handleRunAccrual(p._id)} className="w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40">
                                        Run Accrual Batch
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showRuleForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <GavelIcon /> Add State Compliance Rule
                        </h2>
                        <form onSubmit={handleSaveRule} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">State Code</label>
                                <input type="text" maxLength="2" value={ruleForm.stateCode} onChange={e => setRuleForm({ ...ruleForm, stateCode: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white uppercase" />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={ruleForm.allowsUseItOrLoseIt} onChange={e => setRuleForm({ ...ruleForm, allowsUseItOrLoseIt: e.target.checked })} className="rounded text-brand-600" id="uio" />
                                <label htmlFor="uio" className="text-sm text-gray-700 dark:text-slate-300">Allows Use-It-Or-Lose-It</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={ruleForm.allowsAccrualCap} onChange={e => setRuleForm({ ...ruleForm, allowsAccrualCap: e.target.checked })} className="rounded text-brand-600" id="cap" />
                                <label htmlFor="cap" className="text-sm text-gray-700 dark:text-slate-300">Allows Accrual Cap</label>
                            </div>
                            {ruleForm.allowsAccrualCap && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Cap Multiplier (x Annual Rate)</label>
                                    <input type="number" step="0.1" value={ruleForm.maxAccrualCapMultiplier} onChange={e => setRuleForm({ ...ruleForm, maxAccrualCapMultiplier: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={ruleForm.mandatesTerminationPayout} onChange={e => setRuleForm({ ...ruleForm, mandatesTerminationPayout: e.target.checked })} className="rounded text-brand-600" id="payout" />
                                <label htmlFor="payout" className="text-sm text-gray-700 dark:text-slate-300">Mandates Termination Payout</label>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowRuleForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Save Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
