// ──────────────────────────────────────────────────────────────────────────────
// Helpdesk & Ticketing Hub — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
  TicketCategory,
  SLAPolicy,
  Ticket,
  TicketComment,
  TicketDashboard,
  TicketPriority,
  TicketStatus,
} from '../types/ticketHub';

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const PEOPLE = [
  { _id: 'u1', name: 'Priya Sharma', fullName: 'Priya Sharma', email: 'priya@paysphere.com', department: 'Engineering' },
  { _id: 'u2', name: 'Marcus Johnson', fullName: 'Marcus Johnson', email: 'marcus@paysphere.com', department: 'Sales' },
  { _id: 'u3', name: 'Aisha Patel', fullName: 'Aisha Patel', email: 'aisha@paysphere.com', department: 'Design' },
  { _id: 'u4', name: 'Chen Wei', fullName: 'Chen Wei', email: 'chen@paysphere.com', department: 'Operations' },
  { _id: 'u5', name: 'Sarah Kim', fullName: 'Sarah Kim', email: 'sarah@paysphere.com', department: 'HR' },
  { _id: 'u6', name: 'David Okafor', fullName: 'David Okafor', email: 'david@paysphere.com', department: 'Finance' },
  { _id: 'u7', name: 'Elena Volkov', fullName: 'Elena Volkov', email: 'elena@paysphere.com', department: 'Engineering' },
  { _id: 'u8', name: 'Raj Gupta', fullName: 'Raj Gupta', email: 'raj@paysphere.com', department: 'Marketing' },
];

const CATEGORY_CONFIG = [
  { name: 'Payroll & Salary', description: 'Salary discrepancies, payslip issues, tax deductions', icon: 'wallet', color: '#3b82f6', defaultPriority: 'HIGH' as const },
  { name: 'Leave & Attendance', description: 'Leave requests, attendance corrections, WFH policy', icon: 'calendar', color: '#8b5cf6', defaultPriority: 'MEDIUM' as const },
  { name: 'Benefits & Insurance', description: 'Health insurance, gratuity, PF, ESIC queries', icon: 'shield', color: '#10b981', defaultPriority: 'MEDIUM' as const },
  { name: 'IT & Access', description: 'System access, VPN, hardware issues, software requests', icon: 'monitor', color: '#f59e0b', defaultPriority: 'HIGH' as const },
  { name: 'Policy & Compliance', description: 'Policy clarifications, code of conduct, POSH', icon: 'book', color: '#ef4444', defaultPriority: 'MEDIUM' as const },
  { name: 'Onboarding & Offboarding', description: 'New hire setup, exit process, asset return', icon: 'user-plus', color: '#06b6d4', defaultPriority: 'LOW' as const },
  { name: 'Workplace Facilities', description: 'Office maintenance, cafeteria, parking, desk allocation', icon: 'building', color: '#6366f1', defaultPriority: 'LOW' as const },
  { name: 'Training & Development', description: 'Course enrollment, certification, L&D budget', icon: 'graduation-cap', color: '#ec4899', defaultPriority: 'LOW' as const },
];

const TICKET_SUBJECTS = [
  'Salary discrepancy in August payslip',
  'Unable to access VPN from home',
  'Leave balance not updated after sick leave',
  'Health insurance claim rejected',
  'Need new laptop for remote work',
  'PF deduction higher than expected',
  'Parking pass renewal for Q3',
  'Training budget approval pending',
  'Onboarding documents not received',
  'Office AC not working on 3rd floor',
  'Expense reimbursement delayed',
  'Access to analytics dashboard needed',
  'Gratuity calculation query',
  'Performance review not visible',
  'Company phone not yet received',
  'Team lunch budget request',
];

const TICKET_DESCRIPTIONS = [
  'My August payslip shows a lower amount than expected. The basic salary component seems correct but the HRA deduction appears to be double what it should be. Please investigate.',
  'Since yesterday I am unable to connect to the company VPN. I have tried restarting my router and reinstalling the VPN client. Error code: SSL_HANDSHAKE_FAILURE.',
  'I took 3 days of sick leave last week but the leave portal still shows my balance unchanged. The leave was approved by my manager on the 15th.',
  'I submitted a health insurance claim for my dental procedure but it was rejected saying "non-covered procedure". However, dental is listed as covered under our group policy.',
  'My current laptop is 4 years old and running extremely slowly. I need a new one to work effectively. Can I get a MacBook Pro for development work?',
  'I noticed my PF deduction this month is ₹3,200 instead of the usual ₹2,100. No salary change was communicated. Please check and correct.',
];

