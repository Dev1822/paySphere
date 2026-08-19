// ============================================================================
// Enterprise Performance Management & OKR Suite — Data Models
// PaySphere Enterprise People Module
// ============================================================================

export interface ObjectiveModel {
  objectiveId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  title: string;
  description: string;
  quarter: string; // e.g. "Q3-2026"
  status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED' | 'CANCELLED';
  overallProgress: number; // 0-100
  keyResults: KeyResult[];
  alignedToObjectiveId: string | null;
  ownerName: string;
  reviewCycleId: string;
  createdAtISO: string;
  updatedAtISO: string;
}

export interface KeyResult {
  krId: string;
  title: string;
  metric: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  progress: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED';
}

export interface FeedbackModel {
  feedbackId: string;
  fromEmployeeId: string;
  fromEmployeeName: string;
  toEmployeeId: string;
  toEmployeeName: string;
  type: 'PEER' | 'MANAGER' | 'SELF' | 'UPWARD' | '360';
  category: 'STRENGTHS' | 'IMPROVEMENTS' | 'OVERALL' | 'CULTURE' | 'LEADERSHIP';
  content: string;
  rating: number | null; // 1-5
  isAnonymous: boolean;
  status: 'PENDING' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'ARCHIVED';
  submittedDateISO: string;
  reviewCycleId: string;
}

export interface ReviewCycleModel {
  cycleId: string;
  name: string;
  type: 'QUARTERLY' | 'ANNUAL' | 'MID_YEAR' | 'PROBATION' | 'CONTINUOUS';
  startDateISO: string;
  endDateISO: string;
  status: 'UPCOMING' | 'ACTIVE' | 'CALIBRATING' | 'COMPLETED';
  totalEmployees: number;
  completedReviews: number;
  pendingReviews: number;
  averageRating: number;
}

export interface SuccessionPlanModel {
  planId: string;
  positionTitle: string;
  departmentCode: string;
  departmentName: string;
  currentHolder: string;
  readinessLevel: 'READY_NOW' | 'READY_12M' | 'READY_24M' | 'DEVELOPING' | 'NOT_READY';
  candidates: SuccessionCandidate[];
  lastUpdatedISO: string;
}

export interface SuccessionCandidate {
  employeeId: string;
  employeeName: string;
  currentRole: string;
  readinessLevel: SuccessionPlanModel['readinessLevel'];
  potentialRating: number; // 1-5
  performanceRating: number; // 1-5
  riskOfLoss: 'LOW' | 'MEDIUM' | 'HIGH';
  impactOfLoss: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string;
}

export class Objective implements ObjectiveModel {
  public objectiveId: string; public employeeId: string; public employeeName: string;
  public departmentCode: string; public departmentName: string; public title: string;
  public description: string; public quarter: string; public status: ObjectiveModel['status'];
  public overallProgress: number; public keyResults: KeyResult[];
  public alignedToObjectiveId: string | null; public ownerName: string;
  public reviewCycleId: string; public createdAtISO: string; public updatedAtISO: string;

  constructor(data: Partial<ObjectiveModel>) {
    this.objectiveId = data.objectiveId || `obj_${Date.now()}`; this.employeeId = data.employeeId || '';
    this.employeeName = data.employeeName || ''; this.departmentCode = data.departmentCode || '';
    this.departmentName = data.departmentName || ''; this.title = data.title || '';
    this.description = data.description || ''; this.quarter = data.quarter || 'Q3-2026';
    this.status = data.status || 'ON_TRACK'; this.overallProgress = data.overallProgress || 0;
    this.keyResults = data.keyResults || []; this.alignedToObjectiveId = data.alignedToObjectiveId || null;
    this.ownerName = data.ownerName || ''; this.reviewCycleId = data.reviewCycleId || '';
    this.createdAtISO = data.createdAtISO || new Date().toISOString();
    this.updatedAtISO = data.updatedAtISO || new Date().toISOString();
  }

  public calculateProgress(): number {
    if (this.keyResults.length === 0) return 0;
    const total = this.keyResults.reduce((s, kr) => s + kr.progress, 0);
    return Math.round(total / this.keyResults.length);
  }

  public toJSON(): ObjectiveModel {
    return { objectiveId: this.objectiveId, employeeId: this.employeeId, employeeName: this.employeeName,
      departmentCode: this.departmentCode, departmentName: this.departmentName, title: this.title,
      description: this.description, quarter: this.quarter, status: this.status,
      overallProgress: this.overallProgress, keyResults: this.keyResults,
      alignedToObjectiveId: this.alignedToObjectiveId, ownerName: this.ownerName,
      reviewCycleId: this.reviewCycleId, createdAtISO: this.createdAtISO, updatedAtISO: this.updatedAtISO };
  }
}

export class ReviewCycle implements ReviewCycleModel {
  public cycleId: string; public name: string; public type: ReviewCycleModel['type'];
  public startDateISO: string; public endDateISO: string; public status: ReviewCycleModel['status'];
  public totalEmployees: number; public completedReviews: number; public pendingReviews: number;
  public averageRating: number;

  constructor(data: Partial<ReviewCycleModel>) {
    this.cycleId = data.cycleId || `rc_${Date.now()}`; this.name = data.name || 'Review Cycle';
    this.type = data.type || 'QUARTERLY'; this.startDateISO = data.startDateISO || new Date().toISOString();
    this.endDateISO = data.endDateISO || new Date().toISOString(); this.status = data.status || 'ACTIVE';
    this.totalEmployees = data.totalEmployees || 0; this.completedReviews = data.completedReviews || 0;
    this.pendingReviews = data.pendingReviews || 0; this.averageRating = data.averageRating || 0;
  }

  public completionRate(): number {
    return this.totalEmployees > 0 ? Math.round((this.completedReviews / this.totalEmployees) * 100) : 0;
  }

  public toJSON(): ReviewCycleModel {
    return { cycleId: this.cycleId, name: this.name, type: this.type, startDateISO: this.startDateISO,
      endDateISO: this.endDateISO, status: this.status, totalEmployees: this.totalEmployees,
      completedReviews: this.completedReviews, pendingReviews: this.pendingReviews,
      averageRating: this.averageRating };
  }
}

export class SuccessionPlan implements SuccessionPlanModel {
  public planId: string; public positionTitle: string; public departmentCode: string;
  public departmentName: string; public currentHolder: string;
  public readinessLevel: SuccessionPlanModel['readinessLevel'];
  public candidates: SuccessionCandidate[]; public lastUpdatedISO: string;

  constructor(data: Partial<SuccessionPlanModel>) {
    this.planId = data.planId || `sp_${Date.now()}`; this.positionTitle = data.positionTitle || '';
    this.departmentCode = data.departmentCode || ''; this.departmentName = data.departmentName || '';
    this.currentHolder = data.currentHolder || ''; this.readinessLevel = data.readinessLevel || 'DEVELOPING';
    this.candidates = data.candidates || []; this.lastUpdatedISO = data.lastUpdatedISO || new Date().toISOString();
  }

  public toJSON(): SuccessionPlanModel {
    return { planId: this.planId, positionTitle: this.positionTitle, departmentCode: this.departmentCode,
      departmentName: this.departmentName, currentHolder: this.currentHolder,
      readinessLevel: this.readinessLevel, candidates: this.candidates, lastUpdatedISO: this.lastUpdatedISO };
  }
}
