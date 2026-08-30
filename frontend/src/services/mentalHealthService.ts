import type {
    EmployeeBurnoutProfile,
    DepartmentHeatmapEntry,
    MoodTrendPoint,
    MoodDistribution,
    WellnessIntervention,
    EAPUtilizationMetrics,
    WellnessAlert,
    MentalHealthKPIs,
    BurnoutRiskLevel,
    MoodScore,
} from '../types/mentalHealth';

// ─── Utility Helpers ──────────────────────────────────────────────────────────

const rand = (min: number, max: number) =>
    Math.round(Math.random() * (max - min) + min);

const randFloat = (min: number, max: number, dp = 1) =>
    parseFloat((Math.random() * (max - min) + min).toFixed(dp));

const DEPARTMENTS = [
    'Engineering',
    'Sales',
    'Customer Success',
    'Finance',
    'HR',
    'Operations',
    'Marketing',
    'Product',
    'Legal',
    'Design',
];

const FIRST_NAMES = [
    'Arjun', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Deepa', 'Karan', 'Nisha',
    'Rohit', 'Ananya', 'Suresh', 'Meera', 'Amit', 'Kavya', 'Rajesh',
];

const LAST_NAMES = [
    'Sharma', 'Patel', 'Verma', 'Singh', 'Kumar', 'Gupta', 'Mehta', 'Joshi',
    'Nair', 'Iyer', 'Rao', 'Pillai', 'Chatterjee', 'Bose', 'Sen',
];

const TITLES = [
    'Senior Engineer', 'Account Executive', 'Product Manager', 'HR Specialist',
    'Finance Analyst', 'Customer Success Lead', 'Marketing Manager', 'Designer',
    'Operations Manager', 'Legal Counsel', 'Data Scientist', 'DevOps Engineer',
];

const FLAGGED_SIGNALS = [
    'Consecutive late check-ins',
    '40%+ overtime last 30d',
    'Zero PTO taken in 90 days',
    'Mood score below 2 for 2 weeks',
    'Skipped last 3 check-ins',
    'Manager-flagged performance dip',
    'Absenteeism spike',
    'After-hours email activity > 40%',
    'Meeting overload (>6hr/day avg)',
    'High task backlog accumulation',
];

const INTERVENTION_TYPES: WellnessIntervention['type'][] = [
    'COUNSELLING', 'WORKLOAD_REDUCTION', 'FLEXIBLE_HOURS',
    'PEER_SUPPORT', 'LEAVE_RECOMMENDATION', 'EAP_REFERRAL', 'MANAGER_COACHING',
];

const INTERVENTION_LABELS: Record<WellnessIntervention['type'], string> = {
    COUNSELLING: 'Counselling Session',
    WORKLOAD_REDUCTION: 'Workload Reduction Plan',
    FLEXIBLE_HOURS: 'Flexible Hours Arrangement',
    PEER_SUPPORT: 'Peer Support Program',
    LEAVE_RECOMMENDATION: 'Leave of Absence Recommended',
    EAP_REFERRAL: 'EAP Specialist Referral',
    MANAGER_COACHING: 'Manager Coaching Session',
};

const HR_MANAGERS = [
    'Pooja Rajan', 'Vikram Nair', 'Deepa Menon', 'Suresh Pillai', 'Ananya Bose',
];

function riskLevelFromScore(score: number): BurnoutRiskLevel {
    if (score >= 75) return 'CRITICAL';
    if (score >= 55) return 'HIGH';
    if (score >= 30) return 'MODERATE';
    return 'LOW';
}

function generateMoodTrend(length: number): MoodScore[] {
    const trend: MoodScore[] = [];
    let current = rand(2, 4) as MoodScore;
    for (let i = 0; i < length; i++) {
        const delta = rand(-1, 1);
        const next = Math.min(5, Math.max(1, current + delta)) as MoodScore;
        trend.push(next);
        current = next;
    }
    return trend;
}

function isoDateOffset(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
}

// ─── Employee Burnout Profiles ────────────────────────────────────────────────

