"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockPolicies = createMockPolicies;
exports.createMockAudits = createMockAudits;
exports.createMockIncidents = createMockIncidents;
exports.computeComplianceByCategory = computeComplianceByCategory;
exports.computeAuditEffectiveness = computeAuditEffectiveness;
exports.computeIncidentSeverity = computeIncidentSeverity;
exports.computePolicyReviewStatus = computePolicyReviewStatus;
function createMockPolicies() {
    return [
        { id: 'CP-001', name: 'GDPR Data Processing Policy', category: 'data_privacy', description: 'Governs collection, processing, and storage of personal data for EU operations.', effectiveDate: '2024-01-01', lastReviewedAt: '2026-03-15', nextReviewDate: '2027-03-15', owner: 'DPO Office', status: 'active', requirements: ['Data minimization', 'Consent management', 'Right to erasure', 'Breach notification 72h'], applicableRegions: ['EU', 'UK', 'EEA'], riskRating: 'critical', attachments: ['gdpr_policy_v3.pdf'] },
        { id: 'CP-002', name: 'SOX Financial Controls', category: 'financial', description: 'Sarbanes-Oxley Act compliance controls for financial reporting integrity.', effectiveDate: '2024-01-01', lastReviewedAt: '2026-06-01', nextReviewDate: '2027-01-01', owner: 'CFO Office', status: 'active', requirements: ['Segregation of duties', 'Audit trail for all transactions', 'Quarterly SOX testing', 'Management attestation'], applicableRegions: ['US'], riskRating: 'critical', attachments: ['sox_controls_2026.pdf'] },
        { id: 'CP-003', name: 'ISO 27001 Information Security', category: 'security', description: 'Information security management system requirements per ISO 27001:2022.', effectiveDate: '2023-06-01', lastReviewedAt: '2026-01-10', nextReviewDate: '2026-12-01', owner: 'CISO', status: 'active', requirements: ['Access control matrix', 'Encryption at rest/transit', 'Incident response plan', 'Annual penetration testing'], applicableRegions: ['Global'], riskRating: 'high', attachments: ['iso27001_certificate.pdf', 'isms_manual.pdf'] },
        { id: 'CP-004', name: 'FLSA Labor Compliance', category: 'labor', description: 'Fair Labor Standards Act compliance for US employees including overtime tracking.', effectiveDate: '2024-01-01', lastReviewedAt: '2026-02-20', nextReviewDate: '2027-02-20', owner: 'HR Legal', status: 'active', requirements: ['Accurate time tracking', 'Overtime authorization', 'Minimum wage compliance', 'Child labor restrictions'], applicableRegions: ['US'], riskRating: 'high', attachments: ['flsa_compliance.pdf'] },
        { id: 'CP-005', name: 'Environmental Sustainability Policy', category: 'environmental', description: 'ESG reporting and carbon neutrality commitments for global operations.', effectiveDate: '2025-01-01', lastReviewedAt: '2026-07-01', nextReviewDate: '2027-07-01', owner: 'ESG Committee', status: 'active', requirements: ['Carbon footprint reporting', 'Waste reduction targets', 'Sustainable procurement', 'Annual ESG disclosure'], applicableRegions: ['Global'], riskRating: 'medium', attachments: ['esg_policy.pdf'] },
        { id: 'CP-006', name: 'Code of Business Conduct', category: 'internal_policy', description: 'Company-wide code of conduct covering ethics, anti-corruption, and conflicts of interest.', effectiveDate: '2024-06-01', lastReviewedAt: '2026-06-01', nextReviewDate: '2027-06-01', owner: 'Legal', status: 'active', requirements: ['Annual acknowledgment', 'Anti-bribery compliance', 'Conflict of interest disclosure', 'Whistleblower protection'], applicableRegions: ['Global'], riskRating: 'high', attachments: ['code_of_conduct.pdf'] },
    ];
}
function createMockAudits() {
    return [
        { id: 'AU-001', auditNumber: 'AUD-2026-001', title: 'Q2 2026 Financial Controls Audit', category: 'financial', auditor: 'Deloitte LLP', auditDate: '2026-06-15', status: 'completed', scope: 'All financial systems, general ledger, and reporting controls', findings: [{ id: 'F-001', description: 'Segregation of duties gap in AP process — single user can approve and post payments', severity: 'high', recommendation: 'Implement dual-approval workflow for payments > $5,000', remediationStatus: 'in_progress', assignedTo: 'Finance Ops', dueDate: '2026-09-30' }, { id: 'F-002', description: 'Manual journal entries missing management approval for amounts > $50K', severity: 'medium', recommendation: 'Add approval gate in accounting system', remediationStatus: 'open', assignedTo: 'IT Finance Systems', dueDate: '2026-10-31' }], score: 85, nextAuditDate: '2026-12-15', region: 'US' },
        { id: 'AU-002', auditNumber: 'AUD-2026-002', title: 'GDPR Annual Compliance Audit', category: 'data_privacy', auditor: 'Internal Audit Team', auditDate: '2026-03-10', status: 'completed', scope: 'All EU data processing activities, consent records, and DPO operations', findings: [{ id: 'F-003', description: 'Cookie consent banner not blocking tracking before consent on 3 marketing pages', severity: 'high', recommendation: 'Implement server-side consent check before loading analytics', remediationStatus: 'resolved', assignedTo: 'Web Team', dueDate: '2026-05-01' }], score: 92, nextAuditDate: '2027-03-10', region: 'EU' },
        { id: 'AU-003', auditNumber: 'AUD-2026-003', title: 'ISO 27001 Surveillance Audit', category: 'security', auditor: 'BSI Group', auditDate: '2026-09-01', status: 'in_progress', scope: 'ISMS controls, access management, incident response, and risk treatment', findings: [], score: null, nextAuditDate: '2027-09-01', region: 'Global' },
        { id: 'AU-004', auditNumber: 'AUD-2026-004', title: 'Q3 Payroll Compliance Review', category: 'labor', auditor: 'Internal Audit', auditDate: '2026-10-15', status: 'scheduled', scope: 'US payroll calculations, overtime tracking, and FLSA compliance', findings: [], score: null, nextAuditDate: '2027-01-15', region: 'US' },
    ];
}
function createMockIncidents() {
    return [
        { id: 'CI-001', incidentNumber: 'INC-2026-001', title: 'Unauthorized data export from HR system', category: 'data_privacy', severity: 'critical', reportedBy: 'DPO Office', reportedAt: '2026-07-20T14:00:00Z', description: 'Bulk employee PII exported by departing contractor without authorization', affectedRecords: 621, region: 'Global', status: 'investigating', resolutionNotes: null, resolvedAt: null },
        { id: 'CI-002', incidentNumber: 'INC-2026-002', title: 'Suspicious login attempts on finance portal', category: 'security', severity: 'high', reportedBy: 'SOC Team', reportedAt: '2026-08-05T03:00:00Z', description: '15 failed login attempts from unusual IP ranges targeting finance admin accounts', affectedRecords: 0, region: 'US', status: 'contained', resolutionNotes: 'IP blocked, MFA enforcement accelerated', resolvedAt: '2026-08-05T04:30:00Z' },
        { id: 'CI-003', incidentNumber: 'INC-2026-003', title: 'Missing SOX audit trail for journal entries', category: 'financial', severity: 'medium', reportedBy: 'Internal Audit', reportedAt: '2026-06-20T10:00:00Z', description: '12 manual journal entries posted without required approval documentation', affectedRecords: 12, region: 'US', status: 'resolved', resolutionNotes: 'Retroactive approvals obtained, controls updated', resolvedAt: '2026-07-15T16:00:00Z' },
    ];
}
// Aggregation: compliance summary by category
function computeComplianceByCategory(policies) {
    const map = new Map();
    for (const p of policies) {
        const existing = map.get(p.category) || { count: 0, risks: [] };
        map.set(p.category, { count: existing.count + 1, risks: [...existing.risks, p.riskRating] });
    }
    const riskOrder = ['critical', 'high', 'medium', 'low'];
    return Array.from(map.entries()).map(([category, data]) => {
        const avgRiskIdx = data.risks.reduce((s, r) => s + riskOrder.indexOf(r), 0) / data.risks.length;
        return { category, count: data.count, avgRisk: riskOrder[Math.round(avgRiskIdx)] };
    });
}
// Aggregation: audit effectiveness
function computeAuditEffectiveness(audits) {
    const completed = audits.filter((a) => a.status === 'completed');
    const avgScore = completed.length > 0 ? Math.round(completed.reduce((s, a) => s + (a.score || 0), 0) / completed.length) : 0;
    const totalFindings = audits.reduce((s, a) => s + a.findings.length, 0);
    const resolvedFindings = audits.reduce((s, a) => s + a.findings.filter((f) => f.remediationStatus === 'resolved' || f.remediationStatus === 'verified').length, 0);
    const resolutionRate = totalFindings > 0 ? ((resolvedFindings / totalFindings) * 100).toFixed(1) : '0';
    return { completedCount: completed.length, avgScore, totalFindings, resolvedFindings, resolutionRate };
}
// Aggregation: incident severity distribution
function computeIncidentSeverity(incidents) {
    const dist = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of incidents) {
        if (i.severity in dist)
            dist[i.severity]++;
    }
    return dist;
}
// Aggregation: policy review status
function computePolicyReviewStatus(policies) {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    let upToDate = 0, dueSoon = 0, overdue = 0;
    for (const p of policies) {
        const reviewDate = new Date(p.nextReviewDate);
        const diff = reviewDate.getTime() - now.getTime();
        if (diff < 0)
            overdue++;
        else if (diff < thirtyDays)
            dueSoon++;
        else
            upToDate++;
    }
    return { upToDate, dueSoon, overdue };
}
//# sourceMappingURL=EnterpriseComplianceModel.js.map