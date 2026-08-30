/**
 * Employee Learning Paths — Service Layer
 *
 * Mock courses, enrollments, skill gaps, certifications,
 * trends, department stats, and insights.
 */

import {
  Course, Enrollment, SkillGap, Certification, LearningTrend,
  DepartmentLearning, LearningSummary, LearningInsight,
  CourseCategory, CourseLevel, EnrollmentStatus, SkillDomain,
  ProficiencyLevel, Department,
} from './learningPathTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara','Ahmed','Bella','Carlos','Deepa'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee','Meyer','Diaz','Chowdhury'];
const DEPTS: Department[] = ['Engineering','Product','Design','Marketing','Sales','Finance','HR','Legal','Operations','Customer Success'];

// ── Courses ────────────────────────────────────────────────────────────────

function generateCourses(): Course[] {
  const courses: Omit<Course, 'id'>[] = [
    { title: 'Advanced React Patterns', category: 'Technical', level: 'Advanced', description: 'Hooks, render props, compound components, and performance patterns', instructor: 'Sarah Chen', durationHours: 12, totalModules: 8, rating: 4.8, enrolledCount: 45, maxEnrollment: 50, skills: ['React', 'TypeScript', 'JavaScript'], tags: ['frontend', 'hooks'], isMandatory: false, createdAt: '2026-01-15' },
    { title: 'AWS Solutions Architect Prep', category: 'Certification Prep', level: 'Advanced', description: 'Complete preparation for AWS SAA certification', instructor: 'Mike Johnson', durationHours: 40, totalModules: 20, rating: 4.7, enrolledCount: 28, maxEnrollment: 30, skills: ['AWS', 'Cloud', 'System Design'], tags: ['cloud', 'certification'], isMandatory: false, createdAt: '2026-02-01' },
    { title: 'Leadership Fundamentals', category: 'Leadership', level: 'Intermediate', description: 'Core leadership skills for new and aspiring managers', instructor: 'Dr. Lisa Park', durationHours: 16, totalModules: 10, rating: 4.6, enrolledCount: 32, maxEnrollment: 40, skills: ['Leadership', 'Communication', 'Project Management'], tags: ['management', 'people'], isMandatory: true, createdAt: '2026-01-10' },
    { title: 'Docker & Kubernetes Mastery', category: 'Technical', level: 'Intermediate', description: 'Container orchestration from basics to production deployments', instructor: 'Raj Patel', durationHours: 20, totalModules: 12, rating: 4.9, enrolledCount: 38, maxEnrollment: 40, skills: ['Docker', 'Kubernetes', 'CI/CD'], tags: ['devops', 'containers'], isMandatory: false, createdAt: '2026-03-01' },
    { title: 'Data Privacy & GDPR Compliance', category: 'Compliance', level: 'Beginner', description: 'Understanding data protection regulations and best practices', instructor: 'Anna Schmidt', durationHours: 4, totalModules: 3, rating: 4.3, enrolledCount: 120, maxEnrollment: 200, skills: ['Security', 'Compliance'], tags: ['legal', 'privacy'], isMandatory: true, createdAt: '2026-01-05' },
    { title: 'Effective Communication Skills', category: 'Soft Skills', level: 'Beginner', description: 'Written and verbal communication for technical teams', instructor: 'Maria Garcia', durationHours: 8, totalModules: 6, rating: 4.5, enrolledCount: 55, maxEnrollment: 60, skills: ['Communication'], tags: ['soft-skills'], isMandatory: false, createdAt: '2026-02-15' },
    { title: 'System Design Interview Prep', category: 'Technical', level: 'Advanced', description: 'Design scalable distributed systems', instructor: 'Alex Wang', durationHours: 24, totalModules: 14, rating: 4.8, enrolledCount: 35, maxEnrollment: 40, skills: ['System Design', 'Node.js', 'SQL'], tags: ['interview', 'architecture'], isMandatory: false, createdAt: '2026-03-10' },
    { title: 'Unconscious Bias Training', category: 'DEI', level: 'Beginner', description: 'Recognizing and addressing unconscious bias in the workplace', instructor: 'Dr. Maya Johnson', durationHours: 3, totalModules: 4, rating: 4.4, enrolledCount: 150, maxEnrollment: 200, skills: ['Communication'], tags: ['dei', 'culture'], isMandatory: true, createdAt: '2026-01-01' },
    { title: 'Python for Data Analysis', category: 'Technical', level: 'Intermediate', description: 'Pandas, NumPy, and data visualization with Python', instructor: 'Yuki Tanaka', durationHours: 18, totalModules: 10, rating: 4.7, enrolledCount: 42, maxEnrollment: 50, skills: ['Python', 'Data Analysis'], tags: ['data', 'python'], isMandatory: false, createdAt: '2026-02-20' },
    { title: 'Agile & Scrum Certification', category: 'Certification Prep', level: 'Intermediate', description: 'Prepare for PSM I or CSM certification', instructor: 'Tom Wilson', durationHours: 14, totalModules: 8, rating: 4.6, enrolledCount: 25, maxEnrollment: 30, skills: ['Agile', 'Project Management'], tags: ['agile', 'certification'], isMandatory: false, createdAt: '2026-04-01' },
    { title: 'New Employee Onboarding', category: 'Onboarding', level: 'Beginner', description: 'Company culture, tools, processes, and team introductions', instructor: 'HR Team', durationHours: 10, totalModules: 6, rating: 4.2, enrolledCount: 80, maxEnrollment: 100, skills: ['Communication', 'Agile'], tags: ['onboarding'], isMandatory: true, createdAt: '2026-01-01' },
    { title: 'Go Concurrency Patterns', category: 'Technical', level: 'Expert', description: 'Goroutines, channels, and advanced Go concurrency patterns', instructor: 'Chris Lee', durationHours: 16, totalModules: 8, rating: 4.9, enrolledCount: 18, maxEnrollment: 25, skills: ['Go', 'System Design'], tags: ['backend', 'concurrency'], isMandatory: false, createdAt: '2026-04-15' },
  ];
  return courses.map(c => ({ ...c, id: uid() }));
}

