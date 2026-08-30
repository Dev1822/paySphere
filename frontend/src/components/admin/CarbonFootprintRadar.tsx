import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Leaf, Activity } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
    projections: any[];
    matrix: any[];
}

export default function CarbonFootprintRadar({ projections, matrix }: Props) {

    const radarData = useMemo(() => {
        return matrix.map(m => ({
            subject: m.region,
            Renewable: m.renewablePct,
            Waste: m.wasteDiverted,
            Governance: m.governanceScore,
            fullMark: 100
        }));
    }, [matrix]);

    if (!projections || projections.length === 0) {
        return <div className="animate-pulse bg-emerald-900 border border-emerald-800 rounded-3xl h-[450px] w-full"></div>;
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full mb-6 relative z-10">

            {/* 5-Year Carbon Decarbonization Trajectory */}
            <div className="bg-gradient-to-br from-black via-[#0a0a09] to-emerald-950/20 rounded-3xl border border-emerald-900/30 p-6 shadow-2xl relative overflow-hidden group h-[420px] flex flex-col">

                <div className="absolute top-0 right-1/2 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>

                <div className="mb-4 relative z-10">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Leaf className="text-emerald-400 h-6 w-6" />
                        GHC Net-Zero Decarbonization Array
                    </h3>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.1em] mt-1 pl-9">
                        5-Year Scope 1-3 ML Projection Curve vs SBTi Constraints
                    </p>
                </div>

                <div className="flex-1 w-full bg-black/80 p-4 border border-gray-800/80 rounded-2xl shadow-inner relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={projections} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="cScope3" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.7} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="cScope12" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.7} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="cSBTi" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                            <XAxis dataKey="year" stroke="#4b5563" tick={{ fill: '#a1a1aa', fontWeight: 'bold', fontSize: 11 }} />
                            <YAxis yAxisId="left" stroke="#4b5563" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#09090b', borderColor: '#10b981', borderRadius: '12px' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
                                labelStyle={{ color: '#a1a1aa' }}
                                formatter={(value) => `${(value as number).toLocaleString()} tCO2e`}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa' }} />
                            <Area yAxisId="left" type="monotone" name="Scope 3" dataKey="Scope3" stroke="#f43f5e" fill="url(#cScope3)" strokeWidth={2} stackId="1" />
                            <Area yAxisId="left" type="monotone" name="Scope 1 & 2" dataKey="Scope1" stroke="#f59e0b" fill="url(#cScope12)" strokeWidth={2} stackId="1" />
                            <Area yAxisId="left" type="monotone" name="SBTi Target" dataKey="NetZeroTarget" stroke="#10b981" fill="url(#cSBTi)" strokeWidth={3} strokeDasharray="5 5" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Cross-Regional Compliance Radar */}
            <div className="bg-[#050508] border border-cyan-900/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col h-[420px]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] rounded-full"></div>

                <div className="mb-4 relative z-10">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Activity className="text-cyan-400 h-6 w-6" />
                        Global Telemetry Vectors
                    </h3>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.1em] mt-1 pl-9">
                        Regulatory performance mapping across geographic nodes
                    </p>
                </div>

                <div className="flex-1 relative z-10 w-full bg-black/50 border border-gray-800/80 rounded-2xl p-2 shadow-inner">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="#27272a" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 10 }} />
                            <Radar name="Renewable Adoption" dataKey="Renewable" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                            <Radar name="Waste Diverted" dataKey="Waste" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                            <Radar name="Governance Index" dataKey="Governance" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
