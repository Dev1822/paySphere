export type ComplianceCategory = 'data_privacy' | 'financial' | 'security' | 'labor' | 'environmental' | 'industry' | 'internal_policy';
export type AuditStatus = 'completed' | 'in_progress' | 'scheduled' | 'overdue' | 'remediation';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type RemediationStatus = 'open' | 'in_progress' | 'resolved' | 'verified';
export interface ICompliancePolicy {
    id: string;
    name: string;
    category: ComplianceCategory;
    description: string;
    effectiveDate: string;
    lastReviewedAt: string;
    nextReviewDate: string;
    owner: string;
    status: 'active' | 'under_review' | 'archived';
    requirements: string[];
    applicableRegions: string[];
    riskRating: SeverityLevel;
    attachments: string[];
}
export interface IAuditRecord {
    id: string;
    auditNumber: string;
    title: string;
    category: ComplianceCategory;
    auditor: string;
    auditDate: string;
    status: AuditStatus;
    scope: string;
    findings: Array<{
        id: string;
        description: string;
        severity: SeverityLevel;
        recommendation: string;
        remediationStatus: RemediationStatus;
        assignedTo: string;
        dueDate: string;
    }>;
    score: number | null;
    nextAuditDate: string;
    region: string;
}
export interface IComplianceIncident {
    id: string;
    incidentNumber: string;
    title: string;
    category: ComplianceCategory;
    severity: SeverityLevel;
    reportedBy: string;
    reportedAt: string;
    description: string;
    affectedRecords: number;
    region: string;
    status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
    resolutionNotes: string | null;
    resolvedAt: string | null;
}
export declare function createMockPolicies(): ICompliancePolicy[];
export declare function createMockAudits(): IAuditRecord[];
export declare function createMockIncidents(): IComplianceIncident[];
export declare function computeComplianceByCategory(policies: ICompliancePolicy[]): Array<{
    category: ComplianceCategory;
    count: number;
    avgRisk: string;
}>;
export declare function computeAuditEffectiveness(audits: IAuditRecord[]): {
    completedCount: number;
    avgScore: number;
    totalFindings: number;
    resolvedFindings: number;
    resolutionRate: string;
};
export declare function computeIncidentSeverity(incidents: IComplianceIncident[]): {
    critical: number;
    high: number;
    medium: number;
    low: number;
};
export declare function computePolicyReviewStatus(policies: ICompliancePolicy[]): {
    upToDate: number;
    dueSoon: number;
    overdue: number;
};
//# sourceMappingURL=EnterpriseComplianceModel.d.ts.map