const COMMENT_CONTENT = [
  'I have looked into this and it appears the HRA was calculated based on the old tax regime. Switching to the new regime would fix this.',
  'The IT team has been notified and they will reach out to you within 2 hours to troubleshoot the VPN issue.',
  'I have updated your leave balance manually. The system auto-approve flow had a bug that has now been fixed.',
  'After reviewing your claim with the insurance provider, dental procedures under ₹5,000 are not covered under the basic plan. You would need the premium add-on.',
  'Your laptop replacement request has been approved. Procurement will arrange delivery within 5 business days.',
  'The PF deduction was higher because a one-time arrear from last month was adjusted. This will normalize next month.',
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

export function generateTicketCategories(): TicketCategory[] {
  return CATEGORY_CONFIG.map((cat, i) => ({
    _id: `tcat-${i}`,
    tenantId: 'tenant-1',
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    color: cat.color,
    defaultPriority: cat.defaultPriority,
    isActive: true,
    createdBy: 'admin-1',
    createdAt: daysAgo(120),
  }));
}

export function generateSLAPolicies(): SLAPolicy[] {
  const priorities: Array<{ priority: TicketPriority; name: string; firstResponseHours: number; resolutionHours: number; escalationAfterHours: number }> = [
    { priority: 'LOW', name: 'Low Priority SLA', firstResponseHours: 24, resolutionHours: 72, escalationAfterHours: 48 },
    { priority: 'MEDIUM', name: 'Medium Priority SLA', firstResponseHours: 8, resolutionHours: 24, escalationAfterHours: 16 },
    { priority: 'HIGH', name: 'High Priority SLA', firstResponseHours: 4, resolutionHours: 8, escalationAfterHours: 6 },
    { priority: 'URGENT', name: 'Urgent Priority SLA', firstResponseHours: 1, resolutionHours: 4, escalationAfterHours: 2 },
  ];

  return priorities.map((p, i) => ({
    _id: `sla-${i}`,
    tenantId: 'tenant-1',
    name: p.name,
    priority: p.priority,
    firstResponseHours: p.firstResponseHours,
    resolutionHours: p.resolutionHours,
    escalationAfterHours: p.escalationAfterHours,
    escalationContact: 'hr-head@paysphere.com',
    businessHoursOnly: true,
    isActive: true,
  }));
}

export function generateTickets(count = 30): Ticket[] {
  const categories = generateTicketCategories();
  const statuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_EMPLOYEE', 'RESOLVED', 'CLOSED', 'REOPENED'];
  const priorities: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  return Array.from({ length: count }, (_, i) => {
    const cat = pick(categories);
    const requester = pick(PEOPLE);
    const status = pick(statuses);
    const priority = i < 3 ? 'URGENT' as const : i < 8 ? 'HIGH' as const : (cat.defaultPriority || pick(priorities));
    const dayOffset = rng(1, 30);
    const isResolved = status === 'RESOLVED' || status === 'CLOSED';
    const slaDue = new Date(Date.now() + rng(-20, 20) * 3600000);
    const isBreached = !isResolved && slaDue < new Date();

    return {
      _id: `ticket-${i}`,
      ticketNumber: `TKT-2026-${String(i + 1).padStart(4, '0')}`,
      categoryId: cat,
      subject: pick(TICKET_SUBJECTS),
      description: pick(TICKET_DESCRIPTIONS),
      priority,
      status,
      requesterId: requester,
      assigneeId: pick(PEOPLE.slice(4, 8)),
      assigneeName: pick(PEOPLE.slice(4, 8)).name,
      team: pick(['Payroll', 'IT Support', 'HR Ops', 'Benefits', 'General']),
      firstResponseAt: status !== 'OPEN' ? hoursAgo(rng(1, 24)) : null,
      firstResponseDueAt: hoursAgo(-rng(2, 16)),
      resolutionDueAt: slaDue.toISOString(),
      slaBreached: isBreached,
      slaBreachedAt: isBreached ? hoursAgo(rng(1, 10)) : null,
      resolutionNote: isResolved ? pick(COMMENT_CONTENT) : '',
      resolvedAt: isResolved ? daysAgo(rng(1, 5)) : null,
      closedAt: status === 'CLOSED' ? daysAgo(rng(0, 3)) : null,
      closedBy: status === 'CLOSED' ? 'admin-1' : null,
      reopenCount: status === 'REOPENED' ? rng(1, 2) : 0,
      lastReopenedAt: status === 'REOPENED' ? daysAgo(1) : null,
      tags: pick([[], ['payroll'], ['urgent'], ['it-issue'], ['policy']]),
      satisfactionRating: isResolved ? pick([3, 4, 5, 4, 5]) : null,
      satisfactionComment: isResolved ? 'Quick resolution, thanks!' : '',
      createdAt: daysAgo(dayOffset),
    };
  });
}

export function generateTicketComments(ticketId: string, count = 4): TicketComment[] {
  const authorTypes: Array<TicketComment['authorType']> = ['EMPLOYEE', 'HR', 'SYSTEM', 'HR'];

  return Array.from({ length: count }, (_, i) => {
    const authorType = i === 0 ? 'EMPLOYEE' : pick(authorTypes);
    const author = authorType === 'EMPLOYEE' ? pick(PEOPLE.slice(0, 4)) : pick(PEOPLE.slice(4, 8));

    return {
      _id: `comment-${ticketId}-${i}`,
      ticketId,
      authorId: author,
      authorType,
      authorName: author.name,
      content: i === 0 ? pick(TICKET_DESCRIPTIONS) : pick(COMMENT_CONTENT),
      isInternal: authorType === 'HR' && Math.random() > 0.7,
      isSystemEvent: authorType === 'SYSTEM',
      createdAt: hoursAgo(rng(1, 48) - i * 2),
    };
  });
}

export function generateTicketDashboard(): TicketDashboard {
  const tickets = generateTickets(25);
  const open = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolved = tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
  const breached = tickets.filter((t) => t.slaBreached).length;

  return {
    totalTickets: tickets.length,
    openTickets: open,
    inProgressTickets: inProgress,
    resolvedTickets: resolved,
    breachedTickets: breached,
    ticketsByPriority: {
      LOW: tickets.filter((t) => t.priority === 'LOW').length,
      MEDIUM: tickets.filter((t) => t.priority === 'MEDIUM').length,
      HIGH: tickets.filter((t) => t.priority === 'HIGH').length,
      URGENT: tickets.filter((t) => t.priority === 'URGENT').length,
    },
    ticketsByCategory: CATEGORY_CONFIG.map((cat, i) => ({
      _id: `tcat-${i}`,
      count: rng(2, 8),
      name: cat.name,
      color: cat.color,
    })),
    recentTickets: tickets.slice(0, 8),
    avgResolutionHours: rng(8, 48),
  };
}
