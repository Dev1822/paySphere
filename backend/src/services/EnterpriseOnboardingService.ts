import { Router, Request, Response } from 'express';

import {
  OnboardingTask,
  OffboardingTask,
  ITProvisioning,
  ExitInterview,
  OnboardingTaskModel,
  OffboardingTaskModel,
  ITProvisioningModel,
  ExitInterviewModel,
  OnboardingProgressModel,
} from '../models/EnterpriseOnboardingModel';

// ============================================================================
// Enterprise Onboarding & Offboarding Lifecycle Service
// ============================================================================

const MOCK_ONBOARDING_TASKS: OnboardingTaskModel[] = [
  { taskId: 'ot-001', employeeId: 'emp-2001', employeeName: 'Alex Morgan', departmentCode: 'ENG', departmentName: 'Engineering', category: 'DOCUMENTS', taskName: 'Submit Government ID', description: 'Upload scanned passport or driver license', status: 'COMPLETED', priority: 'CRITICAL', dueDateISO: '2026-08-10', completedDateISO: '2026-08-09', assignedTo: 'HR Team', completedBy: 'hr-001', documentsRequired: ['Passport', 'I-9 Form'], documentsSubmitted: ['Passport', 'I-9 Form'], notes: 'Verified and approved', blockedReason: null },
  { taskId: 'ot-002', employeeId: 'emp-2001', employeeName: 'Alex Morgan', departmentCode: 'ENG', departmentName: 'Engineering', category: 'IT_PROVISIONING', taskName: 'Laptop Setup', description: 'MacBook Pro 16" M4 Max configured with dev tools', status: 'COMPLETED', priority: 'CRITICAL', dueDateISO: '2026-08-12', completedDateISO: '2026-08-11', assignedTo: 'IT Admin', completedBy: 'it-001', documentsRequired: [], documentsSubmitted: [], notes: 'Fully configured with VS Code, Docker, Figma', blockedReason: null },
  { taskId: 'ot-003', employeeId: 'emp-2001', employeeName: 'Alex Morgan', departmentCode: 'ENG', departmentName: 'Engineering', category: 'TRAINING', taskName: 'Security Awareness Training', description: 'Complete mandatory security awareness module', status: 'IN_PROGRESS', priority: 'HIGH', dueDateISO: '2026-08-19', completedDateISO: null, assignedTo: 'L&D Team', completedBy: null, documentsRequired: [], documentsSubmitted: [], notes: '60% complete — module 4 of 7', blockedReason: null },
  { taskId: 'ot-004', employeeId: 'emp-2001', employeeName: 'Alex Morgan', departmentCode: 'ENG', departmentName: 'Engineering', category: 'COMPLIANCE', taskName: 'NDA & IP Assignment', description: 'Review and sign non-disclosure and IP assignment agreements', status: 'COMPLETED', priority: 'CRITICAL', dueDateISO: '2026-08-10', completedDateISO: '2026-08-09', assignedTo: 'Legal Team', completedBy: 'legal-001', documentsRequired: ['NDA', 'IP Assignment'], documentsSubmitted: ['NDA', 'IP Assignment'], notes: 'Digitally signed via DocuSign', blockedReason: null },
  { taskId: 'ot-005', employeeId: 'emp-2001', employeeName: 'Alex Morgan', departmentCode: 'ENG', departmentName: 'Engineering', category: 'SOCIAL', taskName: 'Team Welcome Lunch', description: 'Schedule welcome lunch with the engineering team', status: 'PENDING', priority: 'MEDIUM', dueDateISO: '2026-08-20', completedDateISO: null, assignedTo: 'Manager - Sarah Chen', completedBy: null, documentsRequired: [], documentsSubmitted: [], notes: '', blockedReason: null },
  { taskId: 'ot-006', employeeId: 'emp-2002', employeeName: 'Jordan Lee', departmentCode: 'SALES', departmentName: 'Global Sales', category: 'DOCUMENTS', taskName: 'Submit Tax Forms', description: 'Complete W-4 and state tax withholding forms', status: 'COMPLETED', priority: 'CRITICAL', dueDateISO: '2026-08-05', completedDateISO: '2026-08-04', assignedTo: 'HR Team', completedBy: 'hr-002', documentsRequired: ['W-4', 'State Tax Form'], documentsSubmitted: ['W-4', 'State Tax Form'], notes: 'All documents verified', blockedReason: null },
  { taskId: 'ot-007', employeeId: 'emp-2002', employeeName: 'Jordan Lee', departmentCode: 'SALES', departmentName: 'Global Sales', category: 'IT_PROVISIONING', taskName: 'CRM Access Setup', description: 'Configure Salesforce CRM access and territory assignment', status: 'BLOCKED', priority: 'HIGH', dueDateISO: '2026-08-12', completedDateISO: null, assignedTo: 'IT Admin', completedBy: null, documentsRequired: [], documentsSubmitted: [], notes: '', blockedReason: 'Waiting for territory manager approval on EMEA region access' },
  { taskId: 'ot-008', employeeId: 'emp-2002', employeeName: 'Jordan Lee', departmentCode: 'SALES', departmentName: 'Global Sales', category: 'TRAINING', taskName: 'Sales Playbook Review', description: 'Complete enterprise sales methodology training', status: 'PENDING', priority: 'HIGH', dueDateISO: '2026-08-18', completedDateISO: null, assignedTo: 'Sales Enablement', completedBy: null, documentsRequired: [], documentsSubmitted: [], notes: '', blockedReason: null },
  { taskId: 'ot-009', employeeId: 'emp-2003', employeeName: 'Samira Khan', departmentCode: 'FIN', departmentName: 'Finance & Accounting', category: 'DOCUMENTS', taskName: 'Background Check Consent', description: 'Authorize background verification check', status: 'COMPLETED', priority: 'CRITICAL', dueDateISO: '2026-08-01', completedDateISO: '2026-08-01', assignedTo: 'HR Team', completedBy: 'hr-001', documentsRequired: ['Consent Form'], documentsSubmitted: ['Consent Form'], notes: 'Clear — no issues found', blockedReason: null },
  { taskId: 'ot-010', employeeId: 'emp-2003', employeeName: 'Samira Khan', departmentCode: 'FIN', departmentName: 'Finance & Accounting', category: 'MANAGER_CHECKIN', taskName: 'Week 1 Manager 1:1', description: 'First 1:1 meeting with direct manager to set expectations', status: 'PENDING', priority: 'HIGH', dueDateISO: '2026-08-08', completedDateISO: null, assignedTo: 'Manager - Priya Patel', completedBy: null, documentsRequired: [], documentsSubmitted: [], notes: 'Calendar invite sent', blockedReason: null },
];

