// ============================================================================
// Enterprise Employee Onboarding & Offboarding Lifecycle Suite — Data Models
// PaySphere Enterprise HR Module
// ============================================================================

/**
 * Onboarding task tracked for each new hire during their first 90 days.
 * Covers document collection, IT provisioning, training completion, and
 * manager check-ins with full audit trail.
 */
export interface OnboardingTaskModel {
  taskId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  category: 'DOCUMENTS' | 'IT_PROVISIONING' | 'TRAINING' | 'COMPLIANCE' | 'SOCIAL' | 'MANAGER_CHECKIN';
  taskName: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'SKIPPED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDateISO: string;
  completedDateISO: string | null;
  assignedTo: string;
  completedBy: string | null;
  documentsRequired: string[];
  documentsSubmitted: string[];
  notes: string;
  blockedReason: string | null;
}

/**
 * Offboarding checklist tracked when an employee exits the organisation.
 * Covers asset return, access revocation, knowledge transfer, and exit interview.
 */
export interface OffboardingTaskModel {
  taskId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  lastWorkingDayISO: string;
  reason: 'VOLUNTARY' | 'INVOLUNTARY' | 'RETIREMENT' | 'TRANSFER' | 'CONTRACT_END';
  category: 'ASSET_RETURN' | 'ACCESS_REVOCATION' | 'KNOWLEDGE_TRANSFER' | 'EXIT_INTERVIEW' | 'FINAL_SETTLEMENT' | 'BENEFITS_CESSATION';
  taskName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'WAIVED';
  assignedTo: string;
  dueDateISO: string;
  completedDateISO: string | null;
  notes: string;
}

/**
 * Aggregate onboarding progress for a single employee across all task categories.
 * Used by the dashboard summary cards.
 */
export interface OnboardingProgressModel {
  employeeId: string;
  employeeName: string;
  email: string;
  departmentCode: string;
  departmentName: string;
  designation: string;
  startDateISO: string;
  managerName: string;
  buddyName: string;
  location: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  overallProgress: number;
  daysSinceJoining: number;
  probationEndDateISO: string;
  status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED' | 'ON_LEAVE';
  currentPhase: 'PRE_BOARDING' | 'DAY_ONE' | 'FIRST_WEEK' | 'FIRST_MONTH' | 'FIRST_QUARTER' | 'GRADUATED';
  tasksByCategory: Record<string, { total: number; completed: number }>;
}

/**
 * IT provisioning request for hardware, software, and cloud access.
 */
export interface ITProvisioningModel {
  requestId: string;
  employeeId: string;
  employeeName: string;
  requestType: 'HARDWARE' | 'SOFTWARE' | 'CLOUD_ACCESS' | 'VPN' | 'SECURITY_TOKEN' | 'BADGE';
  itemName: string;
  vendor: string;
  serialNumber: string | null;
  status: 'REQUESTED' | 'ORDERED' | 'SHIPPED' | 'DELIVERED' | 'CONFIGURED' | 'ASSIGNED' | 'RETURNED';
  requestedDateISO: string;
  expectedDeliveryISO: string;
  actualDeliveryISO: string | null;
  assignedBy: string;
  costUSD: number;
 -notes: string;
}

/**
 * Exit interview record capturing employee feedback on their departure.
 */
export interface ExitInterviewModel {
  interviewId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  lastWorkingDayISO: string;
  interviewDateISO: string;
  interviewerName: string;
  overallSatisfaction: number; // 1-10
  workLifeBalance: number;
  managementRating: number;
  compensationRating: number;
  careerGrowthRating: number;
  wouldRecommend: boolean;
  primaryReasonForLeaving: string;
  suggestionsForImprovement: string;
  additionalComments: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'ANALYZED' | 'ACTIONED';
}

/**
 * Summary metric used by the dashboard KPI stat cards.
 */
export interface OnboardingDashboardMetric {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  icon: string;
  accentColor: string;
}

// ============================================================================
// Model Factory Classes
// ============================================================================

export class OnboardingTask implements OnboardingTaskModel {
  public taskId: string;
  public employeeId: string;
  public employeeName: string;
  public departmentCode: string;
  public departmentName: string;
  public category: OnboardingTaskModel['category'];
  public taskName: string;
  public description: string;
  public status: OnboardingTaskModel['status'];
  public priority: OnboardingTaskModel['priority'];
  public dueDateISO: string;
  public completedDateISO: string | null;
  public assignedTo: string;
  public completedBy: string | null;
  public documentsRequired: string[];
  public documentsSubmitted: string[];
  public notes: string;
  public blockedReason: string | null;

