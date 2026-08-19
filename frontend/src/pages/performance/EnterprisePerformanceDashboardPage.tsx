import React, { useState, useMemo } from 'react';
import {
  Target, Users, TrendingUp, ShieldCheck, Download, Search, PieChart, Activity,
  Sparkles, AlertCircle, ArrowUpRight, CheckCircle2, Clock, MessageSquare,
  BarChart3, Award, AlertTriangle, Star, Eye, EyeOff,
} from 'lucide-react';
import OKRObjectiveCard, { OKRMetric } from '../../components/performance/OKRObjectiveCard';
import SuccessionPipelineCard, { SuccessionPlanMetric } from '../../components/performance/SuccessionPipelineCard';

const OKRS: OKRMetric[] = [
  { objectiveId: 'obj-001', employeeName: 'Sarah Chen', departmentName: 'Engineering', title: 'Ship Payment Gateway v3', quarter: 'Q3-2026', status: 'ON_TRACK', overallProgress: 72, keyResults: [{ title: 'Complete API integration', progress: 75, status: 'ON_TRACK', metric: 'endpoints', currentValue: 18, targetValue: 24, unit: 'done' }, { title: 'Reduce latency', progress: 60, status: 'AT_RISK', metric: 'p99 latency', currentValue: 220, targetValue: 150, unit: 'ms' }, { title: '99.99% uptime', progress: 80, status: 'ON_TRACK', metric: 'uptime', currentValue: 99.97, targetValue: 99.99, unit: '%' }], ownerName: 'Sarah Chen' },
  { objectiveId: 'obj-002', employeeName: 'James Rodriguez', departmentName: 'Global Sales', title: 'Close 5 Enterprise Deals', quarter: 'Q3-2026', status: 'AT_RISK', overallProgress: 40, keyResults: [{ title: 'Close Acme Corp', progress: 80, status: 'ON_TRACK', metric: 'deal', currentValue: 1200, targetValue: 1200, unit: 'K' }, { title: 'Close TechFlow', progress: 27, status: 'BEHIND', metric: 'deal', currentValue: 400, targetValue: 1500, unit: 'K' }, { title: 'Pipeline growth', progress: 18, status: 'BEHIND', metric: 'pipeline', currentValue: 6.2, targetValue: 12, unit: 'M' }], ownerName: 'James Rodriguez' },
  { objectiveId: 'obj-003', employeeName: 'Priya Patel', departmentName: 'Corporate Operations', title: 'Automate Compliance Reporting', quarter: 'Q3-2026', status: 'COMPLETED', overallProgress: 100, keyResults: [{ title: 'SOC-2 dashboard', progress: 100, status: 'COMPLETED', metric: 'coverage', currentValue: 100, targetValue: 100, unit: '%' }, { title: 'GDPR data mapping', progress: 100, status: 'COMPLETED', metric: 'systems', currentValue: 42, targetValue: 42, unit: 'mapped' }], ownerName: 'Priya Patel' },
  { objectiveId: 'obj-004', employeeName: 'Aiko Tanaka', departmentName: 'Finance & Accounting', title: 'Reduce Month-End Close to 3 Days', quarter: 'Q3-2026', status: 'ON_TRACK', overallProgress: 65, keyResults: [{ title: 'Automate reconciliations', progress: 68, status: 'ON_TRACK', metric: 'automated', currentValue: 15, targetValue: 22, unit: 'tasks' }, { title: 'Close in 3 days', progress: 63, status: 'ON_TRACK', metric: 'close time', currentValue: 4, targetValue: 3, unit: 'days' }], ownerName: 'Aiko Tanaka' },
];

const FEEDBACK = [
  { id: 'fb-001', from: 'Marcus Thompson', to: 'Sarah Chen', type: 'PEER', category: 'STRENGTHS', content: 'Excellent technical leadership on the payment gateway project. Always available for code reviews.', rating: 5, anonymous: false, status: 'SUBMITTED', date: '2026-08-15' },
  { id: 'fb-002', from: 'Anonymous', to: 'Sarah Chen', type: 'PEER', category: 'IMPROVEMENTS', content: 'Could improve on delegating more tasks to junior engineers to scale the team.', rating: null, anonymous: true, status: 'SUBMITTED', date: '2026-08-16' },
  { id: 'fb-003', from: 'Sarah Chen', to: 'Marcus Thompson', type: 'MANAGER', category: 'OVERALL', content: 'Strong performer, consistently delivers high-quality work. Ready for senior role consideration.', rating: 4, anonymous: false, status: 'ACKNOWLEDGED', date: '2026-08-14' },
];

const SUCCESSION: SuccessionPlanMetric[] = [
  { planId: 'sp-001', positionTitle: 'VP of Engineering', departmentName: 'Engineering', currentHolder: 'Robert Kim', readinessLevel: 'READY_12M', totalCandidates: 2, candidates: [{ name: 'Sarah Chen', currentRole: 'Sr. Staff Engineer', readinessLevel: 'READY_12M', potentialRating: 5, performanceRating: 5, riskOfLoss: 'MEDIUM', impactOfLoss: 'HIGH' }, { name: 'Fatima Al-Rashid', currentRole: 'Staff Engineer', readinessLevel: 'READY_24M', potentialRating: 4, performanceRating: 4, riskOfLoss: 'LOW', impactOfLoss: 'MEDIUM' }], lastUpdatedISO: '2026-08-01' },
  { planId: 'sp-002', positionTitle: 'CFO', departmentName: 'Finance & Accounting', currentHolder: 'Margaret Liu', readinessLevel: 'READY_NOW', totalCandidates: 1, candidates: [{ name: 'Aiko Tanaka', currentRole: 'VP Finance', readinessLevel: 'READY_NOW', potentialRating: 5, performanceRating: 5, riskOfLoss: 'LOW', impactOfLoss: 'HIGH' }], lastUpdatedISO: '2026-07-20' },
];

