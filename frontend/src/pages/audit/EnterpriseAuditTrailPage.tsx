import React, { useState } from 'react';
import { ShieldCheck, Lock, Download, Search, Sparkles, CheckCircle2, Clock, Globe, FileText, Database, Key, Activity, Eye, AlertTriangle } from 'lucide-react';
import AuditLogCard, { AuditLogEntry } from '../../components/audit/AuditLogCard';
import AuditStreamTimeline from '../../components/audit/AuditStreamTimeline';

const AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-701',
    actionName: 'PAYROLL_BATCH_APPROVAL',
    actorEmail: 'cfo@paysphere.io',
    actorRole: 'Global CFO / Enterprise Admin',
    ipAddress: '192.168.1.104 (TLS 1.3)',
    targetResource: 'US-West Monthly Payroll Batch #9021',
    hashChecksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    severity: 'HIGH_SECURITY',
    timestampISO: 'Oct 24, 2026 @ 14:22:05 UTC',
    status: 'VERIFIED_IMMUTABLE',
  },
  {
    id: 'aud-702',
    actionName: 'DIRECT_DEPOSIT_BANK_CHANGE',
    actorEmail: 'e.rostova@paysphere.io',
    actorRole: 'VP Engineering',
    ipAddress: '10.0.4.12 (MFA Verified)',
    targetResource: 'JPMorgan Chase Account ****9821',
    hashChecksum: 'sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    severity: 'MEDIUM_SECURITY',
    timestampISO: 'Oct 24, 2026 @ 11:15:30 UTC',
    status: 'VERIFIED_IMMUTABLE',
  },
  {
    id: 'aud-703',
    actionName: 'TAX_REMITTANCE_SUBMISSION',
    actorEmail: 'system-bot@paysphere.io',
    actorRole: 'Compliance Worker Node',
    ipAddress: 'Internal VPC Remittance Gateway',
    targetResource: 'IRS Form 941 Q3 Statutory Filing',
    hashChecksum: 'sha256:6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090',
    severity: 'CRITICAL',
    timestampISO: 'Oct 24, 2026 @ 09:00:00 UTC',
    status: 'VERIFIED_IMMUTABLE',
  },
];

export default function EnterpriseAuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(AUDIT_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'logs' | 'realtime-stream'>('logs');
  const [selectedLogModal, setSelectedLogModal] = useState<AuditLogEntry | null>(null);

  const filteredLogs = logs.filter(l =>
    l.actionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.targetResource.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full font-semibold border border-purple-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> PaySphere Immutable Compliance Vault
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-400" /> Cryptographic Append-Only Ledger
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
              Enterprise Payroll Audit Trail & Security Ledger
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              SOC 2 Type II compliant immutable audit logging, SHA-256 cryptographic checksum verification, direct deposit change tracking, and tax authority submission receipts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-purple-600/30 transition flex items-center gap-2 border border-purple-400/20 text-sm">
              <Download className="w-4 h-4" /> Export SOC 2 Audit Report
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Cryptographic Integrity</span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">100% Intact</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Zero Tamper Events Detected
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Logged Security Actions</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">14,290 Events</div>
            <div className="text-purple-400 text-xs mt-2 font-medium">
              SOC 2 Type II Verified Storage
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Encryption Standard</span>
              <Key className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">AES-256-GCM</div>
            <div className="text-indigo-400 text-xs mt-2 font-medium">
              Hardware Security Module (HSM) Backed
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'logs'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-4 h-4" /> Immutable Audit Ledger
            </button>
            <button
              onClick={() => setActiveTab('realtime-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'realtime-stream'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Real-time Security Stream
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search action or actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'realtime-stream' ? (
          <AuditStreamTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredLogs.map((log) => (
              <AuditLogCard
                key={log.id}
                log={log}
                onInspect={() => setSelectedLogModal(log)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedLogModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedLogModal.actionName}</h3>
                <div className="text-xs text-slate-400 font-mono">{selectedLogModal.actorEmail} ({selectedLogModal.actorRole})</div>
              </div>
              <span className="bg-purple-500/20 text-purple-400 px-2.5 py-1 rounded font-mono text-xs font-bold border border-purple-500/30">
                {selectedLogModal.severity}
              </span>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Target Resource</span>
                <span className="text-white font-bold">{selectedLogModal.targetResource}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Client IP & TLS Session</span>
                <span className="text-indigo-400 font-bold">{selectedLogModal.ipAddress}</span>
              </div>
              <div>
                <span className="text-slate-500 block">SHA-256 Checksum</span>
                <span className="text-emerald-400 font-bold break-all">{selectedLogModal.hashChecksum}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedLogModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
