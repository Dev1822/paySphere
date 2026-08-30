/**
 * @fileoverview Investigation Timeline Component
 * @description A vertical chronological feed that merges investigation steps,
 * comments, assignments, and evidence into a single visual timeline for a
 * grievance case. Each event type has a distinct icon and color treatment.
 */
import React, { useMemo } from 'react';
import {
  FileText,
  MessageSquare,
  Users,
  Paperclip,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Scale,
  XCircle,
  Ban,
} from 'lucide-react';
import type {
  TimelineEvent,
  InvestigationStep,
  CaseComment,
  CaseAssignment,
  CaseEvidence,
} from '../../types/investigation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Event type config
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string; label: string }
> = {
  STEP: {
    icon: <FileText size={14} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Investigation Step',
  },
  COMMENT: {
    icon: <MessageSquare size={14} />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    label: 'Comment',
  },
  ASSIGNMENT: {
    icon: <Users size={14} />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'Assignment',
  },
  EVIDENCE: {
    icon: <Paperclip size={14} />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Evidence',
  },
  CASE_FILED: {
    icon: <Scale size={14} />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    label: 'Case Filed',
  },
  CASE_RESOLVED: {
    icon: <CheckCircle size={14} />,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Case Resolved',
  },
};

// ---------------------------------------------------------------------------
// Step status styling
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { icon: React.ReactNode; color: string }> = {
  PENDING: { icon: <Clock size={12} />, color: 'text-gray-500 bg-gray-100' },
  IN_PROGRESS: { icon: <Eye size={12} />, color: 'text-blue-600 bg-blue-50' },
  COMPLETED: { icon: <CheckCircle size={12} />, color: 'text-green-600 bg-green-50' },
  BLOCKED: { icon: <AlertTriangle size={12} />, color: 'text-orange-600 bg-orange-50' },
  CANCELLED: { icon: <Ban size={12} />, color: 'text-red-600 bg-red-50' },
};

function StepStatusBadge({ status }: { status: string }) {
  const config = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${config.color}`}>
      {config.icon}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-renderers per event type
// ---------------------------------------------------------------------------

function StepEvent({ data }: { data: InvestigationStep }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm text-gray-900 dark:text-white">
          Step #{data.stepNumber}: {data.title}
        </span>
        <StepStatusBadge status={data.status} />
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400">{data.description}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>Type: <span className="font-semibold">{data.actionType.replace(/_/g, ' ')}</span></span>
        <span>By: <span className="font-semibold">{data.performedBy.name}</span></span>
        {data.dueDate && (
          <span className="text-orange-600 font-semibold">Due: {new Date(data.dueDate).toLocaleDateString('en-IN')}</span>
        )}
        {data.completedAt && (
          <span className="text-green-600">Completed: {new Date(data.completedAt).toLocaleDateString('en-IN')}</span>
        )}
      </div>
      {data.isConfidential && (
        <div className="flex items-center gap-1 text-xs text-red-600 font-bold">
          <Shield size={10} /> CONFIDENTIAL
        </div>
      )}
      {data.attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-1">
          {data.attachments.map((att, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-700">
              <Paperclip size={10} />
              {att.fileName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentEvent({ data }: { data: CaseComment }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm text-gray-900 dark:text-white">
          {data.authorId.name}
        </span>
        {data.isInternal && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 uppercase">
            Internal
          </span>
        )}
        {data.isEncrypted && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">
            Encrypted
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{data.content}</p>
      {data.parentCommentId && (
        <span className="text-xs text-gray-400 italic">Reply to previous comment</span>
      )}
    </div>
  );
}

function AssignmentEvent({ data }: { data: CaseAssignment }) {
  return (
    <div className="space-y-1">
      <p className="text-sm">
        <span className="font-semibold text-gray-900 dark:text-white">{data.assignedTo.name}</span>
        <span className="text-gray-500"> was assigned as </span>
        <span className="font-bold text-purple-600">{data.role.replace(/_/g, ' ')}</span>
        <span className="text-gray-500"> by {data.assignedBy.name}</span>
      </p>
      {!data.isActive && (
        <div className="flex items-center gap-2 mt-1">
          <XCircle size={12} className="text-red-500" />
          <span className="text-xs text-red-600 font-semibold">
            Removed: {data.reason || 'No reason provided'}
          </span>
          {data.unassignedAt && (
            <span className="text-xs text-gray-400">
              on {formatFullDate(data.unassignedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceEvent({ data }: { data: CaseEvidence }) {
  const confidentialityColors: Record<string, string> = {
    PUBLIC: 'bg-green-100 text-green-700',
    CONFIDENTIAL: 'bg-yellow-100 text-yellow-700',
    HIGHLY_CONFIDENTIAL: 'bg-orange-100 text-orange-700',
    RESTRICTED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm text-gray-900 dark:text-white">{data.title}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${confidentialityColors[data.confidentialityLevel] || 'bg-gray-100 text-gray-700'}`}>
          {data.confidentialityLevel.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>Type: <span className="font-semibold">{data.evidenceType.replace(/_/g, ' ')}</span></span>
        <span>Uploaded by: <span className="font-semibold">{data.uploadedBy.name}</span></span>
        <span>{data.fileName} ({(data.fileSize / 1024).toFixed(0)} KB)</span>
      </div>
      {data.verified && (
        <div className="flex items-center gap-1 text-xs text-green-600 font-semibold">
          <CheckCircle size={10} /> Verified by {data.verifiedBy?.name ?? 'unknown'}
        </div>
      )}
      {data.hash && (
        <div className="font-mono text-[10px] text-gray-400 truncate max-w-xs" title={data.hash}>
          Hash: {data.hash}
        </div>
      )}
    </div>
  );
}

