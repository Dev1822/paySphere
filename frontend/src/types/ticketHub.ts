// ──────────────────────────────────────────────────────────────────────────────
// Helpdesk & Ticketing Hub — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_EMPLOYEE' | 'WAITING_ON_THIRD_PARTY' | 'RESOLVED' | 'CLOSED' | 'REOPENED';

export interface TicketCategory {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultPriority: TicketPriority;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface SLAPolicy {
  _id: string;
  tenantId: string;
  name: string;
  priority: TicketPriority;
  firstResponseHours: number;
  resolutionHours: number;
  escalationAfterHours: number;
  escalationContact: string;
  businessHoursOnly: boolean;
  isActive: boolean;
}

export interface TicketAttachment {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface Ticket {
  _id: string;
  ticketNumber: string;
  categoryId: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  requesterId: { _id: string; fullName: string; department?: string; email?: string };
  assigneeId: { _id: string; name: string; email: string } | null;
  assigneeName: string;
  team: string;
  firstResponseAt: string | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  slaBreached: boolean;
  slaBreachedAt: string | null;
  resolutionNote: string;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  tags: string[];
  satisfactionRating: number | null;
  createdAt: string;
}

export interface TicketComment {
  _id: string;
  ticketId: string;
  authorId: { _id: string; name: string; email: string };
  authorType: 'EMPLOYEE' | 'HR' | 'MANAGER' | 'SYSTEM';
  authorName: string;
  content: string;
  isInternal: boolean;
  isSystemEvent: boolean;
  createdAt: string;
}

export interface TicketDashboard {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  breachedTickets: number;
  ticketsByPriority: Record<string, number>;
  ticketsByCategory: Array<{ _id: string; count: number; name: string; color: string }>;
  recentTickets: Ticket[];
  avgResolutionHours: number;
}
