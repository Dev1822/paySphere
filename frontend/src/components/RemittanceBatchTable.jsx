import DownloadIcon from '@mui/icons-material/Download';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * @fileoverview Remittance Batch Table Component
 * @description Displays monthly remittance batches and their delinquency status.
 * Issue: #2009
 */
export default function RemittanceBatchTable({ batches, loading }) {
    const handleDownload = (batch) => {
        const blob = new Blob([batch.edgeFileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = batch.edgeFileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getStatusBadge = (batch) => {
        if (batch.status === 'Submitted') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (batch.delinquency?.isDelinquent) {
            const severity = batch.delinquency.severity;
            if (severity === 'Severe') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            if (severity === 'Critical') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        }
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">CBA Code</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Period</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Hours</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Fringe</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {loading ? (
                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading remittance batches...</td></tr>
                    ) : batches.length === 0 ? (
                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No remittance batches found.</td></tr>
                    ) : batches.map(b => (
                        <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{b.cbaCode}</td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{b.periodMonth}/{b.periodYear}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{b.totalHoursWorked.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">${b.totalFringeContributions.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 justify-center ${getStatusBadge(b)}`}>
                                    {b.delinquency?.isDelinquent && <WarningAmberIcon fontSize="small" />}
                                    {b.delinquency?.isDelinquent ? `${b.delinquency.severity} (${b.delinquency.daysOverdue}d)` : b.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                {b.edgeFileContent && (
                                    <button onClick={() => handleDownload(b)} className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1 mx-auto">
                                        <DownloadIcon fontSize="small" /> EDGE File
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
