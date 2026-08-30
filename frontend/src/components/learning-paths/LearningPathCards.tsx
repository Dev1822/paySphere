/**
 * Employee Learning Paths — Card Components
 *
 * StatCard, CourseCard, EnrollmentCard, SkillGapCard, CertificationCard,
 * InsightCard, DepartmentLearningCard, OverviewStats.
 */

import React from 'react';
import {
  Course, Enrollment, SkillGap, Certification, LearningInsight,
  DepartmentLearning, LearningSummary,
  STATUS_COLORS, STATUS_BG, LEVEL_COLORS, PROFICIENCY_COLORS,
  CATEGORY_ICONS, formatHours, formatScore, formatDate,
  EnrollmentStatus,
} from './learningPathTypes';

// ── Stat Card ──────────────────────────────────────────────────────────────

export const StatCard: React.FC<{
  label: string; value: string | number; icon?: string;
  color?: string; subtitle?: string;
}> = ({ label, value, icon, color = '#2563EB', subtitle }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    flex: '1 1 180px', minWidth: 160,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
    {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
  </div>
);

// ── Overview Stats ─────────────────────────────────────────────────────────

export const OverviewStats: React.FC<{ summary: LearningSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Total Courses" value={summary.totalCourses} icon="📚" />
    <StatCard label="Enrollments" value={summary.totalEnrollments} icon="📋" />
    <StatCard label="Completed" value={summary.completedEnrollments} icon="✅" color="#22c55e" />
    <StatCard label="In Progress" value={summary.inProgressEnrollments} icon="🔄" color="#3b82f6" />
    <StatCard label="Overdue" value={summary.overdueEnrollments} icon="⚠️" color="#ef4444" />
    <StatCard label="Avg Progress" value={`${summary.avgProgress}%`} icon="📊" />
    <StatCard label="Avg Score" value={`${summary.avgScore}%`} icon="🎯" />
    <StatCard label="Hours Logged" value={summary.totalHoursLogged} icon="⏱️" />
    <StatCard label="Skill Gaps" value={summary.totalSkillGaps} icon="🔍" color={summary.criticalGaps > 0 ? '#ef4444' : '#22c55e'} subtitle={`${summary.criticalGaps} critical`} />
    <StatCard label="Active Certs" value={summary.activeCertifications} icon="📜" />
    <StatCard label="Completion Rate" value={`${summary.completionRate}%`} icon="📈" color={summary.completionRate > 60 ? '#22c55e' : '#eab308'} />
  </div>
);

// ── Status Badge ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: EnrollmentStatus }> = ({ status }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    fontSize: 11, fontWeight: 700, color: STATUS_COLORS[status],
    background: STATUS_BG[status], border: `1px solid ${STATUS_COLORS[status]}30`,
  }}>{status}</span>
);

// ── Course Card ────────────────────────────────────────────────────────────

export const CourseCard: React.FC<{ course: Course }> = ({ course }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {CATEGORY_ICONS[course.category]} {course.title}
        {course.isMandatory && <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 6, fontWeight: 700 }}>MANDATORY</span>}
      </div>
      <span style={{
        padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
        color: LEVEL_COLORS[course.level], background: `${LEVEL_COLORS[course.level]}15`,
      }}>{course.level}</span>
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{course.description}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
      <div>⏱️ {formatHours(course.durationHours)}</div>
      <div>📦 {course.totalModules} modules</div>
      <div>⭐ {course.rating}/5</div>
      <div>👨‍🏫 {course.instructor}</div>
      <div>👥 {course.enrolledCount}/{course.maxEnrollment}</div>
      <div>📂 {course.category}</div>
    </div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {course.skills.map(s => (
        <span key={s} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>{s}</span>
      ))}
    </div>
  </div>
);

// ── Enrollment Card ────────────────────────────────────────────────────────

export const EnrollmentCard: React.FC<{ enrollment: Enrollment }> = ({ enrollment }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 14,
    border: '1px solid #e5e7eb',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{enrollment.courseTitle}</div>
      <StatusBadge status={enrollment.status} />
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
      {enrollment.employeeName} · {enrollment.department}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 6 }}>
      <div>Progress: <b>{enrollment.progress}%</b></div>
      <div>Modules: <b>{enrollment.completedModules}/{enrollment.totalModules}</b></div>
      <div>Score: <b>{formatScore(enrollment.score)}</b></div>
      <div>Time: <b>{formatHours(enrollment.timeSpentHours)}</b></div>
      <div>Category: <b>{enrollment.category}</b></div>
      {enrollment.deadline && <div>Due: <b style={{ color: enrollment.status === 'Overdue' ? '#ef4444' : '#374151' }}>{formatDate(enrollment.deadline)}</b></div>}
    </div>
    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3, width: `${enrollment.progress}%`,
        background: STATUS_COLORS[enrollment.status],
      }} />
    </div>
  </div>
);

