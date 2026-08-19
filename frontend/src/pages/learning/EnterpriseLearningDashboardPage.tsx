import React, { useState, useMemo } from 'react';
import {
  GraduationCap, BookOpen, ShieldCheck, AlertCircle, Download, Search,
  PieChart, Activity, Sparkles, TrendingUp, Clock, CheckCircle2, Star,
  BarChart3, Users, Award, AlertTriangle,
} from 'lucide-react';
import CourseProgressCard, { CourseCardMetric } from '../../components/learning/CourseProgressCard';
import CertificationStatusTracker, { CertCardMetric } from '../../components/learning/CertificationStatusTracker';

const COURSES: CourseCardMetric[] = [
  { courseId: 'crs-001', title: 'Advanced TypeScript Patterns', category: 'TECHNICAL', difficulty: 'ADVANCED', durationHours: 12, instructorName: 'Sarah Chen', totalEnrolled: 85, totalCompleted: 62, avgRating: 4.8, totalModules: 8, isMandatory: false, status: 'ACTIVE' },
  { courseId: 'crs-002', title: 'SOC-2 Compliance Training', category: 'COMPLIANCE', difficulty: 'BEGINNER', durationHours: 4, instructorName: 'Security Team', totalEnrolled: 300, totalCompleted: 285, avgRating: 4.2, totalModules: 6, isMandatory: true, status: 'ACTIVE' },
  { courseId: 'crs-003', title: 'Leadership for Engineering Managers', category: 'LEADERSHIP', difficulty: 'INTERMEDIATE', durationHours: 20, instructorName: 'External Coach', totalEnrolled: 24, totalCompleted: 18, avgRating: 4.9, totalModules: 10, isMandatory: false, status: 'ACTIVE' },
  { courseId: 'crs-004', title: 'AWS Solutions Architect Prep', category: 'TECHNICAL', difficulty: 'EXPERT', durationHours: 40, instructorName: 'AWS Certified Trainer', totalEnrolled: 15, totalCompleted: 8, avgRating: 4.7, totalModules: 15, isMandatory: false, status: 'ACTIVE' },
  { courseId: 'crs-005', title: 'Cybersecurity Awareness Refresh', category: 'SECURITY', difficulty: 'BEGINNER', durationHours: 2, instructorName: 'IT Security', totalEnrolled: 300, totalCompleted: 270, avgRating: 4.0, totalModules: 3, isMandatory: true, status: 'ACTIVE' },
];

const CERTS: CertCardMetric[] = [
  { certId: 'cert-001', employeeName: 'Sarah Chen', departmentCode: 'ENG', certificationName: 'AWS Solutions Architect Professional', issuingBody: 'Amazon Web Services', earnedDateISO: '2025-11-15', expiryDateISO: '2028-11-15', status: 'ACTIVE', credentialUrl: '#' },
  { certId: 'cert-002', employeeName: 'Marcus Thompson', departmentCode: 'ENG', certificationName: 'Certified Kubernetes Administrator', issuingBody: 'CNCF', earnedDateISO: '2025-08-20', expiryDateISO: '2027-08-20', status: 'ACTIVE', credentialUrl: '#' },
  { certId: 'cert-003', employeeName: 'Priya Patel', departmentCode: 'OPS', certificationName: 'PMP Certification', issuingBody: 'PMI', earnedDateISO: '2024-06-10', expiryDateISO: '2026-09-10', status: 'EXPIRING_SOON', credentialUrl: '#' },
  { certId: 'cert-004', employeeName: 'Aiko Tanaka', departmentCode: 'FIN', certificationName: 'CFA Level III', issuingBody: 'CFA Institute', earnedDateISO: '2025-03-22', expiryDateISO: null, status: 'ACTIVE', credentialUrl: '#' },
  { certId: 'cert-005', employeeName: 'Fatima Al-Rashid', departmentCode: 'ENG', certificationName: 'SOC-2 Type II Auditor', issuingBody: 'AICPA', earnedDateISO: '2025-05-10', expiryDateISO: '2026-08-25', status: 'EXPIRING_SOON', credentialUrl: '#' },
];

const TRAINING_RECORDS = [
  { id: 'tr-001', employee: 'Alex Morgan', course: 'Advanced TypeScript Patterns', progress: 62, status: 'IN_PROGRESS', score: null, timeSpent: '7.5h' },
  { id: 'tr-002', employee: 'Alex Morgan', course: 'SOC-2 Compliance Training', progress: 100, status: 'COMPLETED', score: 92, timeSpent: '3h' },
  { id: 'tr-003', employee: 'James Rodriguez', course: 'Cybersecurity Awareness', progress: 0, status: 'OVERDUE', score: null, timeSpent: '0h' },
  { id: 'tr-004', employee: 'Marcus Thompson', course: 'AWS Solutions Architect Prep', progress: 88, status: 'IN_PROGRESS', score: null, timeSpent: '30h' },
  { id: 'tr-005', employee: 'Priya Patel', course: 'Leadership for Eng Managers', progress: 100, status: 'COMPLETED', score: 95, timeSpent: '20h' },
];

