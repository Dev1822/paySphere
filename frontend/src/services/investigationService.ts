// ──────────────────────────────────────────────────────────────────────────────
// Investigation Workflow — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
  InvestigationStep,
  CaseComment,
  CaseAssignment,
  CaseEvidence,
  CaseTimelineResponse,
  InvestigationDashboard,
  StepActionType,
  StepStatus,
  EvidenceType,
  AssignmentRole,
  ConfidentialityLevel,
} from '../types/investigation';

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(n, arr.length));
};

const INVESTIGATORS = [
  { _id: 'u1', name: 'Sarah K.', email: 'sarah.k@paysphere.com' },
  { _id: 'u2', name: 'Marcus T.', email: 'marcus.t@paysphere.com' },
  { _id: 'u3', name: 'Priya S.', email: 'priya.s@paysphere.com' },
  { _id: 'u4', name: 'David L.', email: 'david.l@paysphere.com' },
  { _id: 'u5', name: 'External Counsel', email: 'counsel@lawfirm.com' },
];

const STEP_TYPES: StepActionType[] = [
  'INTAKE_INTERVIEW', 'WITNESS_STATEMENT', 'EVIDENCE_COLLECTION',
  'FACT_FINDING', 'HEARING_SCHEDULED', 'HEARING_CONDUCTED',
  'FOLLOW_UP', 'RECOMMENDATION', 'LEGAL_REVIEW',
  'EXTERNAL_ESCALATION', 'COMMUNICATION_SENT', 'OTHER',
];

const STEP_STATUSES: StepStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED'];

const EVIDENCE_TYPES: EvidenceType[] = [
  'DOCUMENT', 'EMAIL', 'PHOTOGRAPH', 'VIDEO', 'AUDIO',
  'SCREENSHOT', 'POLICE_REPORT', 'MEDICAL_RECORD', 'WITNESS_DECLARATION', 'OTHER',
];

const ASSIGNMENT_ROLES: AssignmentRole[] = [
  'INVESTIGATOR', 'LEGAL_COUNSEL', 'HRBP', 'OBSERVER', 'REVIEWER', 'EXTERNAL_CONSULTANT',
];

const CONFIDENTIALITY_LEVELS: ConfidentialityLevel[] = [
  'PUBLIC', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL', 'RESTRICTED',
];

const STEP_TITLES: Record<StepActionType, string[]> = {
  INTAKE_INTERVIEW: ['Initial complainant interview', 'Follow-up intake session', 'Complainant availability assessment'],
  WITNESS_STATEMENT: ['Witness interview — Team Alpha', 'Witness statement from department head', 'Third-party witness collection'],
  EVIDENCE_COLLECTION: ['Document preservation request', 'Digital evidence acquisition', 'Physical evidence cataloging'],
  FACT_FINDING: ['Preliminary fact-finding review', 'Cross-reference witness accounts', 'Timeline reconstruction'],
  HEARING_SCHEDULED: ['Formal hearing — date set', 'Rescheduled hearing notice', 'Preliminary hearing convened'],
  HEARING_CONDUCTED: ['Main hearing completed', 'Supplementary hearing session', 'Cross-examination hearing'],
  FOLLOW_UP: ['Post-hearing follow-up', 'Complainant satisfaction check', 'Witness re-interview'],
  RECOMMENDATION: ['Investigator recommendation draft', 'Final recommendation submitted', 'HR policy recommendation'],
  LEGAL_REVIEW: ['Legal counsel review initiated', 'External legal opinion obtained', 'Regulatory compliance check'],
  EXTERNAL_ESCALATION: ['Escalated to external authority', 'Statutory reporting filed', 'Ombudsman referral'],
  COMMUNICATION_SENT: ['Interim relief notification', 'Outcome communication to parties', 'Policy update notification'],
  OTHER: ['Miscellaneous investigation action', 'Administrative task', 'Scheduling coordination'],
};

