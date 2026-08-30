// ──────────────────────────────────────────────────────────────────────────────
// AI-Driven Succession Planning & Talent Matrix — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type PerformanceRating = 'NEEDS_IMPROVEMENT' | 'MEETS_EXPECTATIONS' | 'EXCEEDS_EXPECTATIONS' | 'OUTSTANDING';
export type PotentialRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCEPTIONAL';
export type ReadinessLevel = 'READY_NOW' | 'READY_1_TO_2_YEARS' | 'READY_3_PLUS_YEARS' | 'EMERGENCY_ONLY';
export type FlightRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NineBoxCategory =
    | 'UNDERPERFORMER' | 'EFFECTIVE_PROFESSIONAL' | 'SOLID_PROFESSIONAL'
    | 'INCONSISTENT_PLAYER' | 'CORE_PLAYER' | 'HIGH_IMPACT_PERFORMER'
    | 'POTENTIAL_GEM' | 'HIGH_POTENTIAL' | 'STAR';

export interface TalentProfile {
    id: string;
    name: string;
    role: string;
    department: string;
    performance: PerformanceRating;
    potential: PotentialRating;
    nineBoxCategory: NineBoxCategory;
    flightRisk: FlightRisk;
    criticalRole: boolean;
    yearsInRole: number;
}

export interface SuccessorCandidate {
    candidateId: string;
    name: string;
    currentRole: string;
    department: string;
    readiness: ReadinessLevel;
    fitScore: number; // 0-100 AI generated fit score
    developmentGaps: string[];
    flightRisk: FlightRisk;
}

export interface KeyRole {
    roleId: string;
    title: string;
    department: string;
    incumbentId: string;
    incumbentName: string;
    incumbentFlightRisk: FlightRisk;
    successors: SuccessorCandidate[];
    benchStrengthScore: number; // 0-100
    vacancyImpact: 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
}

export interface SuccessionKPIs {
    totalKeyRoles: number;
    rolesWithoutReadySuccessors: number;
    overallBenchStrength: number;
    highRiskCriticalRoles: number;
    diverseSuccessorPercentage: number;
    internalFillRateProjected: number;
}

export interface NineBoxDistribution {
    category: NineBoxCategory;
    count: number;
    percentage: number;
}