function CaseFiledEvent({ data }: { data: Record<string, unknown> }) {
  return (
    <p className="text-sm">
      <span className="font-semibold text-indigo-600">{String(data.caseNumber)}</span>
      <span className="text-gray-500"> was filed with status </span>
      <span className="font-bold">{String(data.status)}</span>
    </p>
  );
}

function CaseResolvedEvent({ data }: { data: Record<string, unknown> }) {
  return (
    <p className="text-sm">
      <span className="font-semibold text-green-600">{String(data.caseNumber)}</span>
      <span className="text-gray-500"> resolved with verdict </span>
      <span className="font-bold">{String(data.verdict)}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface InvestigationTimelineProps {
  timeline: TimelineEvent[];
}

export default function InvestigationTimeline({ timeline }: InvestigationTimelineProps) {
  const grouped = useMemo(() => {
    // Group by date
    const groups = new Map<string, TimelineEvent[]>();
    for (const event of timeline) {
      const dateKey = new Date(event.timestamp).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(event);
    }
    return groups;
  }, [timeline]);

  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <FileText size={32} className="mx-auto mb-2 opacity-50" />
        <p className="font-semibold">No investigation activity yet</p>
        <p className="text-sm mt-1">Timeline events will appear here as the investigation progresses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([dateLabel, events]) => (
        <div key={dateLabel}>
          <div className="sticky top-0 z-10 flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-slate-900 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-700">
              {dateLabel}
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
          </div>

          <div className="relative ml-4">
            {/* Vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />

            <div className="space-y-4">
              {events.map((event, idx) => {
                const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.STEP;
                return (
                  <div key={`${event.type}-${idx}`} className="relative pl-6">
                    {/* Dot */}
                    <div className={`absolute -left-2.5 top-1 w-5 h-5 rounded-full flex items-center justify-center ${config.bgColor} border-2 border-white dark:border-slate-950 z-10`}>
                      <span className={config.color}>{config.icon}</span>
                    </div>

                    {/* Card */}
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono" title={formatFullDate(event.timestamp)}>
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>

                      {event.type === 'STEP' && <StepEvent data={event.data as InvestigationStep} />}
                      {event.type === 'COMMENT' && <CommentEvent data={event.data as CaseComment} />}
                      {event.type === 'ASSIGNMENT' && <AssignmentEvent data={event.data as CaseAssignment} />}
                      {event.type === 'EVIDENCE' && <EvidenceEvent data={event.data as CaseEvidence} />}
                      {event.type === 'CASE_FILED' && <CaseFiledEvent data={event.data as Record<string, unknown>} />}
                      {event.type === 'CASE_RESOLVED' && <CaseResolvedEvent data={event.data as Record<string, unknown>} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
