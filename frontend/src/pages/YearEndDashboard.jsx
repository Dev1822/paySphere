import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DownloadIcon from '@mui/icons-material/Download';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

export default function YearEndDashboard() {
    const [data, setData] = useState({ batches: [], files: [], discrepancies: [] });
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/year-end/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleAggregate = async () => {
        if (!window.confirm(`Trigger W-2 aggregation for tax year ${taxYear}? This may take a few minutes.`)) return;
        setProcessing(true);
        try {
            await api.post('/api/year-end/aggregate', { taxYear });
            alert('Aggregation completed successfully!');
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Aggregation failed.'); } finally { setProcessing(false); }
    };

    const handleGenerateMedia = async () => {
        setProcessing(true);
        try {
            await api.post('/api/year-end/generate-media', { taxYear });
            alert('EFW2 Magnetic Media file generated!');
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Generation failed.'); } finally { setProcessing(false); }
    };

    const handleDownload = async (fileId, fileName) => {
        try {
            const res = await api.get(`/api/year-end/download/${fileId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { alert('Download failed.'); }
    };

    const currentBatch = data.batches.find(b => b.taxYear === taxYear);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="YearEnd" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ReceiptLongIcon className="text-indigo-500" /> W-2/W-3 Year-End & SSA Magnetic Media
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Tax Year</label>
                            <input type="number" value={taxYear} onChange={e => setTaxYear(Number(e.target.value))} className="w-32 px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        </div>
                        <button onClick={handleAggregate} disabled={processing || (currentBatch && currentBatch.status === 'Completed')} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                            <PlayArrowIcon fontSize="small" /> {processing ? 'Processing...' : 'Trigger Aggregation'}
                        </button>
                        {currentBatch && currentBatch.status === 'Completed' && (
                            <button onClick={handleGenerateMedia} disabled={processing} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                <ReceiptLongIcon fontSize="small" /> Generate EFW2 File
                            </button>
                        )}
                    </div>

                    {currentBatch && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-gray-500 dark:text-slate-400">Status</p>
                                <p className="text-lg font-bold text-green-600 dark:text-green-400">{currentBatch.status}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-gray-500 dark:text-slate-400">Employees</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{currentBatch.totalEmployeesProcessed}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-gray-500 dark:text-slate-400">Total Box 1 Wages</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">${(currentBatch.totalWages || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-gray-500 dark:text-slate-400">Total Box 3 SS Wages</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">${(currentBatch.totalSocialSecurityWages || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    {data.discrepancies.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-2">
                                <WarningAmberIcon /> Box Discrepancy Audit ({data.discrepancies.length} flagged)
                            </h3>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {data.discrepancies.map(d => (
                                    <p key={d._id} className="text-xs text-amber-700 dark:text-amber-300">
                                        <strong>{d.employeeId?.fullName}:</strong> {d.discrepancyNotes}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Generated Magnetic Media Files</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">File Name</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">RW Records</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {data.files.map(f => (
                                    <tr key={f._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{f.fileName}</td>
                                        <td className="px-6 py-4 text-sm text-right text-gray-700 dark:text-slate-300">{f.totalRWRecords}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{f.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleDownload(f._id, f.fileName)} className="text-brand-600 hover:text-brand-800 flex items-center gap-1 mx-auto">
                                                <DownloadIcon fontSize="small" /> Download
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
