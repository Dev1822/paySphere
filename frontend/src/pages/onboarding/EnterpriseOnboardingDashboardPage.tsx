import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  UserMinus,
  Users,
  TrendingUp,
  TrendingDown,
  Timer,
  ShieldCheck,
  Download,
  Search,
  PieChart,
  Activity,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Laptop,
  GraduationCap,
  FileText,
  Briefcase,
  XCircle,
} from 'lucide-react';
import OnboardingProgressCard, { OnboardingEmployeeMetric } from '../../components/onboarding/OnboardingProgressCard';
import OnboardingActivityTimeline from '../../components/onboarding/OnboardingActivityTimeline';

// ── Mock Data ───────────────────────────────────────────────────────────────

const ONBOARDING_METRICS: OnboardingEmployeeMetric[] = [
  {
    employeeId: 'emp-2001', employeeName: 'Alex Morgan', email: 'alex.morgan@paysphere.io', departmentCode: 'ENG', departmentName: 'Engineering',
    designation: 'Senior Software Engineer', startDateISO: '2026-08-12', managerName: 'Sarah Chen', buddyName: 'Marcus Thompson',
    location: 'HQ New York', totalTasks: 12, completedTasks: 8, pendingTasks: 3, blockedTasks: 1,
    overallProgress: 66.7, daysSinceJoining: 7, currentPhase: 'FIRST_WEEK',
    tasksByCategory: { DOCUMENTS: { total: 2, completed: 2 }, IT_PROVISIONING: { total: 3, completed: 3 }, TRAINING: { total: 3, completed: 1 }, COMPLIANCE: { total: 2, completed: 2 }, SOCIAL: { total: 1, completed: 0 }, MANAGER_CHECKIN: { total: 1, completed: 0 } },
  },
  {
    employeeId: 'emp-2002', employeeName: 'Jordan Lee', email: 'jordan.lee@paysphere.io', departmentCode: 'SALES', departmentName: 'Global Sales',
    designation: 'Enterprise Account Executive', startDateISO: '2026-08-08', managerName: 'Elena Vasquez', buddyName: 'David Kim',
    location: 'LA Office', totalTasks: 14, completedTasks: 9, pendingTasks: 4, blockedTasks: 1,
    overallProgress: 64.3, daysSinceJoining: 11, currentPhase: 'FIRST_MONTH',
    tasksByCategory: { DOCUMENTS: { total: 3, completed: 3 }, IT_PROVISIONING: { total: 4, completed: 2 }, TRAINING: { total: 4, completed: 3 }, COMPLIANCE: { total: 2, completed: 1 }, SOCIAL: { total: 1, completed: 0 } },
  },
  {
    employeeId: 'emp-2003', employeeName: 'Samira Khan', email: 'samira.khan@paysphere.io', departmentCode: 'FIN', departmentName: 'Finance & Accounting',
    designation: 'Financial Analyst', startDateISO: '2026-07-28', managerName: 'Priya Patel', buddyName: 'Aiko Tanaka',
    location: 'Tokyo Office', totalTasks: 10, completedTasks: 9, pendingTasks: 1, blockedTasks: 0,
    overallProgress: 90, daysSinceJoining: 22, currentPhase: 'FIRST_MONTH',
    tasksByCategory: { DOCUMENTS: { total: 2, completed: 2 }, IT_PROVISIONING: { total: 2, completed: 2 }, TRAINING: { total: 3, completed: 3 }, COMPLIANCE: { total: 2, completed: 1 }, MANAGER_CHECKIN: { total: 1, completed: 1 } },
  },
  {
    employeeId: 'emp-2004', employeeName: 'Liam O\'Brien', email: 'liam.obrien@paysphere.io', departmentCode: 'ENG', departmentName: 'Engineering',
    designation: 'DevOps Engineer', startDateISO: '2026-08-18', managerName: 'Fatima Al-Rashid', buddyName: 'Alex Morgan',
    location: 'Dubai Office', totalTasks: 11, completedTasks: 2, pendingTasks: 9, blockedTasks: 0,
    overallProgress: 18.2, daysSinceJoining: 1, currentPhase: 'DAY_ONE',
    tasksByCategory: { DOCUMENTS: { total: 3, completed: 1 }, IT_PROVISIONING: { total: 3, completed: 1 }, TRAINING: { total: 2, completed: 0 }, COMPLIANCE: { total: 2, completed: 0 }, SOCIAL: { total: 1, completed: 0 } },
  },
];

const DEPARTMENTS = ['All', 'ENG', 'SALES', 'FIN', 'OPS', 'HR'];
const PHASES = ['All', 'PRE_BOARDING', 'DAY_ONE', 'FIRST_WEEK', 'FIRST_MONTH', 'FIRST_QUARTER', 'GRADUATED'];

// ── Page ────────────────────────────────────────────────────────────────────

