import { useState } from 'react';
import api from '../services/api';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';

/**
 * @fileoverview Pledge Form Modal Component
 * @description UI for employees to submit new charitable giving pledges.
 * Issue: #2011
 */
export default function PledgeFormModal({ campaign, onClose, onSuccess }) {
    const [form, setForm] = useState({
        charityId: '',
        pledgeAmount: 10,
        frequency: 'Per Paycheck',
        paychecksPerYear: 26
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/charitable-giving/pledge', { ...form, campaignId: campaign._id });
            alert('Pledge submitted successfully!');
            onSuccess();
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to submit pledge.');
        } finally {
            setLoading(false);
        }
    };

    const calculateAnnual = () => {
        const amt = Number(form.pledgeAmount) || 0;
        if (form.frequency === 'One-Time') return amt;
        if (form.frequency === 'Per Paycheck') return amt * form.paychecksPerYear;
        if (form.frequency === 'Monthly') return amt * 12;
        if (form.frequency === 'Bi-Weekly') return amt * 26;
        return 0;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                <div className="flex items-center gap-2 mb-4">
                    <VolunteerActivismIcon className="text-brand-600" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pledge to {campaign.name}</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                    Corporate Match: <strong className="text-brand-600">{campaign.matchingRule}</strong> (Up to ${campaign.matchCapPerEmployee}/yr)
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Select Charity</label>
                        <select value={form.charityId} onChange={e => setForm({ ...form, charityId: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                            <option value="">-- Select Organization --</option>
                            <option value="charity_1">United Way (13-1234567)</option>
                            <option value="charity_2">Red Cross (53-0196605)</option>
                            <option value="charity_3">Local Food Bank (94-1234567)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Amount ($)</label>
                            <input type="number" min="1" step="1" value={form.pledgeAmount} onChange={e => setForm({ ...form, pledgeAmount: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Frequency</label>
                            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                <option>One-Time</option>
                                <option>Per Paycheck</option>
                                <option>Monthly</option>
                                <option>Bi-Weekly</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                            <strong>Annual Pledge Total:</strong> ${calculateAnnual().toLocaleString()}<br />
                            <strong>Expected Corporate Match:</strong> ${Math.min(calculateAnnual(), campaign.matchCapPerEmployee).toLocaleString()}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                            {loading ? 'Submitting...' : 'Confirm Pledge'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
