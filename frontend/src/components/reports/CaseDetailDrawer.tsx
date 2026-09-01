/**
 * @fileoverview Case Detail Drawer Component
 * @description A slide-out drawer that shows the full investigation context for
 * a single grievance case: metadata, timeline, evidence list, comments, and
 * active assignments. Designed to open from the ER Hub case ledger table.
 */
import React, { useState, useMemo } from 'react';
import {
  X,
  Scale,
  FileText,
  Paperclip,
  MessageSquare,
  Users,
  Shield,
  AlertTriangle,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react';
import type { ERCase } from '../../types/employeeRelations';
import type {
  InvestigationStep,
  CaseComment,
  CaseAssignment,
  CaseEvidence,
  CaseTimelineResponse,
} from '../../types/investigation';
import {
  generateCaseTimeline,
  generateInvestigationSteps,
  generateCaseComments,
  generateCaseAssignments,
  generateCaseEvidence,
} from '../../services/investigationService';
import InvestigationTimeline from './InvestigationTimeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtCurrency = (n: number) => `$${n.toLocaleString()}`;

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    LITIGATION_IMMINENT: 'bg-red-600 text-white animate-pulse',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[risk] || styles.LOW}`}>
      {risk.replace(/_/g, ' ')}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isClosed = status.startsWith('CLOSED');
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-bold ${
        isClosed
          ? 'bg-gray-200 text-gray-800'
          : 'bg-blue-100 text-blue-800'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab content sub-components
// ---------------------------------------------------------------------------

function StepsTab({ steps }: { steps: InvestigationStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileText size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm font-semibold">No investigation steps recorded</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div
          key={step._id}
          className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-500">
              Step #{step.stepNumber}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                step.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-700'
                  : step.status === 'BLOCKED'
                    ? 'bg-orange-100 text-orange-700'
                    : step.status === 'CANCELLED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
              }`}
            >
              {step.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {step.title}
          </p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {step.description}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-2">
            <span>{step.actionType.replace(/_/g, ' ')}</span>
            <span>{step.performedBy.name}</span>
            {step.dueDate && (
              <span className="text-orange-600">
                Due {new Date(step.dueDate).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentsTab({ comments }: { comments: CaseComment[] }) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm font-semibold">No comments yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div
          key={c._id}
          className={`border rounded-lg p-3 ${
            c.isInternal
              ? 'border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
              : 'border-gray-200 dark:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {c.authorId.name}
            </span>
            {c.isInternal && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-200 text-yellow-800 uppercase">
                Internal
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400">{c.content}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            {new Date(c.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
      ))}
    </div>
  );
}

function EvidenceTab({ evidence }: { evidence: CaseEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Paperclip size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm font-semibold">No evidence uploaded</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {evidence.map((e) => (
        <div
          key={e._id}
          className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 flex items-center justify-between hover:shadow-sm transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Paperclip size={14} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {e.title}
              </p>
              <p className="text-[10px] text-gray-400">
                {e.evidenceType.replace(/_/g, ' ')} · {e.fileName} ·{' '}
                {(e.fileSize / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {e.verified && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600">
                <CheckCircle size={10} /> Verified
              </span>
            )}
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                e.confidentialityLevel === 'RESTRICTED'
                  ? 'bg-red-100 text-red-700'
                  : e.confidentialityLevel === 'HIGHLY_CONFIDENTIAL'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {e.confidentialityLevel.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentsTab({ assignments }: { assignments: CaseAssignment[] }) {
  if (assignments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Users size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm font-semibold">No team members assigned</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {assignments.map((a) => (
        <div
          key={a._id}
          className={`border rounded-lg p-3 flex items-center justify-between ${
            a.isActive
              ? 'border-green-200 dark:border-green-900/30 bg-green-50/30 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-slate-700 opacity-60'
          }`}
        >
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {a.assignedTo.name}
            </p>
            <p className="text-[10px] text-gray-500">
              <span className="font-bold text-purple-600">
                {a.role.replace(/_/g, ' ')}
              </span>{' '}
              · Assigned by {a.assignedBy.name}
            </p>
          </div>
          {a.isActive ? (
            <span className="text-[10px] font-bold text-green-600">ACTIVE</span>
          ) : (
            <span className="text-[10px] font-bold text-red-500">
              Removed
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

interface CaseDetailDrawerProps {
  caseData: ERCase;
  isOpen: boolean;
  onClose: () => void;
}

type DrawerTab = 'timeline' | 'steps' | 'comments' | 'evidence' | 'assignments';

const TAB_CONFIG: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
  { key: 'timeline', label: 'Timeline', icon: <Clock size={14} /> },
  { key: 'steps', label: 'Steps', icon: <FileText size={14} /> },
  { key: 'comments', label: 'Comments', icon: <MessageSquare size={14} /> },
  { key: 'evidence', label: 'Evidence', icon: <Paperclip size={14} /> },
  { key: 'assignments', label: 'Team', icon: <Users size={14} /> },
];

export default function CaseDetailDrawer({ caseData, isOpen, onClose }: CaseDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('timeline');

  const timeline = useMemo(
    () => generateCaseTimeline(caseData.caseId, caseData.caseId),
    [caseData.caseId],
  );
  const steps = useMemo(
    () => generateInvestigationSteps(caseData.caseId, 5),
    [caseData.caseId],
  );
  const comments = useMemo(
    () => generateCaseComments(caseData.caseId, 4),
    [caseData.caseId],
  );
  const evidence = useMemo(
    () => generateCaseEvidence(caseData.caseId, 3),
    [caseData.caseId],
  );
  const assignments = useMemo(
    () => generateCaseAssignments(caseData.caseId, 2),
    [caseData.caseId],
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white dark:bg-slate-950 shadow-2xl border-l border-gray-200 dark:border-slate-800 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Scale size={18} className="text-red-400 flex-shrink-0" />
                <h2 className="text-lg font-extrabold truncate">
                  {caseData.caseId}
                </h2>
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={caseData.status} />
                <RiskBadge risk={caseData.severity} />
                <span className="text-xs text-slate-400">
                  {caseData.category.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                <span>
                  Filed: <span className="font-semibold text-white">{caseData.filingDate}</span>
                </span>
                <span>
                  Dept: <span className="font-semibold text-white">{caseData.department}</span>
                </span>
                <span>
                  Investigator: <span className="font-semibold text-white">{caseData.assignedInvestigator}</span>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick stats bar */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-slate-800 rounded-lg p-2 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Days Open</p>
              <p className="text-lg font-extrabold">{caseData.daysOpen}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-2 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">SLA Status</p>
              <p className={`text-lg font-extrabold ${caseData.slaBreached ? 'text-red-400' : 'text-green-400'}`}>
                {caseData.slaBreached ? 'BREACH' : 'OK'}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-2 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Exposure</p>
              <p className="text-lg font-extrabold text-orange-400">
                {fmtCurrency(caseData.estimatedLegalExposure)}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-2 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Reporter</p>
              <p className="text-sm font-extrabold truncate">{caseData.reporterName}</p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 flex-shrink-0 overflow-x-auto">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-950'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'timeline' && (
            <InvestigationTimeline timeline={timeline.timeline} />
          )}
          {activeTab === 'steps' && <StepsTab steps={steps} />}
          {activeTab === 'comments' && <CommentsTab comments={comments} />}
          {activeTab === 'evidence' && <EvidenceTab evidence={evidence} />}
          {activeTab === 'assignments' && <AssignmentsTab assignments={assignments} />}
        </div>
      </div>
    </>
  );
}
