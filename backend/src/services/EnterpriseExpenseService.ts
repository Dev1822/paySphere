import { Router, Request, Response } from 'express';

import {
  ExpenseClaim,
  ExpensePolicyRule,
  DepartmentExpenseSummaryImpl,
  ExpenseClaimModel,
  ExpensePolicyRuleModel,
  DepartmentExpenseSummary,
} from '../models/EnterpriseExpenseModel';

// ============================================================================
// Enterprise Expense Management Service
// ============================================================================

const MOCK_EXPENSE_CLAIMS: ExpenseClaimModel[] = [
  {
    claimId: 'ex-001', employeeId: 'emp-1001', employeeName: 'Sarah Chen', departmentCode: 'ENG', departmentName: 'Engineering',
    title: 'AWS re:Invent Conference Travel', description: 'Flights + hotel for AWS conference in Las Vegas',
    category: 'TRAVEL', status: 'REIMBURSED', currency: 'USD', originalAmount: 2850, exchangeRate: 1,
    amountUSD: 2850, taxAmountUSD: 215, totalClaimUSD: 3065,
    receiptUrl: '/receipts/ex-001.pdf', receiptOcrData: { vendorName: 'Delta Airlines', vendorAddress: '1600 E Boundary Rd, Atlanta, GA', receiptDate: '2026-08-05', lineItems: [{ description: 'Round-trip flight JFK-LAS', amount: 850 }, { description: 'Marriott Hotel 3 nights', amount: 1200 }, { description: 'Ground transportation', amount: 180 }], subtotal: 2230, tax: 180, total: 2850, currency: 'USD', confidence: 0.96, rawText: 'DELTA AIRLINES CONFIRMATION...' },
    policyComplianceScore: 98, policyViolations: [], submittedDateISO: '2026-08-06', expenseDateISO: '2026-08-05',
    reimbursedDateISO: '2026-08-12', approverChain: [{ stepId: 'as-001', approverName: 'Manager', approverRole: 'Engineering Manager', status: 'APPROVED', decisionDateISO: '2026-08-07', comments: 'Approved' }, { stepId: 'as-002', approverName: 'Finance', approverRole: 'Finance Director', status: 'APPROVED', decisionDateISO: '2026-08-10', comments: 'Verified' }],
    currentApprover: null, tags: ['conference', 'travel'], mileageKm: null, mileageRatePerKm: null, isRecurring: false, recurringGroupId: null,
  },
  {
    claimId: 'ex-002', employeeId: 'emp-1002', employeeName: 'James Rodriguez', departmentCode: 'SALES', departmentName: 'Global Sales',
    title: 'Client Dinner - Acme Corp', description: 'Dinner meeting with Acme Corp VP of Engineering',
    category: 'CLIENT_ENTERTAINMENT', status: 'APPROVED', currency: 'EUR', originalAmount: 420, exchangeRate: 1.08,
    amountUSD: 453.6, taxAmountUSD: 63.5, totalClaimUSD: 517.1,
    receiptUrl: '/receipts/ex-002.pdf', receiptOcrData: { vendorName: 'Le Petit Bistro', vendorAddress: '15 Rue de Rivoli, Paris', receiptDate: '2026-08-14', lineItems: [{ description: '3-course dinner x3 guests', amount: 320 }, { description: 'Wine pairings', amount: 100 }], subtotal: 420, tax: 0, total: 420, currency: 'EUR', confidence: 0.91, rawText: 'LE PETIT BISTRO RECEIPT...' },
    policyComplianceScore: 85, policyViolations: [{ ruleId: 'epr-003', ruleName: 'Client Entertainment Limit', severity: 'WARNING', message: 'Amount exceeds recommended per-event limit of $400', suggestedAction: 'Provide business justification', autoResolvable: false }],
    submittedDateISO: '2026-08-15', expenseDateISO: '2026-08-14', reimbursedDateISO: null,
    approverChain: [{ stepId: 'as-003', approverName: 'Elena Vasquez', approverRole: 'Sales Director', status: 'APPROVED', decisionDateISO: '2026-08-16', comments: 'Justified - Acme Corp is $2M ARR account' }],
    currentApprover: null, tags: ['client', 'dinner', 'paris'], mileageKm: null, mileageRatePerKm: null, isRecurring: false, recurringGroupId: null,
  },
  {
    claimId: 'ex-003', employeeId: 'emp-1003', employeeName: 'Priya Patel', departmentCode: 'OPS', departmentName: 'Corporate Operations',
    title: 'Weekly Commute Mileage', description: 'Home-to-office commute for the week',
    category: 'MILEAGE', status: 'UNDER_REVIEW', currency: 'GBP', originalAmount: 89.5, exchangeRate: 1.27,
    amountUSD: 113.67, taxAmountUSD: 0, totalClaimUSD: 113.67,
    receiptUrl: null, receiptOcrData: null, policyComplianceScore: 100, policyViolations: [],
    submittedDateISO: '2026-08-18', expenseDateISO: '2026-08-18', reimbursedDateISO: null,
    approverChain: [{ stepId: 'as-004', approverName: 'Manager', approverRole: 'Operations Manager', status: 'PENDING', decisionDateISO: null, comments: '' }],
    currentApprover: 'Operations Manager', tags: ['commute', 'mileage'], mileageKm: 142, mileageRatePerKm: 0.63, isRecurring: true, recurringGroupId: 'rg-001',
  },
  {
    claimId: 'ex-004', employeeId: 'emp-1004', employeeName: 'Marcus Thompson', departmentCode: 'ENG', departmentName: 'Engineering',
    title: 'GitHub Enterprise + Figma Annual', description: 'Annual licenses for dev tools',
    category: 'SOFTWARE', status: 'SUBMITTED', currency: 'USD', originalAmount: 1440, exchangeRate: 1,
    amountUSD: 1440, taxAmountUSD: 0, totalClaimUSD: 1440,
    receiptUrl: '/receipts/ex-004.pdf', receiptOcrData: { vendorName: 'GitHub Inc.', vendorAddress: 'San Francisco, CA', receiptDate: '2026-08-15', lineItems: [{ description: 'GitHub Enterprise Annual', amount: 1200 }, { description: 'Figma Professional Annual', amount: 240 }], subtotal: 1440, tax: 0, total: 1440, currency: 'USD', confidence: 0.99, rawText: 'GITHUB BILLING...' },
    policyComplianceScore: 72, policyViolations: [{ ruleId: 'epr-005', ruleName: 'Software Pre-Approval', severity: 'ERROR', message: 'Software purchases over $500 require pre-approval from IT Director', suggestedAction: 'Obtain pre-approval before resubmitting', autoResolvable: false }, { ruleId: 'epr-002', ruleName: 'Monthly Software Budget', severity: 'WARNING', message: 'Department software budget is 85% consumed this month', suggestedAction: 'Consider deferring to next billing cycle', autoResolvable: false }],
    submittedDateISO: '2026-08-19', expenseDateISO: '2026-08-15', reimbursedDateISO: null,
    approverChain: [{ stepId: 'as-005', approverName: 'Sarah Chen', approverRole: 'Engineering Manager', status: 'PENDING', decisionDateISO: null, comments: '' }, { stepId: 'as-006', approverName: 'Finance', approverRole: 'Finance Director', status: 'PENDING', decisionDateISO: null, comments: '' }],
    currentApprover: 'Engineering Manager', tags: ['software', 'annual'], mileageKm: null, mileageRatePerKm: null, isRecurring: false, recurringGroupId: null,
  },
  {
    claimId: 'ex-005', employeeId: 'emp-1005', employeeName: 'Aiko Tanaka', departmentCode: 'FIN', departmentName: 'Finance & Accounting',
    title: 'Tokyo Office Lunch Meeting', description: 'Team lunch at Tsukiji market area',
    category: 'MEALS', status: 'REIMBURSED', currency: 'JPY', originalAmount: 28500, exchangeRate: 0.0067,
    amountUSD: 190.95, taxAmountUSD: 19.1, totalClaimUSD: 210.05,
    receiptUrl: '/receipts/ex-005.pdf', receiptOcrData: { vendorName: 'Sushi Dai', vendorAddress: 'Tsukiji, Tokyo', receiptDate: '2026-08-12', lineItems: [{ description: 'Omakase set x5', amount: 25000 }, { description: 'Drinks', amount: 3500 }], subtotal: 28500, tax: 2850, total: 31350, currency: 'JPY', confidence: 0.88, rawText: 'すしだい レシート...' },
    policyComplianceScore: 95, policyViolations: [], submittedDateISO: '2026-08-13', expenseDateISO: '2026-08-12',
    reimbursedDateISO: '2026-08-18', approverChain: [{ stepId: 'as-007', approverName: 'Manager', approverRole: 'Finance Manager', status: 'APPROVED', decisionDateISO: '2026-08-14', comments: 'Approved' }],
    currentApprover: null, tags: ['team', 'lunch', 'tokyo'], mileageKm: null, mileageRatePerKm: null, isRecurring: false, recurringGroupId: null,
  },
  {
    claimId: 'ex-006', employeeId: 'emp-1006', employeeName: 'Elena Vasquez', departmentCode: 'SALES', departmentName: 'Global Sales',
    title: 'Berlin to Munich Train', description: 'ICE train for client meeting with BMW Group',
    category: 'TRANSPORT', status: 'DRAFT', currency: 'EUR', originalAmount: 185, exchangeRate: 1.08,
    amountUSD: 199.8, taxAmountUSD: 0, totalClaimUSD: 199.8,
    receiptUrl: null, receiptOcrData: null, policyComplianceScore: 100, policyViolations: [],
    submittedDateISO: '', expenseDateISO: '2026-08-20', reimbursedDateISO: null,
    approverChain: [], currentApprover: null, tags: ['transport', 'client'], mileageKm: null, mileageRatePerKm: null, isRecurring: false, recurringGroupId: null,
  },
  {
    claimId: 'ex-007', employeeId: 'emp-1007', employeeName: 'David Kim', departmentCode: 'HR', departmentName: 'People & Culture',
    title: 'LinkedIn Recruiter License', description: 'Monthly LinkedIn Recruiter seat',
    category: 'SOFTWARE', status: 'REIMBURSED', currency: 'USD', originalAmount: 180, exchangeRate: 1,
    amountUSD: 180, taxAmountUSD: 0, totalClaimUSD: 180,
    receiptUrl: '/receipts/ex-007.pdf', receiptOcrData: null, policyComplianceScore: 100, policyViolations: [],
    submittedDateISO: '2026-08-01', expenseDateISO: '2026-08-01', reimbursedDateISO: '2026-08-05',
    approverChain: [{ stepId: 'as-008', approverName: 'Manager', approverRole: 'HR Director', status: 'APPROVED', decisionDateISO: '2026-08-02', comments: 'Standard tool' }],
    currentApprover: null, tags: ['software', 'recruiting'], mileageKm: null, mileageRatePerKm: null, isRecurring: true, recurringGroupId: 'rg-002',
  },
];

