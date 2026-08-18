import React from 'react';
import { ShieldCheck, Lock, Key, ArrowRight, CheckCircle2 } from 'lucide-react';

export interface AuditLogEntry {
  id: string;
  actionName: string;
  actorEmail: string;
  actorRole: string;
  ipAddress: string;
  targetResource: string;
  hashChecksum: string;
  severity: 'INFO' | 'MEDIUM_SECURITY' | 'HIGH_SECURITY' | 'CRITICAL';
  timestampISO: string;
  status: 'VERIFIED_IMMUTABLE' | 'PENDING_SYNC';
}

interface AuditLogCardProps {
  log: AuditLogEntry;
  onInspect: () => void;
}

export default function AuditLogCard({ log, onInspect }: AuditLogCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-purple-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Action & Severity */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-purple-300 transition">
              {log.actionName}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{log.actorEmail}</p>
          </div>

          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold">
            {log.severity}
          </span>
        </div>

        {/* Target Resource Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Target Payroll Resource</div>
          <div className="text-sm font-bold text-white line-clamp-1">
            {log.targetResource}
          </div>
          <div className="text-[11px] text-emerald-400 mt-2 font-semibold flex items-center gap-1">
            <Lock className="w-3 h-3" /> Checksum: {log.hashChecksum.substring(0, 24)}...
          </div>
        </div>

        {/* Metadata Specs */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Actor Role:</span>
            <span className="text-white font-bold">{log.actorRole}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Client IP:</span>
            <span className="text-indigo-400 font-bold">{log.ipAddress}</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">{log.timestampISO}</span>
        <button
          onClick={onInspect}
          className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/30 transition flex items-center gap-1"
        >
          <span>Verify Cryptography</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