const STATUSES = ['All', 'ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED'];

export default function EnterprisePerformanceDashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeTab, setActiveTab] = useState<'okrs' | 'feedback' | 'succession'>('okrs');
  const [selectedOKRModal, setSelectedOKRModal] = useState<OKRMetric | null>(null);

  const onTrack = OKRS.filter(o => o.status === 'ON_TRACK').length;
  const atRisk = OKRS.filter(o => o.status === 'AT_RISK').length;
  const avgProgress = Math.round(OKRS.reduce((s, o) => s + o.overallProgress, 0) / OKRS.length);

  const filteredOKRs = useMemo(() => {
    return OKRS.filter(o => {
      const ms = o.title.toLowerCase().includes(searchQuery.toLowerCase()) || o.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
      const mf = selectedStatus === 'All' || o.status === selectedStatus;
      return ms && mf;
    });
  }, [searchQuery, selectedStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Enterprise Suite
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> 360° Performance Intelligence
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-200 bg-clip-text text-transparent">
              Enterprise Performance Management & OKR Suite
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Goal cascading, key result tracking, 360° peer feedback, review cycle orchestration, calibration sessions, and succession planning intelligence.
            </p>
          </div>
          <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-blue-600/30 transition flex items-center gap-2 border border-blue-400/20 text-sm self-start">
            <Download className="w-4 h-4" /> Export Performance Report
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Total OKRs</span><Target className="w-4 h-4 text-blue-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{OKRS.length}</div>
            <div className="text-blue-400 text-xs mt-2 flex items-center gap-1 font-medium"><TrendingUp className="w-3.5 h-3.5" /> {onTrack} on track</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>At Risk</span><AlertTriangle className="w-4 h-4 text-amber-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{atRisk}</div>
            <div className={`text-xs mt-2 ${atRisk > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{atRisk > 0 ? 'Needs attention' : 'All clear'}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Avg Progress</span><BarChart3 className="w-4 h-4 text-indigo-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{avgProgress}%</div>
            <div className="text-indigo-400 text-xs mt-2">Across all objectives</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Feedback</span><MessageSquare className="w-4 h-4 text-emerald-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{FEEDBACK.length}</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1"><Star className="w-3 h-3" /> 360° cycle active</div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            {(['okrs', 'feedback', 'succession'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-medium text-sm transition flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                {tab === 'okrs' && <><Target className="w-3.5 h-3.5" /> OKRs</>}
                {tab === 'feedback' && <><MessageSquare className="w-3.5 h-3.5" /> Feedback</>}
                {tab === 'succession' && <><Users className="w-3.5 h-3.5" /> Succession</>}
              </button>
            ))}
          </div>
          {activeTab === 'okrs' && (
            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 md:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Search OKRs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 transition" />
              </div>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2 focus:outline-none focus:border-blue-500 transition">
                {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
        </div>

        {activeTab === 'okrs' && (
          filteredOKRs.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800"><AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" /><p className="text-slate-400 text-sm font-medium">No OKRs match your filters.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{filteredOKRs.map(o => <OKRObjectiveCard key={o.objectiveId} metric={o} onInspect={() => setSelectedOKRModal(o)} />)}</div>
          )
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {FEEDBACK.map(f => (
              <div key={f.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {f.anonymous ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-blue-400" />}
                    <span className="text-sm font-bold text-slate-100">{f.from} → {f.to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-mono border ${
                      f.category === 'STRENGTHS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                      f.category === 'IMPROVEMENTS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    }`}>{f.category}</span>
                    {f.rating && <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5"><Star className="w-3 h-3" /> {f.rating}/5</span>}
                    <span className="text-[10px] text-slate-500 font-mono">{f.date}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{f.content}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-mono border ${
                    f.status === 'ACKNOWLEDGED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}>{f.status}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{f.type}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'succession' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SUCCESSION.map(s => <SuccessionPipelineCard key={s.planId} metric={s} />)}
          </div>
        )}
      </main>

      {selectedOKRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedOKRModal(null)} className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold">×</button>
            <h2 className="text-xl font-bold text-white mb-1">{selectedOKRModal.title}</h2>
            <div className="text-xs text-slate-400 font-mono mb-4">{selectedOKRModal.objectiveId} • {selectedOKRModal.employeeName} • {selectedOKRModal.quarter}</div>
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-xs font-mono">
              <div><span className="text-slate-500 block">Progress</span><span className="text-white font-bold text-sm">{selectedOKRModal.overallProgress}%</span></div>
              <div><span className="text-slate-500 block">Status</span><span className={`font-bold text-sm ${selectedOKRModal.status === 'ON_TRACK' ? 'text-emerald-400' : selectedOKRModal.status === 'AT_RISK' ? 'text-amber-400' : 'text-blue-400'}`}>{selectedOKRModal.status.replace(/_/g, ' ')}</span></div>
              <div><span className="text-slate-500 block">Key Results</span><span className="text-slate-200 font-bold text-sm">{selectedOKRModal.keyResults.length}</span></div>
              <div><span className="text-slate-500 block">Owner</span><span className="text-blue-400 font-bold text-sm">{selectedOKRModal.ownerName}</span></div>
            </div>
            <div className="space-y-2 mb-4">
              {selectedOKRModal.keyResults.map((kr, i) => (
                <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800/70">
                  <div className="flex justify-between text-[11px] mb-1"><span className="text-slate-300 font-medium">{kr.title}</span><span className="font-mono font-bold text-blue-400">{kr.progress}%</span></div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${kr.progress}%` }} /></div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">{kr.currentValue}/{kr.targetValue} {kr.unit}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setSelectedOKRModal(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
