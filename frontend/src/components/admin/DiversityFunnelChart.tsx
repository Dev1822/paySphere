import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { Target, Users, TrendingUp } from 'lucide-react';

interface Props {
    projections: any[];
    inclusionTrends: any[];
}

export default function DiversityFunnelChart({ projections, inclusionTrends }: Props) {

    if (!projections || projections.length === 0) {
        return <div className="animate-pulse bg-gray-900 border border-gray-800 rounded-3xl h-[450px]"></div>;
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">

            {/* 5-Year Predictive Area Mapping (Machine Learning) */}
            <div className="bg-gradient-to-br from-indigo-950/20 via-black to-[#050510] backdrop-blur-3xl rounded-3xl border border-indigo-900/50 p-6 shadow-2xl relative overflow-hidden group">

                <div className="absolute top-0 right-1/2 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform pointer-events-none"></div>

                <div className="mb-6 relative z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Target className="text-indigo-400 h-6 w-6" />
                        Machine Learning Parity Projection
                    </h3>
                    <p className="text-sm text-gray-400 mt-1 pl-9">
                        5-year autonomous drift analysis mapping expected gender representation shifts across structural pipelines.
                    </p>
                </div>

                <div className="h-[320px] w-full bg-black/60 p-4 border border-gray-800 rounded-2xl shadow-inner relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={projections} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorMale" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="colorFemale" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f472b6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#f472b6" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="colorNB" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="year" stroke="#4b5563" tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                            <YAxis yAxisId="left" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111827', borderColor: '#4f46e5', borderRadius: '12px' }}
                                itemStyle={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend iconType="circle" />
                            <Area yAxisId="left" type="monotone" name="Male (%)" dataKey="malePercentage" stroke="#818cf8" fill="url(#colorMale)" strokeWidth={3} />
                            <Area yAxisId="left" type="monotone" name="Female (%)" dataKey="femalePercentage" stroke="#f472b6" fill="url(#colorFemale)" strokeWidth={3} />
                            <Area yAxisId="left" type="monotone" name="Non-Binary (%)" dataKey="nbPercentage" stroke="#34d399" fill="url(#colorNB)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Psychological Safety & Belonging Trends */}
            <div className="bg-gradient-to-bl from-pink-950/20 via-black to-slate-900 rounded-3xl border border-pink-900/30 p-6 shadow-2xl relative overflow-hidden group">

                <div className="absolute bottom-0 right-0 w-64 h-64 bg-pink-500/10 blur-[100px] rounded-full translate-x-1/4 translate-y-1/4 pointer-events-none group-hover:bg-pink-500/20 transition-colors"></div>

                <div className="mb-6 relative z-10 flex justify-between items-end">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            <TrendingUp className="text-pink-400 h-6 w-6" />
                            Inclusive Climate Diagnostics
                        </h3>
                        <p className="text-sm text-gray-400 mt-1 pl-9">
                            Historical survey aggregates measuring psychological safety, voice validation, and structural fairness vectors.
                        </p>
                    </div>

                    <div className="bg-pink-900/30 border border-pink-500/50 p-2 rounded-xl text-center shadow-inner">
                        <p className="text-[10px] text-pink-300 font-extrabold uppercase tracking-widest">Q4 Projection</p>
                        <p className="text-2xl font-black text-white font-mono">84<span className="text-sm text-pink-500">Idx</span></p>
                    </div>
                </div>

                <div className="h-[320px] w-full bg-black/60 p-4 border border-gray-800 rounded-2xl shadow-inner relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={inclusionTrends} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" horizontal vertical={false} />
                            <XAxis dataKey="quarter" stroke="#4a5568" tick={{ fill: '#a0aec0', fontSize: 11, fontWeight: 'bold' }} />
                            <YAxis stroke="#4a5568" tick={{ fill: '#a0aec0', fontSize: 11 }} domain={[40, 100]} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#171923', borderColor: '#d53f8c', borderRadius: '12px' }}
                                itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                            />
                            <Legend iconType="plainline" />
                            <Line type="monotone" name="Belonging Score" dataKey="belonging" stroke="#f687b3" strokeWidth={4} activeDot={{ r: 8 }} />
                            <Line type="monotone" name="Procedural Fairness" dataKey="fairness" stroke="#b794f4" strokeWidth={4} />
                            <Line type="monotone" name="Voice & Recognition" dataKey="voice" stroke="#4fd1c5" strokeWidth={4} strokeDasharray="5 5" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