const MOCK_POLICY_RULES: ExpensePolicyRuleModel[] = [
  { ruleId: 'epr-001', policyName: 'Travel Policy', departmentCode: null, category: 'TRAVEL', dailyLimitUSD: 500, monthlyLimitUSD: 5000, perEventLimitUSD: 2500, requiresReceiptAboveUSD: 25, requiresPreApprovalAboveUSD: 1000, requiresManagerApproval: true, requiresFinanceApprovalAboveUSD: 2000, receiptRequired: true, allowedCurrencies: ['USD', 'EUR', 'GBP', 'JPY'], blockedVendors: [], maxMileagePerDayKm: 500, effectiveFromISO: '2026-01-01', effectiveToISO: null, lastModifiedISO: '2026-06-01T10:00:00Z' },
  { ruleId: 'epr-002', policyName: 'Software Policy', departmentCode: null, category: 'SOFTWARE', dailyLimitUSD: 2000, monthlyLimitUSD: 10000, perEventLimitUSD: 2000, requiresReceiptAboveUSD: 25, requiresPreApprovalAboveUSD: 500, requiresManagerApproval: true, requiresFinanceApprovalAboveUSD: 1000, receiptRequired: true, allowedCurrencies: ['USD'], blockedVendors: [], maxMileagePerDayKm: 0, effectiveFromISO: '2026-01-01', effectiveToISO: null, lastModifiedISO: '2026-06-01T10:00:00Z' },
  { ruleId: 'epr-003', policyName: 'Client Entertainment', departmentCode: 'SALES', category: 'CLIENT_ENTERTAINMENT', dailyLimitUSD: 800, monthlyLimitUSD: 3000, perEventLimitUSD: 400, requiresReceiptAboveUSD: 25, requiresPreApprovalAboveUSD: 200, requiresManagerApproval: true, requiresFinanceApprovalAboveUSD: 500, receiptRequired: true, allowedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'INR'], blockedVendors: [], maxMileagePerDayKm: 0, effectiveFromISO: '2026-01-01', effectiveToISO: null, lastModifiedISO: '2026-06-01T10:00:00Z' },
];