const CATEGORIES = ['All', 'TECHNICAL', 'LEADERSHIP', 'COMPLIANCE', 'SECURITY', 'SOFT_SKILLS'];
const DIFFICULTIES = ['All', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

export default function EnterpriseLearningDashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [activeTab, setActiveTab] = useState<'courses' | 'certs' | 'records'>('courses');
  const [selectedCourseModal, setSelectedCourseModal] = useState<CourseCardMetric | null>(null);

  const totalEnrollments = TRAINING_RECORDS.length;
  const completedCount = TRAINING_RECORDS.filter(r => r.status === 'COMPLETED').length;
  const overdueCount = TRAINING_RECORDS.filter(r => r.status === 'OVERDUE').length;
  const avgRating = Math.round(COURSES.reduce((s, c) => s + c.avgRating, 0) / COURSES.length * 10) / 10;

  const filteredCourses = useMemo(() => {
    return COURSES.filter(c => {
      const ms = c.title.toLowerCase().includes(searchQuery.toLowerCase());
      const mc = selectedCategory === 'All' || c.category === selectedCategory;
      const md = selectedDifficulty === 'All' || c.difficulty === selectedDifficulty;
      return ms && mc && md;
    });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Enterprise Suite
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Skill Gap Intelligence
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
              Enterprise Learning & Development Intelligence
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Course catalog, certification lifecycle tracking, skill gap analysis, mandatory training compliance, and training ROI analytics.
            </p>
          </div>
          <button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 border border-emerald-400/20 text-sm self-start">
            <Download className="w-4 h-4" /> Export L&D Report
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Total Courses</span><BookOpen className="w-4 h-4 text-emerald-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{COURSES.length}</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium"><TrendingUp className="w-3.5 h-3.5" /> {COURSES.filter(c => c.isMandatory).length} mandatory</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Completions</span><CheckCircle2 className="w-4 h-4 text-teal-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{completedCount}</div>
            <div className="text-teal-400 text-xs mt-2">{completedCount}/{totalEnrollments} enrolled</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Overdue</span><AlertTriangle className="w-4 h-4 text-rose-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{overdueCount}</div>
            <div className={`text-xs mt-2 ${overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{overdueCount > 0 ? 'Needs attention' : 'All on track'}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Avg Rating</span><Star className="w-4 h-4 text-amber-400" /></div>
            <div className="text-3xl font-black text-white font-mono">{avgRating}</div>
            <div className="text-amber-400 text-xs mt-2 flex items-center gap-1"><Star className="w-3 h-3" /> across all courses</div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            {(['courses', 'certs', 'records'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-medium text-sm transition flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                {tab === 'courses' && <><BookOpen className="w-3.5 h-3.5" /> Courses</>}
                {tab === 'certs' && <><Award className="w-3.5 h-3.5" /> Certifications</>}
                {tab === 'records' && <><BarChart3 className="w-3.5 h-3.5" /> Records</>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition" />
            </div>
            {activeTab === 'courses' && (
              <>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2 focus:outline-none focus:border-emerald-500 transition">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
                </select>
                <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)} className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2 focus:outline-none focus:border-emerald-500 transition">
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d === 'All' ? 'All Levels' : d}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {activeTab === 'courses' && (
          filteredCourses.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800"><AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" /><p className="text-slate-400 text-sm font-medium">No courses match your filters.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map(c => <CourseProgressCard key={c.courseId} metric={c} onInspect={() => setSelectedCourseModal(c)} />)}
            </div>
          )
        )}

        {activeTab === 'certs' && (
          <div className="space-y-3">
            {CERTS.map(c => <CertificationStatusTracker key={c.certId} metric={c} />)}
          </div>
        )}

        {activeTab === 'records' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-400" /> Training Records</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                  <th className="text-left p-4">Employee</th><th className="text-left p-4">Course</th><th className="text-center p-4">Progress</th><th className="text-center p-4">Status</th><th className="text-center p-4">Score</th><th className="text-center p-4">Time</th>
                </tr></thead>
                <tbody>
                  {TRAINING_RECORDS.map(r => (
                    <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="p-4 font-medium text-slate-100">{r.employee}</td>
                      <td className="p-4 text-slate-300">{r.course}</td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.progress}%` }} /></div>
                          <span className="text-[11px] font-mono text-slate-200">{r.progress}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg font-mono border ${
                        r.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        r.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>{r.status.replace(/_/g, ' ')}</span></td>
                      <td className="p-4 text-center text-[11px] font-mono text-slate-200">{r.score ?? '—'}</td>
                      <td className="p-4 text-center text-[11px] font-mono text-slate-200">{r.timeSpent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {selectedCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <button onClick={() => setSelectedCourseModal(null)} className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold">×</button>
            <h2 className="text-xl font-bold text-white mb-1">{selectedCourseModal.title}</h2>
            <div className="text-xs text-slate-400 font-mono mb-4">{selectedCourseModal.courseId} • {selectedCourseModal.category} • {selectedCourseModal.difficulty}</div>
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-xs font-mono">
              <div><span className="text-slate-500 block">Enrolled</span><span className="text-white font-bold text-sm">{selectedCourseModal.totalEnrolled}</span></div>
              <div><span className="text-slate-500 block">Completed</span><span className="text-emerald-400 font-bold text-sm">{selectedCourseModal.totalCompleted}</span></div>
              <div><span className="text-slate-500 block">Duration</span><span className="text-slate-200 font-bold text-sm">{selectedCourseModal.durationHours}h</span></div>
              <div><span className="text-slate-500 block">Rating</span><span className="text-amber-400 font-bold text-sm">{selectedCourseModal.avgRating}/5.0</span></div>
              <div><span className="text-slate-500 block">Modules</span><span className="text-slate-200 font-bold text-sm">{selectedCourseModal.totalModules}</span></div>
              <div><span className="text-slate-500 block">Mandatory</span><span className={`font-bold text-sm ${selectedCourseModal.isMandatory ? 'text-rose-400' : 'text-slate-400'}`}>{selectedCourseModal.isMandatory ? 'Yes' : 'No'}</span></div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setSelectedCourseModal(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
