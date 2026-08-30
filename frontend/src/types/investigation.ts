// ──────────────────────────────────────────────────────────────────────────────
// Investigation Workflow — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type StepActionType =
  | 'INTAKE_INTERVIEW'
  | 'WITNESS_STATEMENT'
  | 'EVIDENCE_COLLECTION'
  | 'FACT_FINDING'
  | 'HEARING_SCHEDULED'
  | 'HEARING_CONDUCTED'
  | 'FOLLOW_UP'
  | 'RECOMMENDATION'
  | 'LEGAL_REVIEW'
  | 'EXTERNAL_ESCALATION'
  | 'COMMUNICATION_SENT'
  | 'OTHER';

export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';

export type EvidenceType =
  | 'DOCUMENT'
  | 'EMAIL'
  | 'PHOTOGRAPH'
  | 'VIDEO'
  | 'AUDIO'
  | 'SCREENSHOT'
  | 'POLICE_REPORT'
  | 'MEDICAL_RECORD'
  | 'WITNESS_DECLARATION'
  | 'OTHER';

export type ConfidentialityLevel = 'PUBLIC' | 'CONFIDENTIAL' | 'HIGHLY_CONFIDENTIAL' | 'RESTRICTED';

export type AssignmentRole =
  | 'INVESTIGATOR'
  | 'LEGAL_COUNSEL'
  | 'HRBP'
  | 'OBSERVER'
  | 'REVIEWER'
  | 'EXTERNAL_CONSULTANT';

export interface InvestigationStep {
  _id: string;
  tenantId: string;
  caseId: string;
  stepNumber: number;
  actionType: StepActionType;
  title: string;
  description: string;
  performedBy: { _id: string; name: string; email: string };
  confidentialNotes: string;
  isConfidential: boolean;
  attachments: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  }>;
  status: StepStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseComment {
  _id: string;
  tenantId: string;
  caseId: string;
  authorId: { _id: string; name: string; email: string };
  content: string;
  isInternal: boolean;
  isEncrypted: boolean;
  parentCommentId: string | null;
  mentions: string[];
  reactions: Array<{
    userId: string;
    emoji: string;
    reactedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CaseAssignment {
  _id: string;
  tenantId: string;
  caseId: string;
  assignedTo: { _id: string; name: string; email: string };
  assignedBy: { _id: string; name: string; email: string };
  role: AssignmentRole;
  isActive: boolean;
  unassignedAt: string | null;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseEvidence {
  _id: string;
  tenantId: string;
  caseId: string;
  evidenceType: EvidenceType;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: { _id: string; name: string; email: string };
  isAdmissible: boolean;
  confidentialityLevel: ConfidentialityLevel;
  hash: string | null;
  verified: boolean;
  verifiedBy: { _id: string; name: string; email: string } | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  type: 'STEP' | 'COMMENT' | 'ASSIGNMENT' | 'EVIDENCE' | 'CASE_FILED' | 'CASE_RESOLVED';
  timestamp: string;
  data: InvestigationStep | CaseComment | CaseAssignment | CaseEvidence | Record<string, unknown>;
}

export interface CaseTimelineResponse {
  caseId: string;
  caseNumber: string | null;
  status: string | null;
  timeline: TimelineEvent[];
  summary: {
    totalSteps: number;
    totalComments: number;
    totalEvidence: number;
    activeAssignments: number;
  };
}

export interface InvestigationDashboard {
  totalCases: number;
  openCases: number;
  activeAssignments: number;
  evidenceCount: number;
  slaBreachCount: number;
  completionRate: number;
  stepsByStatus: Record<string, number>;
  categoryBreakdown: Array<{ _id: string; count: number }>;
  recentSteps: InvestigationStep[];
}
