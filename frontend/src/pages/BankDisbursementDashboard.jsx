import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';

export default function BankDisbursementDashboard() {
    const [data, setData] = useState({ config: null, files: [], mappings: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('files');

    const [originatorForm, setOriginatorForm] = useState({
        immediateDestination: '', immediateOrigin: '', destinationName: '', originatorName: '',
        companyIdentification: '', operatingBankRouting: '', operatingBankAccount: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/disbursement/dashboard');
            setData(res.data);
            if (res.data.config) setOriginatorForm(res.data.config);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSaveOriginator = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/disbursement/originator', originatorForm);
            alert('Originator configuration saved!');
            fetchData();
        } catch (err) { alert('Failed to save configuration.'); }
    };

    const handleGenerateNacha = async () => {
        if (!window.confirm('Generate NACHA file for the latest approved payroll run?')) return;
        try {
            // Mocking payroll run data for demonstration
            const mockPayouts = data.mappings.slice(0, 5).map(m => ({ employeeId: m.employeeId._id, netPay: 2500.00 }));
            const res = await api.post('/api/disbursement/generate', {
                payrollRunId: 'mock_run_123',
                employeePayouts: mockPayouts,
                effectiveDate: new Date().toISOString()
            });
            alert(`NACHA file generated: ${res.data.disbursement.fileName}`);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Generation failed.'); }
    };

    const handleDownload = async (fileId, fileName) => {
        try {
            const res = await api.get(`/api/disbursement/download/${fileId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { alert('Download failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Disbursement" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceIcon className="text-green-600" /> NACHA Bank Disbursement
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('files')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'files' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            NACHA Files
                        </button>
                        <button onClick={() => setActiveTab('config')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'config' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Originator Config
                        </button>
                        <button onClick={() => setActiveTab('mappings')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'mappings' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Bank Mappings
                        </button>
                    </div>

                    {activeTab === 'files' && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={handleGenerateNacha} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2">
                                    <AccountBalanceIcon fontSize="small" /> Generate NACHA File
                                </button>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">File Name</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Entries</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Credit</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {loading ? (
                                            <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                        ) : data.files.map(f => (
                                            <tr key={f._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{f.fileName}</td>
                                                <td className="px-6 py-4 text-sm text-right text-gray-700 dark:text-slate-300">{f.entryCount}</td>
                                                <td className="px-6 py-4 text-sm text-right font-bold text-green-600 dark:text-green-400">${f.totalCreditAmount.toLocaleString()}</td>
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
                    )}

                    {activeTab === 'config' && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 max-w-2xl">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <SettingsIcon /> ACH Originator Configuration
                            </h2>
                            <form onSubmit={handleSaveOriginator} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Company Name (Originator)</label>
                                        <input type="text" maxLength="23" value={originatorForm.originatorName} onChange={e => setOriginatorForm({ ...originatorForm, originatorName: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Company ID (Tax ID)</label>
                                        <input type="text" maxLength="10" value={originatorForm.companyIdentification} onChange={e => setOriginatorForm({ ...originatorForm, companyIdentification: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Immediate Origin (Routing/Tax ID)</label>
                                        <input type="text" maxLength="9" value={originatorForm.immediateOrigin} onChange={e => setOriginatorForm({ ...originatorForm, immediateOrigin: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Immediate Destination (Bank Routing)</label>
                                        <input type="text" maxLength="9" value={originatorForm.immediateDestination} onChange={e => setOriginatorForm({ ...originatorForm, immediateDestination: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Destination Bank Name</label>
                                    <input type="text" maxLength="23" value={originatorForm.destinationName} onChange={e => setOriginatorForm({ ...originatorForm, destinationName: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Save Configuration</button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'mappings' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Routing</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Account</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Type</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Split %</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Prenote</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {data.mappings.map(m => (
                                        <tr key={m._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{m.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-slate-300">{m.routingNumber}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-slate-300">****{m.accountNumber.slice(-4)}</td>
                                            <td className="px-6 py-4 text-sm text-center text-gray-700 dark:text-slate-300">{m.accountType}</td>
                                            <td className="px-6 py-4 text-sm text-center font-bold text-gray-900 dark:text-white">{m.splitPercentage}%</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.prenoteStatus === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {m.prenoteStatus}
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
