// ============================================================================
// Enterprise Expense Management & Reimbursement Suite — Data Models
// PaySphere Enterprise Finance Module
// ============================================================================

/**
 * Single expense claim submitted by an employee with receipt OCR data,
 * multi-currency support, policy compliance scoring, and approval chain.
 */
export interface ExpenseClaimModel {
  claimId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  title: string;
  description: string;
  category: 'TRAVEL' | 'MEALS' | 'LODGING' | 'TRANSPORT' | 'OFFICE_SUPPLIES' | 'SOFTWARE' | 'TRAINING' | 'CLIENT_ENTERTAINMENT' | 'MILEAGE' | 'OTHER';
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'DISPUTED';
  currency: string;
  originalAmount: number;
  exchangeRate: number;
  amountUSD: number;
  taxAmountUSD: number;
  totalClaimUSD: number;
  receiptUrl: string | null;
  receiptOcrData: ReceiptOCRData | null;
  policyComplianceScore: number; // 0-100
  policyViolations: PolicyViolation[];
  submittedDateISO: string;
  expenseDateISO: string;
  reimbursedDateISO: string | null;
  approverChain: ApprovalStep[];
  currentApprover: string | null;
  tags: string[];
  mileageKm: number | null;
  mileageRatePerKm: number | null;
  isRecurring: boolean;
  recurringGroupId: string | null;
}

/**
 * OCR-extracted data from a scanned/uploaded receipt.
 */
export interface ReceiptOCRData {
  vendorName: string;
  vendorAddress: string;
  receiptDate: string;
  lineItems: { description: string; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  confidence: number; // 0-1
  rawText: string;
}

/**
 * Policy violation detected during automated compliance check.
 */
export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER';
  message: string;
  suggestedAction: string;
  autoResolvable: boolean;
}

/**
 * Expense policy rule defining limits, categories, and compliance thresholds.
 */
export interface ExpensePolicyRuleModel {
  ruleId: string;
  policyName: string;
  departmentCode: string | null; // null = company-wide
  category: string;
  dailyLimitUSD: number;
  monthlyLimitUSD: number;
  perEventLimitUSD: number;
  requiresReceiptAboveUSD: number;
  requiresPreApprovalAboveUSD: number;
  requiresManagerApproval: boolean;
  requiresFinanceApprovalAboveUSD: number;
  receiptRequired: boolean;
  allowedCurrencies: string[];
  blockedVendors: string[];
  maxMileagePerDayKm: number;
  effectiveFromISO: string;
  effectiveToISO: string | null;
  lastModifiedISO: string;
}

/**
 * Approval step in the expense reimbursement workflow.
 */
export interface ApprovalStep {
  stepId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  decisionDateISO: string | null;
  comments: string;
}

/**
 * Monthly expense summary per department for dashboard aggregation.
 */
export interface DepartmentExpenseSummary {
  departmentCode: string;
  departmentName: string;
  totalClaimsCount: number;
  totalClaimedUSD: number;
  totalApprovedUSD: number;
  totalRejectedUSD: number;
  totalReimbursedUSD: number;
  avgProcessingDays: number;
  complianceRate: number;
  topCategory: string;
  monthOverMonthChange: number;
}

// ============================================================================
// Model Factory Classes
// ============================================================================

export class ExpenseClaim implements ExpenseClaimModel {
  public claimId: string;
  public employeeId: string;
  public employeeName: string;
  public departmentCode: string;
  public departmentName: string;
  public title: string;
  public description: string;
  public category: ExpenseClaimModel['category'];
  public status: ExpenseClaimModel['status'];
  public currency: string;
  public originalAmount: number;
  public exchangeRate: number;
  public amountUSD: number;
  public taxAmountUSD: number;
  public totalClaimUSD: number;
  public receiptUrl: string | null;
  public receiptOcrData: ReceiptOCRData | null;
  public policyComplianceScore: number;
  public policyViolations: PolicyViolation[];
  public submittedDateISO: string;
  public expenseDateISO: string;
  public reimbursedDateISO: string | null;
  public approverChain: ApprovalStep[];
  public currentApprover: string | null;
  public tags: string[];
  public mileageKm: number | null;
  public mileageRatePerKm: number | null;
  public isRecurring: boolean;
  public recurringGroupId: string | null;

