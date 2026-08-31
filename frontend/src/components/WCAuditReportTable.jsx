import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * @fileoverview WC Audit Report Table Component
 * @description Displays the class code breakdown and premium calculations for the annual audit.
 * Issue: #2061
 */
export default function WCAuditReportTable({ reports, loading }) {
    if (loading) {
        return <div className="p-8 text-center text-gray-500 dark:text-slate-400">Loading audit reports...</div>;
    }

    if (!reports || reports.length === 0) {
        return <div className="p-8 text-center text-gray-500 dark:text-slate-400">No audit reports generated yet.</div>;
    }

    const latestReport = reports[0];

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {latestReport.policyYear} Audit Report ({latestReport.status})
                </h2>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold rounded-full">
                    EMR: {latestReport.companyEMR.toFixed(2)}
                </span>
            </div>

            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">NCCI Code</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Eligible Wages</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Manual Rate</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Calculated Premium</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {latestReport.classCodeBreakdown.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900 dark:text-white">{row.ncciCode}</td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{row.description}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${row.eligibleWages.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">${row.manualRate.toFixed(2)}</td>
                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-brand-600 dark:text-brand-400">${row.calculatedPremium.toLocaleString()}</td>
                        </tr>
                    ))}
                    <tr className="bg-gray-100 dark:bg-slate-900 font-bold">
                        <td colSpan="2" className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">TOTALS</td>
                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">${latestReport.totalWCEligiblePayroll.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-400">-</td>
                        <td className="px-6 py-4 text-sm text-right font-mono text-brand-600 dark:text-brand-400">${latestReport.totalEstimatedPremium.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

WCAuditReportTable.propTypes = {
    reports: PropTypes.array.isRequired,
    loading: PropTypes.bool.isRequired,
};

WCAuditReportTable.defaultProps = {
    reports: [],
    loading: false,
};
