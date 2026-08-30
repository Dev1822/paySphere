/**
 * Employee Learning Paths Dashboard (#1395)
 *
 * Course tracking, skill gap analysis, certification management,
 * learning analytics, and career development progression.
 */

import { useMemo, useState } from 'react';

import { getLearningPathData } from '../components/learning-paths/learningPathService';
import {
  OverviewStats, CourseCard, EnrollmentCard, SkillGapCard,
  CertificationCard, InsightCard, DeptLearningCard,
} from '../components/learning-paths/LearningPathCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from '../components/learning-paths/LearningPathCharts';
import {
  STATUS_COLORS, LEVEL_COLORS, CATEGORY_ICONS,
} from '../components/learning-paths/learningPathTypes';

const TABS = ['Overview', 'Courses', 'Enrollments', 'Skill Gaps', 'Certifications', 'Departments'];

export default function LearningPathDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const data = useMemo(() => getLearningPathData(), []);

  const filteredEnrollments = useMemo(() => {
    return data.enrollments.filter(e => {
      if (search && !e.courseTitle.toLowerCase().includes(search.toLowerCase()) && !e.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat !== 'All' && e.category !== filterCat) return false;
      if (filterStatus !== 'All' && e.status !== filterStatus) return false;
      return true;
    });
  }, [data.enrollments, search, filterCat, filterStatus]);

  // Chart data
  const statusDonut = [
    { label: 'Completed', value: data.summary.completedEnrollments, color: STATUS_COLORS['Completed'] },
    { label: 'In Progress', value: data.summary.inProgressEnrollments, color: STATUS_COLORS['In Progress'] },
    { label: 'Overdue', value: data.summary.overdueEnrollments, color: STATUS_COLORS['Overdue'] },
    { label: 'Not Started', value: data.enrollments.filter(e => e.status === 'Not Started').length, color: STATUS_COLORS['Not Started'] },
    { label: 'Dropped', value: data.enrollments.filter(e => e.status === 'Dropped').length, color: STATUS_COLORS['Dropped'] },
  ];

  const deptCompletedBar = data.deptLearning
    .map(d => ({ label: d.department.slice(0, 8), value: d.coursesCompleted, color: '#3b82f6' }))
    .sort((a, b) => b.value - a.value);

  const deptScoreBar = data.deptLearning
    .map(d => ({ label: d.department.slice(0, 8), value: d.avgScore, color: d.avgScore > 75 ? '#22c55e' : d.avgScore > 65 ? '#eab308' : '#ef4444' }))
    .sort((a, b) => a.value - b.value);

  const deptRadar = data.deptLearning.slice(0, 6).map(d => ({
    axis: d.department.slice(0, 8), value: d.avgScore / 100,
  }));

  const gapPriorityBar = [
    { label: 'Critical', value: data.skillGaps.filter(g => g.priority === 'Critical').length, color: '#ef4444' },
    { label: 'High', value: data.skillGaps.filter(g => g.priority === 'High').length, color: '#f97316' },
    { label: 'Medium', value: data.skillGaps.filter(g => g.priority === 'Medium').length, color: '#eab308' },
    { label: 'Low', value: data.skillGaps.filter(g => g.priority === 'Low').length, color: '#22c55e' },
  ];

  const filterBarStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 12, color: '#374151', background: '#fff', outline: 'none',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          📚 Employee Learning Paths
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Course tracking, skill gap analysis, certification management, and learning analytics.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
            color: activeTab === tab ? '#2563EB' : '#6b7280',
            background: activeTab === tab ? '#eff6ff' : 'transparent',
            borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
            marginBottom: -2,
          }}>{tab}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <OverviewStats summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <DonutChart data={statusDonut} title="Enrollment Status" />
            <BarChart data={deptCompletedBar} title="Courses Completed by Dept" height={200} />
            <RadarChart data={deptRadar} title="Dept Score Comparison" />
          </div>
          <TrendLine
            trends={data.trends}
            title="Learning Trends Over Time"
            lines={[
              { key: 'coursesCompleted', color: '#3b82f6', label: 'Courses Completed' },
              { key: 'avgScore', color: '#22c55e', label: 'Avg Score' },
              { key: 'activeLearners', color: '#8b5cf6', label: 'Active Learners' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <HorizontalBar data={deptScoreBar} title="Avg Score by Department" />
            <BarChart data={gapPriorityBar} title="Skill Gaps by Priority" height={200} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Learning Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* Courses Tab */}
      {activeTab === 'Courses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {data.courses.map(c => <CourseCard key={c.id} course={c} />)}
        </div>
      )}

      {/* Enrollments Tab */}
      {activeTab === 'Enrollments' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Search courses or employees…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...filterBarStyle, minWidth: 220 }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={filterBarStyle}>
              <option value="All">All Categories</option>
              {['Technical','Leadership','Compliance','Soft Skills','Domain Knowledge','Certification Prep','Onboarding','DEI'].map(c => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterBarStyle}>
              <option value="All">All Statuses</option>
              {['Not Started','In Progress','Completed','Overdue','Dropped'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filteredEnrollments.length} results</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {filteredEnrollments.map(e => <EnrollmentCard key={e.id} enrollment={e} />)}
          </div>
        </div>
      )}

      {/* Skill Gaps Tab */}
      {activeTab === 'Skill Gaps' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <BarChart data={gapPriorityBar} title="Skill Gaps by Priority" height={200} />
            <DonutChart data={gapPriorityBar} title="Gap Distribution" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {data.skillGaps.sort((a, b) => b.gapSize - a.gapSize).map(g => <SkillGapCard key={g.id} gap={g} />)}
          </div>
        </div>
      )}

      {/* Certifications Tab */}
      {activeTab === 'Certifications' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart
              data={[
                { label: 'Active', value: data.certifications.filter(c => c.status === 'Active').length, color: '#22c55e' },
                { label: 'Expiring Soon', value: data.certifications.filter(c => c.status === 'Expiring Soon').length, color: '#eab308' },
                { label: 'Expired', value: data.certifications.filter(c => c.status === 'Expired').length, color: '#ef4444' },
              ]}
              title="Certification Status"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 10 }}>
            {data.certifications.map(c => <CertificationCard key={c.id} cert={c} />)}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'Departments' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <BarChart data={deptCompletedBar} title="Courses Completed by Department" height={220} />
            <RadarChart data={deptRadar} title="Department Performance Radar" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {data.deptLearning.map(d => <DeptLearningCard key={d.department} dept={d} />)}
          </div>
        </div>
      )}
    </div>
  );
}