const MOCK_DEPARTMENT_SUMMARIES: DepartmentExpenseSummary[] = [
  { departmentCode: 'ENG', departmentName: 'Engineering', totalClaimsCount: 45, totalClaimedUSD: 32500, totalApprovedUSD: 28700, totalRejectedUSD: 1200, totalReimbursedUSD: 27500, avgProcessingDays: 4.2, complianceRate: 94, topCategory: 'SOFTWARE', monthOverMonthChange: 12.5 },
  { departmentCode: 'SALES', departmentName: 'Global Sales', totalClaimsCount: 68, totalClaimedUSD: 54200, totalApprovedUSD: 49800, totalRejectedUSD: 2100, totalReimbursedUSD: 47700, avgProcessingDays: 3.1, complianceRate: 89, topCategory: 'TRAVEL', monthOverMonthChange: 8.3 },
  { departmentCode: 'OPS', departmentName: 'Corporate Operations', totalClaimsCount: 32, totalClaimedUSD: 12800, totalApprovedUSD: 11500, totalRejectedUSD: 800, totalReimbursedUSD: 11200, avgProcessingDays: 5.6, complianceRate: 97, topCategory: 'MILEAGE', monthOverMonthChange: -3.2 },
  { departmentCode: 'FIN', departmentName: 'Finance & Accounting', totalClaimsCount: 21, totalClaimedUSD: 8900, totalApprovedUSD: 8200, totalRejectedUSD: 400, totalReimbursedUSD: 8000, avgProcessingDays: 2.8, complianceRate: 100, topCategory: 'MEALS', monthOverMonthChange: 5.1 },
];

