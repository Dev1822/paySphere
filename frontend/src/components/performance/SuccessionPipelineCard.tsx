import React from 'react';
import { Users, AlertTriangle, TrendingUp, ArrowRight, ShieldCheck, ShieldAlert, User } from 'lucide-react';

export interface SuccessionPlanMetric {
  planId: string; positionTitle: string; departmentName: string; currentHolder: string;
  readinessLevel: string; totalCandidates: number;
  candidates: { name: string; currentRole: string; readinessLevel: string; potentialRating: number; performanceRating: number; riskOfLoss: string; impactOfLoss: string }[];
  lastUpdatedISO: string;
}

interface Props { metric: SuccessionPlanMetric; }

function readinessBadge(level: string) {
  const m: Record<string, { bg: string; text: string; border: string }> = {
    READY_NOW: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    READY_12M: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    READY_24M: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    DEVELOPING: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
    NOT_READY: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  };
  return m[level] || m.DEVELOPING;
}

function riskBadge(level: string) {
  if (level === 'HIGH') return 'text-rose-400';
  if (level === 'MEDIUM') return 'text-amber-400';
  return 'text-emerald-400';
}

export default function SuccessionPipelineCard({ metric }: Props) {
  const badge = readinessBadge(metric.readinessLevel);

  return (
    <div className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 backdrop-blur-md transition-all duration-300 group">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/15 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition">{metric.positionTitle}</h3>
            <p className="text-[10px] text-slate-500 font-mono">{metric.departmentName} • {metric.currentHolder}</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold border font-mono ${badge.bg} ${badge.text} ${badge.border}`}>{metric.readinessLevel.replace(/_/g, ' ')}</span>
      </div>

      <div className="space-y-3 mb-4">
        {metric.candidates.map((c, i) => (
          <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800/70">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <div>
                  <span className="text-[11px] font-bold text-slate-100">{c.name}</span>
                  <span className="text-[9px] text-slate-500 font-mono ml-1.5">{c.currentRole}</span>
                </div>
              </div>
              {readinessBadge(c.readinessLevel) && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${readinessBadge(c.readinessLevel).bg} ${readinessBadge(c.readinessLevel).text} ${readinessBadge(c.readinessLevel).border}`}>{c.readinessLevel.replace(/_/g, ' ')}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
              <div>
                <span className="text-slate-500 block">Potential</span>
                <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(n => <div key={n} className={`w-3 h-1.5 rounded-sm ${n <= c.potentialRating ? 'bg-blue-500' : 'bg-slate-800'}`} />)}</div>
              </div>
              <div>
                <span className="text-slate-500 block">Performance</span>
                <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(n => <div key={n} className={`w-3 h-1.5 rounded-sm ${n <= c.performanceRating ? 'bg-emerald-500' : 'bg-slate-800'}`} />)}</div>
              </div>
              <div><span className="text-slate-500">Risk of Loss</span><span className={`block font-bold ${riskBadge(c.riskOfLoss)}`}>{c.riskOfLoss}</span></div>
              <div><span className="text-slate-500">Impact of Loss</span><span className={`block font-bold ${riskBadge(c.impactOfLoss)}`}>{c.impactOfLoss}</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-3 border-t border-slate-800/70 text-[10px] font-mono">
        <span className="text-slate-500">{metric.totalCandidates} candidate{metric.totalCandidates !== 1 ? 's' : ''}</span>
        <span className="text-slate-500">Updated: {metric.lastUpdatedISO}</span>
      </div>
    </div>
  );
}