const MOCK_OFFBOARDING_TASKS: OffboardingTaskModel[] = [
  { taskId: 'off-001', employeeId: 'emp-1050', employeeName: 'Chris Walker', departmentCode: 'ENG', departmentName: 'Engineering', lastWorkingDayISO: '2026-08-30', reason: 'VOLUNTARY', category: 'ASSET_RETURN', taskName: 'Return MacBook Pro', status: 'PENDING', assignedTo: 'IT Admin', dueDateISO: '2026-08-30', completedDateISO: null, notes: 'Assigned asset: MacBook Pro 16" M3 — S/N: C02X1234' },
  { taskId: 'off-002', employeeId: 'emp-1050', employeeName: 'Chris Walker', departmentCode: 'ENG', departmentName: 'Engineering', lastWorkingDayISO: '2026-08-30', reason: 'VOLUNTARY', category: 'ACCESS_REVOCATION', taskName: 'Revoke GitHub Access', status: 'PENDING', assignedTo: 'IT Security', dueDateISO: '2026-08-30', completedDateISO: null, notes: 'Remove from all org repositories and Actions secrets' },
  { taskId: 'off-003', employeeId: 'emp-1050', employeeName: 'Chris Walker', departmentCode: 'ENG', departmentName: 'Engineering', lastWorkingDayISO: '2026-08-30', reason: 'VOLUNTARY', category: 'KNOWLEDGE_TRANSFER', taskName: 'Transfer Project Ownership', status: 'IN_PROGRESS', assignedTo: 'Manager - Sarah Chen', dueDateISO: '2026-08-25', completedDateISO: null, notes: 'Payment Service v3 and Auth Gateway — 70% handoff complete' },
  { taskId: 'off-004', employeeId: 'emp-1050', employeeName: 'Chris Walker', departmentCode: 'ENG', departmentName: 'Engineering', lastWorkingDayISO: '2026-08-30', reason: 'VOLUNTARY', category: 'EXIT_INTERVIEW', taskName: 'Exit Interview Session', status: 'PENDING', assignedTo: 'HR Director', dueDateISO: '2026-08-28', completedDateISO: null, notes: 'Scheduled with HR Director — 45 min slot' },
  { taskId: 'off-005', employeeId: 'emp-1050', employeeName: 'Chris Walker', departmentCode: 'ENG', departmentName: 'Engineering', lastWorkingDayISO: '2026-08-30', reason: 'VOLUNTARY', category: 'FINAL_SETTLEMENT', taskName: 'Process Final Paycheck', status: 'PENDING', assignedTo: 'Payroll Team', dueDateISO: '2026-09-05', completedDateISO: null, notes: 'Include unused PTO payout (18 days)' },
  { taskId: 'off-006', employeeId: 'emp-1051', employeeName: 'Nina Petrova', departmentCode: 'OPS', departmentName: 'Corporate Operations', lastWorkingDayISO: '2026-08-15', reason: 'CONTRACT_END', category: 'ASSET_RETURN', taskName: 'Return Badge & Keys', status: 'COMPLETED', assignedTo: 'Facilities', dueDateISO: '2026-08-15', completedDateISO: '2026-08-15', notes: 'Badge #B-4521 returned, desk key returned' },
  { taskId: 'off-007', employeeId: 'emp-1051', employeeName: 'Nina Petrova', departmentCode: 'OPS', departmentName: 'Corporate Operations', lastWorkingDayISO: '2026-08-15', reason: 'CONTRACT_END', category: 'BENEFITS_CESSATION', taskName: 'Terminate Health Insurance', status: 'COMPLETED', assignedTo: 'Benefits Admin', dueDateISO: '2026-08-15', completedDateISO: '2026-08-15', notes: 'COBRA notice sent, coverage ends 8/31' },
];

