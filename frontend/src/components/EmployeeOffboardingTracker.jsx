import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

/* ─────────────────────── MOCK DATA ─────────────────────── */
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Design', 'Operations', 'Legal'];

const EXIT_TYPES = ['Resignation', 'Termination', 'Retirement', 'End of Contract', 'Mutual Separation'];
const STATUSES = ['Initiated', 'In Progress', 'Clearance Pending', 'Settlement Pending', 'Completed', 'Cancelled'];

const MOCK_PROCESSES = [
  { id: 1, employeeName: 'Amit Deshpande', department: 'Engineering', role: 'Senior Backend Dev', exitType: 'Resignation', status: 'In Progress', lastWorkingDay: '2026-09-15', noticePeriodDays: 60, noticePeriodStatus: 'Serving', resignationDate: '2026-07-17', leavingReason: 'Better opportunity', clearancePct: 65, assetsPending: 2, ktPending: 3, exitInterviewDone: false, settlementEstimate: 285000 },
  { id: 2, employeeName: 'Sneha Kulkarni', department: 'Marketing', role: 'Content Lead', exitType: 'Resignation', status: 'Clearance Pending', lastWorkingDay: '2026-09-01', noticePeriodDays: 30, noticePeriodStatus: 'Completed', resignationDate: '2026-08-02', leavingReason: 'Relocation', clearancePct: 88, assetsPending: 1, ktPending: 0, exitInterviewDone: true, settlementEstimate: 142000 },
  { id: 3, employeeName: 'Ravi Shankar', department: 'Sales', role: 'Regional Head', exitType: 'Termination', status: 'Settlement Pending', lastWorkingDay: '2026-08-28', noticePeriodDays: 0, noticePeriodStatus: 'Waived', resignationDate: null, leavingReason: 'Performance', clearancePct: 100, assetsPending: 0, ktPending: 0, exitInterviewDone: true, settlementEstimate: 520000 },
  { id: 4, employeeName: 'Pooja Iyer', department: 'Finance', role: 'Senior Analyst', exitType: 'Retirement', status: 'Completed', lastWorkingDay: '2026-08-15', noticePeriodDays: 90, noticePeriodStatus: 'Completed', resignationDate: null, leavingReason: 'Voluntary retirement', clearancePct: 100, assetsPending: 0, ktPending: 0, exitInterviewDone: true, settlementEstimate: 1250000 },
  { id: 5, employeeName: 'Karan Malhotra', department: 'Design', role: 'UI Designer', exitType: 'Resignation', status: 'Initiated', lastWorkingDay: '2026-10-01', noticePeriodDays: 30, noticePeriodStatus: 'Serving', resignationDate: '2026-09-01', leavingReason: 'Career change', clearancePct: 15, assetsPending: 4, ktPending: 5, exitInterviewDone: false, settlementEstimate: 95000 },
  { id: 6, employeeName: 'Nisha Agarwal', department: 'HR', role: 'HR Executive', exitType: 'End of Contract', status: 'In Progress', lastWorkingDay: '2026-09-30', noticePeriodDays: 15, noticePeriodStatus: 'Serving', resignationDate: null, leavingReason: 'Contract ended', clearancePct: 40, assetsPending: 2, ktPending: 2, exitInterviewDone: false, settlementEstimate: 178000 },
  { id: 7, employeeName: 'Sanjay Gupta', department: 'Operations', role: 'Ops Manager', exitType: 'Resignation', status: 'Cancelled', lastWorkingDay: '2026-09-10', noticePeriodDays: 30, noticePeriodStatus: 'Revoked', resignationDate: '2026-08-01', leavingReason: 'Counter-offer accepted', clearancePct: 20, assetsPending: 0, ktPending: 0, exitInterviewDone: false, settlementEstimate: 0 },
  { id: 8, employeeName: 'Meera Joshi', department: 'Engineering', role: 'QA Lead', exitType: 'Resignation', status: 'Clearance Pending', lastWorkingDay: '2026-09-05', noticePeriodDays: 30, noticePeriodStatus: 'Completed', resignationDate: '2026-08-06', leavingReason: 'Personal reasons', clearancePct: 92, assetsPending: 0, ktPending: 1, exitInterviewDone: true, settlementEstimate: 310000 },
];

