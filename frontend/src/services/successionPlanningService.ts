import type {
    TalentProfile, SuccessorCandidate, KeyRole,
    SuccessionKPIs, NineBoxDistribution, NineBoxCategory,
    PerformanceRating, PotentialRating
} from '../types/successionPlanning';

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function mapNineBox(perf: PerformanceRating, pot: PotentialRating): NineBoxCategory {
    if (perf === 'NEEDS_IMPROVEMENT') {
        if (pot === 'LOW' || pot === 'MEDIUM') return 'UNDERPERFORMER';
        if (pot === 'HIGH') return 'INCONSISTENT_PLAYER';
        return 'POTENTIAL_GEM';
    }
    if (perf === 'MEETS_EXPECTATIONS') {
        if (pot === 'LOW') return 'EFFECTIVE_PROFESSIONAL';
        if (pot === 'MEDIUM') return 'CORE_PLAYER';
        return 'HIGH_POTENTIAL';
    }
    if (perf === 'EXCEEDS_EXPECTATIONS' || perf === 'OUTSTANDING') {
        if (pot === 'LOW') return 'SOLID_PROFESSIONAL';
        if (pot === 'MEDIUM') return 'HIGH_IMPACT_PERFORMER';
        return 'STAR';
    }
    return 'CORE_PLAYER';
}

export function generateTalentProfiles(count = 100): TalentProfile[] {
    const depts = ['Engineering', 'Product', 'Sales', 'Finance', 'HR', 'Marketing'];
    const titles = ['Director', 'Manager', 'Lead', 'Senior Specialist', 'VP'];

    return Array.from({ length: count }, (_, i) => {
        const perf = pick<PerformanceRating>(['NEEDS_IMPROVEMENT', 'MEETS_EXPECTATIONS', 'EXCEEDS_EXPECTATIONS', 'OUTSTANDING']);
        const pot = pick<PotentialRating>(['LOW', 'MEDIUM', 'HIGH', 'EXCEPTIONAL']);

        return {
            id: `EMP-${rng(1000, 9999)}`,
            name: `Talent ${i + 1}`,
            role: `${pick(titles)} of ${pick(depts)}`,
            department: pick(depts),
            performance: perf,
            potential: pot,
            nineBoxCategory: mapNineBox(perf, pot),
            flightRisk: pick(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
            criticalRole: Math.random() > 0.7,
            yearsInRole: Math.random() * 5 + 1
        };
    });
}

export function generateNineBoxDistribution(profiles: TalentProfile[]): NineBoxDistribution[] {
    const counts: Record<string, number> = {};
    profiles.forEach(p => {
        counts[p.nineBoxCategory] = (counts[p.nineBoxCategory] || 0) + 1;
    });

    return Object.entries(counts).map(([cat, count]) => ({
        category: cat as NineBoxCategory,
        count,
        percentage: Math.round((count / profiles.length) * 100)
    }));
}

export function generateKeyRoles(): KeyRole[] {
    const generateSuccessor = (): SuccessorCandidate => ({
        candidateId: `SUC-${rng(1000, 9999)}`,
        name: `Exec ${rng(1, 100)}`,
        currentRole: pick(['Senior Director', 'VP', 'Head of Department']),
        department: pick(['Engineering', 'Product', 'Sales', 'Finance']),
        readiness: pick(['READY_NOW', 'READY_1_TO_2_YEARS', 'READY_3_PLUS_YEARS', 'EMERGENCY_ONLY']),
        fitScore: rng(60, 98),
        developmentGaps: pick([['Strategic Vision'], ['Cross-functional Leadership', 'Global Market Exposure'], ['None']]),
        flightRisk: pick(['LOW', 'MEDIUM', 'HIGH'])
    });

    return [
        { roleId: 'KR-1', title: 'Chief Technology Officer', department: 'Engineering', incumbentId: 'EMP-001', incumbentName: 'Arjun M.', incumbentFlightRisk: 'HIGH', vacancyImpact: 'CRITICAL', benchStrengthScore: 82, successors: [generateSuccessor(), generateSuccessor()] },
        { roleId: 'KR-2', title: 'VP of Product', department: 'Product', incumbentId: 'EMP-002', incumbentName: 'Sarah L.', incumbentFlightRisk: 'MEDIUM', vacancyImpact: 'SIGNIFICANT', benchStrengthScore: 45, successors: [generateSuccessor()] },
        { roleId: 'KR-3', title: 'Head of Global Sales', department: 'Sales', incumbentId: 'EMP-003', incumbentName: 'David K.', incumbentFlightRisk: 'CRITICAL', vacancyImpact: 'CRITICAL', benchStrengthScore: 20, successors: [] },
        { roleId: 'KR-4', title: 'Chief Financial Officer', department: 'Finance', incumbentId: 'EMP-004', incumbentName: 'Priya R.', incumbentFlightRisk: 'LOW', vacancyImpact: 'CRITICAL', benchStrengthScore: 95, successors: [generateSuccessor(), generateSuccessor(), generateSuccessor()] }
    ];
}

export function generateSuccessionKPIs(): SuccessionKPIs {
    return {
        totalKeyRoles: 42,
        rolesWithoutReadySuccessors: 14,
        overallBenchStrength: 68,
        highRiskCriticalRoles: 5,
        diverseSuccessorPercentage: 35,
        internalFillRateProjected: 72
    };
}
