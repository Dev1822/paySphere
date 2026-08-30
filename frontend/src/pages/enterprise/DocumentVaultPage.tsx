/**
 * @fileoverview Document Vault & E-Signature Hub Page
 * @description Enterprise document management with categorized storage,
 * access control, and digital e-signature request workflows.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderOpen, FileText, PenTool, Clock, CheckCircle, XCircle, AlertTriangle,
  Search, Filter, Shield, Lock, Eye, Download, ChevronRight, Plus,
  Stamp, ShieldCheck, User, Calendar, Hash,
} from 'lucide-react';
import type { EmployeeDocument, ESignatureRequest, DocumentCategory } from '../../types/documentVault';
import {
  generateDocumentCategories,
  generateEmployeeDocuments,
  generateSignatureRequests,
  generateDocumentVaultDashboard,
} from '../../services/documentVaultService';

type VaultTab = 'dashboard' | 'documents' | 'esignatures' | 'categories';

function DocumentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
    ARCHIVED: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-400' },
    EXPIRED: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
    PENDING_REVIEW: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  };
  const c = config[status] || config.ACTIVE;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SignatureStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    SENT: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', icon: <Clock size={10} /> },
    IN_PROGRESS: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', icon: <PenTool size={10} /> },
    COMPLETED: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', icon: <CheckCircle size={10} /> },
    DECLINED: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', icon: <XCircle size={10} /> },
    EXPIRED: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-400', icon: <AlertTriangle size={10} /> },
    CANCELLED: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-500 dark:text-gray-400', icon: <XCircle size={10} /> },
    DRAFT: { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-600 dark:text-gray-400', icon: <FileText size={10} /> },
  };
  const c = config[status] || config.SENT;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.icon} {status.replace(/_/g, ' ')}
    </span>
  );
}

function SignerProgress({ signers }: { signers: Array<{ name: string; status: string }> }) {
  return (
    <div className="flex items-center gap-1">
      {signers.map((s, i) => (
        <div
          key={i}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
            s.status === 'SIGNED'
              ? 'bg-green-100 border-green-300 text-green-700'
              : s.status === 'DECLINED'
                ? 'bg-red-100 border-red-300 text-red-700'
                : 'bg-gray-100 border-gray-300 text-gray-500'
          }`}
          title={`${s.name}: ${s.status}`}
        >
          {s.name.charAt(0)}
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

function DashboardTab({ dashboard, documents, signatures }: {
  dashboard: ReturnType<typeof generateDocumentVaultDashboard>;
  documents: EmployeeDocument[];
  signatures: ESignatureRequest[];
}) {
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <FolderOpen size={14} />
            <span className="text-[10px] uppercase font-bold">Total Docs</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{dashboard.totalDocuments}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <FileText size={14} />
            <span className="text-[10px] uppercase font-bold">Active</span>
          </div>
          <p className="text-xl font-extrabold text-green-600">{dashboard.activeDocuments}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <PenTool size={14} />
            <span className="text-[10px] uppercase font-bold">Pending Signs</span>
          </div>
          <p className="text-xl font-extrabold text-amber-600">{dashboard.pendingSignatures}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <CheckCircle size={14} />
            <span className="text-[10px] uppercase font-bold">Completed</span>
          </div>
          <p className="text-xl font-extrabold text-blue-600">{dashboard.completedSignatures}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle size={14} />
            <span className="text-[10px] uppercase font-bold">Expired</span>
          </div>
          <p className="text-xl font-extrabold text-red-600">{dashboard.expiredDocuments}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText size={16} className="text-indigo-500" />
            Recent Documents
          </h3>
          <div className="space-y-2">
            {dashboard.recentDocuments.map((doc) => (
              <div key={doc._id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg hover:shadow-sm transition">
                <div className="w-8 h-8 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{doc.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {typeof doc.employeeId === 'object' ? doc.employeeId.fullName : 'Unknown'} · {doc.fileName}
                  </p>
                </div>
                <DocumentStatusBadge status={doc.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent E-Signatures */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PenTool size={16} className="text-amber-500" />
            Recent E-Signature Requests
          </h3>
          <div className="space-y-2">
            {dashboard.recentSignatures.map((sig) => (
              <div key={sig._id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg hover:shadow-sm transition">
                <div className="w-8 h-8 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Stamp size={14} className="text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{sig.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {sig.signers.length} signer(s) · {new Date(sig.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SignerProgress signers={sig.signers} />
                  <SignatureStatusBadge status={sig.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Documents Tab ───────────────────────────────────────────────────────────

function DocumentsTab({ documents, categories }: { documents: EmployeeDocument[]; categories: DocumentCategory[] }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (selectedCategory !== 'all' && d.categoryId?._id !== selectedCategory) return false;
      if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [documents, search, selectedCategory]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> Upload
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-5 py-3">Document</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Uploaded</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.slice(0, 20).map((doc) => (
                <tr key={doc._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {doc.isConfidential && <Lock size={10} className="text-red-500" />}
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-xs">{doc.title}</p>
                        <p className="text-[10px] text-gray-400">{doc.fileName} · v{doc.version}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {typeof doc.employeeId === 'object' ? doc.employeeId.fullName : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {typeof doc.categoryId === 'object' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: doc.categoryId.color + '20', color: doc.categoryId.color }}>
                        {doc.categoryId.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3"><DocumentStatusBadge status={doc.status} /></td>
                  <td className="px-5 py-3 text-[10px] text-gray-400">{(doc.fileSize / 1024).toFixed(0)} KB</td>
                  <td className="px-5 py-3 text-[10px] text-gray-400">{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition" title="View">
                        <Eye size={12} className="text-gray-500" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition" title="Download">
                        <Download size={12} className="text-gray-500" />
                      </button>
                    </div>
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

// ─── E-Signatures Tab ────────────────────────────────────────────────────────

function ESignaturesTab({ signatures }: { signatures: ESignatureRequest[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <PenTool size={16} className="text-amber-500" />
          E-Signature Requests
        </h3>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> New Request
        </button>
      </div>

      <div className="space-y-3">
        {signatures.map((sig) => (
          <div key={sig._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{sig.title}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {typeof sig.requestedBy === 'object' ? sig.requestedBy.name : 'Unknown'} · {new Date(sig.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>
              <SignatureStatusBadge status={sig.status} />
            </div>

            {sig.message && (
              <p className="text-xs text-gray-500 mb-3 italic">{sig.message}</p>
            )}

            {/* Signers */}
            <div className="space-y-2 mb-3">
              {sig.signers.map((signer, si) => (
                <div key={si} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    signer.status === 'SIGNED'
                      ? 'bg-green-100 text-green-700'
                      : signer.status === 'DECLINED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {signer.status === 'SIGNED' ? <CheckCircle size={12} /> : signer.status === 'DECLINED' ? <XCircle size={12} /> : si + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{signer.name}</p>
                    <p className="text-[10px] text-gray-400">{signer.email}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold ${
                      signer.status === 'SIGNED' ? 'text-green-600' : signer.status === 'DECLINED' ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {signer.status}
                    </span>
                    {signer.signedAt && (
                      <p className="text-[9px] text-gray-400">{new Date(signer.signedAt).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar size={10} /> Expires: {new Date(sig.expiresAt).toLocaleDateString('en-IN')}
                </span>
                {sig.accessCode && (
                  <span className="flex items-center gap-1">
                    <Lock size={10} /> Access code required
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Hash size={10} /> {sig.auditTrail.length} events
                </span>
              </div>
              <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1">
                View Audit Trail <ChevronRight size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Categories Tab ──────────────────────────────────────────────────────────

function CategoriesTab({ categories }: { categories: DocumentCategory[] }) {
  const ACCESS_ICONS: Record<string, React.ReactNode> = {
    EMPLOYEE_ONLY: <User size={12} />,
    HR_ONLY: <Shield size={12} />,
    ADMIN_ONLY: <Lock size={12} />,
    MANAGER_AND_ABOVE: <ShieldCheck size={12} />,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Document Categories</h3>
        <button className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1">
          <Plus size={12} /> Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: cat.color }}
              >
                <FileText size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{cat.name}</h4>
                <p className="text-[10px] text-gray-400">{cat.accessLevel.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">{cat.description}</p>
            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-3 border-t border-gray-100 dark:border-slate-700">
              <span className="flex items-center gap-1">
                {ACCESS_ICONS[cat.accessLevel]}
                {cat.accessLevel.replace(/_/g, ' ')}
              </span>
              <span>Retention: {Math.round(cat.retentionDays / 365)}yr</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DocumentVaultPage() {
  const [tab, setTab] = useState<VaultTab>('dashboard');
  const [loading, setLoading] = useState(true);

  const categories = useMemo(() => generateDocumentCategories(), []);
  const documents = useMemo(() => generateEmployeeDocuments(30), []);
  const signatures = useMemo(() => generateSignatureRequests(10), []);
  const dashboard = useMemo(() => generateDocumentVaultDashboard(), []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-gray-500 font-bold">
          <FolderOpen size={32} className="animate-bounce text-indigo-500" />
          <p>Loading Document Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-8 text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <FolderOpen size={32} className="text-indigo-400" /> Document Vault & E-Signatures
            </h1>
            <p className="text-slate-400 mt-2">Secure document management with digital signature workflows and access control.</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-xs uppercase font-bold text-slate-400 mb-1">Pending Signatures</p>
            <p className="text-3xl font-extrabold text-amber-400">{dashboard.pendingSignatures}</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 pb-2 flex-wrap">
          <button onClick={() => setTab('dashboard')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'dashboard' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <FolderOpen size={16} /> Dashboard
          </button>
          <button onClick={() => setTab('documents')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'documents' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <FileText size={16} /> Documents
          </button>
          <button onClick={() => setTab('esignatures')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'esignatures' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <PenTool size={16} /> E-Signatures
          </button>
          <button onClick={() => setTab('categories')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg transition ${tab === 'categories' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Shield size={16} /> Categories
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'dashboard' && <DashboardTab dashboard={dashboard} documents={documents} signatures={signatures} />}
        {tab === 'documents' && <DocumentsTab documents={documents} categories={categories} />}
        {tab === 'esignatures' && <ESignaturesTab signatures={signatures} />}
        {tab === 'categories' && <CategoriesTab categories={categories} />}
      </div>
    </div>
  );
}
