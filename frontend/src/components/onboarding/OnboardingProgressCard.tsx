import React from 'react';
import {
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FileText,
  Laptop,
  GraduationCap,
  Users,
  Calendar,
  Briefcase,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface OnboardingEmployeeMetric {
  employeeId: string;
  employeeName: string;
  email: string;
  departmentCode: string;
  departmentName: string;
  designation: string;
  startDateISO: string;
  managerName: string;
  buddyName: string;
  location: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  overallProgress: number;
  daysSinceJoining: number;
  currentPhase: 'PRE_BOARDING' | 'DAY_ONE' | 'FIRST_WEEK' | 'FIRST_MONTH' | 'FIRST_QUARTER' | 'GRADUATED';
  tasksByCategory: Record<string, { total: number; completed: number }>;
}

interface OnboardingProgressCardProps {
  metric: OnboardingEmployeeMetric;
  onInspect: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function phaseBadge(phase: OnboardingEmployeeMetric['currentPhase']) {
  switch (phase) {
    case 'PRE_BOARDING': return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Pre-Boarding' };
    case 'DAY_ONE': return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Day One' };
    case 'FIRST_WEEK': return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', label: 'First Week' };
    case 'FIRST_MONTH': return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', label: 'First Month' };
    case 'FIRST_QUARTER': return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'First Quarter' };
    case 'GRADUATED': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Graduated ✓' };
    default: return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: phase };
  }
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  DOCUMENTS: FileText,
  IT_PROVISIONING: Laptop,
  TRAINING: GraduationCap,
  COMPLIANCE: ShieldCheck,
  SOCIAL: Users,
  MANAGER_CHECKIN: Calendar,
};

const CATEGORY_LABELS: Record<string, string> = {
  DOCUMENTS: 'Docs',
  IT_PROVISIONING: 'IT Setup',
  TRAINING: 'Training',
  COMPLIANCE: 'Compliance',
  SOCIAL: 'Social',
  MANAGER_CHECKIN: 'Check-ins',
};

// ── Component ───────────────────────────────────────────────────────────────

export default function OnboardingProgressCard({ metric, onInspect }: OnboardingProgressCardProps) {
  const badge = phaseBadge(metric.currentPhase);
  const progressWidth = Math.min(100, metric.overallProgress);
  const hasBlocked = metric.blockedTasks > 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-violet-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-violet-500/10 flex flex-col justify-between group">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/30 border border-violet-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-violet-300 transition leading-tight">
                {metric.employeeName}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {metric.designation} • {metric.departmentName}
              </p>
            </div>
          </div>

          <span className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border font-mono ${badge.bg} ${badge.text} ${badge.border}`}>
            {badge.label}
          </span>
        </div>

        {/* ── Progress Bar ──────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 font-medium">Onboarding Progress</span>
            <span className="font-mono font-bold text-slate-200">{metric.overallProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                metric.overallProgress >= 80
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : metric.overallProgress >= 50
                  ? 'bg-gradient-to-r from-violet-500 to-indigo-400'
                  : 'bg-gradient-to-r from-amber-500 to-orange-400'
              }`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>

        {/* ── Task Summary Grid ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 mb-4 font-mono text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Completed</span>
            <span className="text-emerald-400 font-bold text-sm flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {metric.completedTasks} / {metric.totalTasks}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Pending</span>
            <span className="text-amber-400 font-bold text-sm flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5" /> {metric.pendingTasks}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Days Since Start</span>
            <span className="text-indigo-400 font-bold text-sm mt-0.5 block">{metric.daysSinceJoining}d</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Location</span>
            <span className="text-slate-200 font-bold text-sm mt-0.5 block">{metric.location}</span>
          </div>
        </div>

        {/* ── Category Breakdown ───────────────────────────────────── */}
        <div className="space-y-2 text-xs mb-5 font-mono">
          {Object.entries(metric.tasksByCategory).map(([cat, counts]) => {
            const Icon = CATEGORY_ICONS[cat] || FileText;
            const pct = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
            return (
              <div key={cat} className="flex justify-between text-slate-400 items-center">
                <span className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" /> {CATEGORY_LABELS[cat] || cat}
                </span>
                <span className={`font-semibold ${pct === 100 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {counts.completed}/{counts.total}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between pt-2 border-t border-slate-800 text-slate-200 font-bold">
            <span>Manager / Buddy</span>
            <span className="text-violet-400 text-[11px]">{metric.managerName} / {metric.buddyName}</span>
          </div>
        </div>

        {/* ── Blocked Alert ──────────────────────────────────────────── */}
        {hasBlocked && (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-xs text-rose-300 font-medium">
              {metric.blockedTasks} task{metric.blockedTasks > 1 ? 's' : ''} blocked — requires attention
            </p>
          </div>
        )}
      </div>

      {/* ── Footer Action ─────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="text-[11px] text-slate-400 font-mono">
          Start: <span className="text-slate-200">{metric.startDateISO}</span>
        </div>
        <button
          onClick={onInspect}
          className="bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-violet-500/30 transition flex items-center gap-1"
        >
          <span>Full Audit</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