export default function EnterpriseOnboardingDashboardPage() {
  const [metrics, setMetrics] = useState<OnboardingEmployeeMetric[]>(ONBOARDING_METRICS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedPhase, setSelectedPhase] = useState('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');
  const [selectedEmployeeModal, setSelectedEmployeeModal] = useState<OnboardingEmployeeMetric | null>(null);

  // ── Aggregate KPIs ──────────────────────────────────────────────────────
  const totalActive = metrics.length;
  const totalTasksAll = metrics.reduce((s, m) => s + m.totalTasks, 0);
  const completedTasksAll = metrics.reduce((s, m) => s + m.completedTasks, 0);
  const blockedTasksAll = metrics.reduce((s, m) => s + m.blockedTasks, 0);
  const avgProgress = Math.round(metrics.reduce((s, m) => s + m.overallProgress, 0) / totalActive * 10) / 10;

  // ── Filtering ──────────────────────────────────────────────────────────
  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      const matchesSearch = m.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || m.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDepartment === 'All' || m.departmentCode === selectedDepartment;
      const matchesPhase = selectedPhase === 'All' || m.currentPhase === selectedPhase;
      return matchesSearch && matchesDept && matchesPhase;
    });
  }, [metrics, searchQuery, selectedDepartment, selectedPhase]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* ── Executive Header Banner ───────────────────────────────────── */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-violet-950 via-slate-900 to-purple-950 border border-violet-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-violet-500/20 text-violet-300 text-xs px-3 py-1 rounded-full font-semibold border border-violet-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Enterprise Suite
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-400" /> SOC-2 Type II Certified Pipeline
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-violet-200 bg-clip-text text-transparent">
              Employee Onboarding & Offboarding Lifecycle
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Track new hire progress from pre-boarding through graduation, manage IT provisioning, training compliance, and offboarding task orchestration across all facilities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-violet-600/30 transition flex items-center gap-2 border border-violet-400/20 text-sm">
              <Download className="w-4 h-4" /> Export Lifecycle Report
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ─────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* ── Top KPI Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Onboardings</span>
              <UserPlus className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{totalActive}</div>
            <div className="text-violet-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> {metrics.filter(m => m.daysSinceJoining <= 7).length} in first week
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Task Completion Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{Math.round((completedTasksAll / totalTasksAll) * 100)}%</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              {completedTasksAll} of {totalTasksAll} tasks completed
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Blocked Tasks</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{blockedTasksAll}</div>
            <div className={`text-xs mt-2 flex items-center gap-1 font-medium ${blockedTasksAll > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {blockedTasksAll > 0 ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {blockedTasksAll > 0 ? 'Requires immediate attention' : 'No blockers'}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Avg Progress</span>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{avgProgress}%</div>
            <div className="text-indigo-400 text-xs mt-2 flex items-center gap-1 font-medium">
              +12.5% from previous cohort
            </div>
          </div>
        </div>

        {/* ── Navigation Bar ──────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'overview' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <PieChart className="w-4 h-4" /> Employee Overview
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'timeline' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Lifecycle Events
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search employee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-violet-500 transition" />
            </div>
            <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:border-violet-500 transition">
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
            </select>
            <select value={selectedPhase} onChange={(e) => setSelectedPhase(e.target.value)}
              className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:border-violet-500 transition">
              {PHASES.map(p => <option key={p} value={p}>{p === 'All' ? 'All Phases' : p.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
        </div>

        {/* ── Tab Body ────────────────────────────────────────────────── */}
        {activeTab === 'timeline' ? (
          <OnboardingActivityTimeline />
        ) : (
          <>
            {filteredMetrics.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">No employees match your current filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMetrics.map((emp) => (
                  <OnboardingProgressCard key={emp.employeeId} metric={emp} onInspect={() => setSelectedEmployeeModal(emp)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Detail Modal ──────────────────────────────────────────────── */}
      {selectedEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedEmployeeModal(null)} className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold">×</button>

            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/30 border border-violet-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedEmployeeModal.employeeName}</h2>
                <div className="text-xs text-slate-400 font-mono">{selectedEmployeeModal.designation} • {selectedEmployeeModal.departmentName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div><span className="text-slate-500 block">Progress</span><span className="text-white font-bold text-sm">{selectedEmployeeModal.overallProgress}%</span></div>
              <div><span className="text-slate-500 block">Phase</span><span className="text-violet-400 font-bold text-sm">{selectedEmployeeModal.currentPhase.replace(/_/g, ' ')}</span></div>
              <div><span className="text-slate-500 block">Tasks Done</span><span className="text-emerald-400 font-bold text-sm">{selectedEmployeeModal.completedTasks} / {selectedEmployeeModal.totalTasks}</span></div>
              <div><span className="text-slate-500 block">Blocked</span><span className={`font-bold text-sm ${selectedEmployeeModal.blockedTasks > 0 ? 'text-rose-400' : 'text-slate-200'}`}>{selectedEmployeeModal.blockedTasks}</span></div>
              <div><span className="text-slate-500 block">Manager</span><span className="text-white font-bold text-sm">{selectedEmployeeModal.managerName}</span></div>
              <div><span className="text-slate-500 block">Buddy</span><span className="text-white font-bold text-sm">{selectedEmployeeModal.buddyName}</span></div>
              <div><span className="text-slate-500 block">Location</span><span className="text-white font-bold text-sm">{selectedEmployeeModal.location}</span></div>
              <div><span className="text-slate-500 block">Days Since Start</span><span className="text-indigo-400 font-bold text-sm">{selectedEmployeeModal.daysSinceJoining}d</span></div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setSelectedEmployeeModal(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close Audit View</button>
              <button className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-xs transition flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
