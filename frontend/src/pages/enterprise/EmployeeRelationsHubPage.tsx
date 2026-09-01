import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertOctagon, Scale, Clock, ShieldAlert, FileText, CheckCircle, XCircle, Search, AlertCircle,
  Activity, BarChart3, Users, Paperclip, TrendingUp, ChevronRight,
} from 'lucide-react';
import type { ERCase, DisciplinaryAction, EmployeeRelationsKPIs } from '../../types/employeeRelations';
import type { InvestigationDashboard, InvestigationStep } from '../../types/investigation';
import {
  generateERCases, generateDisciplinaryActions, computeERKpis,
} from '../../services/employeeRelationsService';
import {
  generateInvestigationDashboard, generateInvestigationSteps,
} from '../../services/investigationService';
import InvestigationTimeline from '../../components/reports/InvestigationTimeline';
import CaseDetailDrawer from '../../components/reports/CaseDetailDrawer';

const fmtCurrency = (n: number) => `$${n.toLocaleString()}`;

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    'LOW': 'bg-gray-100 text-gray-700',
    'MEDIUM': 'bg-yellow-100 text-yellow-700',
    'HIGH': 'bg-orange-100 text-orange-700',
    'LITIGATION_IMMINENT': 'bg-red-600 text-white animate-pulse'
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[risk]}`}>{risk.replace(/_/g, ' ')}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const isClosed = status.startsWith('CLOSED');
  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${isClosed ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ActionBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    'VERBAL_WARNING': 'text-gray-600 bg-gray-100',
    'WRITTEN_WARNING': 'text-yellow-700 bg-yellow-100',
    'PIP': 'text-orange-700 bg-orange-100',
    'SUSPENSION': 'text-red-700 bg-red-100',
    'TERMINATION_WITH_CAUSE': 'text-white bg-red-600',
  };
  return <span className={`px-2 py-1 rounded text-xs font-bold ${styles[type]}`}>{type.replace(/_/g, ' ')}</span>;
}

function StepStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-gray-400',
    IN_PROGRESS: 'bg-blue-500',
    COMPLETED: 'bg-green-500',
    BLOCKED: 'bg-orange-500',
    CANCELLED: 'bg-red-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />;
}

// ─── Investigation Dashboard Tab ─────────────────────────────────────────────

function InvestigationDashboardTab({
  onCaseClick,
}: {
  onCaseClick: (c: ERCase) => void;
}) {
  const dashboard = useMemo(() => generateInvestigationDashboard(), []);
  const allCases = useMemo(() => generateERCases(50), []);
  const recentSteps = useMemo(() => generateInvestigationSteps('recent', 6), []);

  const openCases = useMemo(
    () => allCases.filter((c) => !c.status.startsWith('CLOSED')).slice(0, 12),
    [allCases],
  );

  const stepStatusData = dashboard.stepsByStatus;
  const totalSteps = Object.values(stepStatusData).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Investigation KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <FileText size={14} />
            <span className="text-[10px] uppercase font-bold">Total Cases</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{dashboard.totalCases}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Activity size={14} />
            <span className="text-[10px] uppercase font-bold">Open Cases</span>
          </div>
          <p className="text-xl font-extrabold text-blue-600">{dashboard.openCases}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Users size={14} />
            <span className="text-[10px] uppercase font-bold">Active Assignments</span>
          </div>
          <p className="text-xl font-extrabold text-purple-600">{dashboard.activeAssignments}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Paperclip size={14} />
            <span className="text-[10px] uppercase font-bold">Evidence Items</span>
          </div>
          <p className="text-xl font-extrabold text-amber-600">{dashboard.evidenceCount}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertOctagon size={14} />
            <span className="text-[10px] uppercase font-bold">SLA Breaches</span>
          </div>
          <p className="text-xl font-extrabold text-red-600">{dashboard.slaBreachCount}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-200 dark:border-green-900/30">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp size={14} />
            <span className="text-[10px] uppercase font-bold">Completion Rate</span>
          </div>
          <p className="text-xl font-extrabold text-green-600">{dashboard.completionRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step Progress Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-500" />
            Step Progress
          </h3>
          <div className="space-y-3">
            {Object.entries(stepStatusData).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <StepStatusDot status={status} />
                <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 w-24">
                  {status.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 bg-gray-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${totalSteps > 0 ? (count / totalSteps) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-extrabold text-gray-900 dark:text-white w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Scale size={16} className="text-indigo-500" />
            Case Status Distribution
          </h3>
          <div className="space-y-3">
            {dashboard.categoryBreakdown.map((cat) => (
              <div key={cat._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${cat._id === 'Filed' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    {cat._id.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Investigation Steps */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-indigo-500" />
            Recent Investigation Steps
          </h3>
          <div className="space-y-2">
            {recentSteps.map((step) => (
              <div key={step._id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-900/50 transition">
                <StepStatusDot status={step.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{step.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {step.actionType.replace(/_/g, ' ')} · {step.performedBy.name}
                  </p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  step.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  step.status === 'BLOCKED' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {step.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Cases Quick List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-500" />
            Cases Requiring Investigation Attention
          </h3>
          <span className="text-xs text-gray-400">{openCases.length} cases</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-5 py-3">Case</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Days Open</th>
                <th className="px-5 py-3">SLA</th>
                <th className="px-5 py-3">Investigator</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {openCases.map((c) => (
                <tr key={c.caseId} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-5 py-3">
                    <p className="font-extrabold text-indigo-600 dark:text-indigo-400">{c.caseId}</p>
                    <p className="text-[10px] text-gray-400">{c.filingDate}</p>
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold">{c.category.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3"><RiskBadge risk={c.severity} /></td>
                  <td className="px-5 py-3 font-extrabold text-gray-900 dark:text-white">{c.daysOpen}</td>
                  <td className="px-5 py-3">
                    {c.slaBreached ? (
                      <span className="flex items-center gap-1 text-xs text-red-600 font-bold">
                        <AlertCircle size={10} /> BREACHED
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-semibold">On Track</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs">{c.assignedInvestigator}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => onCaseClick(c)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                    >
                      View <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Hub Page ───────────────────────────────────────────────────────────

export default function EmployeeRelationsHubPage() {
  const [tab, setTab] = useState<'cases' | 'disciplinary' | 'investigation'>('cases');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<ERCase | null>(null);

  const cases = useMemo(() => generateERCases(50), []);
  const actions = useMemo(() => generateDisciplinaryActions(30), []);
  const kpis = useMemo(() => computeERKpis(cases), [cases]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filteredCases = useMemo(() => cases.filter(c =>
    c.caseId.toLowerCase().includes(search.toLowerCase()) ||
    c.reporterName.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  ), [cases, search]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-gray-500 font-bold">
          <Scale size={32} className="animate-bounce text-indigo-500" />
          <p>Loading Employee Relations Docket...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="bg-slate-900 px-6 py-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Scale className="text-red-500" size={32} /> Employee Relations & Grievance Arbitration Hub
          </h1>
          <p className="text-slate-400 mt-2">Manage confidential grievances, monitor litigation exposure, and enforce SLA on HR investigations.</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-xs uppercase font-bold text-slate-400 mb-1">Total Estimated Legal Exposure</p>
          <p className="text-3xl font-extrabold text-red-500">{fmtCurrency(kpis.totalEstimatedExposure)}</p>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-center text-gray-500 mb-2">
              <span className="text-xs uppercase font-bold">Active Cases</span>
              <FileText size={18} />
            </div>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{kpis.activeCasesTotal}</p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-xl border border-orange-200 dark:border-orange-900/30">
            <div className="flex justify-between items-center text-orange-600 mb-2">
              <span className="text-xs uppercase font-bold">SLA Breaches (&gt;30 Days)</span>
              <Clock className="animate-spin-slow" size={18} />
            </div>
            <p className="text-2xl font-extrabold text-orange-700">{kpis.casesBreachingSLA}</p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl border border-red-200 dark:border-red-900/30">
            <div className="flex justify-between items-center text-red-600 mb-2">
              <span className="text-xs uppercase font-bold">Litigation Imminent</span>
              <AlertOctagon className="animate-pulse" size={18} />
            </div>
            <p className="text-2xl font-extrabold text-red-700">{kpis.litigationRiskCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-center text-gray-500 mb-2">
              <span className="text-xs uppercase font-bold">Avg Resolution Time</span>
              <CheckCircle size={18} />
            </div>
            <p className="text-2xl font-extrabold text-indigo-600">{kpis.averageResolutionDays} Days</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 pb-2 flex-wrap">
          <button onClick={() => setTab('cases')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'cases' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Scale size={16} /> ER Case Ledger
          </button>
          <button onClick={() => setTab('investigation')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'investigation' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Activity size={16} /> Investigation Workflow
          </button>
          <button onClick={() => setTab('disciplinary')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'disciplinary' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <ShieldAlert size={16} /> Disciplinary Actions & PIPs
          </button>
        </div>

        {/* ER Case Ledger Tab */}
        {tab === 'cases' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Active Grievance & Investigation Docket</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search cases..."
                  className="pl-9 pr-4 py-1.5 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-6 py-4">Case ID & Date</th>
                    <th className="px-6 py-4">Category & Risk</th>
                    <th className="px-6 py-4">Parties Involved</th>
                    <th className="px-6 py-4">Status & SLA</th>
                    <th className="px-6 py-4 text-right">Est. Exposure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filteredCases.slice(0, 30).map(c => (
                    <tr key={c.caseId} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedCase(c)}
                          className="font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline text-left"
                        >
                          {c.caseId}
                        </button>
                        <p className="text-xs text-gray-500 mt-1">{c.filingDate}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">{c.category.replace(/_/g, ' ')}</p>
                        <RiskBadge risk={c.severity} />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm"><span className="text-gray-500 text-xs">Reporter:</span> <span className="font-semibold">{c.reporterName}</span></p>
                        {c.accusedName && <p className="text-sm mt-0.5"><span className="text-gray-500 text-xs">Accused:</span> <span className="font-semibold">{c.accusedName}</span></p>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="mb-2"><StatusBadge status={c.status} /></div>
                        {c.slaBreached ? (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-bold"><AlertCircle size={12} /> SLA Breached ({c.daysOpen} d)</span>
                        ) : (
                          <span className="text-xs text-gray-500">{c.daysOpen} Days Open</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {c.estimatedLegalExposure > 0 ? (
                          <span className="font-extrabold text-red-600">{fmtCurrency(c.estimatedLegalExposure)}</span>
                        ) : (
                          <span className="text-gray-400 font-semibold">$0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Investigation Workflow Tab */}
        {tab === 'investigation' && <InvestigationDashboardTab onCaseClick={setSelectedCase} />}

        {/* Disciplinary Actions Tab */}
        {tab === 'disciplinary' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Recent Disciplinary Actions & PIPs</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {actions.map(a => (
                <div key={a.actionId} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-white">{a.employeeName}</p>
                      <p className="text-xs text-gray-500">{a.department} · Issued {a.dateIssued}</p>
                    </div>
                    <ActionBadge type={a.type} />
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-gray-500 uppercase font-bold mb-0.5">Appeal Status</p>
                      <p className={`font-semibold ${a.appealStatus === 'OVERTURNED' ? 'text-green-600' : a.appealStatus === 'UPHELD' ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{a.appealStatus.replace(/_/g, ' ')}</p>
                    </div>
                    {a.relatedCaseId && (
                      <div className="text-right">
                        <p className="text-gray-500 uppercase font-bold mb-0.5">Linked ER Case</p>
                        <button
                          onClick={() => {
                            const matched = cases.find((c) => c.caseId === a.relatedCaseId);
                            if (matched) setSelectedCase(matched);
                          }}
                          className="font-semibold text-indigo-500 hover:underline cursor-pointer"
                        >
                          {a.relatedCaseId}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Case Detail Drawer */}
      <CaseDetailDrawer
        caseData={selectedCase!}
        isOpen={!!selectedCase}
        onClose={() => setSelectedCase(null)}
      />
    </div>
  );
}
