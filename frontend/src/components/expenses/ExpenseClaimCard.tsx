import React from 'react';
import {
  DollarSign, Clock, CheckCircle2, AlertTriangle, XCircle, FileText,
  Camera, ShieldCheck, ShieldAlert, ArrowRight, Globe, Tag, TrendingUp,
  TrendingDown, Receipt, Landmark,
} from 'lucide-react';

export interface ExpenseClaimMetric {
  claimId: string;
  employeeName: string;
  departmentName: string;
  title: string;
  category: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'DISPUTED';
  currency: string;
  totalClaimUSD: number;
  policyComplianceScore: number;
  violationCount: number;
  submittedDateISO: string;
  currentApprover: string | null;
  hasReceipt: boolean;
}

interface ExpenseClaimCardProps {
  metric: ExpenseClaimMetric;
  onInspect: () => void;
}

function statusBadge(status: ExpenseClaimMetric['status']) {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    DRAFT: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Draft' },
    SUBMITTED: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Submitted' },
    UNDER_REVIEW: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Under Review' },
    APPROVED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Approved' },
    REJECTED: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Rejected' },
    REIMBURSED: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', label: 'Reimbursed' },
    DISPUTED: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Disputed' },
  };
  return map[status] || map.DRAFT;
}

export default function ExpenseClaimCard({ metric, onInspect }: ExpenseClaimCardProps) {
  const badge = statusBadge(metric.status);
  const complianceColor = metric.policyComplianceScore >= 90 ? 'text-emerald-400' : metric.policyComplianceScore >= 70 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-amber-500/10 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition leading-tight">{metric.title}</h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">{metric.employeeName} • {metric.departmentName}</p>
            </div>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border font-mono ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 mb-4 font-mono text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Claim Amount</span>
            <span className="text-white font-bold text-sm flex items-center gap-1 mt-0.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" /> ${metric.totalClaimUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Currency</span>
            <span className="text-slate-200 font-bold text-sm flex items-center gap-1 mt-0.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" /> {metric.currency}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Category</span>
            <span className="text-amber-400 font-semibold text-sm mt-0.5 block">{metric.category.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Receipt</span>
            <span className={`font-bold text-sm flex items-center gap-1 mt-0.5 ${metric.hasReceipt ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metric.hasReceipt ? <><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</> : <><XCircle className="w-3.5 h-3.5" /> Missing</>}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs mb-4 font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Policy Compliance:</span>
            <span className={`font-semibold ${complianceColor}`}>{metric.policyComplianceScore}%</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Violations:</span>
            <span className={`font-semibold ${metric.violationCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{metric.violationCount}</span>
          </div>
          {metric.currentApprover && (
            <div className="flex justify-between text-slate-400">
              <span>Pending With:</span>
              <span className="text-indigo-400 font-semibold">{metric.currentApprover}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-800 text-slate-200 font-bold">
            <span>Submitted:</span>
            <span className="text-slate-400">{metric.submittedDateISO || 'Not yet'}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="text-[11px] text-slate-400 font-mono">ID: {metric.claimId}</div>
        <button onClick={onInspect} className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-amber-500/30 transition flex items-center gap-1">
          <span>Full Audit</span><ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
