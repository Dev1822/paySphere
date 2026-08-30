import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import InfoIcon from '@mui/icons-material/Info';

export default function CommuterBenefitsPortal() {
    const [data, setData] = useState({ elections: [], limits: {} });
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ benefitType: 'Transit', electionAmount: 0, effectiveMonth: new Date().getMonth() + 1, effectiveYear: new Date().getFullYear() });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/commuter/my-elections');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/commuter/election', formData);
            alert('Election updated!');
            fetchData();
        } catch (err) { alert('Update failed.'); }
    };

    const currentTransit = data.elections.find(e => e.benefitType === 'Transit' && e.status === 'Active');
    const currentParking = data.elections.find(e => e.benefitType === 'Parking' && e.status === 'Active');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Commuter" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <DirectionsTransitIcon className="text-green-500" /> Commuter & Parking Benefits
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
                        <InfoIcon className="text-blue-600 dark:text-blue-400 mt-0.5" />
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Tax Advantage:</strong> Contributions are deducted from your gross pay <em>before</em> taxes are calculated, lowering your overall taxable income. IRS Monthly Limits: Transit (${data.limits.Transit || 315}), Parking (${data.limits.Parking || 315}).
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-4">
                                <DirectionsTransitIcon className="text-brand-600" />
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transit / Vanpool</h2>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Current Election: <strong className="text-gray-900 dark:text-white">${currentTransit?.electionAmount || 0}/mo</strong></p>
                            <form onSubmit={handleUpdate} className="space-y-3">
                                <input type="hidden" value="Transit" name="benefitType" />
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Monthly Pre-Tax Amount</label>
                                    <input type="number" max={data.limits.Transit} value={formData.benefitType === 'Transit' ? formData.electionAmount : ''} onChange={e => setFormData({ ...formData, benefitType: 'Transit', electionAmount: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Update Transit</button>
                            </form>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-4">
                                <LocalParkingIcon className="text-brand-600" />
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Parking</h2>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Current Election: <strong className="text-gray-900 dark:text-white">${currentParking?.electionAmount || 0}/mo</strong></p>
                            <form onSubmit={handleUpdate} className="space-y-3">
                                <input type="hidden" value="Parking" name="benefitType" />
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Monthly Pre-Tax Amount</label>
                                    <input type="number" max={data.limits.Parking} value={formData.benefitType === 'Parking' ? formData.electionAmount : ''} onChange={e => setFormData({ ...formData, benefitType: 'Parking', electionAmount: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Update Parking</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
