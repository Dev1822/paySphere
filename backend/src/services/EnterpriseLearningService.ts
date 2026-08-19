import { Router, Request, Response } from 'express';
import { Course, Certification, TrainingRecord, CourseModel, CertificationModel, TrainingRecordModel } from '../models/EnterpriseLearningModel';

const MOCK_COURSES: CourseModel[] = [
  { courseId: 'crs-001', title: 'Advanced TypeScript Patterns', description: 'Deep dive into generics, mapped types, conditional types', category: 'TECHNICAL', difficulty: 'ADVANCED', durationHours: 12, instructorName: 'Sarah Chen', departmentRelevance: ['ENG'], totalEnrolled: 85, totalCompleted: 62, avgRating: 4.8, totalModules: 8, isMandatory: false, expiresAfterDays: null, status: 'ACTIVE' },
  { courseId: 'crs-002', title: 'SOC-2 Compliance Training', description: 'Annual mandatory security compliance certification', category: 'COMPLIANCE', difficulty: 'BEGINNER', durationHours: 4, instructorName: 'Security Team', departmentRelevance: ['ALL'], totalEnrolled: 300, totalCompleted: 285, avgRating: 4.2, totalModules: 6, isMandatory: true, expiresAfterDays: 365, status: 'ACTIVE' },
  { courseId: 'crs-003', title: 'Leadership for Engineering Managers', description: 'People management, 1:1s, career coaching', category: 'LEADERSHIP', difficulty: 'INTERMEDIATE', durationHours: 20, instructorName: 'External Coach', departmentRelevance: ['ENG', 'OPS'], totalEnrolled: 24, totalCompleted: 18, avgRating: 4.9, totalModules: 10, isMandatory: false, expiresAfterDays: null, status: 'ACTIVE' },
  { courseId: 'crs-004', title: 'AWS Solutions Architect Prep', description: 'SAA-C03 certification preparation course', category: 'TECHNICAL', difficulty: 'EXPERT', durationHours: 40, instructorName: 'AWS Certified Trainer', departmentRelevance: ['ENG'], totalEnrolled: 15, totalCompleted: 8, avgRating: 4.7, totalModules: 15, isMandatory: false, expiresAfterDays: null, status: 'ACTIVE' },
  { courseId: 'crs-005', title: 'Cybersecurity Awareness Refresh', description: 'Quarterly phishing simulation and security hygiene', category: 'SECURITY', difficulty: 'BEGINNER', durationHours: 2, instructorName: 'IT Security', departmentRelevance: ['ALL'], totalEnrolled: 300, totalCompleted: 270, avgRating: 4.0, totalModules: 3, isMandatory: true, expiresAfterDays: 90, status: 'ACTIVE' },
];

const MOCK_CERTIFICATIONS: CertificationModel[] = [
  { certId: 'cert-001', employeeId: 'emp-1001', employeeName: 'Sarah Chen', departmentCode: 'ENG', certificationName: 'AWS Solutions Architect Professional', issuingBody: 'Amazon Web Services', earnedDateISO: '2025-11-15', expiryDateISO: '2028-11-15', status: 'ACTIVE', credentialUrl: 'https://aws.amazon.com/verification/sc-001' },
  { certId: 'cert-002', employeeId: 'emp-1004', employeeName: 'Marcus Thompson', departmentCode: 'ENG', certificationName: 'Certified Kubernetes Administrator', issuingBody: 'CNCF', earnedDateISO: '2025-08-20', expiryDateISO: '2027-08-20', status: 'ACTIVE', credentialUrl: 'https://training.linuxfoundation.org/certification/mt-001' },
  { certId: 'cert-003', employeeId: 'emp-1003', employeeName: 'Priya Patel', departmentCode: 'OPS', certificationName: 'PMP Certification', issuingBody: 'PMI', earnedDateISO: '2024-06-10', expiryDateISO: '2026-09-10', status: 'EXPIRING_SOON', credentialUrl: 'https://pmi.org/verification/pp-001' },
  { certId: 'cert-004', employeeId: 'emp-1005', employeeName: 'Aiko Tanaka', departmentCode: 'FIN', certificationName: 'CFA Level III', issuingBody: 'CFA Institute', earnedDateISO: '2025-03-22', expiryDateISO: null, status: 'ACTIVE', credentialUrl: 'https://cfainstitute.org/verification/at-001' },
  { certId: 'cert-005', employeeId: 'emp-1008', employeeName: 'Fatima Al-Rashid', departmentCode: 'ENG', certificationName: 'SOC-2 Type II Auditor', issuingBody: 'AICPA', earnedDateISO: '2025-05-10', expiryDateISO: '2026-08-25', status: 'EXPIRING_SOON', credentialUrl: 'https://aicpa.org/verification/fa-001' },
];