const COMMENT_TEMPLATES = [
  'Reviewed the incident report and cross-referenced with the security footage from that date.',
  'Witness A confirmed the timeline presented by the complainant. Need to schedule a follow-up with Witness B.',
  'Legal team has reviewed the preliminary findings. Recommending we proceed to formal hearing.',
  'The department head has provided additional context regarding the workplace policy that was allegedly violated.',
  'Internal audit has produced the relevant financial records. No irregularities found in the payroll entries.',
  'Received the medical certificate. Aligns with the reported timeline. Evidence package is strengthening.',
  'Ethics committee has flagged this case for priority review due to the severity of the allegations.',
  'Manager feedback suggests this may be part of a broader pattern. Recommending expanded scope of investigation.',
  'Preliminary hearing scheduled for next Thursday. All parties have been notified via secure channel.',
  'The complainant has requested interim relief. Assessment is pending HRBP review and legal input.',
];

const EVIDENCE_TITLES = [
  'Email thread — Incident date correspondence',
  'Security camera footage extract',
  'Photographs of the incident location',
  'Signed witness declaration form',
  'Medical certificate from complainant',
  'HR policy document — Workplace conduct',
  'Internal audit report — Q3 payroll',
  'Chat log screenshots from team channel',
  'Audio recording of initial meeting',
  'Police report — related incident',
  'Performance review document — relevant period',
  'Attendance records — incident week',
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function futureDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function generateInvestigationSteps(caseId: string, count?: number): InvestigationStep[] {
  const stepCount = count ?? rng(3, 8);
  const steps: InvestigationStep[] = [];

  for (let i = 0; i < stepCount; i++) {
    const actionType = pick(STEP_TYPES);
    const isCompleted = Math.random() > 0.4;
    const isCancelled = !isCompleted && Math.random() > 0.8;
    const dayOffset = rng(1, 60);

    steps.push({
      _id: `step-${caseId}-${i}`,
      tenantId: 'tenant-1',
      caseId,
      stepNumber: i + 1,
      actionType,
      title: pick(STEP_TITLES[actionType]),
      description: COMMENT_TEMPLATES[rng(0, COMMENT_TEMPLATES.length - 1)],
      performedBy: pick(INVESTIGATORS),
      confidentialNotes: Math.random() > 0.6 ? 'Internal note: needs priority escalation to legal.' : '',
      isConfidential: Math.random() > 0.7,
      attachments: Math.random() > 0.5 ? [{
        fileName: `attachment-${i}.pdf`,
        fileUrl: `/files/attachment-${i}.pdf`,
        fileSize: rng(10000, 500000),
        mimeType: 'application/pdf',
        uploadedAt: daysAgo(dayOffset),
      }] : [],
      status: isCancelled ? 'CANCELLED' : isCompleted ? 'COMPLETED' : pick(['PENDING', 'IN_PROGRESS', 'BLOCKED']),
      dueDate: isCompleted ? null : futureDays(rng(1, 14)),
      completedAt: isCompleted ? daysAgo(dayOffset) : null,
      createdAt: daysAgo(dayOffset),
      updatedAt: daysAgo(dayOffset - 1),
    });
  }

  return steps;
}

export function generateCaseComments(caseId: string, count?: number): CaseComment[] {
  const commentCount = count ?? rng(2, 6);
  return Array.from({ length: commentCount }, (_, i) => {
    const dayOffset = rng(1, 45);
    return {
      _id: `comment-${caseId}-${i}`,
      tenantId: 'tenant-1',
      caseId,
      authorId: pick(INVESTIGATORS),
      content: COMMENT_TITLES[i % COMMENT_TITLES.length] ?? COMMENT_TEMPLATES[0],
      isInternal: Math.random() > 0.7,
      isEncrypted: Math.random() > 0.8,
      parentCommentId: i > 0 && Math.random() > 0.6 ? `comment-${caseId}-${i - 1}` : null,
      mentions: [],
      reactions: [],
      createdAt: daysAgo(dayOffset),
      updatedAt: daysAgo(dayOffset),
    };
  });
}

export function generateCaseAssignments(caseId: string, count?: number): CaseAssignment[] {
  const assignCount = count ?? rng(1, 3);
  const usedRoles = new Set<string>();
  const assignments: CaseAssignment[] = [];

  for (let i = 0; i < assignCount; i++) {
    const role = ASSIGNMENT_ROLES.find((r) => !usedRoles.has(r)) ?? pick(ASSIGNMENT_ROLES);
    usedRoles.add(role);
    const dayOffset = rng(1, 50);
    const isActive = Math.random() > 0.2;

    assignments.push({
      _id: `assign-${caseId}-${i}`,
      tenantId: 'tenant-1',
      caseId,
      assignedTo: pick(INVESTIGATORS),
      assignedBy: INVESTIGATORS[0],
      role,
      isActive,
      unassignedAt: isActive ? null : daysAgo(dayOffset - 5),
      reason: isActive ? '' : pick(['Completed role', 'Reassigned to external counsel', 'Removed per policy']),
      createdAt: daysAgo(dayOffset),
      updatedAt: daysAgo(dayOffset),
    });
  }

  return assignments;
}

export function generateCaseEvidence(caseId: string, count?: number): CaseEvidence[] {
  const evCount = count ?? rng(1, 5);
  return Array.from({ length: evCount }, (_, i) => {
    const dayOffset = rng(1, 40);
    const isVerified = Math.random() > 0.4;
    return {
      _id: `evidence-${caseId}-${i}`,
      tenantId: 'tenant-1',
      caseId,
      evidenceType: pick(EVIDENCE_TYPES),
      title: pick(EVIDENCE_TITLES),
      description: COMMENT_TEMPLATES[i % COMMENT_TEMPLATES.length],
      fileUrl: `/files/evidence-${caseId}-${i}.pdf`,
      fileName: `evidence-${caseId}-${i}.pdf`,
      fileSize: rng(5000, 2000000),
      mimeType: 'application/pdf',
      uploadedBy: pick(INVESTIGATORS),
      isAdmissible: Math.random() > 0.1,
      confidentialityLevel: pick(CONFIDENTIALITY_LEVELS),
      hash: `sha256:${Array.from({ length: 64 }, () => pick('0123456789abcdef'.split(''))).join('')}`,
      verified: isVerified,
      verifiedBy: isVerified ? pick(INVESTIGATORS) : null,
      verifiedAt: isVerified ? daysAgo(dayOffset - 2) : null,
      createdAt: daysAgo(dayOffset),
    };
  });
}

export function generateCaseTimeline(caseId: string, caseNumber: string): CaseTimelineResponse {
  const steps = generateInvestigationSteps(caseId, rng(4, 7));
  const comments = generateCaseComments(caseId, rng(2, 4));
  const assignments = generateCaseAssignments(caseId, rng(1, 3));
  const evidence = generateCaseEvidence(caseId, rng(2, 5));

  const timeline = [
    ...steps.map((s) => ({ type: 'STEP' as const, timestamp: s.createdAt, data: s })),
    ...comments.map((c) => ({ type: 'COMMENT' as const, timestamp: c.createdAt, data: c })),
    ...assignments.map((a) => ({ type: 'ASSIGNMENT' as const, timestamp: a.createdAt, data: a })),
    ...evidence.map((e) => ({ type: 'EVIDENCE' as const, timestamp: e.createdAt, data: e })),
    { type: 'CASE_FILED' as const, timestamp: daysAgo(rng(30, 90)), data: { caseNumber, status: 'Under Inquiry' } },
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    caseId,
    caseNumber,
    status: 'Under Inquiry',
    timeline,
    summary: {
      totalSteps: steps.length,
      totalComments: comments.length,
      totalEvidence: evidence.length,
      activeAssignments: assignments.filter((a) => a.isActive).length,
    },
  };
}

export function generateInvestigationDashboard(): InvestigationDashboard {
  return {
    totalCases: rng(20, 60),
    openCases: rng(8, 25),
    activeAssignments: rng(10, 30),
    evidenceCount: rng(40, 120),
    slaBreachCount: rng(1, 8),
    completionRate: rng(35, 75),
    stepsByStatus: {
      PENDING: rng(5, 15),
      IN_PROGRESS: rng(3, 10),
      COMPLETED: rng(15, 40),
      BLOCKED: rng(0, 4),
      CANCELLED: rng(0, 3),
    },
    categoryBreakdown: [
      { _id: 'Filed', count: rng(3, 10) },
      { _id: 'Under Inquiry', count: rng(5, 15) },
    ],
    recentSteps: generateInvestigationSteps('recent', 5),
  };
}
