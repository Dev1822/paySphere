import React from 'react';
import { Bot, LineChart, MessageSquare, AlertCircle, Sparkles, TrendingDown } from 'lucide-react';

export default function DiversityInterventionTimeline() {

    const aiActions = [
        {
            id: 'AI-441-A',
            title: 'Talent Acquisition Re-route',
            desc: 'Engineering pipeline identified at 82% male concentration. Autonomous agent dynamically injected 4 diverse hiring forums into upstream sourcing ATS integrations.',
            date: '2026-08-10',
            impact: '+12% Pipeline Parity',
            status: 'active',
            icon: <Sparkles className="h-4 w-4 text-emerald-400" />
        },
        {
            id: 'AI-209-X',
            title: 'Psychological Safety Alert',
            desc: 'Q2 pulse surveys in Sales indicated a 15% drop in psychological safety for underrepresented minorities. Agent dispatched targeted anonymized pulse surveys and flagged executive review.',
            date: '2026-07-28',
            impact: 'Mitigation Started',
            status: 'review',
            icon: <AlertCircle className="h-4 w-4 text-orange-400" />
        },
        {
            id: 'AI-911-F',
            title: 'Bias Detection in Performance Reviews',
            desc: 'NLP engine scanned Q1 performance evaluations. Detected statistically significant variance (p < 0.05) in non-actionable feedback given to female employees vs male peers. HR trained.',
            date: '2026-06-15',
            impact: 'Bias Prevented',
            status: 'completed',
            icon: <Bot className="h-4 w-4 text-indigo-400" />
        },
        {
            id: 'AI-772-L',
            title: 'Pay Parity Compensation Adjustment',
            desc: 'Automated compensation audit detected an unexplained 4.5% gap in Product division. Budget equalized during merit cycle programmatically.',
            date: '2026-05-01',
            impact: '100% Equity Restored',
            status: 'completed',
            icon: <LineChart className="h-4 w-4 text-cyan-400" />
        },
        {
            id: 'AI-002-K',
            title: 'Micro-aggression Slack Monitor',
            desc: 'Sentiment analysis on enterprise communication channels indicated rising hostility in #ops-triage. Anonymous team health workshop triggered automatically.',
            date: '2026-04-12',
            impact: 'Toxicity Reduced',
            status: 'completed',
            icon: <MessageSquare className="h-4 w-4 text-rose-400" />
        }
    ];

    return (
        <div className="bg-[#0b1021] border border-indigo-900/30 rounded-3xl p-6 shadow-2xl flex flex-col h-[600px] relative overflow-hidden mt-6 mb-6">

            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full opacity-50"></div>

            <div className="relative z-10 flex justify-between items-center mb-6 border-b border-gray-800/80 pb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <Bot className="text-indigo-400 h-6 w-6" />
                    AI Intervention Audits
                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded uppercase tracking-[0.2em]">Autonomous</span>
                </h3>
                <span className="text-xs text-gray-500 font-bold font-mono bg-black/40 p-2 rounded">
                    {aiActions.length} System Actions Processed
                </span>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto pr-4 space-y-6 custom-scrollbar">
                {aiActions.map((action, idx) => (
                    <div key={action.id} className="relative group">
                        {idx !== aiActions.length - 1 && (
                            <div className="absolute left-[20px] top-10 bottom-[-30px] w-0.5 bg-gray-800/80 group-hover:bg-indigo-500/30 transition-colors z-0"></div>
                        )}

                        <div className="flex gap-4 relative z-10">
                            <div className={`h-10 w-10 shrink-0 rounded-xl bg-black border-2 border-gray-800 flex items-center justify-center transform transition-all shadow-lg
                     ${action.status === 'active' ? 'border-emerald-500/50 shadow-emerald-500/20' :
                                    action.status === 'review' ? 'border-orange-500/50' : 'border-gray-800'}
                   `}>
                                {action.icon}
                            </div>

                            <div className="flex-1 bg-black/30 border border-gray-800/60 p-5 rounded-2xl hover:bg-[#0f152b] transition-colors group-hover:border-indigo-500/30">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="text-gray-200 font-bold text-sm tracking-wide">{action.title}</h4>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 font-black">{action.id} &bull; {action.date}</p>
                                    </div>
                                    <div className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-lg border
                            ${action.status === 'active' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' :
                                            action.status === 'review' ? 'bg-orange-950/40 text-orange-400 border-orange-900/60' :
                                                'bg-indigo-950/20 text-indigo-400 border-indigo-900/30'
                                        }
                         `}>
                                        {action.impact}
                                    </div>
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed max-w-3xl mt-3">{action.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