const MOCK_IT_PROVISIONING: ITProvisioningModel[] = [
  { requestId: 'it-001', employeeId: 'emp-2001', employeeName: 'Alex Morgan', requestType: 'HARDWARE', itemName: 'MacBook Pro 16" M4 Max', vendor: 'Apple', serialNumber: 'C02Y5678', status: 'ASSIGNED', requestedDateISO: '2026-08-01', expectedDeliveryISO: '2026-08-10', actualDeliveryISO: '2026-08-09', assignedBy: 'IT Admin', costUSD: 3499, notes: 'Pre-configured with dev environment' },
  { requestId: 'it-002', employeeId: 'emp-2001', employeeName: 'Alex Morgan', requestType: 'SOFTWARE', itemName: 'GitHub Enterprise License', vendor: 'GitHub', serialNumber: null, status: 'ASSIGNED', requestedDateISO: '2026-08-01', expectedDeliveryISO: '2026-08-05', actualDeliveryISO: '2026-08-02', assignedBy: 'IT Admin', costUSD: 21, notes: 'Monthly seat license' },
  { requestId: 'it-003', employeeId: 'emp-2001', employeeName: 'Alex Morgan', requestType: 'CLOUD_ACCESS', itemName: 'AWS SSO + IAM Role', vendor: 'AWS', serialNumber: null, status: 'ASSIGNED', requestedDateISO: '2026-08-05', expectedDeliveryISO: '2026-08-08', actualDeliveryISO: '2026-08-06', assignedBy: 'DevOps Lead', costUSD: 0, notes: 'Engineering-full-access role' },
  { requestId: 'it-004', employeeId: 'emp-2002', employeeName: 'Jordan Lee', requestType: 'HARDWARE', itemName: 'Dell XPS 15', vendor: 'Dell', serialNumber: 'DL-98765', status: 'DELIVERED', requestedDateISO: '2026-08-01', expectedDeliveryISO: '2026-08-12', actualDeliveryISO: '2026-08-11', assignedBy: 'IT Admin', costUSD: 2199, notes: 'Awaiting configuration' },
  { requestId: 'it-005', employeeId: 'emp-2002', employeeName: 'Jordan Lee', requestType: 'VPN', itemName: 'GlobalProtect VPN License', vendor: 'Palo Alto', serialNumber: null, status: 'ORDERED', requestedDateISO: '2026-08-05', expectedDeliveryISO: '2026-08-15', actualDeliveryISO: null, assignedBy: 'IT Security', costUSD: 15, notes: 'Pending security approval' },
  { requestId: 'it-006', employeeId: 'emp-2003', employeeName: 'Samira Khan', requestType: 'HARDWARE', itemName: 'MacBook Air 15" M4', vendor: 'Apple', serialNumber: 'C02Z9012', status: 'CONFIGURED', requestedDateISO: '2026-07-25', expectedDeliveryISO: '2026-08-01', actualDeliveryISO: '2026-07-30', assignedBy: 'IT Admin', costUSD: 1999, notes: 'Finance-specific app bundle installed' },
  { requestId: 'it-007', employeeId: 'emp-2003', employeeName: 'Samira Khan', requestType: 'SECURITY_TOKEN', itemName: 'YubiKey 5C NFC', vendor: 'Yubico', serialNumber: 'YK-34567', status: 'ASSIGNED', requestedDateISO: '2026-07-25', expectedDeliveryISO: '2026-08-01', actualDeliveryISO: '2026-07-29', assignedBy: 'IT Security', costUSD: 55, notes: 'Registered for SSO MFA' },
];