  constructor(data: Partial<OnboardingTaskModel>) {
    this.taskId = data.taskId || `ot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.employeeId = data.employeeId || 'emp-001';
    this.employeeName = data.employeeName || 'New Employee';
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.category = data.category || 'DOCUMENTS';
    this.taskName = data.taskName || 'Complete task';
    this.description = data.description || '';
    this.status = data.status || 'PENDING';
    this.priority = data.priority || 'MEDIUM';
    this.dueDateISO = data.dueDateISO || new Date().toISOString();
    this.completedDateISO = data.completedDateISO || null;
    this.assignedTo = data.assignedTo || 'HR Team';
    this.completedBy = data.completedBy || null;
    this.documentsRequired = data.documentsRequired || [];
    this.documentsSubmitted = data.documentsSubmitted || [];
    this.notes = data.notes || '';
    this.blockedReason = data.blockedReason || null;
  }

  public complete(completerId: string): void {
    this.status = 'COMPLETED';
    this.completedDateISO = new Date().toISOString();
    this.completedBy = completerId;
  }

  public block(reason: string): void {
    this.status = 'BLOCKED';
    this.blockedReason = reason;
  }

  public toJSON(): OnboardingTaskModel {
    return {
      taskId: this.taskId,
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      departmentCode: this.departmentCode,
      departmentName: this.departmentName,
      category: this.category,
      taskName: this.taskName,
      description: this.description,
      status: this.status,
      priority: this.priority,
      dueDateISO: this.dueDateISO,
      completedDateISO: this.completedDateISO,
      assignedTo: this.assignedTo,
      completedBy: this.completedBy,
      documentsRequired: this.documentsRequired,
      documentsSubmitted: this.documentsSubmitted,
      notes: this.notes,
      blockedReason: this.blockedReason,
    };
  }
}

export class OffboardingTask implements OffboardingTaskModel {
  public taskId: string;
  public employeeId: string;
  public employeeName: string;
  public departmentCode: string;
  public departmentName: string;
  public lastWorkingDayISO: string;
  public reason: OffboardingTaskModel['reason'];
  public category: OffboardingTaskModel['category'];
  public taskName: string;
  public status: OffboardingTaskModel['status'];
  public assignedTo: string;
  public dueDateISO: string;
  public completedDateISO: string | null;
  public notes: string;

  constructor(data: Partial<OffboardingTaskModel>) {
    this.taskId = data.taskId || `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.employeeId = data.employeeId || 'emp-001';
    this.employeeName = data.employeeName || 'Departing Employee';
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.lastWorkingDayISO = data.lastWorkingDayISO || new Date().toISOString();
    this.reason = data.reason || 'VOLUNTARY';
    this.category = data.category || 'ASSET_RETURN';
    this.taskName = data.taskName || 'Complete offboarding task';
    this.status = data.status || 'PENDING';
    this.assignedTo = data.assignedTo || 'HR Team';
    this.dueDateISO = data.dueDateISO || new Date().toISOString();
    this.completedDateISO = data.completedDateISO || null;
    this.notes = data.notes || '';
  }

  public complete(completerId: string): void {
    this.status = 'COMPLETED';
    this.completedDateISO = new Date().toISOString();
  }

  public waive(): void {
    this.status = 'WAIVED';
  }

  public toJSON(): OffboardingTaskModel {
    return {
      taskId: this.taskId,
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      departmentCode: this.departmentCode,
      departmentName: this.departmentName,
      lastWorkingDayISO: this.lastWorkingDayISO,
      reason: this.reason,
      category: this.category,
      taskName: this.taskName,
      status: this.status,
      assignedTo: this.assignedTo,
      dueDateISO: this.dueDateISO,
      completedDateISO: this.completedDateISO,
      notes: this.notes,
    };
  }
}

export class ITProvisioning implements ITProvisioningModel {
  public requestId: string;
  public employeeId: string;
  public employeeName: string;
  public requestType: ITProvisioningModel['requestType'];
  public itemName: string;
  public vendor: string;
  public serialNumber: string | null;
  public status: ITProvisioningModel['status'];
  public requestedDateISO: string;
  public expectedDeliveryISO: string;
  public actualDeliveryISO: string | null;
  public assignedBy: string;
  public costUSD: number;
  public notes: string;

