import React from 'react';
import { Target, TrendingUp, CheckCircle2, AlertTriangle, ArrowRight, Zap, Clock, BarChart3 } from 'lucide-react';

export interface OKRMetric {
  objectiveId: string; employeeName: string; departmentName: string; title: string;
  quarter: string; status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED' | 'CANCELLED';
  overallProgress: number; keyResults: { title: string; progress: number; status: string; metric: string; currentValue: number; targetValue: number; unit: string }[];
  ownerName: string;
}

interface Props { metric: OKRMetric; onInspect: () => void; }

function statusBadge(s: string) {
  const m: Record<string, { bg: string; text: string; border: string; label: string }> = {
    ON_TRACK: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'On Track' },
    AT_RISK: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'At Risk' },
    BEHIND: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Behind' },
    COMPLETED: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Completed' },
    CANCELLED: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Cancelled' },
  };
  return m[s] || m.ON_TRACK;
}

export default function OKRObjectiveCard({ metric, onInspect }: Props) {
  const badge = statusBadge(metric.status);
  const barColor = metric.overallProgress >= 70 ? 'from-emerald-500 to-teal-400' : metric.overallProgress >= 40 ? 'from-amber-500 to-orange-400' : 'from-rose-500 to-pink-400';

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:shadow-blue-500/10 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/20 flex items-center justify-center">
              <Target className="w-4.5 h-4.5 text-blue-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition leading-tight">{metric.title}</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{metric.employeeName} • {metric.quarter}</p>
            </div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold border font-mono ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400">Overall Progress</span>
            <span className="font-mono font-bold text-slate-200">{metric.overallProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${barColor}`} style={{ width: `${metric.overallProgress}%` }} />
          </div>
        </div>

        {/* Key Results */}
        <div className="space-y-2 mb-3">
          {metric.keyResults.map((kr, i) => (
            <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/70">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-300 font-medium truncate">{kr.title}</span>
                <span className={`font-mono font-bold ${kr.progress >= 70 ? 'text-emerald-400' : kr.progress >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{kr.progress}%</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${kr.progress >= 70 ? 'bg-emerald-500' : kr.progress >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${kr.progress}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                <span>{kr.metric}</span>
                <span>{kr.currentValue}/{kr.targetValue} {kr.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-[10px] font-mono">
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Key Results</span>
            <span className="text-slate-200 font-semibold">{metric.keyResults.length}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Owner</span>
            <span className="text-blue-400 font-semibold">{metric.ownerName}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-mono">{metric.departmentName}</span>
        <button onClick={onInspect} className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-blue-500/30 transition flex items-center gap-1">
          Details <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