const MOCK_CHECKLISTS = {
  1: [
    { id: 1, category: 'IT', title: 'Revoke VPN access', done: true, assignedTo: 'Rajesh (IT)' },
    { id: 2, category: 'IT', title: 'Return laptop & peripherals', done: false, assignedTo: 'Rajesh (IT)' },
    { id: 3, category: 'Finance', title: 'Clear outstanding advances', done: true, assignedTo: 'Priya (Finance)' },
    { id: 4, category: 'HR', title: 'Exit interview scheduled', done: false, assignedTo: 'Neha (HR)' },
    { id: 5, category: 'Facilities', title: 'Return access card', done: false, assignedTo: 'Karthik (Facilities)' },
    { id: 6, category: 'Manager', title: 'Knowledge transfer plan', done: true, assignedTo: 'Arjun (Manager)' },
    { id: 7, category: 'IT', title: 'Revoke email access', done: false, assignedTo: 'Rajesh (IT)' },
    { id: 8, category: 'HR', title: 'Collect relieving letter', done: false, assignedTo: 'Neha (HR)' },
  ],
  2: [
    { id: 1, category: 'IT', title: 'Revoke all system access', done: true, assignedTo: 'Rajesh (IT)' },
    { id: 2, category: 'Finance', title: 'Final PTO settlement', done: true, assignedTo: 'Priya (Finance)' },
    { id: 3, category: 'HR', title: 'Exit interview', done: true, assignedTo: 'Neha (HR)' },
    { id: 4, category: 'Facilities', title: 'Return parking pass', done: false, assignedTo: 'Karthik (Facilities)' },
  ],
  3: [
    { id: 1, category: 'IT', title: 'Revoke all access', done: true, assignedTo: 'Rajesh (IT)' },
    { id: 2, category: 'Finance', title: 'Process final settlement', done: true, assignedTo: 'Priya (Finance)' },
  ],
  5: [
    { id: 1, category: 'IT', title: 'Laptop handover', done: false, assignedTo: 'Rajesh (IT)' },
    { id: 2, category: 'IT', title: 'Code repository transfer', done: false, assignedTo: 'Rajesh (IT)' },
    { id: 3, category: 'Manager', title: 'Project documentation', done: false, assignedTo: 'Arjun (Manager)' },
  ],
};

const MOCK_ASSETS = {
  1: [
    { id: 1, type: 'Laptop', description: 'MacBook Pro 14"', tag: 'IT-0089', status: 'Pending' },
    { id: 2, type: 'Monitor', description: 'Dell 27" 4K', tag: 'IT-0142', status: 'Returned' },
    { id: 3, type: 'Access Card', description: 'Building access', tag: 'FC-0201', status: 'Pending' },
  ],
  2: [
    { id: 1, type: 'Laptop', description: 'ThinkPad X1', tag: 'IT-0055', status: 'Returned' },
  ],
  5: [
    { id: 1, type: 'Laptop', description: 'MacBook Air M2', tag: 'IT-0103', status: 'Pending' },
    { id: 2, type: 'Design Tablet', description: 'Wacom Intuos Pro', tag: 'IT-0211', status: 'Pending' },
    { id: 3, type: 'Monitor', description: 'LG UltraWide 34"', tag: 'IT-0178', status: 'Pending' },
    { id: 4, type: 'Keyboard', description: 'Keychron Q1', tag: 'IT-0233', status: 'Pending' },
  ],
};

const MOCK_KT = {
  1: [
    { id: 1, topic: 'Payment Gateway Integration', transferTo: 'Ishita Banerjee', status: 'In Progress', progress: 60 },
    { id: 2, topic: 'Redis Caching Layer', transferTo: 'Aditya Kumar', status: 'Pending', progress: 10 },
    { id: 3, topic: 'BullMQ Job Workers', transferTo: 'Ishita Banerjee', status: 'Pending', progress: 0 },
  ],
  5: [
    { id: 1, topic: 'Design System Components', transferTo: 'Meera Iyer', status: 'Pending', progress: 0 },
    { id: 2, topic: 'Brand Guidelines', transferTo: 'Meera Iyer', status: 'Pending', progress: 0 },
  ],
};

const ATTRITION_TRENDS = [
  { month: 'Mar', resignations: 3, terminations: 0, retirements: 1, total: 4 },
  { month: 'Apr', resignations: 2, terminations: 1, retirements: 0, total: 3 },
  { month: 'May', resignations: 5, terminations: 0, retirements: 0, total: 5 },
  { month: 'Jun', resignations: 2, terminations: 1, retirements: 0, total: 3 },
  { month: 'Jul', resignations: 4, terminations: 0, retirements: 1, total: 5 },
  { month: 'Aug', resignations: 3, terminations: 1, retirements: 0, total: 4 },
];