export function generateEmployeeBurnoutProfiles(count = 40): EmployeeBurnoutProfile[] {
    return Array.from({ length: count }, (_, i) => {
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
        const name = `${firstName} ${lastName}`;
        const riskScore = rand(5, 98);
        const riskLevel = riskLevelFromScore(riskScore);
        const moodTrend = generateMoodTrend(14);
        const latestMood = moodTrend[moodTrend.length - 1];

        const numSignals = riskLevel === 'CRITICAL' ? rand(3, 5)
            : riskLevel === 'HIGH' ? rand(2, 4)
                : riskLevel === 'MODERATE' ? rand(1, 2) : 0;

        const shuffled = [...FLAGGED_SIGNALS].sort(() => Math.random() - 0.5);
        const flaggedSignals = shuffled.slice(0, numSignals);

        return {
            employeeId: `EMP${String(1000 + i).padStart(4, '0')}`,
            name,
            department: DEPARTMENTS[i % DEPARTMENTS.length],
            jobTitle: TITLES[i % TITLES.length],
            avatarInitials: `${firstName[0]}${lastName[0]}`,
            riskLevel,
            riskScore,
            riskDelta: randFloat(-15, 20),
            overtimeHoursLast30d: riskLevel === 'CRITICAL' ? rand(40, 80)
                : riskLevel === 'HIGH' ? rand(20, 45)
                    : rand(0, 20),
            absenteeismRate: randFloat(0, riskLevel === 'CRITICAL' ? 25 : 15),
            moodTrend,
            latestMood,
            lastCheckInDate: isoDateOffset(rand(0, 14)),
            activeIntervention: riskLevel === 'CRITICAL' || (riskLevel === 'HIGH' && Math.random() > 0.5),
            flaggedSignals,
        };
    });
}

// ─── Department Heatmap ───────────────────────────────────────────────────────

export function generateDepartmentHeatmap(): DepartmentHeatmapEntry[] {
    return DEPARTMENTS.map((dept) => {
        const headcount = rand(12, 80);
        const avgRiskScore = randFloat(15, 85);
        const criticalCount = Math.round(headcount * randFloat(0, 0.12));
        const highCount = Math.round(headcount * randFloat(0.05, 0.2));
        const moderateCount = Math.round(headcount * randFloat(0.1, 0.3));
        const lowCount = headcount - criticalCount - highCount - moderateCount;

        return {
            department: dept,
            headcount,
            avgRiskScore,
            criticalCount,
            highCount,
            moderateCount,
            lowCount: Math.max(0, lowCount),
            avgMoodScore: randFloat(2.2, 4.8),
            avgOvertimeHours: randFloat(5, 45),
            trendDirection:
                avgRiskScore > 65 ? 'worsening' : avgRiskScore < 40 ? 'improving' : 'stable',
        };
    });
}

// ─── Mood Trend Data ──────────────────────────────────────────────────────────

export function generateMoodTrendData(days = 90): MoodTrendPoint[] {
    const points: MoodTrendPoint[] = [];
    let score = randFloat(3.0, 4.2);

    for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        score = Math.min(5, Math.max(1, score + randFloat(-0.2, 0.2)));
        points.push({
            date: dateStr,
            avgScore: parseFloat(score.toFixed(2)),
            checkInCount: rand(30, 200),
        });
    }

    return points;
}

export function getMoodDistribution(): MoodDistribution[] {
    const total = 850;
    const raw = [
        { score: 1 as MoodScore, label: 'Exhausted', count: rand(20, 60), color: '#ef4444' },
        { score: 2 as MoodScore, label: 'Struggling', count: rand(50, 100), color: '#f97316' },
        { score: 3 as MoodScore, label: 'Neutral', count: rand(150, 250), color: '#eab308' },
        { score: 4 as MoodScore, label: 'Content', count: rand(250, 350), color: '#22c55e' },
        { score: 5 as MoodScore, label: 'Thriving', count: rand(100, 200), color: '#14b8a6' },
    ];

    const sum = raw.reduce((acc, r) => acc + r.count, 0);
    return raw.map((r) => ({
        ...r,
        percentage: parseFloat(((r.count / sum) * 100).toFixed(1)),
    }));
}

// ─── Wellness Interventions ───────────────────────────────────────────────────

export function generateInterventions(employees: EmployeeBurnoutProfile[]): WellnessIntervention[] {
    const highRisk = employees.filter(
        (e) => e.riskLevel === 'CRITICAL' || e.riskLevel === 'HIGH',
    );

    return highRisk.slice(0, 20).map((emp, i) => {
        const type = INTERVENTION_TYPES[i % INTERVENTION_TYPES.length];
        const statuses: WellnessIntervention['status'][] = ['PROPOSED', 'ACTIVE', 'COMPLETED', 'DECLINED'];
        const status = emp.riskLevel === 'CRITICAL'
            ? (Math.random() > 0.4 ? 'ACTIVE' : 'PROPOSED')
            : statuses[rand(0, 3)];

        const proposedDate = isoDateOffset(rand(1, 30));
        const completedDate = status === 'COMPLETED' ? isoDateOffset(rand(0, 10)) : undefined;

        return {
            id: `INT-${String(2000 + i).padStart(5, '0')}`,
            employeeId: emp.employeeId,
            employeeName: emp.name,
            department: emp.department,
            type,
            status,
            proposedDate,
            completedDate,
            assignedTo: HR_MANAGERS[i % HR_MANAGERS.length],
            notes: `Auto-flagged based on burnout score of ${emp.riskScore}/100. ${emp.flaggedSignals[0] || 'Multiple signals detected'}.`,
            priority: emp.riskLevel === 'CRITICAL' ? 'URGENT'
                : emp.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
            outcome: status === 'COMPLETED' ? 'Employee reported improvement in workload balance.' : undefined,
        };
    });
}

