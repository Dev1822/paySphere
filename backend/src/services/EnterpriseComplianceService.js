"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Enterprise Compliance & Audit Trail Suite — Service Layer
const express_1 = require("express");
const EnterpriseComplianceModel_1 = require("../models/EnterpriseComplianceModel");
const router = (0, express_1.Router)();
const policies = (0, EnterpriseComplianceModel_1.createMockPolicies)();
const audits = (0, EnterpriseComplianceModel_1.createMockAudits)();
const incidents = (0, EnterpriseComplianceModel_1.createMockIncidents)();
router.get('/policies', (req, res) => {
    let filtered = [...policies];
    const { category, status } = req.query;
    if (category)
        filtered = filtered.filter((p) => p.category === category);
    if (status)
        filtered = filtered.filter((p) => p.status === status);
    res.json({ policies: filtered, total: filtered.length });
});
router.get('/policies/:id', (req, res) => {
    const policy = policies.find((p) => p.id === req.params.id);
    if (!policy)
        return res.status(404).json({ error: 'Policy not found' });
    res.json({ policy });
});
router.get('/audits', (req, res) => {
    let filtered = [...audits];
    const { status, category } = req.query;
    if (status)
        filtered = filtered.filter((a) => a.status === status);
    if (category)
        filtered = filtered.filter((a) => a.category === category);
    res.json({ audits: filtered, total: filtered.length });
});
router.get('/audits/:id', (req, res) => {
    const audit = audits.find((a) => a.id === req.params.id);
    if (!audit)
        return res.status(404).json({ error: 'Audit not found' });
    res.json({ audit });
});
router.get('/incidents', (req, res) => {
    let filtered = [...incidents];
    const { status, severity } = req.query;
    if (status)
        filtered = filtered.filter((i) => i.status === status);
    if (severity)
        filtered = filtered.filter((i) => i.severity === severity);
    res.json({ incidents: filtered, total: filtered.length });
});
router.get('/analytics', (_req, res) => {
    const totalFindings = audits.reduce((s, a) => s + a.findings.length, 0);
    const openFindings = audits.reduce((s, a) => s + a.findings.filter((f) => f.remediationStatus === 'open').length, 0);
    const criticalFindings = audits.reduce((s, a) => s + a.findings.filter((f) => f.severity === 'critical').length, 0);
    const avgScore = audits.filter((a) => a.score !== null).reduce((s, a, _, arr) => s + (a.score || 0) / arr.length, 0);
    const activePolicies = policies.filter((p) => p.status === 'active').length;
    const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length;
    const criticalIncidents = incidents.filter((i) => i.severity === 'critical' && i.status !== 'closed').length;
    res.json({
        totalPolicies: policies.length, activePolicies, totalAudits: audits.length,
        completedAudits: audits.filter((a) => a.status === 'completed').length,
        totalFindings, openFindings, criticalFindings,
        avgAuditScore: Math.round(avgScore), openIncidents, criticalIncidents,
        totalAffectedRecords: incidents.reduce((s, i) => s + i.affectedRecords, 0),
    });
});
router.post('/findings/:id/remediate', (req, res) => {
    for (const audit of audits) {
        const finding = audit.findings.find((f) => f.id === req.params.id);
        if (finding) {
            finding.remediationStatus = req.body.status || 'in_progress';
            if (req.body.status === 'resolved')
                finding.remediationStatus = 'resolved';
            if (req.body.status === 'verified')
                finding.remediationStatus = 'verified';
            return res.json({ finding, message: 'Remediation status updated' });
        }
    }
    return res.status(404).json({ error: 'Finding not found' });
});
router.post('/incidents/:id/resolve', (req, res) => {
    const incident = incidents.find((i) => i.id === req.params.id);
    if (!incident)
        return res.status(404).json({ error: 'Incident not found' });
    incident.status = 'resolved';
    incident.resolutionNotes = req.body.notes || 'Resolved';
    incident.resolvedAt = new Date().toISOString();
    res.json({ incident, message: 'Incident resolved' });
});
exports.default = router;
//# sourceMappingURL=EnterpriseComplianceService.js.map