import { useState } from 'react';
import api from '../services/api';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

/**
 * @fileoverview NAUPA File Exporter Component
 * @description UI for generating and downloading NAUPA standard electronic files.
 * Issue: #2013
 */
export default function NAUPAFileExporter({ dormantCounts, onExportComplete }) {
    const [form, setForm] = useState({ stateCode: 'CA', reportingYear: new Date().getFullYear() });
    const [loading, setLoading] = useState(false);
    const [generatedFile, setGeneratedFile] = useState(null);

    const handleGenerate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/api/escheatment/naupa', form);
            setGeneratedFile(res.data.batch);
            if (onExportComplete) onExportComplete();
            alert(`NAUPA file generated for ${res.data.batch.totalChecks} checks.`);
        } catch (err) {
            alert(err.response?.data?.message || 'Generation failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!generatedFile) return;
        const blob = new Blob([generatedFile.naupaFileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generatedFile.naupaFileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CloudUploadIcon className="text-indigo-500" /> Generate NAUPA State Remittance File
            </h2>
            <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">State</label>
                    <select value={form.stateCode} onChange={e => setForm({ ...form, stateCode: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm">
                        <option value="CA">California</option>
                        <option value="NY">New York</option>
                        <option value="TX">Texas</option>
                        <option value="FL">Florida</option>
                        <option value="IL">Illinois</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Reporting Year</label>
                    <input type="number" value={form.reportingYear} onChange={e => setForm({ ...form, reportingYear: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                </div>
                <div className="flex items-end">
                    <button type="submit" disabled={loading} className="w-full py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 text-sm">
                        {loading ? 'Generating...' : 'Generate NAUPA File'}
                    </button>
                </div>
            </form>

            {generatedFile && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-green-800 dark:text-green-200">File Ready: {generatedFile.naupaFileName}</p>
                        <p className="text-xs text-green-700 dark:text-green-300">{generatedFile.totalChecks} checks | ${generatedFile.totalAmount.toLocaleString()} total</p>
                    </div>
                    <button onClick={handleDownload} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2 text-sm">
                        <DownloadIcon fontSize="small" /> Download .txt
                    </button>
                </div>
            )}
        </div>
    );
}