// ============================================================================
// Service Class
// ============================================================================

export class EnterpriseExpenseService {
  private claims: ExpenseClaimModel[];
  private policyRules: ExpensePolicyRuleModel[];
  private departmentSummaries: DepartmentExpenseSummary[];

  constructor() {
    this.claims = [...MOCK_EXPENSE_CLAIMS];
    this.policyRules = [...MOCK_POLICY_RULES];
    this.departmentSummaries = [...MOCK_DEPARTMENT_SUMMARIES];
  }

  public getClaims(filters?: { employeeId?: string; category?: string; status?: string; departmentCode?: string }): ExpenseClaimModel[] {
    let results = [...this.claims];
    if (filters?.employeeId) results = results.filter(c => c.employeeId === filters.employeeId);
    if (filters?.category) results = results.filter(c => c.category === filters.category);
    if (filters?.status) results = results.filter(c => c.status === filters.status);
    if (filters?.departmentCode) results = results.filter(c => c.departmentCode === filters.departmentCode);
    return results;
  }

  public getClaimById(id: string): ExpenseClaimModel | undefined {
    return this.claims.find(c => c.claimId === id);
  }

  public approveClaim(claimId: string, stepId: string, comments: string): ExpenseClaimModel | null {
    const claim = this.claims.find(c => c.claimId === claimId);
    if (!claim) return null;
    const step = claim.approverChain.find(s => s.stepId === stepId);
    if (step) { step.status = 'APPROVED'; step.decisionDateISO = new Date().toISOString(); step.comments = comments; }
    claim.status = 'APPROVED';
    return claim;
  }

