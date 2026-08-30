import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Target, Flag, Shield, Activity } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
    matrix: any[];
}

export default function DiversityLeadershipRadar({ matrix }: Props) {

    const radarData = useMemo(() => {
        return matrix.slice(0, 6).map(m => ({
            subject: m.department,
            Female: m.leadershipFemalePct,
            URM: m.leadershipUrmPct,
            Safety: m.inclusionScore,
            fullMark: 100
        }));
    }, [matrix]);

    const scatterData = useMemo(() => {
        return matrix.map(m => ({
            name: m.department,
            Safety: m.inclusionScore,
            Risk: m.attritionRisk,
            Size: m.totalHeadcount
        }));
    }, [matrix]);

    if (!matrix || matrix.length === 0) return null;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full mb-6">

            {/* Radar Vector Component */}
            <div className="bg-[#050614] border border-cyan-900/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col h-[400px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[60px] rounded-full"></div>

                <h3 className="text-lg font-bold text-white flex items-center gap-3 relative z-10 mb-2">
                    <Target className="text-cyan-400 h-5 w-5" />
                    Leadership Equity Footprint (Top 6 Divisions)
                </h3>
                <p className="text-xs text-gray-400 mb-4 max-w-md">Multi-dimensional scoring of director-level and above diversity saturation vs psychological safety.</p>

                <div className="flex-1 relative z-10 w-full bg-black/40 border border-gray-800/80 rounded-2xl p-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="#1e293b" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569' }} />
                            <Radar name="Female Representation (Lead)" dataKey="Female" stroke="#ec4899" fill="#ec4899" fillOpacity={0.2} />
                            <Radar name="Underrepresented (Lead)" dataKey="URM" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                            <Radar name="Safety Index" dataKey="Safety" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Attrition/Safety Scatter Matrix */}
            <div className="bg-[#050614] border border-rose-900/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col h-[400px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px] rounded-full"></div>

                <h3 className="text-lg font-bold text-white flex items-center gap-3 relative z-10 mb-2">
                    <Activity className="text-rose-400 h-5 w-5" />
                    Climatology Risk Intersections
                </h3>
                <p className="text-xs text-gray-400 mb-4 max-w-md">Plotting departmental inclusion scores iteratively against observed voluntary attrition velocity.</p>

                <div className="flex-1 relative z-10 w-full bg-black/40 border border-gray-800/80 rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis type="number" dataKey="Safety" name="Safety Score" domain={[40, 100]} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }}>
                                <Label value="Safety Index" offset={-10} position="insideBottom" fill="#64748b" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }} />
                            </XAxis>
                            <YAxis type="number" dataKey="Risk" name="Attrition Risk" domain={[0, 40]} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}%`}>
                                <Label value="Attrition %" angle={-90} offset={20} position="insideLeft" fill="#64748b" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }} />
                            </YAxis>
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#e11d48', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                            />
                            <Scatter name="Department" data={scatterData} fill="#f43f5e">
                                {scatterData.map((entry, index) => (
                                    <cell key={`cell-${index}`} fill={entry.Safety < 70 ? '#ef4444' : entry.Safety > 80 ? '#10b981' : '#f59e0b'} opacity={0.7} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
