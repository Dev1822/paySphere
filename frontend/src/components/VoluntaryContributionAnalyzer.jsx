import { useState } from 'react';
import api from '../services/api';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * @fileoverview Voluntary Contribution Analyzer Component
 * @description UI for calculating the ROI of buying down the SUI rate.
 * Issue: #2012
 */
export default function VoluntaryContributionAnalyzer({ onAnalysisComplete }) {
    const [form, setForm] = useState({ stateCode: 'CA', taxYear: new Date().getFullYear(), targetRate: 0.01, projectedTaxablePayroll: 1000000 });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/api/sui-tax/analyze', form);
            setResult(res.data.roi);
            if (onAnalysisComplete) onAnalysisComplete();
        } catch (err) {
            alert(err.response?.data?.message || 'Analysis failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUpIcon className="text-green-500" /> Voluntary Contribution ROI Analyzer
            </h2>
            <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">State</label>
                    <select value={form.stateCode} onChange={e => setForm({ ...form, stateCode: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm">
                        <option value="CA">California</option>
                        <option value="NY">New York</option>
                        <option value="WA">Washington</option>
                        <option value="TX">Texas</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Target Rate (%)</label>
                    <input type="number" step="0.01" value={form.targetRate * 100} onChange={e => setForm({ ...form, targetRate: Number(e.target.value) / 100 })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Projected Taxable Payroll</label>
                    <input type="number" value={form.projectedTaxablePayroll} onChange={e => setForm({ ...form, projectedTaxablePayroll: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                </div>
                <div className="flex items-end">
                    <button type="submit" disabled={loading} className="w-full py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 text-sm">
                        {loading ? 'Analyzing...' : 'Calculate ROI'}
                    </button>
                </div>
            </form>

            {result && (
                <div className={`p-4 rounded-lg border ${result.isAllowed && result.netSavings > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                    <div className="flex items-start gap-2">
                        {result.isAllowed && result.netSavings > 0 ? <TrendingUpIcon className="text-green-600 mt-0.5" /> : <WarningAmberIcon className="text-red-600 mt-0.5" />}
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{result.message}</h3>
                            {result.isAllowed && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-xs">
                                    <div><p className="text-gray-500">Required Contribution</p><p className="font-bold text-gray-900 dark:text-white">${result.requiredContribution.toLocaleString()}</p></div>
                                    <div><p className="text-gray-500">Processing Fee</p><p className="font-bold text-gray-900 dark:text-white">${result.processingFee.toLocaleString()}</p></div>
                                    <div><p className="text-gray-500">Net Savings</p><p className="font-bold text-green-600 dark:text-green-400">${result.netSavings.toLocaleString()}</p></div>
                                    <div><p className="text-gray-500">ROI</p><p className="font-bold text-brand-600 dark:text-brand-400">{result.roiPercentage}%</p></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
