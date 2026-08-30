import { Coins, AlertOctagon, RefreshCw, BarChart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ESGTaxLiabilitiesChart() {
    // Static Monte-Carlo simulation mock data for tax scaling models
    const mockTaxData = [
        { year: 2026, baseTax: 50.2, highRiskPenalty: 5.4, subsidy: -12.4 },
        { year: 2027, baseTax: 62.1, highRiskPenalty: 14.1, subsidy: -15.8 },
        { year: 2028, baseTax: 78.5, highRiskPenalty: 28.5, subsidy: -22.1 },
        { year: 2029, baseTax: 105.4, highRiskPenalty: 45.2, subsidy: -30.5 },
        { year: 2030, baseTax: 140.8, highRiskPenalty: 72.8, subsidy: -45.0 },
        { year: 2031, baseTax: 185.0, highRiskPenalty: 120.4, subsidy: -65.2 },
    ];

    return (
        <div className="bg-[#0b1021] border border-orange-900/30 rounded-3xl p-6 shadow-2xl h-[550px] relative overflow-hidden flex flex-col mt-6 mb-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[90px] rounded-full pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-800/80 pb-4">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Coins className="text-orange-400 h-6 w-6" />
                        Algorithmic Carbon Tax Projections
                        <span className="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded font-black tracking-widest uppercase shadow-inner border border-orange-500/30 font-mono">
                            $USD (Millions)
                        </span>
                    </h3>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-black mt-1">
                        Monte-Carlo simulation mapping Cap & Trade penalty limits escalating globally across EU/CA regimes.
                    </p>
                </div>
                <div className="bg-orange-950/40 border border-orange-900/50 p-2 rounded-xl text-center shadow-inner flex flex-col min-w-[120px]">
                    <span className="text-[9px] uppercase font-black text-orange-300/80 tracking-widest">2030 Enterprise Liability</span>
                    <span className="text-2xl font-black font-mono text-white">$213.6<span className="text-sm font-sans text-orange-500">M</span></span>
                </div>
            </div>

            <div className="relative z-10 flex-1 w-full bg-[#050812] border border-gray-800/80 rounded-2xl p-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockTaxData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorPenalty" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorSubsidy" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#94a3b8', fontWeight: 'bold' }} />
                        <YAxis stroke="#475569" tick={{ fill: '#94a3b8' }} tickFormatter={v => `$${v}M`} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#f97316', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}
                        />
                        <Area type="monotone" name="Base Geopolitical Tax" dataKey="baseTax" stroke="#f97316" fill="url(#colorBase)" strokeWidth={3} />
                        <Area type="monotone" name="Cap Excess Penalty" dataKey="highRiskPenalty" stroke="#ef4444" fill="url(#colorPenalty)" strokeWidth={3} />
                        <Area type="monotone" name="Renewable Subsidies" dataKey="subsidy" stroke="#10b981" fill="url(#colorSubsidy)" strokeWidth={2} strokeDasharray="5 5" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

        </div>
    );
}