const MOCK_EXIT_INTERVIEWS: ExitInterviewModel[] = [
  { interviewId: 'ei-001', employeeId: 'emp-1050', employeeName: 'Chris Walker', departmentCode: 'ENG', departmentName: 'Engineering', lastWorkingDayISO: '2026-08-30', interviewDateISO: '2026-08-22', interviewerName: 'HR Director', overallSatisfaction: 7, workLifeBalance: 8, managementRating: 8, compensationRating: 6, careerGrowthRating: 5, wouldRecommend: true, primaryReasonForLeaving: 'Better career growth opportunity at a startup', suggestionsForImprovement: 'More internal mobility and rotation programs', additionalComments: 'Great team, learned a lot. Will miss the culture.', status: 'SCHEDULED' },
  { interviewId: 'ei-002', employeeId: 'emp-1051', employeeName: 'Nina Petrova', departmentCode: 'OPS', departmentName: 'Corporate Operations', lastWorkingDayISO: '2026-08-15', interviewDateISO: '2026-08-12', interviewerName: 'HR Director', overallSatisfaction: 6, workLifeBalance: 5, managementRating: 7, compensationRating: 4, careerGrowthRating: 5, wouldRecommend: false, primaryReasonForLeaving: 'Contract ended — not renewed', suggestionsForImprovement: 'Clearer contract renewal timelines and communication', additionalComments: 'Felt like a second-class citizen as a contractor.', status: 'COMPLETED' },
];

// ============================================================================
// Service Class
// ============================================================================

export class EnterpriseOnboardingService {
  private onboardingTasks: OnboardingTaskModel[];
  private offboardingTasks: OffboardingTaskModel[];
  private itProvisioning: ITProvisioningModel[];
  private exitInterviews: ExitInterviewModel[];

  constructor() {
    this.onboardingTasks = [...MOCK_ONBOARDING_TASKS];
    this.offboardingTasks = [...MOCK_OFFBOARDING_TASKS];
    this.itProvisioning = [...MOCK_IT_PROVISIONING];
    this.exitInterviews = [...MOCK_EXIT_INTERVIEWS];
  }

  // ── Onboarding Tasks ──────────────────────────────────────────────────
  public getOnboardingTasks(filters?: { employeeId?: string; category?: string; status?: string }): OnboardingTaskModel[] {
    let results = [...this.onboardingTasks];
    if (filters?.employeeId) results = results.filter(t => t.employeeId === filters.employeeId);
    if (filters?.category) results = results.filter(t => t.category === filters.category);
    if (filters?.status) results = results.filter(t => t.status === filters.status);
    return results;
  }

  public completeOnboardingTask(taskId: string, completerId: string): OnboardingTaskModel | null {
    const task = this.onboardingTasks.find(t => t.taskId === taskId);
    if (!task) return null;
    task.status = 'COMPLETED';
    task.completedDateISO = new Date().toISOString();
    task.completedBy = completerId;
    return task;
  }

