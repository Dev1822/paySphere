import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, ExternalLink, AlertTriangle, CheckCircle2, User, Building2 } from 'lucide-react';

export interface CertCardMetric {
  certId: string; employeeName: string; departmentCode: string;
  certificationName: string; issuingBody: string; earnedDateISO: string;
  expiryDateISO: string | null; status: 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON' | 'REVOKED';
  credentialUrl: string | null;
}

interface Props { metric: CertCardMetric; }

function statusBadge(s: string) {
  const m: Record<string, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
    ACTIVE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: ShieldCheck, label: 'Active' },
    EXPIRING_SOON: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: ShieldAlert, label: 'Expiring Soon' },
    EXPIRED: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: ShieldX, label: 'Expired' },
    REVOKED: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: ShieldX, label: 'Revoked' },
  };
  return m[s] || m.ACTIVE;
}

export default function CertificationStatusTracker({ metric }: Props) {
  const badge = statusBadge(metric.status);
  const Icon = badge.icon;
  const daysLeft = metric.expiryDateISO ? Math.max(0, Math.round((new Date(metric.expiryDateISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 hover:border-emerald-500/30 transition-all">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center">
            <Icon className={`w-4 h-4 ${badge.text}`} />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-100 leading-tight block">{metric.certificationName}</span>
            <span className="text-[10px] text-slate-500 font-mono">{metric.issuingBody}</span>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold border font-mono ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-2">
        <div className="flex items-center gap-1 text-slate-400">
          <User className="w-2.5 h-2.5" /> {metric.employeeName}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Building2 className="w-2.5 h-2.5" /> {metric.departmentCode}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <CheckCircle2 className="w-2.5 h-2.5" /> Earned: {metric.earnedDateISO}
        </div>
        {daysLeft !== null && (
          <div className={`flex items-center gap-1 ${daysLeft <= 30 ? 'text-amber-400' : 'text-slate-400'}`}>
            <Clock className="w-2.5 h-2.5" /> {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
          </div>
        )}
      </div>

      {metric.status === 'EXPIRING_SOON' && daysLeft !== null && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 flex items-center gap-1.5 mb-2">
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-300 font-medium">Renewal needed within {daysLeft} days</span>
        </div>
      )}

      {metric.credentialUrl && (
        <a href={metric.credentialUrl} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1 transition">
          <ExternalLink className="w-2.5 h-2.5" /> View Credential
        </a>
      )}
    </div>
  );
}