export function getInterventionLabel(type: WellnessIntervention['type']): string {
    return INTERVENTION_LABELS[type];
}

// ─── EAP Utilization ──────────────────────────────────────────────────────────

export function generateEAPMetrics(): EAPUtilizationMetrics {
    const totalSessions = rand(300, 800);
    const uniqueEmployees = rand(80, 200);

    return {
        totalSessions,
        sessionsThisMonth: rand(30, 80),
        uniqueEmployeesServed: uniqueEmployees,
        utilizationRate: randFloat(8, 28),
        avgSessionsPerEmployee: randFloat(1.5, 5, 2),
        byCategory: [
            { category: 'Work-Life Balance', sessions: rand(60, 150), percentage: 22, icon: '⚖️' },
            { category: 'Anxiety & Stress', sessions: rand(80, 180), percentage: 28, icon: '🧠' },
            { category: 'Financial Counselling', sessions: rand(40, 100), percentage: 14, icon: '💰' },
            { category: 'Relationship Support', sessions: rand(30, 80), percentage: 10, icon: '❤️' },
            { category: 'Career Guidance', sessions: rand(50, 120), percentage: 18, icon: '🎯' },
            { category: 'Grief & Bereavement', sessions: rand(10, 40), percentage: 8, icon: '🕊️' },
        ],
        monthlyTrend: Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (11 - i));
            return {
                month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
                sessions: rand(20, 80),
                uniqueUsers: rand(15, 60),
            };
        }),
    };
}

// ─── Wellness Alerts ──────────────────────────────────────────────────────────

export function generateWellnessAlerts(): WellnessAlert[] {
    return [
        {
            id: 'ALT-001',
            severity: 'critical',
            title: 'Critical Burnout Cluster Detected',
            message: '8 employees in Engineering department have crossed critical burnout threshold (score > 80). Immediate intervention recommended.',
            affectedCount: 8,
            department: 'Engineering',
            createdAt: isoDateOffset(0),
            isRead: false,
            actionRequired: true,
        },
        {
            id: 'ALT-002',
            severity: 'warning',
            title: 'Mood Score Decline — Sales Team',
            message: 'Average mood score in Sales dropped from 3.8 to 2.9 over the last 14 days. Correlated with Q3 target pressure.',
            affectedCount: 24,
            department: 'Sales',
            createdAt: isoDateOffset(1),
            isRead: false,
            actionRequired: true,
        },
        {
            id: 'ALT-003',
            severity: 'warning',
            title: 'Check-in Participation Drop',
            message: 'Company-wide check-in participation fell to 58% this week (down from 74%). Consider nudge campaign.',
            affectedCount: 120,
            createdAt: isoDateOffset(2),
            isRead: true,
            actionRequired: false,
        },
        {
            id: 'ALT-004',
            severity: 'info',
            title: 'EAP Utilization Milestone',
            message: 'EAP sessions this month exceeded 65 — highest in the past 6 months. Program ROI tracking updated.',
            affectedCount: 65,
            createdAt: isoDateOffset(3),
            isRead: true,
            actionRequired: false,
        },
        {
            id: 'ALT-005',
            severity: 'critical',
            title: 'Overtime Spike — Finance Dept',
            message: '12 Finance employees averaged 55+ overtime hours in the last 30 days. Statutory compliance at risk.',
            affectedCount: 12,
            department: 'Finance',
            createdAt: isoDateOffset(4),
            isRead: false,
            actionRequired: true,
        },
    ];
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export function computeKPIs(
    employees: EmployeeBurnoutProfile[],
    interventions: WellnessIntervention[],
    eap: EAPUtilizationMetrics,
): MentalHealthKPIs {
    const totalAtRisk = employees.filter(
        (e) => e.riskLevel === 'CRITICAL' || e.riskLevel === 'HIGH',
    ).length;
    const criticalRiskCount = employees.filter((e) => e.riskLevel === 'CRITICAL').length;
    const highRiskCount = employees.filter((e) => e.riskLevel === 'HIGH').length;

    const moodScores = employees.map((e) => e.latestMood);
    const avgMoodScore =
        parseFloat((moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(2));

    const completed = interventions.filter((i) => i.status === 'COMPLETED').length;
    const total = interventions.length;

    return {
        totalAtRisk,
        criticalRiskCount,
        highRiskCount,
        avgCompanyMoodScore: avgMoodScore,
        moodScoreDelta: randFloat(-0.5, 0.5),
        activeInterventions: interventions.filter((i) => i.status === 'ACTIVE').length,
        interventionSuccessRate: total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
        eapUtilizationRate: eap.utilizationRate,
        avgOvertimeHoursCompany: randFloat(12, 35),
        absenteeismRate: randFloat(2, 8),
        checkInParticipationRate: randFloat(55, 85),
    };
}
