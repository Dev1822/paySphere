import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DownloadIcon from '@mui/icons-material/Download';

export default function Form1099Dashboard() {
    const [data, setData] = useState({ accumulations: [], tinRecords: [], drafts: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('accumulations');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/contractor-1099/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleValidateTIN = async () => {
        try {
            // Mocking a TIN validation for demo
            await api.post('/api/contractor-1099/validate-tin', {
                contractorId: 'mock_contractor_1', tinType: 'EIN', tinValue: '123456789', legalName: 'Test LLC'
            });
            alert('TIN validation submitted to IRS.');
            fetchData();
        } catch (err) { alert('Validation failed.'); }
    };

    const handleGenerateFIRE = async () => {
        try {
            await api.post('/api/contractor-1099/generate-fire', { taxYear: new Date().getFullYear() });
            alert('IRS FIRE format file generated.');
            fetchData();
        } catch (err) { alert('Generation failed.'); }
    };

    const getTINStatusBadge = (status) => {
        if (status === 'Match') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (status === 'Mismatch') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Contractor1099" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ReceiptLongIcon className="text-purple-500" /> Contractor 1099-NEC/MISC & TIN Validation
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-end gap-3">
                        <button onClick={handleValidateTIN} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2">
                            <VerifiedUserIcon fontSize="small" /> Validate TIN
                        </button>
                        <button onClick={handleGenerateFIRE} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                            <DownloadIcon fontSize="small" /> Generate FIRE File
                        </button>
                    </div>

                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('accumulations')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'accumulations' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            YTD Payment Accumulations
                        </button>
                        <button onClick={() => setActiveTab('tin')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'tin' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            TIN Validation Status
                        </button>
                    </div>

                    {activeTab === 'accumulations' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Contractor ID</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">YTD NEC (Box 1)</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Backup Withheld</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Threshold Met?</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : data.accumulations.map(a => (
                                        <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900 dark:text-white">{a._id}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${a.totalNEC.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-red-600 dark:text-red-400">${a.totalWithholding.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                {a.totalNEC >= 600 ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Yes (1099 Required)</span>
                                                ) : (
                                                    <span className="text-xs text-gray-500">No</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'tin' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Legal Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">TIN Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">TIN (Masked)</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">IRS Match Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.tinRecords.map(t => (
                                        <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{t.legalName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{t.tinType}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-slate-300">***-**-{t.tinValue.slice(-4)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 justify-center ${getTINStatusBadge(t.irsMatchStatus)}`}>
                                                    {t.irsMatchStatus === 'Mismatch' && <WarningAmberIcon fontSize="small" />}
                                                    {t.irsMatchStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
