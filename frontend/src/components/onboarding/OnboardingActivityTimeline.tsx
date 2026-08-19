import React from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  FileText,
  Laptop,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  Briefcase,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string;
  employeeName: string;
  employeeId: string;
  departmentName: string;
  action: 'TASK_COMPLETED' | 'TASK_BLOCKED' | 'DOCUMENT_SUBMITTED' | 'IT_PROVISIONED' | 'TRAINING_STARTED' | 'MANAGER_CHECKIN' | 'OFFBOARD_INITIATED';
  taskName: string;
  category: string;
  timestamp: string;
  notes: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const TIMELINE_ENTRIES: TimelineEntry[] = [
  { id: 'tl-001', employeeName: 'Alex Morgan', employeeId: 'emp-2001', departmentName: 'Engineering', action: 'TASK_COMPLETED', taskName: 'NDA & IP Assignment signed via DocuSign', category: 'COMPLIANCE', timestamp: '10 mins ago', notes: 'Digitally signed — verified by Legal Team' },
  { id: 'tl-002', employeeName: 'Jordan Lee', employeeId: 'emp-2002', departmentName: 'Global Sales', action: 'TASK_BLOCKED', taskName: 'CRM Access Setup — awaiting territory approval', category: 'IT_PROVISIONING', timestamp: '2 hours ago', notes: 'Waiting for territory manager approval on EMEA region' },
  { id: 'tl-003', employeeName: 'Alex Morgan', employeeId: 'emp-2001', departmentName: 'Engineering', action: 'DOCUMENT_SUBMITTED', taskName: 'Government ID uploaded and verified', category: 'DOCUMENTS', timestamp: '1 day ago', notes: 'Passport + I-9 form verified by HR' },
  { id: 'tl-004', employeeName: 'Alex Morgan', employeeId: 'emp-2001', departmentName: 'Engineering', action: 'IT_PROVISIONED', taskName: 'MacBook Pro 16" M4 Max configured', category: 'IT_PROVISIONING', timestamp: '2 days ago', notes: 'VS Code, Docker, Figma pre-installed' },
  { id: 'tl-005', employeeName: 'Samira Khan', employeeId: 'emp-2003', departmentName: 'Finance & Accounting', action: 'TRAINING_STARTED', taskName: 'Security Awareness Training initiated', category: 'TRAINING', timestamp: '3 days ago', notes: 'Modules 1-3 completed, 60% progress' },
  { id: 'tl-006', employeeName: 'Chris Walker', employeeId: 'emp-1050', departmentName: 'Engineering', action: 'OFFBOARD_INITIATED', taskName: 'Offboarding process initiated — LWD Aug 30', category: 'OFFBOARDING', timestamp: '5 days ago', notes: 'Voluntary departure — 5 tasks created' },
  { id: 'tl-007', employeeName: 'Nina Petrova', employeeId: 'emp-1051', departmentName: 'Corporate Operations', action: 'TASK_COMPLETED', taskName: 'Badge & keys returned', category: 'ASSET_RETURN', timestamp: '1 week ago', notes: 'Badge #B-4521 returned, desk key returned' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function actionConfig(action: TimelineEntry['action']) {
  switch (action) {
    case 'TASK_COMPLETED': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2, label: 'Completed' };
    case 'TASK_BLOCKED': return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: AlertTriangle, label: 'Blocked' };
    case 'DOCUMENT_SUBMITTED': return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: FileText, label: 'Document' };
    case 'IT_PROVISIONED': return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', icon: Laptop, label: 'IT Provisioned' };
    case 'TRAINING_STARTED': return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: GraduationCap, label: 'Training' };
    case 'MANAGER_CHECKIN': return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: User, label: 'Check-in' };
    case 'OFFBOARD_INITIATED': return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', icon: Briefcase, label: 'Offboarding' };
    default: return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', icon: Activity, label: 'Event' };
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function OnboardingActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" /> Onboarding & Offboarding Lifecycle Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            Document submissions, IT provisioning status, training progress, and offboarding events in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-violet-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-violet-400" /> Lifecycle Events
        </div>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/30 via-slate-800 to-transparent" />

        <div className="space-y-5">
          {TIMELINE_ENTRIES.map((entry) => {
            const cfg = actionConfig(entry.action);
            const ActionIcon = cfg.icon;

            return (
              <div key={entry.id} className="relative pl-12">
                {/* Dot on timeline */}
                <div className={`absolute left-3 top-5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  entry.action === 'TASK_BLOCKED'
                    ? 'bg-rose-500/20 border-rose-500'
                    : entry.action === 'TASK_COMPLETED'
                    ? 'bg-emerald-500/20 border-emerald-500'
                    : 'bg-slate-500/20 border-slate-600'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    entry.action === 'TASK_BLOCKED' ? 'bg-rose-400'
                    : entry.action === 'TASK_COMPLETED' ? 'bg-emerald-400'
                    : 'bg-slate-400'
                  }`} />
                </div>

                {/* Card */}
                <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-violet-500/30 transition-all">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-300" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-100">{entry.employeeName}</span>
                        <span className="text-[11px] text-slate-500 font-mono ml-2">{entry.employeeId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border font-mono flex items-center gap-1 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <ActionIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">{entry.timestamp}</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-100 mb-2">{entry.taskName}</h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px]">Department</span>
                      <span className="text-slate-200 font-semibold">{entry.departmentName}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px]">Category</span>
                      <span className="text-violet-400 font-semibold">{entry.category}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60 sm:col-span-1 col-span-2">
                      <span className="text-slate-500 block text-[10px]">Notes</span>
                      <span className="text-slate-300 font-medium">{entry.notes}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
