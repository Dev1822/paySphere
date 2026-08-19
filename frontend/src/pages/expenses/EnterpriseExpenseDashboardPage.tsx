import React, { useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Users, ShieldCheck, Download, Search,
  PieChart, Activity, Sparkles, AlertCircle, ArrowUpRight, CheckCircle2,
  Clock, XCircle, Receipt, Globe, Camera, FileText, Landmark, Filter,
} from 'lucide-react';
import ExpenseClaimCard, { ExpenseClaimMetric } from '../../components/expenses/ExpenseClaimCard';
import ExpenseDepartmentSummary, { DeptExpenseSummary } from '../../components/expenses/ExpenseDepartmentSummary';

const EXPENSE_CLAIMS: ExpenseClaimMetric[] = [
  { claimId: 'ex-001', employeeName: 'Sarah Chen', departmentName: 'Engineering', title: 'AWS re:Invent Conference Travel', category: 'TRAVEL', status: 'REIMBURSED', currency: 'USD', totalClaimUSD: 3065, policyComplianceScore: 98, violationCount: 0, submittedDateISO: '2026-08-06', currentApprover: null, hasReceipt: true },
  { claimId: 'ex-002', employeeName: 'James Rodriguez', departmentName: 'Global Sales', title: 'Client Dinner - Acme Corp', category: 'CLIENT_ENTERTAINMENT', status: 'APPROVED', currency: 'EUR', totalClaimUSD: 517.1, policyComplianceScore: 85, violationCount: 1, submittedDateISO: '2026-08-15', currentApprover: null, hasReceipt: true },
  { claimId: 'ex-003', employeeName: 'Priya Patel', departmentName: 'Corporate Operations', title: 'Weekly Commute Mileage', category: 'MILEAGE', status: 'UNDER_REVIEW', currency: 'GBP', totalClaimUSD: 113.67, policyComplianceScore: 100, violationCount: 0, submittedDateISO: '2026-08-18', currentApprover: 'Operations Manager', hasReceipt: false },
  { claimId: 'ex-004', employeeName: 'Marcus Thompson', departmentName: 'Engineering', title: 'GitHub Enterprise + Figma Annual', category: 'SOFTWARE', status: 'SUBMITTED', currency: 'USD', totalClaimUSD: 1440, policyComplianceScore: 72, violationCount: 2, submittedDateISO: '2026-08-19', currentApprover: 'Engineering Manager', hasReceipt: true },
  { claimId: 'ex-005', employeeName: 'Aiko Tanaka', departmentName: 'Finance & Accounting', title: 'Tokyo Office Lunch Meeting', category: 'MEALS', status: 'REIMBURSED', currency: 'JPY', totalClaimUSD: 210.05, policyComplianceScore: 95, violationCount: 0, submittedDateISO: '2026-08-13', currentApprover: null, hasReceipt: true },
  { claimId: 'ex-006', employeeName: 'Elena Vasquez', departmentName: 'Global Sales', title: 'Berlin to Munich Train', category: 'TRANSPORT', status: 'DRAFT', currency: 'EUR', totalClaimUSD: 199.8, policyComplianceScore: 100, violationCount: 0, submittedDateISO: '', currentApprover: null, hasReceipt: false },
  { claimId: 'ex-007', employeeName: 'David Kim', departmentName: 'People & Culture', title: 'LinkedIn Recruiter License', category: 'SOFTWARE', status: 'REIMBURSED', currency: 'USD', totalClaimUSD: 180, policyComplianceScore: 100, violationCount: 0, submittedDateISO: '2026-08-01', currentApprover: null, hasReceipt: true },
];

const DEPT_SUMMARIES: DeptExpenseSummary[] = [
  { departmentCode: 'ENG', departmentName: 'Engineering', totalClaimsCount: 45, totalClaimedUSD: 32500, totalApprovedUSD: 28700, totalRejectedUSD: 1200, totalReimbursedUSD: 27500, avgProcessingDays: 4.2, complianceRate: 94, topCategory: 'SOFTWARE', monthOverMonthChange: 12.5 },
  { departmentCode: 'SALES', departmentName: 'Global Sales', totalClaimsCount: 68, totalClaimedUSD: 54200, totalApprovedUSD: 49800, totalRejectedUSD: 2100, totalReimbursedUSD: 47700, avgProcessingDays: 3.1, complianceRate: 89, topCategory: 'TRAVEL', monthOverMonthChange: 8.3 },
  { departmentCode: 'OPS', departmentName: 'Corporate Operations', totalClaimsCount: 32, totalClaimedUSD: 12800, totalApprovedUSD: 11500, totalRejectedUSD: 800, totalReimbursedUSD: 11200, avgProcessingDays: 5.6, complianceRate: 97, topCategory: 'MILEAGE', monthOverMonthChange: -3.2 },
  { departmentCode: 'FIN', departmentName: 'Finance & Accounting', totalClaimsCount: 21, totalClaimedUSD: 8900, totalApprovedUSD: 8200, totalRejectedUSD: 400, totalReimbursedUSD: 8000, avgProcessingDays: 2.8, complianceRate: 100, topCategory: 'MEALS', monthOverMonthChange: 5.1 },
];