  constructor(data: Partial<ITProvisioningModel>) {
    this.requestId = data.requestId || `it_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.employeeId = data.employeeId || 'emp-001';
    this.employeeName = data.employeeName || 'New Employee';
    this.requestType = data.requestType || 'HARDWARE';
    this.itemName = data.itemName || 'Laptop';
    this.vendor = data.vendor || 'Apple';
    this.serialNumber = data.serialNumber || null;
    this.status = data.status || 'REQUESTED';
    this.requestedDateISO = data.requestedDateISO || new Date().toISOString();
    this.expectedDeliveryISO = data.expectedDeliveryISO || new Date().toISOString();
    this.actualDeliveryISO = data.actualDeliveryISO || null;
    this.assignedBy = data.assignedBy || 'IT Admin';
    this.costUSD = data.costUSD || 0;
    this.notes = data.notes || '';
  }

  public toJSON(): ITProvisioningModel {
    return {
      requestId: this.requestId,
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      requestType: this.requestType,
      itemName: this.itemName,
      vendor: this.vendor,
      serialNumber: this.serialNumber,
      status: this.status,
      requestedDateISO: this.requestedDateISO,
      expectedDeliveryISO: this.expectedDeliveryISO,
      actualDeliveryISO: this.actualDeliveryISO,
      assignedBy: this.assignedBy,
      costUSD: this.costUSD,
      notes: this.notes,
    };
  }
}

export class ExitInterview implements ExitInterviewModel {
  public interviewId: string;
  public employeeId: string;
  public employeeName: string;
  public departmentCode: string;
  public departmentName: string;
  public lastWorkingDayISO: string;
  public interviewDateISO: string;
  public interviewerName: string;
  public overallSatisfaction: number;
  public workLifeBalance: number;
  public managementRating: number;
  public compensationRating: number;
  public careerGrowthRating: number;
  public wouldRecommend: boolean;
  public primaryReasonForLeaving: string;
  public suggestionsForImprovement: string;
  public additionalComments: string;
  public status: ExitInterviewModel['status'];

  constructor(data: Partial<ExitInterviewModel>) {
    this.interviewId = data.interviewId || `ei_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.employeeId = data.employeeId || 'emp-001';
    this.employeeName = data.employeeName || 'Departing Employee';
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.lastWorkingDayISO = data.lastWorkingDayISO || new Date().toISOString();
    this.interviewDateISO = data.interviewDateISO || new Date().toISOString();
    this.interviewerName = data.interviewerName || 'HR Director';
    this.overallSatisfaction = data.overallSatisfaction || 7;
    this.workLifeBalance = data.workLifeBalance || 6;
    this.managementRating = data.managementRating || 7;
    this.compensationRating = data.compensationRating || 5;
    this.careerGrowthRating = data.careerGrowthRating || 6;
    this.wouldRecommend = data.wouldRecommend ?? true;
    this.primaryReasonForLeaving = data.primaryReasonForLeaving || 'Better opportunity';
    this.suggestionsForImprovement = data.suggestionsForImprovement || '';
    this.additionalComments = data.additionalComments || '';
    this.status = data.status || 'SCHEDULED';
  }

  public averageScore(): number {
    return Math.round(
      ((this.overallSatisfaction + this.workLifeBalance + this.managementRating +
        this.compensationRating + this.careerGrowthRating) / 5) * 100
    ) / 100;
  }

  public toJSON(): ExitInterviewModel {
    return {
      interviewId: this.interviewId,
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      departmentCode: this.departmentCode,
      departmentName: this.departmentName,
      lastWorkingDayISO: this.lastWorkingDayISO,
      interviewDateISO: this.interviewDateISO,
      interviewerName: this.interviewerName,
      overallSatisfaction: this.overallSatisfaction,
      workLifeBalance: this.workLifeBalance,
      managementRating: this.managementRating,
      compensationRating: this.compensationRating,
      careerGrowthRating: this.careerGrowthRating,
      wouldRecommend: this.wouldRecommend,
      primaryReasonForLeaving: this.primaryReasonForLeaving,
      suggestionsForImprovement: this.suggestionsForImprovement,
      additionalComments: this.additionalComments,
      status: this.status,
    };
  }
}
