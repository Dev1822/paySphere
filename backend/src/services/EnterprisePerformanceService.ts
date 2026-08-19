import { Router, Request, Response } from 'express';
import { Objective, ReviewCycle, SuccessionPlan, ObjectiveModel, ReviewCycleModel, SuccessionPlanModel, FeedbackModel } from '../models/EnterprisePerformanceModel';

const MOCK_OKRS: ObjectiveModel[] = [
  { objectiveId: 'obj-001', employeeId: 'emp-1001', employeeName: 'Sarah Chen', departmentCode: 'ENG', departmentName: 'Engineering', title: 'Ship Payment Gateway v3', description: 'Launch next-gen payment processing with multi-currency support', quarter: 'Q3-2026', status: 'ON_TRACK', overallProgress: 72, keyResults: [{ krId: 'kr-001', title: 'Complete API integration', metric: 'endpoints done', startValue: 0, currentValue: 18, targetValue: 24, unit: 'endpoints', progress: 75, status: 'ON_TRACK' }, { krId: 'kr-002', title: 'Reduce latency', metric: 'p99 latency', startValue: 450, currentValue: 220, targetValue: 150, unit: 'ms', progress: 60, status: 'AT_RISK' }, { krId: 'kr-003', title: 'Achieve 99.99% uptime', metric: 'uptime', startValue: 99.9, currentValue: 99.97, targetValue: 99.99, unit: '%', progress: 80, status: 'ON_TRACK' }], alignedToObjectiveId: null, ownerName: 'Sarah Chen', reviewCycleId: 'rc-001', createdAtISO: '2026-07-01', updatedAtISO: '2026-08-15' },
  { objectiveId: 'obj-002', employeeId: 'emp-1002', employeeName: 'James Rodriguez', departmentCode: 'SALES', departmentName: 'Global Sales', title: 'Close 5 Enterprise Deals', description: 'Land 5 new enterprise accounts worth $1M+ ARR each', quarter: 'Q3-2026', status: 'AT_RISK', overallProgress: 40, keyResults: [{ krId: 'kr-004', title: 'Close Acme Corp', metric: 'deal value', startValue: 0, currentValue: 1200000, targetValue: 1200000, unit: 'USD', progress: 80, status: 'ON_TRACK' }, { krId: 'kr-005', title: 'Close TechFlow Inc', metric: 'deal value', startValue: 0, currentValue: 400000, targetValue: 1500000, unit: 'USD', progress: 27, status: 'BEHIND' }, { krId: 'kr-006', title: 'Pipeline growth', metric: 'pipeline', startValue: 5000000, currentValue: 6200000, targetValue: 12000000, unit: 'USD', progress: 18, status: 'BEHIND' }], alignedToObjectiveId: null, ownerName: 'James Rodriguez', reviewCycleId: 'rc-001', createdAtISO: '2026-07-01', updatedAtISO: '2026-08-18' },
  { objectiveId: 'obj-003', employeeId: 'emp-1003', employeeName: 'Priya Patel', departmentCode: 'OPS', departmentName: 'Corporate Operations', title: 'Automate Compliance Reporting', description: 'Build automated SOC-2 and GDPR compliance dashboards', quarter: 'Q3-2026', status: 'COMPLETED', overallProgress: 100, keyResults: [{ krId: 'kr-007', title: 'Build SOC-2 dashboard', metric: 'coverage', startValue: 0, currentValue: 100, targetValue: 100, unit: '%', progress: 100, status: 'COMPLETED' }, { krId: 'kr-008', title: 'GDPR data mapping', metric: 'systems mapped', startValue: 0, currentValue: 42, targetValue: 42, unit: 'systems', progress: 100, status: 'COMPLETED' }], alignedToObjectiveId: null, ownerName: 'Priya Patel', reviewCycleId: 'rc-001', createdAtISO: '2026-07-01', updatedAtISO: '2026-08-10' },
  { objectiveId: 'obj-004', employeeId: 'emp-1005', employeeName: 'Aiko Tanaka', departmentCode: 'FIN', departmentName: 'Finance & Accounting', title: 'Reduce Month-End Close to 3 Days', description: 'Streamline financial close process from 7 days to 3 days', quarter: 'Q3-2026', status: 'ON_TRACK', overallProgress: 65, keyResults: [{ krId: 'kr-009', title: 'Automate reconciliations', metric: 'automated', startValue: 0, currentValue: 15, targetValue: 22, unit: 'tasks', progress: 68, status: 'ON_TRACK' }, { krId: 'kr-010', title: 'Close in 3 days', metric: 'days', startValue: 7, currentValue: 4, targetValue: 3, unit: 'days', progress: 63, status: 'ON_TRACK' }], alignedToObjectiveId: null, ownerName: 'Aiko Tanaka', reviewCycleId: 'rc-001', createdAtISO: '2026-07-01', updatedAtISO: '2026-08-16' },
];

const MOCK_FEEDBACK: FeedbackModel[] = [
  { feedbackId: 'fb-001', fromEmployeeId: 'emp-1004', fromEmployeeName: 'Marcus Thompson', toEmployeeId: 'emp-1001', toEmployeeName: 'Sarah Chen', type: 'PEER', category: 'STRENGTHS', content: 'Excellent technical leadership on the payment gateway project. Always available for code reviews.', rating: 5, isAnonymous: false, status: 'SUBMITTED', submittedDateISO: '2026-08-15', reviewCycleId: 'rc-001' },
  { feedbackId: 'fb-002', fromEmployeeId: 'emp-1008', fromEmployeeName: 'Fatima Al-Rashid', toEmployeeId: 'emp-1001', toEmployeeName: 'Sarah Chen', type: 'PEER', category: 'IMPROVEMENTS', content: 'Could improve on delegating more tasks to junior engineers to scale the team.', rating: null, isAnonymous: true, status: 'SUBMITTED', submittedDateISO: '2026-08-16', reviewCycleId: 'rc-001' },
  { feedbackId: 'fb-003', fromEmployeeId: 'emp-1001', fromEmployeeName: 'Sarah Chen', toEmployeeId: 'emp-1004', toEmployeeName: 'Marcus Thompson', type: 'MANAGER', category: 'OVERALL', content: 'Strong performer, consistently delivers high-quality work. Ready for senior role consideration.', rating: 4, isAnonymous: false, status: 'ACKNOWLEDGED', submittedDateISO: '2026-08-14', reviewCycleId: 'rc-001' },
];

