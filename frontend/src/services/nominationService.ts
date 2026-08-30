// ──────────────────────────────────────────────────────────────────────────────
// Recognition & Nomination — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
  NominationCategory,
  Nomination,
  RecognitionCycle,
  LeaderboardEntry,
  NominationDashboard,
  NominationStatus,
} from '../types/nomination';

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const PEOPLE = [
  { _id: 'emp1', fullName: 'Priya Sharma', department: 'Engineering' },
  { _id: 'emp2', fullName: 'Marcus Johnson', department: 'Sales' },
  { _id: 'emp3', fullName: 'Aisha Patel', department: 'Design' },
  { _id: 'emp4', fullName: 'Chen Wei', department: 'Operations' },
  { _id: 'emp5', fullName: 'Sarah Kim', department: 'HR' },
  { _id: 'emp6', fullName: 'David Okafor', department: 'Finance' },
  { _id: 'emp7', fullName: 'Elena Volkov', department: 'Engineering' },
  { _id: 'emp8', fullName: 'Raj Gupta', department: 'Marketing' },
  { _id: 'emp9', fullName: 'Sofia Martinez', department: 'Product' },
  { _id: 'emp10', fullName: 'James Tan', department: 'Engineering' },
];

const NOMINATION_TITLES = [
  'Outstanding sprint delivery under tight deadline',
  'Went above and beyond for customer satisfaction',
  'Mentored new team member through onboarding',
  'Initiated process improvement saving 20 hours/week',
  'Led cross-functional project to successful launch',
  'Resolved critical production incident within SLA',
  'Created reusable component library for the team',
  'Facilitated team knowledge sharing session',
  'Demonstrated exceptional collaboration across departments',
  'Took ownership of technical debt reduction initiative',
];

const NOMINATION_REASONS = [
  'Consistently delivers high-quality work and raises the bar for the entire team. Their technical skills and positive attitude make them an invaluable team member.',
  'Showed exceptional dedication by staying late to help resolve a critical client issue, saving the account relationship.',
  'Took time out of their busy schedule to mentor three new hires, ensuring they were productive within their first month.',
  'Identified a bottleneck in our deployment pipeline and built an automated solution that reduced release time by 40%.',
  'Coordinated between engineering, design, and product to ship a major feature ahead of schedule while maintaining quality.',
  'Responded to a P0 production incident at 2 AM and had the system back online within 30 minutes, minimizing customer impact.',
  'Built a shared component library that has been adopted by four teams, significantly reducing duplicate UI work.',
  'Organized monthly tech talks that have become the most popular internal learning event, with 90%+ attendance.',
  'Proactively reached out to a struggling colleague and helped them get back on track through pair programming sessions.',
  'Volunteered to lead the infrastructure modernization project, resulting in 30% cost savings on cloud compute.',
];

