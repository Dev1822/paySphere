import { Users, Filter, BarChart3, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

interface DepartmentDemographics {
    department: string;
    totalHeadcount: number;
    leadershipFemalePct: number;
    leadershipUrmPct: number;
    metrics: {
        white: number;
        asian: number;
        black: number;
        hispanic: number;
        other: number;
    };
    attritionRisk: number;
    inclusionScore: number;
}

interface Props {
    matrix: DepartmentDemographics[];
}

export default function DemographicMatrixTable({ matrix }: Props) {

    const renderScale = (pct: number, isRisk: boolean = false) => {
        let color = 'bg-cyan-500';
        if (isRisk) {
            if (pct > 15) color = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse';
            else if (pct > 10) color = 'bg-orange-500';
            else color = 'bg-emerald-500';
        } else {
            if (pct < 15) color = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse';
            else if (pct < 25) color = 'bg-orange-400';
            else if (pct >= 40) color = 'bg-emerald-500';
        }

        return (
            <div className="w-full bg-gray-950 h-2 rounded-full border border-gray-800/80 overflow-hidden relative">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, pct)}%` }}></div>
            </div>
        );
    };

    return (
        <div className="bg-[#0b1021] border border-indigo-900/30 rounded-3xl p-6 shadow-2xl flex flex-col min-h-[600px] relative overflow-hidden">

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Users className="text-indigo-500 h-6 w-6" />
                        Granular Division Topology Matrix
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Cross-cutting departmental taxonomy reflecting ethnic breakdowns, leadership inclusion metrics, and aggregate algorithmic attrition risk telemetry.
                    </p>
                </div>

                <div className="flex bg-black/60 border border-gray-800 rounded-xl p-1 shadow-inner">
                    <button className="px-4 py-2 text-xs font-bold bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 rounded-lg flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Snapshot View
                    </button>
                    <button className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 rounded-lg flex items-center gap-2 transition-colors">
                        <Filter className="h-4 w-4" /> Add Pivot
                    </button>
                </div>
            </div>

            <div className="relative z-10 flex-1 overflow-auto rounded-3xl border border-gray-800/80 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] bg-[#050812] custom-scrollbar">
                <table className="w-full text-left whitespace-nowrap min-w-[1000px]">
                    <thead className="bg-[#0a0f25] sticky top-0 border-b border-indigo-900/50 shadow-lg z-20">
                        <tr>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">Division / Cost Center</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400 text-center border-x border-gray-800/50">Baseline Ethnicity Spline (%)</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">Leadership Inclusion</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">Idx Safety</th>
                            <th className="px-6 py-5 text-[10px] uppercase font-black tracking-[0.2em] text-rose-500 flex items-center gap-2 max-w-max">
                                <AlertTriangle className="h-3 w-3" /> Attrition Flux
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                        {matrix.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-24 text-center text-gray-600 font-bold h-[300px]">
                                    Awaiting datalake synchronization...
                                </td>
                            </tr>
                        ) : (
                            matrix.map((row, idx) => (
                                <tr key={idx} className="hover:bg-indigo-950/20 transition-colors group">

                                    {/* Department Core */}
                                    <td className="px-6 py-5">
                                        <p className="font-extrabold text-gray-200 text-sm">{row.department}</p>
                                        <p className="text-[10px] text-indigo-400 uppercase font-black tracking-widest mt-1">VOL: {row.totalHeadcount.toLocaleString()}</p>
                                    </td>

                                    {/* Highly granular multi-bar ethnicity mapping */}
                                    <td className="px-6 py-5 border-x border-gray-800/30">
                                        <div className="flex h-3 w-full max-w-xs rounded-sm overflow-hidden bg-gray-900 border border-gray-700/50">
                                            <div className="bg-slate-400 h-full border-r border-black" style={{ width: `${row.metrics.white}%` }} title={`White: ${row.metrics.white}%`}></div>
                                            <div className="bg-yellow-500 h-full border-r border-black" style={{ width: `${row.metrics.asian}%` }} title={`Asian: ${row.metrics.asian}%`}></div>
                                            <div className="bg-amber-600 h-full border-r border-black" style={{ width: `${row.metrics.hispanic}%` }} title={`Hispanic: ${row.metrics.hispanic}%`}></div>
                                            <div className="bg-indigo-600 h-full" style={{ width: `${row.metrics.black}%` }} title={`Black: ${row.metrics.black}%`}></div>
                                        </div>
                                        <div className="flex gap-4 mt-2 text-[10px] uppercase font-black text-gray-500 tracking-wider">
                                            <span>W: {row.metrics.white}%</span>
                                            <span>A: {row.metrics.asian}%</span>
                                            <span>H: {row.metrics.hispanic}%</span>
                                            <span>B: {row.metrics.black}%</span>
                                        </div>
                                    </td>

                                    {/* Dual Scale Pct Bars */}
                                    <td className="px-6 py-5 w-64 min-w-[250px]">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-[9px] uppercase font-black text-gray-400 mb-1">
                                                    <span>Female Leads</span>
                                                    <span>{row.leadershipFemalePct}%</span>
                                                </div>
                                                {renderScale(row.leadershipFemalePct)}
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[9px] uppercase font-black text-gray-400 mb-1">
                                                    <span>Underrepresented Leads</span>
                                                    <span>{row.leadershipUrmPct}%</span>
                                                </div>
                                                {renderScale(row.leadershipUrmPct)}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 font-mono text-gray-300 text-lg font-black">
                                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-black border border-gray-700 shadow-inner group-hover:border-cyan-500/50 transition-colors">
                                            {row.inclusionScore}
                                        </div>
                                    </td>

                                    <td className="px-6 py-5">
                                        <span className="text-xl font-bold font-mono text-rose-400">
                                            {row.attritionRisk}%
                                        </span>
                                        <div className="mt-1 w-full max-w-[80px]">
                                            {renderScale(row.attritionRisk, true)}
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
