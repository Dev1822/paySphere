import { useState, useEffect } from 'react';
import { esgAPI } from '../../services/admin/esgService';
import CarbonFootprintRadar from '../../components/admin/CarbonFootprintRadar';
import ESGComplianceMatrixTable from '../../components/admin/ESGComplianceMatrixTable';
import EmissionsTimeline from '../../components/admin/EmissionsTimeline';
import ESGTaxLiabilitiesChart from '../../components/admin/ESGTaxLiabilitiesChart';
import { Database, TrendingDown, Leaf, Coins, Zap } from 'lucide-react';

export default function ESGPredictorPage() {
    const [loading, setLoading] = useState(true);

    const [projectionsData, setProjectionsData] = useState<any>(null);
    const [departmentMatrix, setDepartmentMatrix] = useState<any[]>([]);
    const [logFeeds, setLogFeeds] = useState<any[]>([]);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const [projRes, matrixRes, logsRes] = await Promise.all([
                esgAPI.getCarbonProjections(),
                esgAPI.getRegionalMatrix(),
                esgAPI.getLogFeeds()
            ]);
            setProjectionsData(projRes.data);
            setDepartmentMatrix(matrixRes.data || []);
            setLogFeeds(logsRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, []);

    const handleSeed = async () => {
        setLoading(true);
        await esgAPI.seedDemoData();
        fetchAssets();
    };

    return (
        <div className="min-h-screen bg-[#04060c] text-gray-200">

            {/* Enterprise Header */}
            <header className="sticky top-0 z-50 bg-[#020306]/95 backdrop-blur-3xl border-b border-emerald-900/30 px-6 py-5 flex flex-col md:flex-row justify-between items-center shadow-2xl gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-gradient-to-tr from-emerald-700 via-teal-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)] border border-emerald-400/30">
                        <Leaf className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                            Corporate ESG Tracking Hub
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-2.5 py-1 rounded-sm border border-emerald-500/40 font-black tracking-[0.2em] uppercase shadow-inner animate-pulse">SCOPE 3 LIVE</span>
                        </h1>
                        <p className="text-[11px] text-emerald-200/50 font-bold tracking-[0.1em] uppercase mt-1">Enterprise Carbon Accrual & Regulatory Compliance Matrix</p>
                    </div>
                </div>

                <button onClick={handleSeed} className="bg-black hover:bg-gray-900 border border-emerald-900 text-emerald-400 px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-3 shadow-lg hover:shadow-emerald-500/10">
                    <Database className="h-4 w-4" />
                    Cycle Sensor Net
                </button>
            </header>

            <div className="max-w-[1600px] mx-auto p-6 space-y-6">

                {/* KPI Data Blocks */}
                {projectionsData && projectionsData.baseline && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">

                        <div className="bg-[#0b1021] border border-gray-800/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden relative">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-gray-500/10 blur-[50px] rounded-full"></div>
                            <p className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-emerald-500" /> Total Base Emissions
                            </p>
                            <div>
                                <h3 className="text-5xl font-black text-white font-mono tracking-tighter">
                                    {(projectionsData.baseline.Total / 1000).toLocaleString()}<span className="text-lg text-emerald-500 ml-1">kT</span>
                                </h3>
                            </div>
                        </div>

                        <div className="bg-[#0b1021] border border-gray-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-rose-500/5 blur-[50px] rounded-full"></div>
                            <p className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                <Leaf className="h-4 w-4 text-rose-500" /> Supply Chain (Scope 3)
                            </p>
                            <h3 className="text-4xl font-black text-white font-mono flex items-end gap-2 mt-4">
                                {Math.floor((projectionsData.baseline.Scope3 / projectionsData.baseline.Total) * 100)}%
                                <span className="text-lg text-gray-600 mb-1">Vol</span>
                            </h3>

                            <div className="mt-6 bg-gray-950 h-2.5 rounded-full overflow-hidden border border-gray-800">
                                <div className="bg-rose-500 h-full" style={{ width: `${(projectionsData.baseline.Scope3 / projectionsData.baseline.Total) * 100}%` }}></div>
                            </div>
                        </div>

                        <div className="bg-[#0b1021] border border-gray-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                            <p className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                <Coins className="h-4 w-4 text-orange-400" /> Projected Global Tax
                            </p>
                            <h3 className="text-4xl font-black text-orange-400 font-mono">
                                ${departmentMatrix.length ? (departmentMatrix.reduce((a, c) => a + c.finesUSD, 0) / 1000000).toFixed(1) : 0}M
                            </h3>
                            <p className="text-[9px] font-black uppercase text-gray-600 tracking-widest bg-black/40 px-2 py-1 rounded inline-block border border-gray-900 w-max mt-2">Aggregate Fine Liability</p>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-950 to-[#051510] border border-emerald-500/40 rounded-3xl p-6 shadow-[0_10px_40px_rgba(16,185,129,0.1)]">
                            <p className="text-[11px] font-black uppercase text-emerald-300 tracking-[0.2em] mb-4">Science Based Target</p>
                            <h3 className="text-6xl font-black text-white font-mono tracking-tighter flex items-center gap-2">
                                1.5<span className="text-xl text-emerald-400 font-sans">&deg;C</span>
                            </h3>
                            <p className="text-[10px] text-emerald-200 mt-4 leading-relaxed font-bold tracking-wider opacity-80 uppercase">Decarbonization tracking aligned to Paris Agreement heuristics.</p>
                        </div>

                    </div>
                )}

                <CarbonFootprintRadar projections={projectionsData?.projections || []} matrix={departmentMatrix} />

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-10">
                    <div className="xl:col-span-2 relative z-10 w-full h-full">
                        <ESGComplianceMatrixTable matrix={departmentMatrix} />
                    </div>

                    <div className="xl:col-span-1 relative z-10 w-full h-full">
                        <EmissionsTimeline logs={logFeeds} />
                    </div>
                </div>

            </div>
        </div>
    );
}