const CATEGORY_CONFIG: Array<{
  name: string;
  description: string;
  icon: string;
  color: string;
  pointsPerNomination: number;
  maxNominationsPerMonth: number;
  requiresManagerApproval: boolean;
}> = [
  { name: 'Innovation Champion', description: 'For creative problem-solving and innovative solutions', icon: 'lightbulb', color: '#f59e0b', pointsPerNomination: 25, maxNominationsPerMonth: 2, requiresManagerApproval: true },
  { name: 'Team Player', description: 'For exceptional collaboration and teamwork', icon: 'users', color: '#3b82f6', pointsPerNomination: 15, maxNominationsPerMonth: 5, requiresManagerApproval: false },
  { name: 'Customer Hero', description: 'For outstanding customer service and satisfaction', icon: 'heart', color: '#ef4444', pointsPerNomination: 20, maxNominationsPerMonth: 3, requiresManagerApproval: true },
  { name: 'Rising Star', description: 'For new employees who have made an exceptional impact', icon: 'star', color: '#8b5cf6', pointsPerNomination: 20, maxNominationsPerMonth: 2, requiresManagerApproval: false },
  { name: 'Impact Driver', description: 'For measurable business impact and results', icon: 'zap', color: '#10b981', pointsPerNomination: 30, maxNominationsPerMonth: 2, requiresManagerApproval: true },
  { name: 'Culture Builder', description: 'For strengthening company culture and values', icon: 'globe', color: '#06b6d4', pointsPerNomination: 15, maxNominationsPerMonth: 4, requiresManagerApproval: false },
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function monthsAgo(months: number): { month: number; year: number } {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function generateNominationCategories(): NominationCategory[] {
  return CATEGORY_CONFIG.map((cat, i) => ({
    _id: `cat-${i}`,
    tenantId: 'tenant-1',
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    color: cat.color,
    pointsPerNomination: cat.pointsPerNomination,
    maxNominationsPerMonth: cat.maxNominationsPerMonth,
    requiresManagerApproval: cat.requiresManagerApproval,
    isActive: true,
    createdBy: 'admin-1',
    createdAt: daysAgo(90),
  }));
}

export function generateNominations(count = 30): Nomination[] {
  const categories = generateNominationCategories();
  const statuses: NominationStatus[] = ['APPROVED', 'APPROVED', 'APPROVED', 'PENDING_APPROVAL', 'REJECTED'];

  return Array.from({ length: count }, (_, i) => {
    const category = pick(categories);
    const nominee = pick(PEOPLE);
    const nominator = pick(PEOPLE.filter((p) => p._id !== nominee._id));
    const dayOffset = rng(1, 60);
    const status = pick(statuses);
    const isApproved = status === 'APPROVED';

    return {
      _id: `nom-${i}`,
      tenantId: 'tenant-1',
      categoryId: category,
      nomineeId: nominee,
      nominatorId: nominator,
      managerId: isApproved ? 'mgr-1' : null,
      title: pick(NOMINATION_TITLES),
      reason: pick(NOMINATION_REASONS),
      impactDescription: rng(0, 1) > 0.4 ? 'Had measurable positive impact on team velocity and morale.' : '',
      isPublic: rng(0, 1) > 0.1,
      pointsAwarded: isApproved ? category.pointsPerNomination : 0,
      status,
      approvalNote: status === 'APPROVED' ? 'Approved — great nomination!' : status === 'REJECTED' ? 'Insufficient detail in the reason provided.' : '',
      approvedBy: isApproved ? 'mgr-1' : null,
      approvedAt: isApproved ? daysAgo(dayOffset - 2) : null,
      rejectedBy: status === 'REJECTED' ? 'mgr-1' : null,
      rejectedAt: status === 'REJECTED' ? daysAgo(dayOffset - 1) : null,
      reactionCount: rng(0, 15),
      commentCount: rng(0, 5),
      cycleId: null,
      reactions: Math.random() > 0.5
        ? [
            { emoji: '🎉', count: rng(1, 8) },
            { emoji: '👏', count: rng(0, 5) },
          ]
        : [],
      createdAt: daysAgo(dayOffset),
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function generateLeaderboard(): LeaderboardEntry[] {
  return PEOPLE.map((person, i) => ({
    _id: person._id,
    employeeName: person.fullName,
    department: person.department,
    totalPoints: rng(20, 200),
    nominationCount: rng(2, 10),
    categoryCount: rng(1, 4),
  })).sort((a, b) => b.totalPoints - a.totalPoints);
}

export function generateCycles(): RecognitionCycle[] {
  return Array.from({ length: 3 }, (_, i) => {
    const { month, year } = monthsAgo(i);
    const status = i === 0 ? 'OPEN' : i === 1 ? 'FINALIZED' : 'OPEN';
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return {
      _id: `cycle-${i}`,
      tenantId: 'tenant-1',
      title: `${startDate.toLocaleString('en-US', { month: 'long' })} ${year} Recognition`,
      month,
      year,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: status as any,
      totalNominations: status === 'FINALIZED' ? rng(15, 30) : 0,
      totalPointsAwarded: status === 'FINALIZED' ? rng(200, 800) : 0,
      finalizedBy: status === 'FINALIZED' ? 'admin-1' : null,
      finalizedAt: status === 'FINALIZED' ? daysAgo(5) : null,
      createdAt: daysAgo(30 + i * 30),
    };
  });
}

export function generateNominationDashboard(): NominationDashboard {
  const recentNoms = generateNominations(5);
  const top = pick(PEOPLE);

  return {
    totalNominations: rng(100, 300),
    monthNominations: rng(15, 40),
    pendingApprovals: rng(3, 10),
    totalCategories: CATEGORY_CONFIG.length,
    topNominee: {
      _id: top._id,
      totalPoints: rng(100, 300),
      count: rng(5, 12),
      employee: { fullName: top.fullName, department: top.department },
    },
    recentNominations: recentNoms,
  };
}
