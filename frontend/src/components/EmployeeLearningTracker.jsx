import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

/* ─────────────────────── MOCK DATA ─────────────────────── */
const EMPLOYEES = [
  { id: 1, name: 'Priya Sharma', dept: 'Engineering', avatar: '👩‍💻', role: 'Senior Developer', learningHours: 48, coursesCompleted: 12, certifications: 3, skillScore: 88 },
  { id: 2, name: 'Rahul Verma', dept: 'Marketing', avatar: '👨‍💼', role: 'Marketing Lead', learningHours: 32, coursesCompleted: 8, certifications: 2, skillScore: 75 },
  { id: 3, name: 'Ananya Patel', dept: 'Design', avatar: '👩‍🎨', role: 'UX Designer', learningHours: 56, coursesCompleted: 15, certifications: 4, skillScore: 92 },
  { id: 4, name: 'Vikram Singh', dept: 'Finance', avatar: '👨‍💻', role: 'Financial Analyst', learningHours: 28, coursesCompleted: 7, certifications: 2, skillScore: 70 },
  { id: 5, name: 'Neha Gupta', dept: 'HR', avatar: '👩‍💼', role: 'HR Manager', learningHours: 40, coursesCompleted: 10, certifications: 3, skillScore: 82 },
  { id: 6, name: 'Arjun Mehta', dept: 'Engineering', avatar: '👨‍💻', role: 'Tech Lead', learningHours: 60, coursesCompleted: 18, certifications: 5, skillScore: 95 },
  { id: 7, name: 'Sneha Reddy', dept: 'Sales', avatar: '👩‍💼', role: 'Sales Executive', learningHours: 22, coursesCompleted: 5, certifications: 1, skillScore: 65 },
  { id: 8, name: 'Karthik Nair', dept: 'Operations', avatar: '👨‍💼', role: 'Ops Manager', learningHours: 35, coursesCompleted: 9, certifications: 2, skillScore: 78 },
  { id: 9, name: 'Pooja Joshi', dept: 'Legal', avatar: '👩‍⚖️', role: 'Legal Counsel', learningHours: 42, coursesCompleted: 11, certifications: 3, skillScore: 85 },
  { id: 10, name: 'Aditya Kumar', dept: 'Engineering', avatar: '👨‍💻', role: 'DevOps Engineer', learningHours: 52, coursesCompleted: 14, certifications: 4, skillScore: 90 },
];

const COURSES = [
  { id: 1, title: 'Advanced TypeScript Patterns', category: 'Engineering', difficulty: 'Advanced', duration: '12h', provider: 'Internal', enrolled: 45, completed: 32, rating: 4.8, skills: ['TypeScript', 'Design Patterns', 'OOP'] },
  { id: 2, title: 'AWS Solutions Architect', category: 'Engineering', difficulty: 'Expert', duration: '40h', provider: 'AWS', enrolled: 20, completed: 8, rating: 4.9, skills: ['AWS', 'Cloud Architecture', 'DevOps'] },
  { id: 3, title: 'Product Marketing Fundamentals', category: 'Marketing', difficulty: 'Intermediate', duration: '8h', provider: 'Coursera', enrolled: 30, completed: 22, rating: 4.5, skills: ['Marketing Strategy', 'Content', 'Analytics'] },
  { id: 4, title: 'Figma Advanced Prototyping', category: 'Design', difficulty: 'Advanced', duration: '15h', provider: 'Internal', enrolled: 15, completed: 12, rating: 4.7, skills: ['Figma', 'Prototyping', 'UX Research'] },
  { id: 5, title: 'Financial Modeling & Valuation', category: 'Finance', difficulty: 'Advanced', duration: '20h', provider: 'Udemy', enrolled: 12, completed: 9, rating: 4.6, skills: ['Excel', 'Financial Modeling', 'Valuation'] },
  { id: 6, title: 'Leadership & Team Management', category: 'HR', difficulty: 'Intermediate', duration: '10h', provider: 'LinkedIn Learning', enrolled: 50, completed: 38, rating: 4.4, skills: ['Leadership', 'Communication', 'Team Building'] },
  { id: 7, title: 'React Performance Optimization', category: 'Engineering', difficulty: 'Advanced', duration: '8h', provider: 'Internal', enrolled: 35, completed: 28, rating: 4.8, skills: ['React', 'Performance', 'JavaScript'] },
  { id: 8, title: 'Negotiation Mastery', category: 'Sales', difficulty: 'Intermediate', duration: '6h', provider: 'Coursera', enrolled: 25, completed: 18, rating: 4.3, skills: ['Negotiation', 'Communication', 'Sales'] },
  { id: 9, title: 'Compliance & Regulatory Framework', category: 'Legal', difficulty: 'Advanced', duration: '14h', provider: 'Internal', enrolled: 10, completed: 7, rating: 4.5, skills: ['Compliance', 'Legal', 'Regulations'] },
  { id: 10, title: 'Docker & Kubernetes Deep Dive', category: 'Engineering', difficulty: 'Expert', duration: '25h', provider: 'A Cloud Guru', enrolled: 22, completed: 10, rating: 4.9, skills: ['Docker', 'Kubernetes', 'DevOps'] },
];