  // ── Offboarding Tasks ────────────────────────────────────────────────
  public getOffboardingTasks(filters?: { employeeId?: string; category?: string }): OffboardingTaskModel[] {
    let results = [...this.offboardingTasks];
    if (filters?.employeeId) results = results.filter(t => t.employeeId === filters.employeeId);
    if (filters?.category) results = results.filter(t => t.category === filters.category);
    return results;
  }

  // ── IT Provisioning ──────────────────────────────────────────────────
  public getITProvisioning(filters?: { employeeId?: string; status?: string }): ITProvisioningModel[] {
    let results = [...this.itProvisioning];
    if (filters?.employeeId) results = results.filter(p => p.employeeId === filters.employeeId);
    if (filters?.status) results = results.filter(p => p.status === filters.status);
    return results;
  }

  // ── Exit Interviews ──────────────────────────────────────────────────
  public getExitInterviews(filters?: { status?: string }): ExitInterviewModel[] {
    let results = [...this.exitInterviews];
    if (filters?.status) results = results.filter(i => i.status === filters.status);
    return results;
  }

  // ── Dashboard Metrics ────────────────────────────────────────────────
  public getDashboardMetrics() {
    const totalActiveOnboardings = new Set(this.onboardingTasks.map(t => t.employeeId)).size;
    const totalActiveOffboardings = new Set(this.offboardingTasks.map(t => t.employeeId)).size;
    const completedTasks = this.onboardingTasks.filter(t => t.status === 'COMPLETED').length;
    const blockedTasks = this.onboardingTasks.filter(t => t.status === 'BLOCKED').length;
    const totalITRequests = this.itProvisioning.length;
    const deliveredIT = this.itProvisioning.filter(p => ['ASSIGNED', 'CONFIGURED'].includes(p.status)).length;
    const avgSatisfaction = this.exitInterviews.length > 0
      ? Math.round(this.exitInterviews.reduce((sum, i) => sum + i.overallSatisfaction, 0) / this.exitInterviews.length * 100) / 100
      : 0;
    const totalITCost = this.itProvisioning.reduce((sum, p) => sum + p.costUSD, 0);

    return {
      totalActiveOnboardings,
      totalActiveOffboardings,
      completedOnboardingTasks: completedTasks,
      blockedOnboardingTasks: blockedTasks,
      totalITRequests,
      deliveredIT,
      pendingIT: totalITRequests - deliveredIT,
      totalITCost,
      avgExitSatisfaction: avgSatisfaction,
      exitInterviewsCompleted: this.exitInterviews.filter(i => i.status === 'COMPLETED').length,
      exitInterviewsTotal: this.exitInterviews.length,
    };
  }
}

// ============================================================================
// Express Router
// ============================================================================

const service = new EnterpriseOnboardingService();
const router = Router();

router.get('/onboarding/tasks', (req: Request, res: Response) => {
  const { employeeId, category, status } = req.query;
  const tasks = service.getOnboardingTasks({
    employeeId: employeeId as string | undefined,
    category: category as string | undefined,
    status: status as string | undefined,
  });
  res.json({ success: true, data: tasks });
});

router.post('/onboarding/tasks/:id/complete', (req: Request, res: Response) => {
  const updated = service.completeOnboardingTask(req.params.id, req.body.completerId || 'system');
  if (!updated) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, data: updated });
});

router.get('/offboarding/tasks', (req: Request, res: Response) => {
  const { employeeId, category } = req.query;
  const tasks = service.getOffboardingTasks({
    employeeId: employeeId as string | undefined,
    category: category as string | undefined,
  });
  res.json({ success: true, data: tasks });
});

router.get('/onboarding/it-provisioning', (req: Request, res: Response) => {
  const { employeeId, status } = req.query;
  const items = service.getITProvisioning({
    employeeId: employeeId as string | undefined,
    status: status as string | undefined,
  });
  res.json({ success: true, data: items });
});

router.get('/onboarding/exit-interviews', (req: Request, res: Response) => {
  const { status } = req.query;
  const interviews = service.getExitInterviews({ status: status as string | undefined });
  res.json({ success: true, data: interviews });
});

router.get('/onboarding/dashboard-metrics', (req: Request, res: Response) => {
  const metrics = service.getDashboardMetrics();
  res.json({ success: true, data: metrics });
});

export default router;
