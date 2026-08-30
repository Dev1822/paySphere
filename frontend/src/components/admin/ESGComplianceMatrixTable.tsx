import { Filter, BarChart3, AlertTriangle, ShieldCheck } from 'lucide-react';

interface MatrixRow {
    region: string;
    facilitiesTracked: number;
    totalEmissions: number;
    renewablePct: number;
    wasteDiverted: number;
    governanceScore: number;
    riskRating: number;
    finesUSD: number;
}

interface Props {
    matrix: MatrixRow[];
}

export default function ESGComplianceMatrixTable({ matrix }: Props) {

    const renderScale = (pct: number, inverse: boolean = false) => {
        let color = 'bg-cyan-500';
        if (inverse) {
            if (pct > 40) color = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse';
            else if (pct > 20) color = 'bg-orange-500';
            else color = 'bg-emerald-500';
        } else {
            if (pct < 30) color = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse';
            else if (pct < 60) color = 'bg-orange-400';
            else color = 'bg-emerald-500';
        }

        return (
            <div className="w-full bg-gray-950 h-2.5 rounded border border-gray-800/80 overflow-hidden relative">
                <div className={`h-full ${color} rounded`} style={{ width: `${Math.min(100, pct)}%` }}></div>
            </div>
        );
    };

    return (
        <div className="bg-[#0b1021] border border-indigo-900/30 rounded-3xl p-6 shadow-2xl flex flex-col h-[550px] relative overflow-hidden">

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <ShieldCheck className="text-emerald-500 h-6 w-6" />
                        Regional Impact Ledgers
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-black">
                        Direct and Indirect (Scope 3) footprint mapping against localized regulatory structures.
                    </p>
                </div>
            </div>

            <div className="relative z-10 flex-1 overflow-auto rounded-3xl border border-gray-800/80 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] bg-[#050812] custom-scrollbar">
                <table className="w-full text-left whitespace-nowrap min-w-[1000px]">
                    <thead className="bg-[#0a0f25] sticky top-0 border-b border-indigo-900/50 shadow-lg z-20">
                        <tr>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">Jurisdiction</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400 font-mono text-right">tCO2e Payload</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">Sustainability Vectors</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">Gov. Index</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-rose-500 text-right">Fiscal Risk Exposure</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                        {matrix.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-24 text-center text-gray-600 font-bold h-[300px]">
                                    Awaiting environmental sensors...
                                </td>
                            </tr>
                        ) : (
                            matrix.map((row, idx) => (
                                <tr key={idx} className="hover:bg-indigo-950/20 transition-colors group">

                                    <td className="px-6 py-5">
                                        <p className="font-extrabold text-gray-200">{row.region}</p>
                                        <p className="text-[10px] text-indigo-400 uppercase font-black tracking-widest mt-1">NODES: {row.facilitiesTracked}</p>
                                    </td>

                                    <td className="px-6 py-5 text-right font-mono text-gray-300 font-bold text-lg">
                                        {(row.totalEmissions).toLocaleString()} <span className="text-xs text-gray-600 font-normal">t</span>
                                    </td>

                                    <td className="px-6 py-5 w-72">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-[9px] uppercase font-black text-gray-400 mb-1">
                                                    <span>Renewable Utilization</span>
                                                    <span className="text-white">{row.renewablePct}%</span>
                                                </div>
                                                {renderScale(row.renewablePct)}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 text-lg font-black font-mono">
                                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-black border border-gray-700 shadow-inner group-hover:border-emerald-500/50 text-gray-400">
                                            {row.governanceScore}
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xl font-bold font-mono text-rose-400 group-hover:text-rose-300 transition-colors">
                                                ${(row.finesUSD / 1000000).toFixed(2)}M
                                            </span>
                                            <span className="text-[9px] uppercase font-black text-gray-500 tracking-widest mt-1 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-900">
                                                Risk Lvl: {row.riskRating}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
