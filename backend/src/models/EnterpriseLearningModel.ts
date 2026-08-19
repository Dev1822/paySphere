// ============================================================================
// Enterprise Learning & Development Intelligence Suite — Data Models
// PaySphere Enterprise L&D Module
// ============================================================================

export interface CourseModel {
  courseId: string;
  title: string;
  description: string;
  category: 'TECHNICAL' | 'LEADERSHIP' | 'COMPLIANCE' | 'SOFT_SKILLS' | 'ONBOARDING' | 'SECURITY';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  durationHours: number;
  instructorName: string;
  departmentRelevance: string[];
  totalEnrolled: number;
  totalCompleted: number;
  avgRating: number;
  totalModules: number;
  isMandatory: boolean;
  expiresAfterDays: number | null;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}

export interface CertificationModel {
  certId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  certificationName: string;
  issuingBody: string;
  earnedDateISO: string;
  expiryDateISO: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON' | 'REVOKED';
  credentialUrl: string | null;
}

export interface SkillGapModel {
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  requiredSkills: SkillEntry[];
  currentSkills: SkillEntry[];
  overallGapScore: number;
  priorityAreas: string[];
}

export interface SkillEntry {
  skillName: string;
  level: 1 | 2 | 3 | 4 | 5;
  lastAssessedISO: string;
}

export interface TrainingRecordModel {
  recordId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  courseId: string;
  courseTitle: string;
  enrolledDateISO: string;
  startedDateISO: string | null;
  completedDateISO: string | null;
  progressPercent: number;
  status: 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'WAIVED';
  score: number | null;
  timeSpentMinutes: number;
}

export class Course implements CourseModel {
  public courseId: string; public title: string; public description: string;
  public category: CourseModel['category']; public difficulty: CourseModel['difficulty'];
  public durationHours: number; public instructorName: string; public departmentRelevance: string[];
  public totalEnrolled: number; public totalCompleted: number; public avgRating: number;
  public totalModules: number; public isMandatory: boolean; public expiresAfterDays: number | null;
  public status: CourseModel['status'];

  constructor(data: Partial<CourseModel>) {
    this.courseId = data.courseId || `crs_${Date.now()}`;
    this.title = data.title || 'Untitled Course'; this.description = data.description || '';
    this.category = data.category || 'TECHNICAL'; this.difficulty = data.difficulty || 'BEGINNER';
    this.durationHours = data.durationHours || 0; this.instructorName = data.instructorName || 'TBD';
    this.departmentRelevance = data.departmentRelevance || []; this.totalEnrolled = data.totalEnrolled || 0;
    this.totalCompleted = data.totalCompleted || 0; this.avgRating = data.avgRating || 0;
    this.totalModules = data.totalModules || 0; this.isMandatory = data.isMandatory ?? false;
    this.expiresAfterDays = data.expiresAfterDays || null; this.status = data.status || 'ACTIVE';
  }

  public completionRate(): number {
    return this.totalEnrolled > 0 ? Math.round((this.totalCompleted / this.totalEnrolled) * 100) : 0;
  }

  public toJSON(): CourseModel {
    return { courseId: this.courseId, title: this.title, description: this.description, category: this.category,
      difficulty: this.difficulty, durationHours: this.durationHours, instructorName: this.instructorName,
      departmentRelevance: this.departmentRelevance, totalEnrolled: this.totalEnrolled,
      totalCompleted: this.totalCompleted, avgRating: this.avgRating, totalModules: this.totalModules,
      isMandatory: this.isMandatory, expiresAfterDays: this.expiresAfterDays, status: this.status };
  }
}

export class Certification implements CertificationModel {
  public certId: string; public employeeId: string; public employeeName: string;
  public departmentCode: string; public certificationName: string; public issuingBody: string;
  public earnedDateISO: string; public expiryDateISO: string | null;
  public status: CertificationModel['status']; public credentialUrl: string | null;

  constructor(data: Partial<CertificationModel>) {
    this.certId = data.certId || `cert_${Date.now()}`; this.employeeId = data.employeeId || '';
    this.employeeName = data.employeeName || ''; this.departmentCode = data.departmentCode || '';
    this.certificationName = data.certificationName || ''; this.issuingBody = data.issuingBody || '';
    this.earnedDateISO = data.earnedDateISO || new Date().toISOString();
    this.expiryDateISO = data.expiryDateISO || null; this.status = data.status || 'ACTIVE';
    this.credentialUrl = data.credentialUrl || null;
  }

  public isExpiringSoon(withinDays: number = 30): boolean {
    if (!this.expiryDateISO) return false;
    const expiry = new Date(this.expiryDateISO).getTime();
    const now = Date.now();
    const daysUntil = (expiry - now) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= withinDays;
  }

  public toJSON(): CertificationModel {
    return { certId: this.certId, employeeId: this.employeeId, employeeName: this.employeeName,
      departmentCode: this.departmentCode, certificationName: this.certificationName,
      issuingBody: this.issuingBody, earnedDateISO: this.earnedDateISO, expiryDateISO: this.expiryDateISO,
      status: this.status, credentialUrl: this.credentialUrl };
  }
}

export class TrainingRecord implements TrainingRecordModel {
  public recordId: string; public employeeId: string; public employeeName: string;
  public departmentCode: string; public courseId: string; public courseTitle: string;
  public enrolledDateISO: string; public startedDateISO: string | null;
  public completedDateISO: string | null; public progressPercent: number;
  public status: TrainingRecordModel['status']; public score: number | null;
  public timeSpentMinutes: number;

  constructor(data: Partial<TrainingRecordModel>) {
    this.recordId = data.recordId || `tr_${Date.now()}`; this.employeeId = data.employeeId || '';
    this.employeeName = data.employeeName || ''; this.departmentCode = data.departmentCode || '';
    this.courseId = data.courseId || ''; this.courseTitle = data.courseTitle || '';
    this.enrolledDateISO = data.enrolledDateISO || new Date().toISOString();
    this.startedDateISO = data.startedDateISO || null; this.completedDateISO = data.completedDateISO || null;
    this.progressPercent = data.progressPercent || 0; this.status = data.status || 'ENROLLED';
    this.score = data.score || null; this.timeSpentMinutes = data.timeSpentMinutes || 0;
  }

  public toJSON(): TrainingRecordModel {
    return { recordId: this.recordId, employeeId: this.employeeId, employeeName: this.employeeName,
      departmentCode: this.departmentCode, courseId: this.courseId, courseTitle: this.courseTitle,
      enrolledDateISO: this.enrolledDateISO, startedDateISO: this.startedDateISO,
      completedDateISO: this.completedDateISO, progressPercent: this.progressPercent,
      status: this.status, score: this.score, timeSpentMinutes: this.timeSpentMinutes };
  }
}
