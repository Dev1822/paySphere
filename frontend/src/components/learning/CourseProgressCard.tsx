import React from 'react';
import { BookOpen, Clock, Star, Users, CheckCircle2, AlertTriangle, ArrowRight, GraduationCap, ShieldCheck } from 'lucide-react';

export interface CourseCardMetric {
  courseId: string; title: string; category: string; difficulty: string;
  durationHours: number; instructorName: string; totalEnrolled: number;
  totalCompleted: number; avgRating: number; totalModules: number;
  isMandatory: boolean; status: string;
}

interface Props { metric: CourseCardMetric; onInspect: () => void; }

function diffBadge(d: string) {
  const m: Record<string, { bg: string; text: string; border: string }> = {
    BEGINNER: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    INTERMEDIATE: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    ADVANCED: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    EXPERT: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  };
  return m[d] || m.BEGINNER;
}

export default function CourseProgressCard({ metric, onInspect }: Props) {
  const badge = diffBadge(metric.difficulty);
  const compRate = metric.totalEnrolled > 0 ? Math.round((metric.totalCompleted / metric.totalEnrolled) * 100) : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/20 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-300 transition leading-tight">{metric.title}</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{metric.instructorName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {metric.isMandatory && <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30 font-mono">REQ</span>}
            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold border font-mono ${badge.bg} ${badge.text} ${badge.border}`}>{metric.difficulty}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/70 mb-3 font-mono text-[11px]">
          <div><span className="text-slate-500 block text-[9px]">Enrolled</span><span className="text-white font-bold">{metric.totalEnrolled}</span></div>
          <div><span className="text-slate-500 block text-[9px]">Completed</span><span className="text-emerald-400 font-bold">{metric.totalCompleted}</span></div>
          <div><span className="text-slate-500 block text-[9px]">Modules</span><span className="text-slate-200 font-bold">{metric.totalModules}</span></div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400">Completion Rate</span>
            <span className="font-mono font-bold text-slate-200">{compRate}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${compRate}%` }} />
          </div>
        </div>

        <div className="space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</span>
            <span className="text-slate-200 font-semibold">{metric.durationHours}h</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> Rating</span>
            <span className="text-amber-400 font-semibold">{metric.avgRating}/5.0</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Category</span>
            <span className="text-emerald-400 font-semibold">{metric.category}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-mono">{metric.courseId}</span>
        <button onClick={onInspect} className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-emerald-500/30 transition flex items-center gap-1">
          Details <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