  public rejectClaim(claimId: string, stepId: string, reason: string): ExpenseClaimModel | null {
    const claim = this.claims.find(c => c.claimId === claimId);
    if (!claim) return null;
    const step = claim.approverChain.find(s => s.stepId === stepId);
    if (step) { step.status = 'REJECTED'; step.decisionDateISO = new Date().toISOString(); step.comments = reason; }
    claim.status = 'REJECTED';
    return claim;
  }

  public getPolicyRules(): ExpensePolicyRuleModel[] { return [...this.policyRules]; }

  public getDepartmentSummaries(): DepartmentExpenseSummary[] { return [...this.departmentSummaries]; }

  public getDashboardMetrics() {
    const totalClaims = this.claims.length;
    const totalClaimedUSD = this.claims.reduce((s, c) => s + c.totalClaimUSD, 0);
    const pendingClaims = this.claims.filter(c => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length;
    const approvedClaims = this.claims.filter(c => c.status === 'APPROVED' || c.status === 'REIMBURSED').length;
    const rejectedClaims = this.claims.filter(c => c.status === 'REJECTED').length;
    const avgCompliance = Math.round(this.claims.reduce((s, c) => s + c.policyComplianceScore, 0) / totalClaims);
    const avgProcessingDays = Math.round(this.departmentSummaries.reduce((s, d) => s + d.avgProcessingDays, 0) / this.departmentSummaries.length * 10) / 10;
    return { totalClaims, totalClaimedUSD, pendingClaims, approvedClaims, rejectedClaims, avgCompliance, avgProcessingDays };
  }
}

// ============================================================================
// Express Router
// ============================================================================

const service = new EnterpriseExpenseService();
const router = Router();

router.get('/expense/claims', (req: Request, res: Response) => {
  const { employeeId, category, status, departmentCode } = req.query;
  const claims = service.getClaims({ employeeId: employeeId as string, category: category as string, status: status as string, departmentCode: departmentCode as string });
  res.json({ success: true, data: claims });
});

router.get('/expense/claims/:id', (req: Request, res: Response) => {
  const claim = service.getClaimById(req.params.id);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });
  res.json({ success: true, data: claim });
});

router.post('/expense/claims/:id/approve', (req: Request, res: Response) => {
  const updated = service.approveClaim(req.params.id, req.body.stepId, req.body.comments || 'Approved');
  if (!updated) return res.status(404).json({ success: false, error: 'Claim not found' });
  res.json({ success: true, data: updated });
});

router.post('/expense/claims/:id/reject', (req: Request, res: Response) => {
  const updated = service.rejectClaim(req.params.id, req.body.stepId, req.body.reason || 'Rejected');
  if (!updated) return res.status(404).json({ success: false, error: 'Claim not found' });
  res.json({ success: true, data: updated });
});

router.get('/expense/policy-rules', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getPolicyRules() });
});

router.get('/expense/department-summaries', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getDepartmentSummaries() });
});

router.get('/expense/dashboard-metrics', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getDashboardMetrics() });
});

export default router;
