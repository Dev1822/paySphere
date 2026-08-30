// ──────────────────────────────────────────────────────────────────────────────
// Employee Relations (ER) & Grievance Arbitration Hub — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type GrievanceCategory = 'HARASSMENT' | 'DISCRIMINATION' | 'WAGE_THEFT_DISPUTE' | 'WORKPLACE_SAFETY' | 'POLICY_VIOLATION' | 'INTERPERSONAL_CONFLICT';
export type CaseStatus = 'OPEN_INVESTIGATION' | 'PENDING_ARBITRATION' | 'LEGAL_REVIEW' | 'CLOSED_RESOLVED' | 'CLOSED_UNSUBSTANTIATED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'LITIGATION_IMMINENT';

export interface ERCase {
    caseId: string;
    filingDate: string; // ISO date
    reporterName: string; // Can be 'Anonymous'
    accusedName: string | null;
    department: string;
    category: GrievanceCategory;
    severity: RiskLevel;
    daysOpen: number;
    slaBreached: boolean; // e.g., > 30 days without resolution
    status: CaseStatus;
    estimatedLegalExposure: number; // Potential cost liability
    assignedInvestigator: string;
}

export interface DisciplinaryAction {
    actionId: string;
    employeeName: string;
    department: string;
    dateIssued: string;
    type: 'VERBAL_WARNING' | 'WRITTEN_WARNING' | 'PIP' | 'SUSPENSION' | 'TERMINATION_WITH_CAUSE';
    relatedCaseId?: string;
    reviewer: string;
    appealStatus: 'NO_APPEAL' | 'PENDING_REVIEW' | 'OVERTURNED' | 'UPHELD';
}

export interface InvestigationStep {
    stepId: string;
    caseId: string;
    date: string;
    actionTaken: string;
    notes: string;
    completedBy: string;
}

export interface EmployeeRelationsKPIs {
    activeCasesTotal: number;
    casesBreachingSLA: number;
    litigationRiskCount: number;
    totalEstimatedExposure: number;
    averageResolutionDays: number;
    pipSuccessRate: number; // Percentage of employees who successfully pass a PIP
}