const MOCK_REVIEW_CYCLES: ReviewCycleModel[] = [
  { cycleId: 'rc-001', name: 'Q3 2026 Performance Review', type: 'QUARTERLY', startDateISO: '2026-08-01', endDateISO: '2026-08-31', status: 'ACTIVE', totalEmployees: 300, completedReviews: 180, pendingReviews: 120, averageRating: 3.8 },
  { cycleId: 'rc-002', name: 'H1 2026 Annual Review', type: 'ANNUAL', startDateISO: '2026-06-15', endDateISO: '2026-07-15', status: 'COMPLETED', totalEmployees: 280, completedReviews: 275, pendingReviews: 5, averageRating: 3.7 },
];

const MOCK_SUCCESSION: SuccessionPlanModel[] = [
  { planId: 'sp-001', positionTitle: 'VP of Engineering', departmentCode: 'ENG', departmentName: 'Engineering', currentHolder: 'Robert Kim', readinessLevel: 'READY_12M', candidates: [{ employeeId: 'emp-1001', employeeName: 'Sarah Chen', currentRole: 'Sr. Staff Engineer', readinessLevel: 'READY_12M', potentialRating: 5, performanceRating: 5, riskOfLoss: 'MEDIUM', impactOfLoss: 'HIGH', notes: 'Strong technical leader, needs exec exposure' }, { employeeId: 'emp-1008', employeeName: 'Fatima Al-Rashid', currentRole: 'Staff Engineer', readinessLevel: 'READY_24M', potentialRating: 4, performanceRating: 4, riskOfLoss: 'LOW', impactOfLoss: 'MEDIUM', notes: 'Great architecture skills, developing people management' }], lastUpdatedISO: '2026-08-01' },
  { planId: 'sp-002', positionTitle: 'CFO', departmentCode: 'FIN', departmentName: 'Finance & Accounting', currentHolder: 'Margaret Liu', readinessLevel: 'READY_NOW', candidates: [{ employeeId: 'emp-1005', employeeName: 'Aiko Tanaka', currentRole: 'VP Finance', readinessLevel: 'READY_NOW', potentialRating: 5, performanceRating: 5, riskOfLoss: 'LOW', impactOfLoss: 'CRITICAL', notes: 'CFA Level III, 12 years experience, board-ready' }], lastUpdatedISO: '2026-07-20' },
];

export class EnterprisePerformanceService {
  private okrs: ObjectiveModel[]; private feedback: FeedbackModel[];
  private cycles: ReviewCycleModel[]; private succession: SuccessionPlanModel[];
  constructor() {
    this.okrs = [...MOCK_OKRS]; this.feedback = [...MOCK_FEEDBACK];
    this.cycles = [...MOCK_REVIEW_CYCLES]; this.succession = [...MOCK_SUCCESSION];
  }
  public getOKRs(filters?: { employeeId?: string; status?: string; quarter?: string }): ObjectiveModel[] {
    let r = [...this.okrs];
    if (filters?.employeeId) r = r.filter(o => o.employeeId === filters.employeeId);
    if (filters?.status) r = r.filter(o => o.status === filters.status);
    if (filters?.quarter) r = r.filter(o => o.quarter === filters.quarter);
    return r;
  }
  public getFeedback(filters?: { toEmployeeId?: string; type?: string }): FeedbackModel[] {
    let r = [...this.feedback];
    if (filters?.toEmployeeId) r = r.filter(f => f.toEmployeeId === filters.toEmployeeId);
    if (filters?.type) r = r.filter(f => f.type === filters.type);
    return r;
  }
  public getReviewCycles(): ReviewCycleModel[] { return [...this.cycles]; }
  public getSuccessionPlans(): SuccessionPlanModel[] { return [...this.succession]; }
  public getDashboardMetrics() {
    return {
      totalOKRs: this.okrs.length, onTrackOKRs: this.okrs.filter(o => o.status === 'ON_TRACK').length,
      atRiskOKRs: this.okrs.filter(o => o.status === 'AT_RISK').length,
      completedOKRs: this.okrs.filter(o => o.status === 'COMPLETED').length,
      avgProgress: Math.round(this.okrs.reduce((s, o) => s + o.overallProgress, 0) / this.okrs.length),
      totalFeedback: this.feedback.length,
      activeCycles: this.cycles.filter(c => c.status === 'ACTIVE').length,
      successionPlans: this.succession.length,
    };
  }
}

const service = new EnterprisePerformanceService();
const router = Router();

router.get('/performance/okrs', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getOKRs({ employeeId: req.query.employeeId as string, status: req.query.status as string, quarter: req.query.quarter as string }) });
});
router.get('/performance/feedback', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getFeedback({ toEmployeeId: req.query.toEmployeeId as string, type: req.query.type as string }) });
});
router.get('/performance/review-cycles', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getReviewCycles() });
});
router.get('/performance/succession', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getSuccessionPlans() });
});
router.get('/performance/dashboard-metrics', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getDashboardMetrics() });
});

export default router;
