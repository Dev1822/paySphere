// ──────────────────────────────────────────────────────────────────────────────
// Recognition & Nomination — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type NominationStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type CycleStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINALIZED';

export interface NominationCategory {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  pointsPerNomination: number;
  maxNominationsPerMonth: number;
  requiresManagerApproval: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface Nomination {
  _id: string;
  tenantId: string;
  categoryId: NominationCategory;
  nomineeId: { _id: string; fullName: string; department?: string };
  nominatorId: { _id: string; fullName: string };
  managerId: string | null;
  title: string;
  reason: string;
  impactDescription: string;
  isPublic: boolean;
  pointsAwarded: number;
  status: NominationStatus;
  approvalNote: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  reactionCount: number;
  commentCount: number;
  cycleId: string | null;
  reactions: Array<{ emoji: string; count: number }>;
  createdAt: string;
}

export interface NominationComment {
  _id: string;
  tenantId: string;
  nominationId: string;
  authorId: { _id: string; name: string; email: string };
  content: string;
  isManagerComment: boolean;
  createdAt: string;
}

export interface RecognitionCycle {
  _id: string;
  tenantId: string;
  title: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  totalNominations: number;
  totalPointsAwarded: number;
  finalizedBy: string | null;
  finalizedAt: string | null;
  createdAt: string;
}

export interface NominationFeedResponse {
  nominations: Nomination[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeaderboardEntry {
  _id: string;
  employeeName: string;
  department: string;
  totalPoints: number;
  nominationCount: number;
  categoryCount: number;
}

export interface NominationDashboard {
  totalNominations: number;
  monthNominations: number;
  pendingApprovals: number;
  totalCategories: number;
  topNominee: {
    _id: string;
    totalPoints: number;
    count: number;
    employee: { fullName: string; department: string } | null;
  } | null;
  recentNominations: Nomination[];
}
