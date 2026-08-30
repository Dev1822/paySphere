// ──────────────────────────────────────────────────────────────────────────────
// Employee Relations (ER) & Grievance Arbitration Hub — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
    ERCase, DisciplinaryAction, InvestigationStep,
    EmployeeRelationsKPIs, GrievanceCategory, CaseStatus, RiskLevel
} from '../types/employeeRelations';

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function generateERCases(count = 40): ERCase[] {
    const firstNames = ['John', 'Alicia', 'Miguel', 'Aisha', 'Chen', 'Emily', 'Robert', 'David', 'Sophia'];
    const depts = ['Sales', 'Engineering', 'Operations', 'Finance', 'Warehouse', 'HR'];
    const categories: GrievanceCategory[] = ['HARASSMENT', 'DISCRIMINATION', 'WAGE_THEFT_DISPUTE', 'WORKPLACE_SAFETY', 'POLICY_VIOLATION', 'INTERPERSONAL_CONFLICT'];
    const statuses: CaseStatus[] = ['OPEN_INVESTIGATION', 'PENDING_ARBITRATION', 'LEGAL_REVIEW', 'CLOSED_RESOLVED', 'CLOSED_UNSUBSTANTIATED'];

    return Array.from({ length: count }, (_, i) => {
        const days = rng(5, 120);
        const isClosed = Math.random() > 0.6;
        const status = isClosed ? pick(['CLOSED_RESOLVED', 'CLOSED_UNSUBSTANTIATED']) : pick(['OPEN_INVESTIGATION', 'PENDING_ARBITRATION', 'LEGAL_REVIEW']);
        const category = pick(categories);
        const isHighRisk = ['HARASSMENT', 'DISCRIMINATION', 'WAGE_THEFT_DISPUTE'].includes(category) && Math.random() > 0.7;

        return {
            caseId: `ER-2026-${rng(1000, 9999)}`,
            filingDate: new Date(Date.now() - days * 86400000).toISOString().split('T')[0],
            reporterName: Math.random() > 0.2 ? `${pick(firstNames)} ${pick(['M.', 'S.', 'T.', 'R.'])}` : 'Anonymous',
            accusedName: Math.random() > 0.3 ? `${pick(firstNames)} ${pick(['L.', 'P.', 'K.'])}` : null,
            department: pick(depts),
            category,
            severity: isHighRisk ? pick(['HIGH', 'LITIGATION_IMMINENT']) : pick(['LOW', 'MEDIUM', 'HIGH']),
            daysOpen: isClosed ? Math.round(days * Math.random()) : days,
            slaBreached: !isClosed && days > 30, // 30 day SLA
            status,
            estimatedLegalExposure: isHighRisk ? rng(50000, 500000) : rng(0, 15000),
            assignedInvestigator: `${pick(['Sarah K.', 'Marcus T.', 'External Counsel'])}`,
        };
    }).sort((a, b) => b.daysOpen - a.daysOpen);
}

export function generateDisciplinaryActions(count = 25): DisciplinaryAction[] {
    return Array.from({ length: count }, (_, i) => ({
        actionId: `DA-2026-${rng(100, 999)}`,
        employeeName: `Employee ${rng(1, 300)}`,
        department: pick(['Sales', 'Engineering', 'Operations', 'Finance', 'Warehouse']),
        dateIssued: new Date(Date.now() - rng(5, 180) * 86400000).toISOString().split('T')[0],
        type: pick(['VERBAL_WARNING', 'WRITTEN_WARNING', 'PIP', 'SUSPENSION', 'TERMINATION_WITH_CAUSE']),
        relatedCaseId: Math.random() > 0.5 ? `ER-2026-${rng(1000, 9999)}` : undefined,
        reviewer: pick(['HRBP assigned', 'Legal Team', 'Manager']),
        appealStatus: pick(['NO_APPEAL', 'NO_APPEAL', 'PENDING_REVIEW', 'OVERTURNED', 'UPHELD'])
    }));
}

export function computeERKpis(cases: ERCase[]): EmployeeRelationsKPIs {
    const active = cases.filter(c => !c.status.startsWith('CLOSED'));
    return {
        activeCasesTotal: active.length,
        casesBreachingSLA: active.filter(c => c.slaBreached).length,
        litigationRiskCount: active.filter(c => c.severity === 'LITIGATION_IMMINENT').length,
        totalEstimatedExposure: active.reduce((acc, c) => acc + c.estimatedLegalExposure, 0),
        averageResolutionDays: Math.round(cases.filter(c => c.status.startsWith('CLOSED')).reduce((a, c) => a + c.daysOpen, 0) / (cases.filter(c => c.status.startsWith('CLOSED')).length || 1)),
        pipSuccessRate: 42, // Mocked 42% survival rate
    };
}
