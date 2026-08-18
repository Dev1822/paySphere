import React from 'react';
import { CheckCircle2, ShieldCheck, Lock, Activity, Key } from 'lucide-react';

interface AuditStreamItem {
  id: string;
  action: string;
  userEmail: string;
  target: string;
  ip: string;
  checksum: string;
  timestampAgo: string;
}

const RECENT_AUDIT_STREAM: AuditStreamItem[] = [
  {
    id: 'str-1',
    action: 'PAYROLL_BATCH_APPROVAL',
    userEmail: 'cfo@paysphere.io',
    target: 'US-West Batch #9021',
    ip: '192.168.1.104',
    checksum: 'e3b0c44298fc1c14...',
    timestampAgo: 'Just now',
  },
  {
    id: 'str-2',
    action: 'DIRECT_DEPOSIT_BANK_CHANGE',
    userEmail: 'e.rostova@paysphere.io',
    target: 'JPMorgan Chase Account',
    ip: '10.0.4.12',
    checksum: '8f434346648f6b96...',
    timestampAgo: '2 hours ago',
  },
  {
    id: 'str-3',
    action: 'TAX_REMITTANCE_SUBMISSION',
    userEmail: 'system-bot@paysphere.io',
    target: 'IRS Form 941 Q3',
    ip: 'Internal Gateway',
    checksum: '6ca13d52ca70c883...',
    timestampAgo: '5 hours ago',
  },
];

export default function AuditStreamTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" /> Real-time Audit Stream & Ledger Telemetry
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live SOC 2 event ingestion stream with hardware-backed digital signature validation.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-purple-300 font-semibold font-mono">
          <Lock className="w-4 h-4 text-emerald-400" /> Cryptographic Ledger Active
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_AUDIT_STREAM.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-purple-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-purple-500/10 text-purple-400 text-[11px] font-mono px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                  {item.action}
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.timestampAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{item.target}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Actor: <span className="text-slate-200">{item.userEmail}</span> • IP: <span className="text-indigo-400">{item.ip}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-xs bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                {item.checksum}
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Signed & Written
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