const MOCK_TRAINING_RECORDS: TrainingRecordModel[] = [
  { recordId: 'tr-001', employeeId: 'emp-2001', employeeName: 'Alex Morgan', departmentCode: 'ENG', courseId: 'crs-001', courseTitle: 'Advanced TypeScript Patterns', enrolledDateISO: '2026-08-12', startedDateISO: '2026-08-12', completedDateISO: null, progressPercent: 62, status: 'IN_PROGRESS', score: null, timeSpentMinutes: 450 },
  { recordId: 'tr-002', employeeId: 'emp-2001', employeeName: 'Alex Morgan', departmentCode: 'ENG', courseId: 'crs-002', courseTitle: 'SOC-2 Compliance Training', enrolledDateISO: '2026-08-12', startedDateISO: '2026-08-13', completedDateISO: '2026-08-14', progressPercent: 100, status: 'COMPLETED', score: 92, timeSpentMinutes: 180 },
  { recordId: 'tr-003', employeeId: 'emp-1002', employeeName: 'James Rodriguez', departmentCode: 'SALES', courseId: 'crs-005', courseTitle: 'Cybersecurity Awareness Refresh', enrolledDateISO: '2026-07-01', startedDateISO: null, completedDateISO: null, progressPercent: 0, status: 'OVERDUE', score: null, timeSpentMinutes: 0 },
  { recordId: 'tr-004', employeeId: 'emp-1004', employeeName: 'Marcus Thompson', departmentCode: 'ENG', courseId: 'crs-004', courseTitle: 'AWS Solutions Architect Prep', enrolledDateISO: '2026-07-15', startedDateISO: '2026-07-16', completedDateISO: null, progressPercent: 88, status: 'IN_PROGRESS', score: null, timeSpentMinutes: 1800 },
  { recordId: 'tr-005', employeeId: 'emp-1003', employeeName: 'Priya Patel', departmentCode: 'OPS', courseId: 'crs-003', courseTitle: 'Leadership for Engineering Managers', enrolledDateISO: '2026-06-01', startedDateISO: '2026-06-05', completedDateISO: '2026-07-20', progressPercent: 100, status: 'COMPLETED', score: 95, timeSpentMinutes: 1200 },
];

export class EnterpriseLearningService {
  private courses: CourseModel[]; private certs: CertificationModel[]; private records: TrainingRecordModel[];
  constructor() {
    this.courses = [...MOCK_COURSES]; this.certs = [...MOCK_CERTIFICATIONS]; this.records = [...MOCK_TRAINING_RECORDS];
  }
  public getCourses(filters?: { category?: string; difficulty?: string }): CourseModel[] {
    let r = [...this.courses];
    if (filters?.category) r = r.filter(c => c.category === filters.category);
    if (filters?.difficulty) r = r.filter(c => c.difficulty === filters.difficulty);
    return r;
  }
  public getCertifications(filters?: { status?: string; departmentCode?: string }): CertificationModel[] {
    let r = [...this.certs];
    if (filters?.status) r = r.filter(c => c.status === filters.status);
    if (filters?.departmentCode) r = r.filter(c => c.departmentCode === filters.departmentCode);
    return r;
  }
  public getTrainingRecords(filters?: { employeeId?: string; status?: string }): TrainingRecordModel[] {
    let r = [...this.records];
    if (filters?.employeeId) r = r.filter(t => t.employeeId === filters.employeeId);
    if (filters?.status) r = r.filter(t => t.status === filters.status);
    return r;
  }
  public getDashboardMetrics() {
    return {
      totalCourses: this.courses.length, totalEnrollments: this.records.length,
      completedTrainings: this.records.filter(r => r.status === 'COMPLETED').length,
      overdueTrainings: this.records.filter(r => r.status === 'OVERDUE').length,
      expiringCerts: this.certs.filter(c => c.status === 'EXPIRING_SOON').length,
      activeCerts: this.certs.filter(c => c.status === 'ACTIVE').length,
      avgCourseRating: Math.round(this.courses.reduce((s, c) => s + c.avgRating, 0) / this.courses.length * 10) / 10,
    };
  }
}

const service = new EnterpriseLearningService();
const router = Router();

router.get('/learning/courses', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getCourses({ category: req.query.category as string, difficulty: req.query.difficulty as string }) });
});
router.get('/learning/certifications', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getCertifications({ status: req.query.status as string, departmentCode: req.query.departmentCode as string }) });
});
router.get('/learning/training-records', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getTrainingRecords({ employeeId: req.query.employeeId as string, status: req.query.status as string }) });
});
router.get('/learning/dashboard-metrics', (req: Request, res: Response) => {
  res.json({ success: true, data: service.getDashboardMetrics() });
});

export default router;
