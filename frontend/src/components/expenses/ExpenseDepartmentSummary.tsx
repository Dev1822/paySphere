import React from 'react';
import { Building2, TrendingUp, TrendingDown, DollarSign, CheckCircle2, XCircle, Clock, ShieldCheck, Tag } from 'lucide-react';

export interface DeptExpenseSummary {
  departmentCode: string;
  departmentName: string;
  totalClaimsCount: number;
  totalClaimedUSD: number;
  totalApprovedUSD: number;
  totalRejectedUSD: number;
  totalReimbursedUSD: number;
  avgProcessingDays: number;
  complianceRate: number;
  topCategory: string;
  monthOverMonthChange: number;
}

interface ExpenseDepartmentSummaryProps {
  summary: DeptExpenseSummary;
}

export default function ExpenseDepartmentSummary({ summary }: ExpenseDepartmentSummaryProps) {
  const approvalRate = summary.totalClaimsCount > 0
    ? Math.round((summary.totalApprovedUSD / (summary.totalApprovedUSD + summary.totalRejectedUSD)) * 100)
    : 100;

  return (
    <div className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 backdrop-blur-md transition-all duration-300 group">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/15 flex items-center justify-center">
            <Building2 className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition">{summary.departmentName}</h3>
            <p className="text-[11px] text-slate-500 font-mono">{summary.departmentCode} • {summary.totalClaimsCount} claims</p>
          </div>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-lg font-semibold font-mono flex items-center gap-1 ${
          summary.monthOverMonthChange >= 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
        }`}>
          {summary.monthOverMonthChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {summary.monthOverMonthChange >= 0 ? '+' : ''}{summary.monthOverMonthChange}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/70 mb-4 font-mono text-xs">
        <div>
          <span className="text-slate-500 block text-[10px]">Total Claimed</span>
          <span className="text-white font-bold text-sm">${(summary.totalClaimedUSD / 1000).toFixed(1)}k</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Reimbursed</span>
          <span className="text-emerald-400 font-bold text-sm">${(summary.totalReimbursedUSD / 1000).toFixed(1)}k</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Avg Processing</span>
          <span className="text-indigo-400 font-bold text-sm">{summary.avgProcessingDays}d</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> Top Category</span>
          <span className="text-amber-400 font-bold text-sm">{summary.topCategory}</span>
        </div>
      </div>

      {/* Compliance Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Compliance</span>
          <span className="font-mono font-bold text-slate-200">{summary.complianceRate}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${summary.complianceRate >= 95 ? 'bg-emerald-500' : summary.complianceRate >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${summary.complianceRate}%` }} />
        </div>
      </div>

      {/* Approval Rate Bar */}
      <div>
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approval Rate</span>
          <span className="font-mono font-bold text-slate-200">{approvalRate}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${approvalRate}%` }} />
        </div>
      </div>

      <div className="flex justify-between mt-3 pt-3 border-t border-slate-800/70 text-[11px] font-mono">
        <span className="text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> ${(summary.totalApprovedUSD / 1000).toFixed(1)}k approved</span>
        <span className="text-slate-500 flex items-center gap-1"><XCircle className="w-3 h-3 text-rose-400" /> ${(summary.totalRejectedUSD / 1000).toFixed(1)}k rejected</span>
      </div>
    </div>
  );
}