// ── Skill Gap Card ─────────────────────────────────────────────────────────

export const SkillGapCard: React.FC<{ gap: SkillGap }> = ({ gap }) => {
  const priColor = gap.priority === 'Critical' ? '#ef4444' : gap.priority === 'High' ? '#f97316' : gap.priority === 'Medium' ? '#eab308' : '#22c55e';
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 14,
      border: `1px solid ${priColor}30`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🎯 {gap.skill}</div>
        <span style={{
          padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          color: priColor, background: `${priColor}15`,
        }}>{gap.priority}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        {gap.employeeName} · {gap.department}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
        <span style={{ padding: '2px 6px', borderRadius: 4, background: PROFICIENCY_COLORS[gap.currentLevel], color: '#fff', fontWeight: 600 }}>
          {gap.currentLevel}
        </span>
        <span style={{ color: '#9ca3af' }}>→</span>
        <span style={{ padding: '2px 6px', borderRadius: 4, background: PROFICIENCY_COLORS[gap.targetLevel], color: '#fff', fontWeight: 600 }}>
          {gap.targetLevel}
        </span>
        <span style={{ color: '#9ca3af' }}>({gap.gapSize} level{gap.gapSize > 1 ? 's' : ''} gap)</span>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>📅 Due: {formatDate(gap.dueDate)}</div>
    </div>
  );
};

// ── Certification Card ─────────────────────────────────────────────────────

export const CertificationCard: React.FC<{ cert: Certification }> = ({ cert }) => {
  const statusColor = cert.status === 'Active' ? '#22c55e' : cert.status === 'Expiring Soon' ? '#eab308' : '#ef4444';
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 14,
      borderLeft: `4px solid ${statusColor}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>📜 {cert.name}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor }}>{cert.status}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        {cert.employeeName} · {cert.department}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        {cert.issuer} · ID: {cert.credentialId} · Obtained: {formatDate(cert.obtainedDate)}
        {cert.expiryDate && ` · Expires: ${formatDate(cert.expiryDate)}`}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {cert.linkedSkills.map(s => (
          <span key={s} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#eff6ff', color: '#3b82f6' }}>{s}</span>
        ))}
      </div>
    </div>
  );
};

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: LearningInsight }> = ({ insight }) => {
  const colors = { positive: '#22c55e', warning: '#eab308', critical: '#ef4444', info: '#3b82f6' };
  const color = colors[insight.type];
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{insight.title}</div>
        <span style={{ fontSize: 12 }}>{insight.trend === 'up' ? '📈' : insight.trend === 'down' ? '📉' : '➡️'}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{insight.description}</div>
      <div style={{ fontSize: 11, color }}><b>{insight.metric}:</b> {insight.value}</div>
    </div>
  );
};

// ── Department Learning Card ───────────────────────────────────────────────

export const DeptLearningCard: React.FC<{ dept: DepartmentLearning }> = ({ dept }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{dept.department}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
      <div>Learners: <b>{dept.totalLearners}</b></div>
      <div>Avg Progress: <b>{dept.avgProgress}%</b></div>
      <div>Completed: <b>{dept.coursesCompleted}</b></div>
      <div>Avg Score: <b>{dept.avgScore}%</b></div>
      <div>Top Skill: <b>{dept.topSkill}</b></div>
      <div>Gaps: <b style={{ color: dept.skillGaps > 5 ? '#ef4444' : '#22c55e' }}>{dept.skillGaps}</b></div>
      <div>Mandatory Pending: <b style={{ color: dept.mandatoryPending > 3 ? '#ef4444' : '#374151' }}>{dept.mandatoryPending}</b></div>
    </div>
    <div style={{ marginTop: 8, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3, width: `${dept.avgProgress}%`,
        background: dept.avgProgress > 70 ? '#22c55e' : dept.avgProgress > 50 ? '#eab308' : '#ef4444',
      }} />
    </div>
  </div>
);