const LEAVING_REASONS = [
  { reason: 'Better opportunity', count: 12, pct: 35 },
  { reason: 'Relocation', count: 5, pct: 15 },
  { reason: 'Career change', count: 4, pct: 12 },
  { reason: 'Personal reasons', count: 4, pct: 12 },
  { reason: 'Performance', count: 3, pct: 9 },
  { reason: 'Contract ended', count: 3, pct: 9 },
  { reason: 'Compensation', count: 2, pct: 6 },
  { reason: 'Work culture', count: 1, pct: 3 },
];

/* ─────────────────────── UTILITIES ─────────────────────── */
function getStatusStyle(status) {
  switch (status) {
    case 'Initiated': return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' };
    case 'In Progress': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' };
    case 'Clearance Pending': return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-500' };
    case 'Settlement Pending': return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' };
    case 'Completed': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' };
    case 'Cancelled': return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', dot: 'bg-gray-500' };
    default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', dot: 'bg-gray-500' };
  }
}

function daysUntil(dateStr) {
  const target = new Date(dateStr);
  const now = new Date('2026-08-30');
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  return `₹${(amount / 1000).toFixed(0)}K`;
}

/* ─────────────────────── SVG CHARTS ─────────────────────── */
function MiniBarChart({ data, height = 100 }) {
  const max = Math.max(...data.map(d => d.total), 1);
  const barW = Math.floor(280 / data.length);
  return (
    <svg viewBox={`0 0 280 ${height}`} className="w-full" style={{ height: `${height}px` }}>
      {data.map((d, i) => {
        const yR = (d.resignations / max) * (height - 25);
        const yT = (d.terminations / max) * (height - 25);
        const yRet = (d.retirements / max) * (height - 25);
        return (
          <g key={i}>
            <rect x={i * barW + 12} y={height - yR - 18} width={barW - 24} height={yR} rx="3" fill="#f59e0b" opacity="0.85" />
            <rect x={i * barW + 12} y={height - yR - yT - 18} width={barW - 24} height={yT} rx="3" fill="#ef4444" opacity="0.85" />
            <rect x={i * barW + 12} y={height - yR - yT - yRet - 18} width={barW - 24} height={yRet} rx="3" fill="#3b82f6" opacity="0.85" />
            <text x={i * barW + barW / 2} y={height - 4} textAnchor="middle" fill="#9ca3af" fontSize="8">{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ClearanceRing({ pct, size = 64 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (pct / 100) * circ;
  const color = pct >= 90 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#374151" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="12" fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: 'center' }}>{pct}%</text>
    </svg>
  );
}

function HorizontalBar({ label, value, max, color, suffix = '' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-28 truncate">{label}</span>
      <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-12 text-right" style={{ color }}>{value}{suffix}</span>
    </div>
  );
}

/* ─────────────────────── DETAIL PANEL ─────────────────────── */
function ProcessDetail({ process, onBack }) {
  const [detailTab, setDetailTab] = useState('checklist');
  const checklist = MOCK_CHECKLISTS[process.id] || [];
  const assets = MOCK_ASSETS[process.id] || [];
  const kt = MOCK_KT[process.id] || [];
  const s = getStatusStyle(process.status);
  const daysLeft = daysUntil(process.lastWorkingDay);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1">
        ← Back to list
      </button>

      {/* HEADER CARD */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{process.employeeName}</h2>
            <div className="text-xs text-gray-500 mt-1">{process.role} · {process.department} · {process.exitType}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text} border ${s.border}`}>{process.status}</span>
              <span className="text-[10px] text-gray-400">Last day: {process.lastWorkingDay}</span>
              <span className={`text-[10px] font-bold ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-gray-400'}`}>
                {daysLeft > 0 ? `${daysLeft}d remaining` : 'Departed'}
              </span>
            </div>
          </div>
          <ClearanceRing pct={process.clearancePct} size={72} />
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center">
            <div className="text-xs text-gray-500">Assets</div>
            <div className={`text-lg font-bold ${process.assetsPending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{process.assetsPending}</div>
            <div className="text-[9px] text-gray-400">pending</div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center">
            <div className="text-xs text-gray-500">Knowledge</div>
            <div className={`text-lg font-bold ${process.ktPending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{process.ktPending}</div>
            <div className="text-[9px] text-gray-400">transfers left</div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center">
            <div className="text-xs text-gray-500">Exit Interview</div>
            <div className={`text-lg font-bold ${process.exitInterviewDone ? 'text-emerald-500' : 'text-red-500'}`}>{process.exitInterviewDone ? '✓' : '✗'}</div>
            <div className="text-[9px] text-gray-400">{process.exitInterviewDone ? 'done' : 'pending'}</div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center">
            <div className="text-xs text-gray-500">Settlement</div>
            <div className="text-lg font-bold text-blue-500">{formatCurrency(process.settlementEstimate)}</div>
            <div className="text-[9px] text-gray-400">estimate</div>
          </div>
        </div>
      </div>

      {/* DETAIL TABS */}
      <div className="flex gap-2">
        {[
          { id: 'checklist', label: `✓ Checklist (${checklist.filter(c => c.done).length}/${checklist.length})` },
          { id: 'assets', label: `💻 Assets (${assets.filter(a => a.status === 'Returned').length}/${assets.length})` },
          { id: 'kt', label: `📚 Knowledge (${kt.filter(k => k.progress === 100).length}/${kt.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setDetailTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${detailTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CHECKLIST */}
      {detailTab === 'checklist' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {checklist.length === 0 && <div className="p-6 text-center text-sm text-gray-400">No checklist items yet.</div>}
          {checklist.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-4">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${item.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                {item.done && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <div className="flex-1">
                <div className={`text-sm font-medium ${item.done ? 'line-through text-gray-400' : ''}`}>{item.title}</div>
                <div className="text-[10px] text-gray-400">{item.category} · {item.assignedTo}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ASSETS */}
      {detailTab === 'assets' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {assets.length === 0 && <div className="p-6 text-center text-sm text-gray-400">No assets tracked.</div>}
          {assets.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-4">
              <div className="text-xl">💻</div>
              <div className="flex-1">
                <div className="text-sm font-medium">{a.description}</div>
                <div className="text-[10px] text-gray-400">{a.type} · Tag: {a.tag}</div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === 'Returned' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* KNOWLEDGE TRANSFER */}
      {detailTab === 'kt' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {kt.length === 0 && <div className="p-6 text-center text-sm text-gray-400">No knowledge transfers tracked.</div>}
          {kt.map(k => (
            <div key={k.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{k.topic}</div>
                  <div className="text-[10px] text-gray-400">→ {k.transferTo}</div>
                </div>
                <span className={`text-xs font-bold ${k.progress === 100 ? 'text-emerald-400' : k.progress > 0 ? 'text-blue-400' : 'text-gray-400'}`}>{k.progress}%</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{
                  width: `${k.progress}%`,
                  backgroundColor: k.progress === 100 ? '#22c55e' : k.progress > 0 ? '#3b82f6' : '#6b7280'
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function EmployeeOffboardingTracker() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selectedProcess, setSelectedProcess] = useState(null);

  const filteredProcesses = useMemo(() =>
    MOCK_PROCESSES.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (deptFilter !== 'All' && p.department !== deptFilter) return false;
      return true;
    }),
    [statusFilter, deptFilter]
  );

  const stats = useMemo(() => {
    const active = MOCK_PROCESSES.filter(p => !['Completed', 'Cancelled'].includes(p.status));
    const avgClearancePct = active.length > 0 ? Math.round(active.reduce((s, p) => s + p.clearancePct, 0) / active.length) : 0;
    const totalSettlement = MOCK_PROCESSES.filter(p => p.status !== 'Cancelled').reduce((s, p) => s + p.settlementEstimate, 0);
    const interviewsPending = MOCK_PROCESSES.filter(p => !p.exitInterviewDone && p.status !== 'Completed' && p.status !== 'Cancelled').length;
    const assetsOutstanding = MOCK_PROCESSES.reduce((s, p) => s + p.assetsPending, 0);
    return { activeCount: active.length, avgClearancePct, totalSettlement, interviewsPending, assetsOutstanding, completed: MOCK_PROCESSES.filter(p => p.status === 'Completed').length };
  }, []);

  const statusCounts = useMemo(() => {
    const c = {};
    STATUSES.forEach(s => { c[s] = 0; });
    MOCK_PROCESSES.forEach(p => { if (c[p.status] !== undefined) c[p.status]++; });
    return c;
  }, []);

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'processes', label: '📋 Processes' },
    { id: 'analytics', label: '📈 Analytics' },
  ];

  if (selectedProcess) {
    return (
      <>
        <Helmet><title>Offboarding Tracker — PaySphere</title></Helmet>
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
          <Sidebar />
          <div className="flex-1 ml-64 p-6">
            <ProcessDetail process={selectedProcess} onBack={() => setSelectedProcess(null)} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Offboarding Tracker — PaySphere</title></Helmet>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🚪 Offboarding Tracker</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage departures, clearance, asset returns & exit settlements</p>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══════════ DASHBOARD TAB ═══════════ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Active Offboards</div>
                  <div className="text-2xl font-bold text-indigo-500 mt-1">{stats.activeCount}</div>
                  <div className="text-[10px] text-gray-400">in progress</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Avg Clearance</div>
                  <div className={`text-2xl font-bold mt-1 ${stats.avgClearancePct >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{stats.avgClearancePct}%</div>
                  <div className="text-[10px] text-gray-400">completion</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Total Settlement</div>
                  <div className="text-2xl font-bold text-blue-500 mt-1">{formatCurrency(stats.totalSettlement)}</div>
                  <div className="text-[10px] text-gray-400">across processes</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Interviews Pending</div>
                  <div className={`text-2xl font-bold mt-1 ${stats.interviewsPending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{stats.interviewsPending}</div>
                  <div className="text-[10px] text-gray-400">to schedule</div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="text-xs text-gray-500">Assets Outstanding</div>
                  <div className={`text-2xl font-bold mt-1 ${stats.assetsOutstanding > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{stats.assetsOutstanding}</div>
                  <div className="text-[10px] text-gray-400">not returned</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* STATUS PIPELINE */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-4">🔄 Status Pipeline</h3>
                  <div className="space-y-3">
                    {STATUSES.map(st => {
                      const c = getStatusStyle(st);
                      return (
                        <div key={st} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <span className="text-xs text-gray-500 w-32">{st}</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${(statusCounts[st] / MOCK_PROCESSES.length) * 100}%`, backgroundColor: c.dot.replace('bg-', '#') }} />
                          </div>
                          <span className="text-xs font-bold w-6 text-right">{statusCounts[st]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* UPCOMING DEPARTURES */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-4">📅 Upcoming Departures</h3>
                  <div className="space-y-3">
                    {MOCK_PROCESSES
                      .filter(p => p.status !== 'Completed' && p.status !== 'Cancelled')
                      .sort((a, b) => new Date(a.lastWorkingDay) - new Date(b.lastWorkingDay))
                      .slice(0, 5)
                      .map(p => {
                        const d = daysUntil(p.lastWorkingDay);
                        return (
                          <button key={p.id} onClick={() => setSelectedProcess(p)}
                            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
                            <div className="flex-1">
                              <div className="text-sm font-medium">{p.employeeName}</div>
                              <div className="text-[10px] text-gray-400">{p.department} · {p.lastWorkingDay}</div>
                            </div>
                            <ClearanceRing pct={p.clearancePct} size={40} />
                            <span className={`text-[10px] font-bold ${d <= 7 ? 'text-red-400' : d <= 30 ? 'text-amber-400' : 'text-gray-400'}`}>
                              {d > 0 ? `${d}d` : 'Today'}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ PROCESSES TAB ═══════════ */}
          {activeTab === 'processes' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  <option value="All">All Statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredProcesses.map(p => {
                  const s = getStatusStyle(p.status);
                  const d = daysUntil(p.lastWorkingDay);
                  return (
                    <button key={p.id} onClick={() => setSelectedProcess(p)}
                      className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all text-left w-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <ClearanceRing pct={p.clearancePct} size={56} />
                          <div>
                            <h4 className="text-sm font-bold">{p.employeeName}</h4>
                            <div className="text-[10px] text-gray-500">{p.role} · {p.department}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text} border ${s.border}`}>{p.status}</span>
                              <span className="text-[10px] text-gray-400">{p.exitType}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-xs text-gray-500">Last day: {p.lastWorkingDay}</div>
                          <div className={`text-[10px] font-bold ${d <= 7 ? 'text-red-400' : d <= 30 ? 'text-amber-400' : 'text-gray-400'}`}>
                            {d > 0 ? `${d} days` : 'Departed'}
                          </div>
                          <div className="text-[10px] text-blue-400">{formatCurrency(p.settlementEstimate)}</div>
                        </div>
                      </div>
                      {/* PROGRESS BAR */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 w-16">Clearance</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{
                            width: `${p.clearancePct}%`,
                            backgroundColor: p.clearancePct >= 90 ? '#22c55e' : p.clearancePct >= 60 ? '#3b82f6' : '#f59e0b'
                          }} />
                        </div>
                        <span className="text-[10px] text-gray-400">Assets: {p.assetsPending} · KT: {p.ktPending} · Interview: {p.exitInterviewDone ? '✓' : '✗'}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredProcesses.length === 0 && (
                  <div className="text-center py-12 text-sm text-gray-400">No processes match the current filters.</div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ ANALYTICS TAB ═══════════ */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ATTRITION TRENDS */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📈 Attrition Trends (6 months)</h3>
                  <MiniBarChart data={ATTRITION_TRENDS} height={120} />
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-[10px]"><div className="w-2 h-2 rounded bg-amber-500" /> Resignations</div>
                    <div className="flex items-center gap-1 text-[10px]"><div className="w-2 h-2 rounded bg-red-500" /> Terminations</div>
                    <div className="flex items-center gap-1 text-[10px]"><div className="w-2 h-2 rounded bg-blue-500" /> Retirements</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs font-bold text-amber-500">19</div>
                      <div className="text-[9px] text-gray-400">Resignations</div>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs font-bold text-red-500">3</div>
                      <div className="text-[9px] text-gray-400">Terminations</div>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-xs font-bold text-blue-500">2</div>
                      <div className="text-[9px] text-gray-400">Retirements</div>
                    </div>
                  </div>
                </div>

                {/* LEAVING REASONS */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-4">🔍 Top Leaving Reasons</h3>
                  <div className="space-y-3">
                    {LEAVING_REASONS.map((r, i) => (
                      <HorizontalBar key={i} label={r.reason} value={r.count} max={12}
                        color={i < 2 ? '#ef4444' : i < 5 ? '#f59e0b' : '#6b7280'} suffix={` (${r.pct}%)`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* DEPARTMENT ATTRITION */}
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-4">🏢 Department Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {DEPARTMENTS.map(dept => {
                    const deptProcesses = MOCK_PROCESSES.filter(p => p.department === dept);
                    const active = deptProcesses.filter(p => !['Completed', 'Cancelled'].includes(p.status)).length;
                    const completed = deptProcesses.filter(p => p.status === 'Completed').length;
                    return (
                      <div key={dept} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">{dept}</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">{deptProcesses.length}</div>
                        <div className="text-[9px] text-gray-400">
                          {active} active · {completed} completed
                        </div>
                        {deptProcesses.length > 0 && (
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(deptProcesses.length / MOCK_PROCESSES.length) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INSIGHTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">💡 Key Insights</h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                      <span className="font-bold text-red-600 dark:text-red-400">⚠️ Retention Risk:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">35% leave for better opportunities — review compensation benchmarking against market.</span>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <span className="font-bold text-amber-600 dark:text-amber-400">💻 Asset Recovery:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">{stats.assetsOutstanding} assets pending return. Escalate to facilities for imminent departures.</span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <span className="font-bold text-blue-600 dark:text-blue-400">📚 Knowledge Gaps:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">Schedule remaining KT sessions for processes closing within 2 weeks.</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📊 Clearance Heatmap</h3>
                  <div className="space-y-2">
                    {MOCK_PROCESSES.filter(p => p.status !== 'Cancelled').map(p => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-32 truncate">{p.employeeName}</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-3 flex overflow-hidden">
                          {['IT', 'Finance', 'HR', 'Facilities', 'Manager'].map(cat => {
                            const done = MOCK_CHECKLISTS[p.id]?.filter(c => c.category === cat && c.done).length || 0;
                            const total = MOCK_CHECKLISTS[p.id]?.filter(c => c.category === cat).length || 0;
                            return (
                              <div key={cat} className="h-3 transition-all" style={{
                                width: `${100 / 5}%`,
                                backgroundColor: total === 0 ? '#374151' : done === total ? '#22c55e' : done > 0 ? '#f59e0b' : '#ef4444'
                              }} />
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-gray-400 w-8 text-right">{p.clearancePct}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center gap-3 mt-3">
                    {[
                      { label: 'Complete', color: '#22c55e' },
                      { label: 'Partial', color: '#f59e0b' },
                      { label: 'Not started', color: '#ef4444' },
                      { label: 'N/A', color: '#374151' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1 text-[9px] text-gray-400">
                        <div className="w-2 h-2 rounded" style={{ backgroundColor: l.color }} /> {l.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