const SKILLS = [
  { name: 'TypeScript', category: 'Engineering', level: 85, trend: 'up', employees: 8 },
  { name: 'React', category: 'Engineering', level: 90, trend: 'up', employees: 10 },
  { name: 'AWS', category: 'Engineering', level: 72, trend: 'stable', employees: 5 },
  { name: 'Docker', category: 'Engineering', level: 68, trend: 'up', employees: 4 },
  { name: 'Python', category: 'Engineering', level: 78, trend: 'stable', employees: 6 },
  { name: 'SQL', category: 'Engineering', level: 82, trend: 'up', employees: 12 },
  { name: 'Figma', category: 'Design', level: 88, trend: 'up', employees: 3 },
  { name: 'UX Research', category: 'Design', level: 75, trend: 'up', employees: 4 },
  { name: 'Analytics', category: 'Marketing', level: 70, trend: 'stable', employees: 6 },
  { name: 'SEO', category: 'Marketing', level: 65, trend: 'down', employees: 3 },
  { name: 'Excel', category: 'Finance', level: 92, trend: 'stable', employees: 8 },
  { name: 'Leadership', category: 'HR', level: 80, trend: 'up', employees: 15 },
  { name: 'Communication', category: 'Cross-Functional', level: 85, trend: 'stable', employees: 18 },
  { name: 'Project Management', category: 'Cross-Functional', level: 72, trend: 'up', employees: 10 },
];

const CERTIFICATIONS = [
  { name: 'AWS Solutions Architect', issuer: 'Amazon', category: 'Engineering', expiry: '2027-08-28', holders: ['Arjun Mehta', 'Aditya Kumar'], icon: '☁️' },
  { name: 'Certified Scrum Master', issuer: 'Scrum Alliance', category: 'HR', expiry: '2027-03-15', holders: ['Neha Gupta', 'Karthik Nair'], icon: '📋' },
  { name: 'Google Analytics Certified', issuer: 'Google', category: 'Marketing', expiry: '2027-01-20', holders: ['Rahul Verma'], icon: '📊' },
  { name: 'PMP Certification', issuer: 'PMI', category: 'Cross-Functional', expiry: '2027-06-10', holders: ['Arjun Mehta', 'Vikram Singh'], icon: '🎓' },
  { name: 'Kubernetes Administrator', issuer: 'CNCF', category: 'Engineering', expiry: '2026-12-01', holders: ['Aditya Kumar'], icon: '⚙️' },
  { name: 'Figma Design Certification', issuer: 'Figma', category: 'Design', expiry: '2027-09-30', holders: ['Ananya Patel'], icon: '🎨' },
];

const LEARNING_PATHS = [
  { name: 'Full-Stack Engineering', courses: 8, totalHours: 120, progress: 65, enrolled: 12, icon: '🧑‍💻', color: '#a855f7' },
  { name: 'Marketing Leadership', courses: 6, totalHours: 80, progress: 45, enrolled: 8, icon: '📣', color: '#22c55e' },
  { name: 'Design Excellence', courses: 7, totalHours: 100, progress: 72, enrolled: 5, icon: '🎨', color: '#3b82f6' },
  { name: 'Sales Mastery', courses: 5, totalHours: 60, progress: 55, enrolled: 10, icon: '💼', color: '#f59e0b' },
];