  constructor(data: Partial<ExpenseClaimModel>) {
    this.claimId = data.claimId || `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.employeeId = data.employeeId || 'emp-001';
    this.employeeName = data.employeeName || 'Employee';
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.title = data.title || 'Expense Claim';
    this.description = data.description || '';
    this.category = data.category || 'OTHER';
    this.status = data.status || 'DRAFT';
    this.currency = data.currency || 'USD';
    this.originalAmount = data.originalAmount || 0;
    this.exchangeRate = data.exchangeRate || 1;
    this.amountUSD = data.amountUSD || this.originalAmount * this.exchangeRate;
    this.taxAmountUSD = data.taxAmountUSD || 0;
    this.totalClaimUSD = data.totalClaimUSD || this.amountUSD + this.taxAmountUSD;
    this.receiptUrl = data.receiptUrl || null;
    this.receiptOcrData = data.receiptOcrData || null;
    this.policyComplianceScore = data.policyComplianceScore ?? 100;
    this.policyViolations = data.policyViolations || [];
    this.submittedDateISO = data.submittedDateISO || new Date().toISOString();
    this.expenseDateISO = data.expenseDateISO || new Date().toISOString();
    this.reimbursedDateISO = data.reimbursedDateISO || null;
    this.approverChain = data.approverChain || [];
    this.currentApprover = data.currentApprover || null;
    this.tags = data.tags || [];
    this.mileageKm = data.mileageKm || null;
    this.mileageRatePerKm = data.mileageRatePerKm || null;
    this.isRecurring = data.isRecurring ?? false;
    this.recurringGroupId = data.recurringGroupId || null;
  }

  public submit(): void {
    this.status = 'SUBMITTED';
    this.submittedDateISO = new Date().toISOString();
  }

  public approve(stepId: string, comments: string): void {
    const step = this.approverChain.find(s => s.stepId === stepId);
    if (step) {
      step.status = 'APPROVED';
      step.decisionDateISO = new Date().toISOString();
      step.comments = comments;
    }
    this.status = 'APPROVED';
  }

  public reject(stepId: string, reason: string): void {
    const step = this.approverChain.find(s => s.stepId === stepId);
    if (step) {
      step.status = 'REJECTED';
      step.decisionDateISO = new Date().toISOString();
      step.comments = reason;
    }
    this.status = 'REJECTED';
  }

  public reimburse(): void {
    this.status = 'REIMBURSED';
    this.reimbursedDateISO = new Date().toISOString();
  }

  public toJSON(): ExpenseClaimModel {
    return {
      claimId: this.claimId, employeeId: this.employeeId, employeeName: this.employeeName,
      departmentCode: this.departmentCode, departmentName: this.departmentName,
      title: this.title, description: this.description, category: this.category,
      status: this.status, currency: this.currency, originalAmount: this.originalAmount,
      exchangeRate: this.exchangeRate, amountUSD: this.amountUSD, taxAmountUSD: this.taxAmountUSD,
      totalClaimUSD: this.totalClaimUSD, receiptUrl: this.receiptUrl,
      receiptOcrData: this.receiptOcrData, policyComplianceScore: this.policyComplianceScore,
      policyViolations: this.policyViolations, submittedDateISO: this.submittedDateISO,
      expenseDateISO: this.expenseDateISO, reimbursedDateISO: this.reimbursedDateISO,
      approverChain: this.approverChain, currentApprover: this.currentApprover,
      tags: this.tags, mileageKm: this.mileageKm, mileageRatePerKm: this.mileageRatePerKm,
      isRecurring: this.isRecurring, recurringGroupId: this.recurringGroupId,
    };
  }
}

export class ExpensePolicyRule implements ExpensePolicyRuleModel {
  public ruleId: string;
  public policyName: string;
  public departmentCode: string | null;
  public category: string;
  public dailyLimitUSD: number;
  public monthlyLimitUSD: number;
  public perEventLimitUSD: number;
  public requiresReceiptAboveUSD: number;
  public requiresPreApprovalAboveUSD: number;
  public requiresManagerApproval: boolean;
  public requiresFinanceApprovalAboveUSD: number;
  public receiptRequired: boolean;
  public allowedCurrencies: string[];
  public blockedVendors: string[];
  public maxMileagePerDayKm: number;
  public effectiveFromISO: string;
  public effectiveToISO: string | null;
  public lastModifiedISO: string;

  constructor(data: Partial<ExpensePolicyRuleModel>) {
    this.ruleId = data.ruleId || `epr_${Date.now()}`;
    this.policyName = data.policyName || 'Default Policy';
    this.departmentCode = data.departmentCode || null;
    this.category = data.category || 'OTHER';
    this.dailyLimitUSD = data.dailyLimitUSD || 200;
    this.monthlyLimitUSD = data.monthlyLimitUSD || 2000;
    this.perEventLimitUSD = data.perEventLimitUSD || 500;
    this.requiresReceiptAboveUSD = data.requiresReceiptAboveUSD || 25;
    this.requiresPreApprovalAboveUSD = data.requiresPreApprovalAboveUSD || 100;
    this.requiresManagerApproval = data.requiresManagerApproval ?? true;
    this.requiresFinanceApprovalAboveUSD = data.requiresFinanceApprovalAboveUSD || 1000;
    this.receiptRequired = data.receiptRequired ?? true;
    this.allowedCurrencies = data.allowedCurrencies || ['USD', 'EUR', 'GBP', 'JPY', 'INR'];
    this.blockedVendors = data.blockedVendors || [];
    this.maxMileagePerDayKm = data.maxMileagePerDayKm || 300;
    this.effectiveFromISO = data.effectiveFromISO || new Date().toISOString();
    this.effectiveToISO = data.effectiveToISO || null;
    this.lastModifiedISO = data.lastModifiedISO || new Date().toISOString();
  }

  public toJSON(): ExpensePolicyRuleModel {
    return {
      ruleId: this.ruleId, policyName: this.policyName, departmentCode: this.departmentCode,
      category: this.category, dailyLimitUSD: this.dailyLimitUSD, monthlyLimitUSD: this.monthlyLimitUSD,
      perEventLimitUSD: this.perEventLimitUSD, requiresReceiptAboveUSD: this.requiresReceiptAboveUSD,
      requiresPreApprovalAboveUSD: this.requiresPreApprovalAboveUSD,
      requiresManagerApproval: this.requiresManagerApproval,
      requiresFinanceApprovalAboveUSD: this.requiresFinanceApprovalAboveUSD,
      receiptRequired: this.receiptRequired, allowedCurrencies: this.allowedCurrencies,
      blockedVendors: this.blockedVendors, maxMileagePerDayKm: this.maxMileagePerDayKm,
      effectiveFromISO: this.effectiveFromISO, effectiveToISO: this.effectiveToISO,
      lastModifiedISO: this.lastModifiedISO,
    };
  }
}

export class DepartmentExpenseSummaryImpl implements DepartmentExpenseSummary {
  public departmentCode: string;
  public departmentName: string;
  public totalClaimsCount: number;
  public totalClaimedUSD: number;
  public totalApprovedUSD: number;
  public totalRejectedUSD: number;
  public totalReimbursedUSD: number;
  public avgProcessingDays: number;
  public complianceRate: number;
  public topCategory: string;
  public monthOverMonthChange: number;

  constructor(data: Partial<DepartmentExpenseSummary>) {
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.totalClaimsCount = data.totalClaimsCount || 0;
    this.totalClaimedUSD = data.totalClaimedUSD || 0;
    this.totalApprovedUSD = data.totalApprovedUSD || 0;
    this.totalRejectedUSD = data.totalRejectedUSD || 0;
    this.totalReimbursedUSD = data.totalReimbursedUSD || 0;
    this.avgProcessingDays = data.avgProcessingDays || 0;
    this.complianceRate = data.complianceRate || 100;
    this.topCategory = data.topCategory || 'TRAVEL';
    this.monthOverMonthChange = data.monthOverMonthChange || 0;
  }

  public toJSON(): DepartmentExpenseSummary {
    return { ...this };
  }
}
