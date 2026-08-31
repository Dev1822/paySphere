import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import AddIcon from '@mui/icons-material/Add';
import PledgeFormModal from '../components/PledgeFormModal';

/**
 * @fileoverview Charitable Giving Dashboard
 * @description Main UI for managing campaigns, submitting pledges, and monitoring participation.
 * Issue: #2011
 */
export default function CharitableGivingDashboard() {
    const [data, setData] = useState({ campaigns: [], myPledges: [] });
    const [loading, setLoading] = useState(true);
    const [activeCampaign, setActiveCampaign] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/charitable-giving/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleExport = async (campaignId) => {
        try {
            const res = await api.post('/api/charitable-giving/export', { campaignId, year: new Date().getFullYear() });
            alert(`Disbursement report generated for ${Object.keys(res.data.report).length} charities.`);
        } catch (err) { alert('Export failed.'); }
    };

    const activeCampaigns = data.campaigns.filter(c => c.status === 'Active');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Charity" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <VolunteerActivismIcon className="text-pink-500" /> Charitable Giving & Corporate Matching
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Campaigns</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? (
                            <p className="text-gray-500 col-span-3 text-center py-12">Loading campaigns...</p>
                        ) : activeCampaigns.length === 0 ? (
                            <p className="text-gray-500 col-span-3 text-center py-12">No active campaigns at this time.</p>
                        ) : activeCampaigns.map(c => (
                            <div key={c._id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{c.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{c.description}</p>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-xs text-gray-600 dark:text-slate-300">
                                        <span>Raised</span>
                                        <span className="font-bold">${c.totalRaised.toLocaleString()} / ${c.totalCorporateBudget.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                        <div className="bg-pink-500 h-2 rounded-full" style={{ width: `${Math.min(100, (c.totalRaised / c.totalCorporateBudget) * 100)}%` }}></div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-4">
                                    <span>{c.participantCount} Participants</span>
                                    <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full font-bold">{c.matchingRule}</span>
                                </div>

                                <button onClick={() => { setActiveCampaign(c); setShowModal(true); }} className="w-full py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center justify-center gap-2">
                                    <AddIcon fontSize="small" /> Make a Pledge
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">My Active Pledges</h2>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Campaign</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Pledge Amt</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Frequency</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">YTD Deducted</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">YTD Matched</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.myPledges.map(p => (
                                        <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{p.campaignId?.name}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono">${p.pledgeAmount}</td>
                                            <td className="px-6 py-4 text-sm text-center text-gray-700 dark:text-slate-300">{p.frequency}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${p.ytdDeducted}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-green-600 dark:text-green-400">${p.ytdMatched}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.status === 'Active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {showModal && activeCampaign && (
                <PledgeFormModal campaign={activeCampaign} onClose={() => setShowModal(false)} onSuccess={fetchData} />
            )}
        </div>
    );
}
