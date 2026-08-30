import React, { useState } from 'react';
import { Download, FileText, CheckCircle2, ChevronRight, Settings, Command } from 'lucide-react';
import { ComprehensiveAnalyticsPayload } from '../../types/paymentAnalytics';

interface ExportExplorerProps {
    data: ComprehensiveAnalyticsPayload | null;
    onClose: () => void;
    isOpen: boolean;
}

export const AnalyticsExportExplorer: React.FC<ExportExplorerProps> = ({ data, onClose, isOpen }) => {
    const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON' | 'PDF'>('CSV');
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [exported, setExported] = useState(false);

    if (!isOpen) return null;

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            // Mocked export process
            if (exportFormat === 'JSON' && data) {
                let exportData = data;
                if (!includeMetadata) {
                    exportData = { ...data, recentTransactions: data.recentTransactions.map(({ metadata, ...rest }) => rest as any) };
                }
                const json = JSON.stringify(exportData, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics_export_${Date.now()}.json`;
                a.click();
            } else if (exportFormat === 'CSV' && data) {
                let csv = "ID,Timestamp,Amount,Currency,Method,Status,Customer Name,Gateway,Region,Net Amount,Fees\n";
                data.recentTransactions.forEach(t => {
                    csv += `${t.id},${t.timestamp},${t.amount},${t.currency},${t.method},${t.status},"${t.customerName}",${t.gateway},${t.region},${t.netAmount},${t.feeAmount}\n`;
                });
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics_export_${Date.now()}.csv`;
                a.click();
            }
            setIsExporting(false);
            setExported(true);
            setTimeout(() => {
                setExported(false);
                onClose();
            }, 2000);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-950 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
                <div className="flex items-center gap-4 p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="bg-indigo-600 p-2.5 rounded-xl">
                        <Download className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Export Analytics Data</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Download customized extracts of the analytics payload</p>
                    </div>
                </div>

                <div className="p-6 flex-1 flex flex-col gap-6">
                    {/* Format Selection */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" /> Export Format
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                            {['CSV', 'JSON', 'PDF'].map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => setExportFormat(fmt as any)}
                                    className={`py-3 rounded-xl border-2 font-medium text-sm transition-all flex flex-col items-center justify-center gap-2 ${exportFormat === fmt
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400'
                                            : 'border-gray-200 dark:border-gray-800 hover:border-indigo-300 text-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    {fmt === 'CSV' && <div className="text-xl">📊</div>}
                                    {fmt === 'JSON' && <div className="text-xl">{'{ }'}</div>}
                                    {fmt === 'PDF' && <div className="text-xl">📑</div>}
                                    {fmt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Configuration */}
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-gray-400" /> Advanced Options
                        </h4>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center w-5 h-5">
                                <input
                                    type="checkbox"
                                    checked={includeMetadata}
                                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                                    className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded checked:bg-indigo-600 checked:border-indigo-600 dark:border-gray-700 cursor-pointer transition-all"
                                />
                                <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-300">Include Raw Metadata Objects</span>
                                <span className="text-xs text-gray-500">Append risk scores, device IPs, etc.</span>
                            </div>
                        </label>
                    </div>

                    <div className="text-xs text-gray-500 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
                        <Command className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p>Exporting this dataset will generate approximately {data?.metrics.transactionCount || 0} rows depending on current filters. Large CSVs may take a moment to compress.</p>
                    </div>

                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isExporting || exported}
                        className="px-5 py-2.5 rounded-xl font-medium text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting || exported}
                        className="px-6 py-2.5 rounded-xl font-medium text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 min-w-[140px] justify-center"
                    >
                        {isExporting ? (
                            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Processing...</>
                        ) : exported ? (
                            <><CheckCircle2 className="w-4 h-4" /> Complete</>
                        ) : (
                            <>Generate {exportFormat} <ChevronRight className="w-4 h-4" /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