// ── Enrollments ────────────────────────────────────────────────────────────

function generateEnrollments(courses: Course[]): Enrollment[] {
  const enrollments: Enrollment[] = [];
  const statuses: EnrollmentStatus[] = ['Not Started', 'In Progress', 'Completed', 'Overdue', 'Dropped'];
  const weights = [0.1, 0.35, 0.35, 0.12, 0.08];

  for (let i = 0; i < 80; i++) {
    const course = pick(courses);
    const r = Math.random();
    let cum = 0, status: EnrollmentStatus = 'In Progress';
    for (let j = 0; j < statuses.length; j++) {
      cum += weights[j];
      if (r <= cum) { status = statuses[j]; break; }
    }
    const progress = status === 'Completed' ? 100 : status === 'Not Started' ? 0 : status === 'Dropped' ? rand(5, 40) : rand(10, 90);
    const completedModules = Math.round((progress / 100) * course.totalModules);

    enrollments.push({
      id: uid(), courseId: course.id, courseTitle: course.title,
      category: course.category, level: course.level,
      employeeId: `EMP-${1000 + rand(0, 59)}`,
      employeeName: `${pick(FIRST)} ${pick(LAST)}`,
      department: pick(DEPTS),
      status, progress, completedModules, totalModules: course.totalModules,
      score: status === 'Completed' ? rand(60, 100) : status === 'Overdue' ? rand(30, 65) : null,
      enrolledAt: `2026-${String(rand(1, 6)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
      lastAccessedAt: `2026-08-${String(rand(1, 24)).padStart(2, '0')}`,
      completedAt: status === 'Completed' ? `2026-${String(rand(3, 8)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}` : null,
      deadline: status === 'Overdue' ? `2026-08-${String(rand(1, 15)).padStart(2, '0')}` : Math.random() > 0.5 ? `2026-${String(rand(9, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}` : null,
      timeSpentHours: Math.round((progress / 100) * course.durationHours * (0.8 + Math.random() * 0.4) * 10) / 10,
    });
  }
  return enrollments;
}

// ── Skill Gaps ─────────────────────────────────────────────────────────────

function generateSkillGaps(): SkillGap[] {
  const skills: SkillDomain[] = ['React', 'TypeScript', 'AWS', 'Docker', 'Kubernetes', 'Python', 'System Design', 'Leadership', 'Communication', 'SQL', 'Node.js', 'Go'];
  const profLevels: ProficiencyLevel[] = ['None', 'Aware', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
  const gaps: SkillGap[] = [];
  for (let i = 0; i < 30; i++) {
    const currentIdx = rand(0, 4);
    const targetIdx = Math.min(currentIdx + rand(1, 3), 5);
    gaps.push({
      id: uid(), employeeId: `EMP-${1000 + rand(0, 59)}`,
      employeeName: `${pick(FIRST)} ${pick(LAST)}`,
      department: pick(DEPTS), skill: pick(skills),
      currentLevel: profLevels[currentIdx], targetLevel: profLevels[targetIdx],
      gapSize: targetIdx - currentIdx,
      recommendedCourses: [`${pick(skills)} Fundamentals`, `${pick(skills)} Advanced`],
      priority: targetIdx - currentIdx >= 3 ? 'Critical' : targetIdx - currentIdx >= 2 ? 'High' : targetIdx - currentIdx >= 1 ? 'Medium' : 'Low',
      dueDate: `2026-${String(rand(9, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
    });
  }
  return gaps;
}

// ── Certifications ─────────────────────────────────────────────────────────

function generateCertifications(): Certification[] {
  const certs: Omit<Certification, 'id'>[] = [
    { employeeName: 'Aisha Patel', department: 'Engineering', name: 'AWS Solutions Architect', issuer: 'Amazon', obtainedDate: '2025-11-15', expiryDate: '2028-11-15', status: 'Active', credentialId: 'AWS-SAA-1234', linkedSkills: ['AWS', 'System Design'] },
    { employeeName: 'David Mueller', department: 'Engineering', name: 'CKA Kubernetes', issuer: 'CNCF', obtainedDate: '2025-06-20', expiryDate: '2026-09-20', status: 'Expiring Soon', credentialId: 'CKA-5678', linkedSkills: ['Kubernetes', 'Docker'] },
    { employeeName: 'Elena Santos', department: 'Product', name: 'PSM I Scrum Master', issuer: 'Scrum.org', obtainedDate: '2026-01-10', expiryDate: null, status: 'Active', credentialId: 'PSM-9012', linkedSkills: ['Agile', 'Project Management'] },
    { employeeName: 'Faisal Okafor', department: 'Engineering', name: 'Google Cloud Professional', issuer: 'Google', obtainedDate: '2024-08-10', expiryDate: '2026-08-10', status: 'Expired', credentialId: 'GCP-3456', linkedSkills: ['AWS', 'System Design'] },
    { employeeName: 'Grace Kim', department: 'Finance', name: 'CFA Level II', issuer: 'CFA Institute', obtainedDate: '2025-09-01', expiryDate: null, status: 'Active', credentialId: 'CFA-L2-7890', linkedSkills: ['Data Analysis', 'Communication'] },
    { employeeName: 'Hiroshi Nakamura', department: 'Engineering', name: 'Terraform Associate', issuer: 'HashiCorp', obtainedDate: '2026-03-15', expiryDate: '2028-03-15', status: 'Active', credentialId: 'TF-1234', linkedSkills: ['AWS', 'Docker'] },
    { employeeName: 'James Singh', department: 'Engineering', name: 'MongoDB Developer', issuer: 'MongoDB', obtainedDate: '2026-05-01', expiryDate: '2028-05-01', status: 'Active', credentialId: 'MDB-5678', linkedSkills: ['SQL', 'Node.js'] },
    { employeeName: 'Kavita Chen', department: 'Design', name: 'Google UX Design', issuer: 'Google', obtainedDate: '2026-02-20', expiryDate: null, status: 'Active', credentialId: 'UXD-9012', linkedSkills: ['Communication'] },
  ];
  return certs.map(c => ({ ...c, id: uid(), employeeId: `EMP-${rand(1000, 1059)}` }));
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): LearningTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let completed = 18, hours = 320, score = 72, certs = 2, learners = 35;
  return months.map((month) => {
    completed = Math.max(10, Math.min(40, completed + rand(-3, 5)));
    hours = Math.max(200, Math.min(500, hours + rand(-30, 40)));
    score = Math.max(65, Math.min(85, score + rand(-2, 3)));
    certs = Math.max(1, Math.min(6, certs + rand(-1, 2)));
    learners = Math.max(25, Math.min(55, learners + rand(-2, 4)));
    return {
      month, coursesCompleted: completed, hoursLogged: hours,
      avgScore: score, certificationsEarned: certs,
      activeLearners: learners,
      completionRate: Math.max(55, Math.min(85, rand(60, 80))),
    };
  });
}

// ── Department Learning ────────────────────────────────────────────────────

function generateDeptLearning(): DepartmentLearning[] {
  const skills: SkillDomain[] = ['React', 'Python', 'AWS', 'Leadership', 'Communication', 'SQL', 'TypeScript', 'Docker'];
  return DEPTS.map(dept => ({
    department: dept,
    totalLearners: rand(5, 20),
    avgProgress: rand(40, 85),
    coursesCompleted: rand(8, 35),
    avgScore: rand(65, 90),
    topSkill: pick(skills),
    skillGaps: rand(2, 12),
    mandatoryPending: rand(0, 8),
  }));
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): LearningInsight[] {
  return [
    { id: uid(), title: 'Engineering completion rate at 82%', description: 'Highest among all departments. Kubernetes course is most popular.', type: 'positive', metric: 'Completion', value: '82%', trend: 'up' },
    { id: uid(), title: '12 mandatory courses overdue', description: 'Compliance and DEI courses have the highest overdue rate. Send reminders.', type: 'warning', metric: 'Overdue', value: '12', trend: 'up' },
    { id: uid(), title: 'Critical skill gaps in Kubernetes', description: '8 engineers need K8s training urgently. Consider team workshop.', type: 'critical', metric: 'Critical Gaps', value: '8', trend: 'up' },
    { id: uid(), title: 'Avg course rating improved to 4.6', description: 'Feedback surveys show higher satisfaction with video-based content.', type: 'positive', metric: 'Rating', value: '4.6/5', trend: 'up' },
    { id: uid(), title: 'Sales team has lowest engagement', description: 'Only 40% of Sales employees have active enrollments. Outreach needed.', type: 'warning', metric: 'Engagement', value: '40%', trend: 'down' },
    { id: uid(), title: '2 certifications expiring this month', description: 'David Mueller (CKA) and Faisal Okafor (GCP) need renewal.', type: 'info', metric: 'Expiring', value: '2', trend: 'stable' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getLearningPathData() {
  const courses = generateCourses();
  const enrollments = generateEnrollments(courses);
  const skillGaps = generateSkillGaps();
  const certifications = generateCertifications();
  const trends = generateTrends();
  const deptLearning = generateDeptLearning();
  const insights = generateInsights();

  const summary: LearningSummary = {
    totalCourses: courses.length,
    totalEnrollments: enrollments.length,
    completedEnrollments: enrollments.filter(e => e.status === 'Completed').length,
    inProgressEnrollments: enrollments.filter(e => e.status === 'In Progress').length,
    overdueEnrollments: enrollments.filter(e => e.status === 'Overdue').length,
    avgProgress: Math.round(enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length),
    avgScore: Math.round(enrollments.filter(e => e.score !== null).reduce((s, e) => s + (e.score || 0), 0) / Math.max(enrollments.filter(e => e.score !== null).length, 1)),
    totalHoursLogged: Math.round(enrollments.reduce((s, e) => s + e.timeSpentHours, 0)),
    totalSkillGaps: skillGaps.length,
    criticalGaps: skillGaps.filter(g => g.priority === 'Critical').length,
    activeCertifications: certifications.filter(c => c.status === 'Active').length,
    expiringCerts: certifications.filter(c => c.status === 'Expiring Soon').length,
    completionRate: Math.round((enrollments.filter(e => e.status === 'Completed').length / enrollments.length) * 100),
  };

  return { courses, enrollments, skillGaps, certifications, trends, deptLearning, insights, summary };
}