const MONTHLY_ENROLLMENTS = [
  { month: 'Mar', enrollments: 28, completions: 18 },
  { month: 'Apr', enrollments: 35, completions: 22 },
  { month: 'May', enrollments: 42, completions: 28 },
  { month: 'Jun', enrollments: 38, completions: 30 },
  { month: 'Jul', enrollments: 45, completions: 32 },
  { month: 'Aug', enrollments: 50, completions: 35 },
];

/* ─────────────────────── SVG CHART COMPONENTS ─────────────────────── */
function SkillBar({ name, level, trend, color = '#a855f7' }) {
  const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 dark:text-gray-300">{name} {trendIcon}</span>
        <span className="font-bold" style={{ color }}>{level}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${level}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function CourseProgressRing({ enrolled, completed, size = 60 }) {
  const pct = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b';
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#374151" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="12" fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: 'center' }}>{pct}%</text>
    </svg>
  );
}

function EnrollmentChart({ data, height = 100 }) {
  const max = Math.max(...data.map(d => d.enrollments));
  const width = 280;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }}>
      <defs>
        <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" /><stop offset="100%" stopColor="#a855f7" stopOpacity="0" /></linearGradient>
        <linearGradient id="completGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" /></linearGradient>
      </defs>
      {data.map((d, i) => {
        const barW = width / data.length;
        const hE = (d.enrollments / max) * (height - 25);
        const hC = (d.completions / max) * (height - 25);
        return (
          <g key={i}>
            <rect x={i * barW + 12} y={height - 20 - hE} width={barW / 2 - 8} height={hE} rx="3" fill="#a855f7" opacity="0.7" />
            <rect x={i * barW + barW / 2 + 8} y={height - 20 - hC} width={barW / 2 - 8} height={hC} rx="3" fill="#22c55e" opacity="0.7" />
            <text x={i * barW + barW / 2} y={height - 5} textAnchor="middle" fill="#9ca3af" fontSize="8">{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function EmployeeLearningTracker() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const categories = ['All', 'Engineering', 'Marketing', 'Design', 'Finance', 'HR', 'Sales', 'Legal'];

  const filteredCourses = useMemo(() =>
    COURSES.filter(c => {
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
      if (searchTerm && !c.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    }), [searchTerm, categoryFilter]);

  const filteredSkills = useMemo(() =>
    SKILLS.filter(s => categoryFilter === 'All' || s.category === categoryFilter), [categoryFilter]);

  const stats = useMemo(() => ({
    totalHours: EMPLOYEES.reduce((s, e) => s + e.learningHours, 0),
    totalCourses: COURSES.length,
    totalCertifications: CERTIFICATIONS.length,
    avgSkillScore: Math.round(EMPLOYEES.reduce((s, e) => s + e.skillScore, 0) / EMPLOYEES.length),
    totalEnrollments: COURSES.reduce((s, c) => s + c.enrolled, 0),
    totalCompletions: COURSES.reduce((s, c) => s + c.completed, 0),
  }), []);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'courses', label: '📚 Courses' },
    { id: 'skills', label: '🎯 Skills' },
    { id: 'certifications', label: '🏆 Certifications' },
    { id: 'paths', label: '🛤️ Learning Paths' },
  ];

  return (
    <>
      <Helmet><title>Employee Learning Tracker — PaySphere</title></Helmet>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex-1 ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📚 Employee Learning Tracker</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track courses, skills, certifications, and learning paths across the organization</p>
            </div>
            <ThemeToggle />
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-purple-500">{stats.totalHours}h</div>
              <div className="text-xs text-gray-500">Learning Hours</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-emerald-500">{stats.totalCourses}</div>
              <div className="text-xs text-gray-500">Available Courses</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-amber-500">{stats.totalCertifications}</div>
              <div className="text-xs text-gray-500">Certifications</div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
              <div className="text-2xl font-black text-blue-500">{stats.avgSkillScore}%</div>
              <div className="text-xs text-gray-500">Avg Skill Score</div>
            </div>
          </div>

          {/* TAB NAV */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══════════ OVERVIEW TAB ═══════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">📈 Monthly Enrollments vs Completions</h3>
                  <EnrollmentChart data={MONTHLY_ENROLLMENTS} height={120} />
                  <div className="flex justify-center gap-6 mt-2">
                    <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-purple-500" /> Enrollments</div>
                    <div className="flex items-center gap-1 text-xs"><div className="w-3 h-1 rounded bg-emerald-500" /> Completions</div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">🏆 Top Learners</h3>
                  <div className="space-y-2">
                    {EMPLOYEES.sort((a, b) => b.learningHours - a.learningHours).slice(0, 5).map((e, i) => (
                      <div key={e.id} className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <span className="text-sm font-bold text-gray-400 w-5">#{i + 1}</span>
                        <span className="text-lg">{e.avatar}</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold">{e.name}</div>
                          <div className="text-[10px] text-gray-500">{e.coursesCompleted} courses · {e.certifications} certs</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-purple-500">{e.learningHours}h</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-bold mb-3">🛤️ Learning Paths Progress</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {LEARNING_PATHS.map(p => (
                    <div key={p.name} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center">
                      <div className="text-2xl mb-1">{p.icon}</div>
                      <div className="text-xs font-bold">{p.name}</div>
                      <div className="text-[10px] text-gray-500 mt-1">{p.courses} courses · {p.totalHours}h</div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                        <div className="h-2 rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.color }} />
                      </div>
                      <div className="text-[10px] font-bold mt-1" style={{ color: p.color }}>{p.progress}% · {p.enrolled} enrolled</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ COURSES TAB ═══════════ */}
          {activeTab === 'courses' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <input type="text" placeholder="Search courses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm w-64" />
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCourses.map(course => (
                  <div key={course.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-[10px] text-purple-400 uppercase font-bold">{course.category} · {course.provider}</div>
                        <h4 className="text-sm font-bold mt-1">{course.title}</h4>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-[10px] text-gray-500">⏱️ {course.duration}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${course.difficulty === 'Expert' ? 'bg-red-500/20 text-red-400' : course.difficulty === 'Advanced' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{course.difficulty}</span>
                          <span className="px-2 py-0.5 bg-amber-500/20 rounded text-[10px] text-amber-400">⭐ {course.rating}</span>
                        </div>
                      </div>
                      <CourseProgressRing enrolled={course.enrolled} completed={course.completed} size={55} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {course.skills.map(s => <span key={s} className="px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded text-[10px]">{s}</span>)}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-2">{course.completed}/{course.enrolled} completed ({Math.round((course.completed / course.enrolled) * 100)}%)</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ SKILLS TAB ═══════════ */}
          {activeTab === 'skills' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-2">
                {categories.map(c => (
                  <button key={c} onClick={() => setCategoryFilter(c)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${categoryFilter === c ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSkills.map(skill => (
                  <div key={skill.name} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold">{skill.name}</h4>
                      <span className="text-[10px] text-gray-500">{skill.employees} employees</span>
                    </div>
                    <SkillBar name={skill.name} level={skill.level} trend={skill.trend} />
                    <div className="text-[10px] text-gray-500">Category: {skill.category}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ CERTIFICATIONS TAB ═══════════ */}
          {activeTab === 'certifications' && (
            <div className="space-y-4">
              {CERTIFICATIONS.map(cert => (
                <div key={cert.name} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{cert.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold">{cert.name}</h4>
                      <div className="text-[10px] text-gray-500">Issued by {cert.issuer} · {cert.category}</div>
                      <div className="text-[10px] text-gray-500 mt-1">Expires: {cert.expiry}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-500">{cert.holders.length}</div>
                      <div className="text-[10px] text-gray-500">holders</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {cert.holders.map(h => <span key={h} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded text-[10px]">✓ {h}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════════ LEARNING PATHS TAB ═══════════ */}
          {activeTab === 'paths' && (
            <div className="space-y-4">
              {LEARNING_PATHS.map(path => (
                <div key={path.name} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-3xl">{path.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold">{path.name}</h4>
                      <div className="text-[10px] text-gray-500">{path.courses} courses · {path.totalHours}h · {path.enrolled} enrolled</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: path.color }}>{path.progress}%</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${path.progress}%`, backgroundColor: path.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
