import { useState, useEffect } from 'react';
import { diversityAPI } from '../../services/admin/diversityService';
import DiversityFunnelChart from '../../components/admin/DiversityFunnelChart';
import DemographicMatrixTable from '../../components/admin/DemographicMatrixTable';
import DiversityLeadershipRadar from '../../components/admin/DiversityLeadershipRadar';
import DiversityInterventionTimeline from '../../components/admin/DiversityInterventionTimeline';
import { Database, TrendingUp, Users, HeartHandshake, ShieldAlert, BadgeInfo } from 'lucide-react';

export default function DiversityPredictorPage() {
    const [loading, setLoading] = useState(true);

    const [projectionsData, setProjectionsData] = useState<any>(null);
    const [departmentMatrix, setDepartmentMatrix] = useState<any[]>([]);
    const [inclusionTrends, setInclusionTrends] = useState<any[]>([]);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const [projRes, matrixRes, incRes] = await Promise.all([
                diversityAPI.getProjections(),
                diversityAPI.getDepartmentMatrix(),
                diversityAPI.getInclusionTrends()
            ]);
            setProjectionsData(projRes.data);
            setDepartmentMatrix(matrixRes.data || []);
            setInclusionTrends(incRes.data || []);
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
        await diversityAPI.seedDemoData();
        fetchAssets();
    };

    return (
        <div className="min-h-screen bg-[#030612] text-gray-200">

            {/* Enterprise Header */}
            <header className="sticky top-0 z-50 bg-[#02040b]/90 backdrop-blur-3xl border-b border-indigo-900/40 px-6 py-5 flex flex-col md:flex-row justify-between items-center shadow-2xl gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-gradient-to-tr from-indigo-700 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] border border-indigo-400/30">
                        <HeartHandshake className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                            Global Inclusion Predictor
                            <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2.5 py-1 rounded-sm border border-indigo-500/40 font-black tracking-[0.2em] uppercase shadow-inner">NEURAL NET</span>
                        </h1>
                        <p className="text-xs text-indigo-200/60 font-semibold tracking-wide uppercase mt-1">Enterprise Representation Forecasting & Psychological Parity Model</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={handleSeed} className="bg-gradient-to-t from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 border border-gray-700 text-gray-300 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-3 shadow-lg hover:shadow-cyan-500/20 group">
                        <Database className="h-4 w-4 text-cyan-500 group-hover:rotate-12 transition-transform" />
                        Hydrate Datalake
                    </button>
                </div>
            </header>

            <div className="max-w-[1600px] mx-auto p-6 space-y-6">

                {/* KPI Strategic Ribbons */}
                {projectionsData && projectionsData.baseline && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                        <div className="bg-[#0b1021] border border-gray-800/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between group overflow-hidden relative">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 blur-[50px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                            <p className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                <Users className="h-4 w-4 text-indigo-400" /> Active Global Headcount
                            </p>
                            <div>
                                <h3 className="text-5xl font-black text-white font-mono tracking-tighter">
                                    {projectionsData.baseline.totalHeadcount.toLocaleString()}
                                </h3>
                                <p className="text-xs text-indigo-400 font-bold mt-2 bg-indigo-900/30 inline-block px-2 py-1 rounded">Net Baseline Evaluated</p>
                            </div>
                        </div>

                        <div className="bg-[#0b1021] border border-gray-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-pink-500/5 blur-[50px] rounded-full"></div>
                            <p className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                <BadgeInfo className="h-4 w-4 text-pink-500" /> Female Representation Baseline
                            </p>
                            <h3 className="text-4xl font-black text-white font-mono flex items-end gap-2 mt-4">
                                {projectionsData.baseline.femalePercentage}%
                                <span className="text-lg text-gray-600 mb-1">/ 50%</span>
                            </h3>

                            <div className="mt-6 bg-gray-950 h-2.5 rounded-full overflow-hidden border border-gray-800">
                                <div className="bg-pink-500 h-full transition-all duration-1000" style={{ width: `${projectionsData.baseline.femalePercentage}%` }}></div>
                            </div>
                        </div>

                        <div className="bg-[#0b1021] border border-gray-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/5 blur-[50px] rounded-full"></div>
                            <p className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-orange-400" /> Aggregated Attrition Heat
                            </p>

                            <div className="flex items-center gap-4 mt-4">
                                <div className="flex-1">
                                    <h3 className="text-4xl font-black text-orange-400 font-mono">
                                        {departmentMatrix.length ? Math.round(departmentMatrix.reduce((a, c) => a + c.attritionRisk, 0) / departmentMatrix.length) : 0}%
                                    </h3>
                                    <p className="text-[10px] font-black uppercase text-gray-600 tracking-widest mt-1">Cross-matrix Median</p>
                                </div>

                                <div className="h-16 w-16 bg-black border-[4px] border-orange-500/30 rounded-full flex items-center justify-center">
                                    <TrendingUp className="h-6 w-6 text-orange-500" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-900 to-[#101030] border border-indigo-500/40 rounded-3xl p-6 shadow-[0_10px_40px_rgba(99,102,241,0.2)]">
                            <p className="text-[11px] font-black uppercase text-indigo-300 tracking-[0.2em] mb-4">Total Neural Projections</p>
                            <h3 className="text-6xl font-black text-white font-mono tracking-tighter">
                                5 <span className="text-xl text-indigo-400">Yrs</span>
                            </h3>
                            <p className="text-xs text-indigo-200 mt-4 leading-relaxed font-medium">Forward looking disparity decay mapping utilizing organizational baseline vectors and ML pipelines.</p>
                        </div>

                    </div>
                )}

                {/* Dense Dashboard Graphics Mapping Module */}
                <DiversityFunnelChart projections={projectionsData?.projections || []} inclusionTrends={inclusionTrends} />

                {/* Detailed Enterprise Table Grid Module */}
                <DemographicMatrixTable matrix={departmentMatrix} />

            </div>
        </div>
    );
}
