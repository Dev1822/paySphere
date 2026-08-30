// ──────────────────────────────────────────────────────────────────────────────
// Mergers & Acquisitions (M&A) HR Harmonization Hub — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
    AcquisitionTarget,
    HarmonizationKPIs,
    RedundancyRecord,
    TalentRetentionProfile,
    BenefitMapping,
    IntegrationTimelineEvent
} from '../types/maHarmonization';

const rng = (min: number, max: number, decimals = 0): number => {
    const v = Math.random() * (max - min) + min;
    return decimals ? parseFloat(v.toFixed(decimals)) : Math.round(v);
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function generateAcquisitionTarget(): AcquisitionTarget {
    return {
        id: 'ACQ-2026-02',
        targetName: 'FinStream Global',
        industry: 'FinTech / Lending',
        headcount: 450,
        dealValue: 120000000,
        closeDate: '2026-11-01',
        status: 'INTEGRATION_ACTIVE',
        overallProgress: 45,
        keyRisks: 'MEDIUM',
    };
}

export function generateHarmonizationKPIs(): HarmonizationKPIs {
    return {
        totalHeadcountAcquired: 450,
        redundantRolesIdentified: 85,
        severanceBudgetUsed: 1250000,
        severanceBudgetTotal: 3000000,
        retainedCriticalTalentPct: 92,
        cultureIntegrationScore: 74,
        benefitsCostDelta: -450000,
    };
}

export function generateRedundancyAnalysis(): RedundancyRecord[] {
    const roles = [
        { d: 'Engineering', r: 'Software Engineer', ah: 300, th: 120, tom: 380 },
        { d: 'Engineering', r: 'QA Manager', ah: 12, th: 8, tom: 15 },
        { d: 'Finance', r: 'Payroll Specialist', ah: 5, th: 3, tom: 6 },
        { d: 'Sales', r: 'Account Executive', ah: 80, th: 45, tom: 125 },
        { d: 'HR', r: 'HR Business Partner', ah: 15, th: 8, tom: 18 },
        { d: 'Operations', r: 'Support Lead', ah: 25, th: 15, tom: 30 },
    ];

    return roles.map((role, i) => {
        const combined = role.ah + role.th;
        const redundancyCount = Math.max(0, combined - role.tom);
        const decision = redundancyCount > 0 ? (Math.random() > 0.3 ? 'LAYOFF' : 'REDEPLOY') : 'RETAIN_ALL';
        return {
            id: `RED-${i}`,
            department: role.d,
            role: role.r,
            acquirerHeadcount: role.ah,
            targetHeadcount: role.th,
            combinedHeadcount: combined,
            targetOperatingModel: role.tom,
            redundancyCount,
            estimatedSeveranceImpact: redundancyCount * rng(15000, 45000),
            decision,
            actionProgress: redundancyCount > 0 ? rng(0, 100) : 100,
        };
    });
}

export function generateTalentRetentionProfiles(count = 20): TalentRetentionProfile[] {
    const firstNames = ['Arjun', 'Sarah', 'Priya', 'David', 'Neha', 'John', 'Anjali', 'Michael'];
    const lastNames = ['Sharma', 'Smith', 'Patel', 'Johnson', 'Verma', 'Williams', 'Kaur', 'Brown'];

    return Array.from({ length: count }, (_, i) => ({
        employeeId: `TGT-${1000 + i}`,
        name: `${pick(firstNames)} ${pick(lastNames)}`,
        role: pick(['Senior Engineer', 'Engineering Manager', 'VP of Sales', 'Lead Data Scientist', 'Product Director']),
        department: pick(['Engineering', 'Sales', 'Product', 'Data']),
        criticality: pick(['MUST_RETAIN', 'MUST_RETAIN', 'IMPORTANT', 'STANDARD']), // Weighted
        flightRisk: pick(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        retentionBonus: rng(10000, 75000),
        vestingUnmappedEquity: rng(20000, 150000),
        sentimentScore: rng(20, 50, 1) / 10,
        status: pick(['PENDING_OFFER', 'OFFER_ACCEPTED', 'RESIGNED', 'TRANSITIONED']),
    }));
}

export function generateBenefitMappings(): BenefitMapping[] {
    return [
        { category: 'Health Insurance', acquirerBenefit: 'Tier 1 Cigna Comprehensive', targetBenefit: 'Tier 2 Aetna Standard', harmonizationAction: 'MIGRATE_TO_ACQUIRER', costImpactPerEmployee: 1200, completionStatus: 80 },
        { category: 'Retirement (401k/EPF)', acquirerBenefit: '6% Match', targetBenefit: '3% Match', harmonizationAction: 'MIGRATE_TO_ACQUIRER', costImpactPerEmployee: 2500, completionStatus: 45 },
        { category: 'PTO Policy', acquirerBenefit: 'Unlimited PTO', targetBenefit: '20 Days Accrued', harmonizationAction: 'MIGRATE_TO_ACQUIRER', costImpactPerEmployee: 0, completionStatus: 100 },
        { category: 'Wellness Allowance', acquirerBenefit: 'None', targetBenefit: '$500 / yr Gym', harmonizationAction: 'KEEP_SEPARATE', costImpactPerEmployee: -500, completionStatus: 100 },
        { category: 'Equity Refresh', acquirerBenefit: 'RSU Annually', targetBenefit: 'ESOP Options', harmonizationAction: 'CREATE_NEW_PLAN', costImpactPerEmployee: 4500, completionStatus: 20 },
    ];
}

export function generateIntegrationTimeline(): IntegrationTimelineEvent[] {
    return [
        { id: 'TL-1', date: '2026-08-01', milestone: 'Day 1 Communications & Org Reveal', owner: 'HR Lead', status: 'COMPLETED' },
        { id: 'TL-2', date: '2026-08-15', milestone: 'Executive Retention Agreements Signed', owner: 'Legal', status: 'COMPLETED' },
        { id: 'TL-3', date: '2026-09-01', milestone: 'Redundancy Notifications & Severance', owner: 'HR Operations', status: 'IN_PROGRESS' },
        { id: 'TL-4', date: '2026-10-01', milestone: 'Benefits & Payroll Migration (Target -> Acquirer)', owner: 'Comp & Ben', status: 'PENDING' },
        { id: 'TL-5', date: '2026-11-15', milestone: 'Final Culture Harmonization Survey', owner: 'Change Mgmt', status: 'PENDING' },
    ];
}