const STATUSES = ['All', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REIMBURSED'];
const CATEGORIES = ['All', 'TRAVEL', 'MEALS', 'SOFTWARE', 'CLIENT_ENTERTAINMENT', 'MILEAGE', 'TRANSPORT', 'LODGING'];

export default function EnterpriseExpenseDashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'claims' | 'departments'>('claims');
  const [selectedClaimModal, setSelectedClaimModal] = useState<ExpenseClaimMetric | null>(null);

  const totalClaimed = EXPENSE_CLAIMS.reduce((s, c) => s + c.totalClaimUSD, 0);
  const pendingClaims = EXPENSE_CLAIMS.filter(c => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length;
  const avgCompliance = Math.round(EXPENSE_CLAIMS.reduce((s, c) => s + c.policyComplianceScore, 0) / EXPENSE_CLAIMS.length);
  const totalViolations = EXPENSE_CLAIMS.reduce((s, c) => s + c.violationCount, 0);

  const filteredClaims = useMemo(() => {
    return EXPENSE_CLAIMS.filter(c => {
      const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus;
      const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [searchQuery, selectedStatus, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Enterprise Suite
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Automated Policy Engine
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
              Enterprise Expense Management & Reimbursement
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Multi-currency receipt OCR, automated policy compliance scoring, approval workflow orchestration, and department-level expense analytics.
            </p>
          </div>
          <button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-amber-600/30 transition flex items-center gap-2 border border-amber-400/20 text-sm self-start">
            <Download className="w-4 h-4" /> Export Expense Audit
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* ── KPI Stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total Claimed</span><DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${totalClaimed.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
            <div className="text-amber-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> +8.3% from previous period
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Pending Claims</span><Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{pendingClaims}</div>
            <div className="text-blue-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> Awaiting approval
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Policy Compliance</span><ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{avgCompliance}%</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Avg across all claims
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Policy Violations</span><AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{totalViolations}</div>
            <div className={`text-xs mt-2 flex items-center gap-1 font-medium ${totalViolations > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {totalViolations > 0 ? <><XCircle className="w-3.5 h-3.5" /> Requires attention</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Clean record</>}
            </div>
          </div>
        </div>

        {/* ── Nav Bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button onClick={() => setActiveTab('claims')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${activeTab === 'claims' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <Receipt className="w-4 h-4" /> Expense Claims
            </button>
            <button onClick={() => setActiveTab('departments')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${activeTab === 'departments' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <PieChart className="w-4 h-4" /> Department View
            </button>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search claims..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500 transition" />
            </div>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 transition">
              {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
            </select>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500 transition">
              {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        {/* ── Tab Body ────────────────────────────────────────────────── */}
        {activeTab === 'departments' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DEPT_SUMMARIES.map(s => <ExpenseDepartmentSummary key={s.departmentCode} summary={s} />)}
          </div>
        ) : (
          filteredClaims.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800">
              <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No claims match your current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredClaims.map(c => <ExpenseClaimCard key={c.claimId} metric={c} onInspect={() => setSelectedClaimModal(c)} />)}
            </div>
          )
        )}
      </main>

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {selectedClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedClaimModal(null)} className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold">×</button>
            <h2 className="text-xl font-bold text-white mb-1">{selectedClaimModal.title}</h2>
            <div className="text-xs text-slate-400 font-mono mb-4">{selectedClaimModal.claimId} • {selectedClaimModal.employeeName} • {selectedClaimModal.departmentName}</div>
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div><span className="text-slate-500 block">Amount</span><span className="text-white font-bold text-sm">${selectedClaimModal.totalClaimUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div><span className="text-slate-500 block">Currency</span><span className="text-blue-400 font-bold text-sm">{selectedClaimModal.currency}</span></div>
              <div><span className="text-slate-500 block">Status</span><span className="text-amber-400 font-bold text-sm">{selectedClaimModal.status}</span></div>
              <div><span className="text-slate-500 block">Compliance</span><span className={`font-bold text-sm ${selectedClaimModal.policyComplianceScore >= 90 ? 'text-emerald-400' : selectedClaimModal.policyComplianceScore >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{selectedClaimModal.policyComplianceScore}%</span></div>
              <div><span className="text-slate-500 block">Category</span><span className="text-slate-200 font-bold text-sm">{selectedClaimModal.category.replace(/_/g, ' ')}</span></div>
              <div><span className="text-slate-500 block">Receipt</span><span className={`font-bold text-sm ${selectedClaimModal.hasReceipt ? 'text-emerald-400' : 'text-rose-400'}`}>{selectedClaimModal.hasReceipt ? 'Uploaded ✓' : 'Missing ✕'}</span></div>
              <div><span className="text-slate-500 block">Violations</span><span className={`font-bold text-sm ${selectedClaimModal.violationCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{selectedClaimModal.violationCount}</span></div>
              <div><span className="text-slate-500 block">Submitted</span><span className="text-white font-bold text-sm">{selectedClaimModal.submittedDateISO || 'N/A'}</span></div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setSelectedClaimModal(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close</button>
              <button className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs transition flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
