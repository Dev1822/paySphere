import React, { useState, useMemo } from 'react';
import {
  GraduationCap, BookOpen, Award, Target, Clock, Calendar, Users,
  Search, Filter, ChevronDown, ChevronUp, ArrowUpRight, TrendingUp,
  TrendingDown, BarChart3, PieChart, CheckCircle2, XCircle, AlertTriangle,
  Info, Sparkles, Download, RefreshCw, Eye, Star, Brain, Zap, Heart,
  Flame, Crown, Medal, Trophy, Rocket, Lightbulb, Shield, Globe,
  MapPin, Briefcase, Play, Pause, Square, PlayCircle, FastForward,
  SkipForward, Volume2, Monitor, Laptop, Smartphone, Code2, Database,
  Server, Layers, Palette, Terminal, GitBranch, Cloud, ShieldCheck,
  DollarSign, BarChart, Activity, Hash, Bookmark, Share2, ExternalLink,
  Bell, Settings, Plus, Minus, CircleDot, Flag, Compass, Timer,
  Hourglass, CalendarDays, Repeat, Award as AwardIcon, BadgeCheck,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */

type CourseCategory = 'technical' | 'leadership' | 'compliance' | 'soft_skills' | 'onboarding' | 'certification';
type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type CourseStatus = 'not_started' | 'in_progress' | 'completed' | 'expired';
type AssessmentType = 'quiz' | 'project' | 'peer_review' | 'exam' | 'practical';

interface Course {
  id: string;
  title: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  instructor: string;
  duration: string;
  modules: number;
  enrolledCount: number;
  rating: number;
  reviews: number;
  price: number;
  status: CourseStatus;
  progress: number;
  thumbnail: string;
  tags: string[];
  skills: string[];
  certificate: boolean;
  deadline: string | null;
  lastAccessed: string | null;
}

interface SkillAssessment {
  id: string;
  skill: string;
  category: CourseCategory;
  currentLevel: number;
  targetLevel: number;
  assessments: { date: string; score: number; type: AssessmentType }[];
  trend: 'improving' | 'stable' | 'declining';
  lastAssessed: string;
  recommendedCourses: string[];
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  courses: string[];
  totalDuration: string;
  difficulty: CourseLevel;
  enrolled: number;
  rating: number;
  completionRate: number;
  skills: string[];
  color: string;
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  credentialId: string;
  status: 'active' | 'expiring_soon' | 'expired';
  category: CourseCategory;
  skills: string[];
  verified: boolean;
}

interface LearningStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalHours: number;
  certificatesEarned: number;
  skillsImproved: number;
  currentStreak: number;
  rank: number;
  totalEmployees: number;
  xpEarned: number;
  maxXp: number;
  level: number;
}

interface LearningInsight {
  id: string;
  type: 'achievement' | 'suggestion' | 'alert' | 'trend' | 'recommendation';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  priority: number;
}

/* ─────────────── Constants ─────────────── */

const CATEGORY_CONFIG: Record<CourseCategory, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  technical: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <Code2 size={14} />, label: 'Technical' },
  leadership: { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: <Crown size={14} />, label: 'Leadership' },
  compliance: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <ShieldCheck size={14} />, label: 'Compliance' },
  soft_skills: { color: 'text-pink-400', bg: 'bg-pink-500/20', icon: <Heart size={14} />, label: 'Soft Skills' },
  onboarding: { color: 'text-green-400', bg: 'bg-green-500/20', icon: <Rocket size={14} />, label: 'Onboarding' },
  certification: { color: 'text-orange-400', bg: 'bg-orange-500/20', icon: <Award size={14} />, label: 'Certification' },
};

const LEVEL_CONFIG: Record<CourseLevel, { color: string; bg: string; label: string }> = {
  beginner: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Beginner' },
  intermediate: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Intermediate' },
  advanced: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Advanced' },
  expert: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Expert' },
};

const STATUS_CONFIG: Record<CourseStatus, { color: string; bg: string; label: string }> = {
  not_started: { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Not Started' },
  in_progress: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'In Progress' },
  completed: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  expired: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Expired' },
};

/* ─────────────── Sample Data ─────────────── */

const COURSES: Course[] = [
  { id: 'c1', title: 'Advanced React Patterns', description: 'Master compound components, render props, hooks patterns, and performance optimization', category: 'technical', level: 'advanced', instructor: 'Sarah Chen', duration: '12 hours', modules: 8, enrolledCount: 342, rating: 4.9, reviews: 156, price: 0, status: 'completed', progress: 100, thumbnail: '⚛️', tags: ['react', 'hooks', 'patterns'], skills: ['React', 'TypeScript', 'Performance'], certificate: true, deadline: null, lastAccessed: '2026-08-28' },
  { id: 'c2', title: 'System Design Masterclass', description: 'Design scalable distributed systems, microservices, and event-driven architectures', category: 'technical', level: 'expert', instructor: 'Alex Kumar', duration: '20 hours', modules: 12, enrolledCount: 189, rating: 4.8, reviews: 98, price: 199, status: 'in_progress', progress: 65, thumbnail: '🏗️', tags: ['architecture', 'distributed', 'scalability'], skills: ['System Design', 'Architecture', 'Distributed Systems'], certificate: true, deadline: '2026-09-30', lastAccessed: '2026-08-30' },
  { id: 'c3', title: 'Leadership for Tech Leads', description: 'Transition from IC to tech lead: delegation, feedback, conflict resolution, and team building', category: 'leadership', level: 'intermediate', instructor: 'Maria Johnson', duration: '8 hours', modules: 6, enrolledCount: 256, rating: 4.7, reviews: 134, price: 0, status: 'in_progress', progress: 40, thumbnail: '👑', tags: ['leadership', 'management', 'communication'], skills: ['Leadership', 'Communication', 'Delegation'], certificate: true, deadline: null, lastAccessed: '2026-08-29' },
  { id: 'c4', title: 'Data Privacy & GDPR Compliance', description: 'Understand GDPR, CCPA, and data protection regulations for engineering teams', category: 'compliance', level: 'beginner', instructor: 'Legal Team', duration: '4 hours', modules: 5, enrolledCount: 567, rating: 4.3, reviews: 289, price: 0, status: 'completed', progress: 100, thumbnail: '🛡️', tags: ['gdpr', 'privacy', 'compliance'], skills: ['Data Privacy', 'GDPR', 'Compliance'], certificate: true, deadline: null, lastAccessed: '2026-07-15' },
  { id: 'c5', title: 'Effective Communication Workshop', description: 'Improve written and verbal communication for remote and hybrid teams', category: 'soft_skills', level: 'beginner', instructor: 'HR Team', duration: '6 hours', modules: 4, enrolledCount: 423, rating: 4.5, reviews: 201, price: 0, status: 'in_progress', progress: 75, thumbnail: '💬', tags: ['communication', 'remote', 'teamwork'], skills: ['Communication', 'Presentation', 'Writing'], certificate: false, deadline: '2026-08-31', lastAccessed: '2026-08-30' },
  { id: 'c6', title: 'AWS Solutions Architect Prep', description: 'Prepare for the AWS Solutions Architect certification exam with hands-on labs', category: 'certification', level: 'advanced', instructor: 'Cloud Academy', duration: '40 hours', modules: 20, enrolledCount: 87, rating: 4.9, reviews: 67, price: 299, status: 'not_started', progress: 0, thumbnail: '☁️', tags: ['aws', 'cloud', 'certification'], skills: ['AWS', 'Cloud Architecture', 'Networking'], certificate: true, deadline: '2026-12-31', lastAccessed: null },
  { id: 'c7', title: 'TypeScript Deep Dive', description: 'Master advanced TypeScript features: generics, utility types, declaration files, and patterns', category: 'technical', level: 'intermediate', instructor: 'Sarah Chen', duration: '10 hours', modules: 7, enrolledCount: 278, rating: 4.8, reviews: 145, price: 0, status: 'completed', progress: 100, thumbnail: '📘', tags: ['typescript', 'types', 'patterns'], skills: ['TypeScript', 'Type System', 'Generics'], certificate: true, deadline: null, lastAccessed: '2026-08-20' },
  { id: 'c8', title: 'New Employee Onboarding', description: 'Complete guide to company culture, tools, processes, and your first 90 days', category: 'onboarding', level: 'beginner', instructor: 'HR Team', duration: '3 hours', modules: 6, enrolledCount: 890, rating: 4.4, reviews: 456, price: 0, status: 'completed', progress: 100, thumbnail: '🚀', tags: ['onboarding', 'culture', 'tools'], skills: ['Company Culture', 'Tools', 'Processes'], certificate: false, deadline: null, lastAccessed: '2026-06-01' },
];

const SKILL_ASSESSMENTS: SkillAssessment[] = [
  { id: 'sa1', skill: 'React', category: 'technical', currentLevel: 8, targetLevel: 10, assessments: [{ date: '2026-08-15', score: 82, type: 'project' }, { date: '2026-06-01', score: 75, type: 'quiz' }, { date: '2026-03-01', score: 68, type: 'peer_review' }], trend: 'improving', lastAssessed: '2026-08-15', recommendedCourses: ['c1', 'c2'] },
  { id: 'sa2', skill: 'System Design', category: 'technical', currentLevel: 6, targetLevel: 9, assessments: [{ date: '2026-08-20', score: 65, type: 'exam' }, { date: '2026-05-01', score: 58, type: 'project' }], trend: 'improving', lastAssessed: '2026-08-20', recommendedCourses: ['c2'] },
  { id: 'sa3', skill: 'Leadership', category: 'leadership', currentLevel: 5, targetLevel: 8, assessments: [{ date: '2026-08-10', score: 55, type: 'peer_review' }, { date: '2026-04-01', score: 48, type: 'quiz' }], trend: 'improving', lastAssessed: '2026-08-10', recommendedCourses: ['c3'] },
  { id: 'sa4', skill: 'TypeScript', category: 'technical', currentLevel: 9, targetLevel: 10, assessments: [{ date: '2026-08-01', score: 88, type: 'project' }, { date: '2026-05-15', score: 82, type: 'exam' }], trend: 'stable', lastAssessed: '2026-08-01', recommendedCourses: ['c7'] },
  { id: 'sa5', skill: 'Communication', category: 'soft_skills', currentLevel: 7, targetLevel: 9, assessments: [{ date: '2026-08-25', score: 72, type: 'peer_review' }], trend: 'improving', lastAssessed: '2026-08-25', recommendedCourses: ['c5'] },
];

const LEARNING_PATHS: LearningPath[] = [
  { id: 'lp1', title: 'Full-Stack Mastery', description: 'Complete path from frontend to backend to cloud deployment', courses: ['c1', 'c2', 'c6', 'c7'], totalDuration: '82 hours', difficulty: 'advanced', enrolled: 156, rating: 4.8, completionRate: 34, skills: ['React', 'System Design', 'AWS', 'TypeScript'], color: '#3b82f6' },
  { id: 'lp2', title: 'Tech Lead Track', description: 'Transition from senior engineer to tech lead with management skills', courses: ['c3', 'c5', 'c2'], totalDuration: '34 hours', difficulty: 'intermediate', enrolled: 89, rating: 4.7, completionRate: 28, skills: ['Leadership', 'Communication', 'System Design'], color: '#a855f7' },
  { id: 'lp3', title: 'Cloud Certification', description: 'Prepare for AWS Solutions Architect certification', courses: ['c6', 'c2'], totalDuration: '60 hours', difficulty: 'advanced', enrolled: 67, rating: 4.9, completionRate: 45, skills: ['AWS', 'Cloud Architecture'], color: '#f97316' },
];

const CERTIFICATIONS: Certification[] = [
  { id: 'cert1', name: 'Advanced React Patterns', issuer: 'DevLink Academy', issueDate: '2026-08-28', expiryDate: null, credentialId: 'DEV-REACT-2026-0828', status: 'active', category: 'technical', skills: ['React', 'TypeScript'], verified: true },
  { id: 'cert2', name: 'Data Privacy & GDPR', issuer: 'Legal & Compliance', issueDate: '2026-07-15', expiryDate: '2027-07-15', credentialId: 'CMP-GDPR-2026-0715', status: 'active', category: 'compliance', skills: ['GDPR', 'Data Privacy'], verified: true },
  { id: 'cert3', name: 'TypeScript Deep Dive', issuer: 'DevLink Academy', issueDate: '2026-08-20', expiryDate: null, credentialId: 'DEV-TS-2026-0820', status: 'active', category: 'technical', skills: ['TypeScript'], verified: true },
  { id: 'cert4', name: 'New Employee Onboarding', issuer: 'HR Department', issueDate: '2026-06-01', expiryDate: null, credentialId: 'HR-ONB-2026-0601', status: 'active', category: 'onboarding', skills: ['Company Culture'], verified: true },
];

const LEARNING_STATS: LearningStats = {
  totalCourses: 8, completedCourses: 4, inProgressCourses: 3, totalHours: 47,
  certificatesEarned: 4, skillsImproved: 5, currentStreak: 12, rank: 15,
  totalEmployees: 340, xpEarned: 2340, maxXp: 4000, level: 6,
};

const LEARNING_INSIGHTS: LearningInsight[] = [
  { id: 'li1', type: 'achievement', title: '12-Day Learning Streak!', description: 'You\'ve learned for 12 consecutive days. Amazing consistency!', icon: <Flame size={16} />, color: 'text-orange-400', priority: 1 },
  { id: 'li2', type: 'alert', title: 'Communication Workshop Due Tomorrow', description: 'Complete the remaining 25% to earn your badge before the deadline.', icon: <AlertTriangle size={16} />, color: 'text-yellow-400', priority: 2 },
  { id: 'li3', type: 'recommendation', title: 'Start AWS Certification', description: 'Based on your learning path, now is the perfect time to start the AWS cert prep.', icon: <Cloud size={16} />, color: 'text-blue-400', priority: 3 },
  { id: 'li4', type: 'trend', title: 'System Design Skills Rising', description: 'Your system design score improved 12% this quarter. Keep the momentum!', icon: <TrendingUp size={16} />, color: 'text-green-400', priority: 4 },
  { id: 'li5', type: 'suggestion', title: 'Peer Learning Opportunity', description: '3 colleagues are also studying React. Consider forming a study group.', icon: <Users size={16} />, color: 'text-purple-400', priority: 5 },
];

/* ─────────────── Sub-Components ─────────────── */

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string; trend?: string; trendUp?: boolean }> = ({ icon, label, value, sub, color = 'text-white', trend, trendUp }) => (
  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
    <div className="flex items-center gap-2 mb-2"><span className={color}>{icon}</span><span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span></div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    {trend && <div className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? 'text-green-400' : 'text-red-400'}`}>{trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{trend}</div>}
  </div>
);

const CourseCard: React.FC<{ course: Course; selected: boolean; onSelect: () => void }> = ({ course, selected, onSelect }) => {
  const catCfg = CATEGORY_CONFIG[course.category];
  const lvlCfg = LEVEL_CONFIG[course.level];
  const statusCfg = STATUS_CONFIG[course.status];
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{course.thumbnail}</span>
          <span className="font-semibold text-white text-sm">{course.title}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>
      <p className="text-xs text-gray-400 mb-2 line-clamp-2">{course.description}</p>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${catCfg.bg} ${catCfg.color}`}>{catCfg.label}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${lvlCfg.bg} ${lvlCfg.color}`}>{lvlCfg.label}</span>
        {course.certificate && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">📜 Cert</span>}
      </div>
      {course.status === 'in_progress' && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-gray-400">{course.progress}% complete</span>
            <span className="text-gray-500">{course.duration}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-cyan-400 h-2 rounded-full" style={{ width: `${course.progress}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400 fill-yellow-400" />{course.rating} ({course.reviews})</span>
        <span className="flex items-center gap-1"><Users size={10} />{course.enrolledCount}</span>
        <span>{course.price === 0 ? 'Free' : `$${course.price}`}</span>
      </div>
    </div>
  );
};

const SkillCard: React.FC<{ assessment: SkillAssessment }> = ({ assessment }) => {
  const progress = (assessment.currentLevel / 10) * 100;
  const targetPct = (assessment.targetLevel / 10) * 100;
  const catCfg = CATEGORY_CONFIG[assessment.category];
  const latestScore = assessment.assessments[0]?.score || 0;
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{assessment.skill}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${catCfg.bg} ${catCfg.color}`}>{catCfg.label}</span>
        </div>
        <span className={`text-[10px] flex items-center gap-1 ${assessment.trend === 'improving' ? 'text-green-400' : assessment.trend === 'declining' ? 'text-red-400' : 'text-gray-400'}`}>
          {assessment.trend === 'improving' ? '↑' : assessment.trend === 'declining' ? '↓' : '→'} {assessment.trend}
        </span>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-gray-400">Level {assessment.currentLevel}/10</span>
          <span className="text-gray-500">Target: {assessment.targetLevel}/10</span>
        </div>
        <div className="relative w-full bg-white/10 rounded-full h-3">
          <div className="absolute h-3 rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
          <div className="absolute h-3 w-0.5 bg-yellow-400" style={{ left: `${targetPct}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Latest: {latestScore}%</span>
        <span className="text-gray-500">{assessment.assessments.length} assessments</span>
      </div>
    </div>
  );
};

const PathCard: React.FC<{ path: LearningPath; selected: boolean; onSelect: () => void }> = ({ path, selected, onSelect }) => {
  const lvlCfg = LEVEL_CONFIG[path.difficulty];
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-white text-sm">{path.title}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${lvlCfg.bg} ${lvlCfg.color}`}>{lvlCfg.label}</span>
      </div>
      <p className="text-xs text-gray-400 mb-2">{path.description}</p>
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-gray-400">{path.courses.length} courses · {path.totalDuration}</span>
          <span className="text-gray-500">{path.completionRate}% avg completion</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className="h-2 rounded-full" style={{ width: `${path.completionRate}%`, backgroundColor: path.color }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {path.skills.map((s) => <span key={s} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-gray-400">{s}</span>)}
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400" />{path.rating}</span>
        <span className="flex items-center gap-1"><Users size={10} />{path.enrolled}</span>
      </div>
    </div>
  );
};

const CertCard: React.FC<{ cert: Certification }> = ({ cert }) => {
  const statusColors: Record<string, string> = { active: 'text-green-400', expiring_soon: 'text-yellow-400', expired: 'text-red-400' };
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
          <Award size={20} className="text-yellow-400" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-white text-sm">{cert.name}</div>
          <div className="text-[10px] text-gray-500">{cert.issuer}</div>
        </div>
        {cert.verified && <BadgeCheck size={16} className="text-blue-400" />}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 mb-2">
        <span>Issued: {cert.issueDate}</span>
        <span>{cert.expiryDate ? `Expires: ${cert.expiryDate}` : 'No expiry'}</span>
        <span className="font-mono">{cert.credentialId}</span>
        <span className={statusColors[cert.status]}>{cert.status.replace('_', ' ')}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {cert.skills.map((s) => <span key={s} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-gray-400">{s}</span>)}
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ insight: LearningInsight }> = ({ insight }) => {
  const typeColors: Record<string, string> = { achievement: 'border-orange-400/30 bg-orange-500/5', suggestion: 'border-purple-400/30 bg-purple-500/5', alert: 'border-yellow-400/30 bg-yellow-500/5', trend: 'border-green-400/30 bg-green-500/5', recommendation: 'border-blue-400/30 bg-blue-500/5' };
  return (
    <div className={`rounded-xl p-3 border ${typeColors[insight.type]} flex items-start gap-3`}>
      <span className={insight.color}>{insight.icon}</span>
      <div>
        <div className="text-sm font-semibold text-white">{insight.title}</div>
        <div className="text-xs text-gray-400">{insight.description}</div>
      </div>
    </div>
  );
};

/* ─────────────── Main Component ─────────────── */

export default function EmployeeLearningHubPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'skills' | 'paths' | 'certifications' | 'insights'>('catalog');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<CourseCategory | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<CourseLevel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<CourseStatus | 'all'>('all');

  const filteredCourses = useMemo(() => {
    let result = [...COURSES];
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter((c) => c.title.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q))); }
    if (filterCategory !== 'all') result = result.filter((c) => c.category === filterCategory);
    if (filterLevel !== 'all') result = result.filter((c) => c.level === filterLevel);
    if (filterStatus !== 'all') result = result.filter((c) => c.status === filterStatus);
    return result;
  }, [searchQuery, filterCategory, filterLevel, filterStatus]);

  const tabs = [
    { id: 'catalog' as const, label: 'Course Catalog', icon: <BookOpen size={14} /> },
    { id: 'skills' as const, label: 'Skill Assessments', icon: <Target size={14} /> },
    { id: 'paths' as const, label: 'Learning Paths', icon: <Map size={14} /> },
    { id: 'certifications' as const, label: 'Certifications', icon: <Award size={14} /> },
    { id: 'insights' as const, label: 'Insights', icon: <Sparkles size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-600 flex items-center justify-center">
                <GraduationCap size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">Learning Hub</h1>
                <p className="text-indigo-300/60 text-sm">Learn · Grow · Certify · Lead</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 font-bold">🔥 {LEARNING_STATS.currentStreak} day streak</span>
              <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold">Lvl {LEARNING_STATS.level}</span>
            </div>
          </div>
        </header>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={<BookOpen size={18} />} label="Courses" value={`${LEARNING_STATS.completedCourses}/${LEARNING_STATS.totalCourses}`} color="text-blue-400" />
          <KpiCard icon={<Clock size={18} />} label="Hours" value={LEARNING_STATS.totalHours} color="text-cyan-400" trend="+6h this week" trendUp />
          <KpiCard icon={<Award size={18} />} label="Certificates" value={LEARNING_STATS.certificatesEarned} color="text-yellow-400" />
          <KpiCard icon={<Target size={18} />} label="Skills" value={LEARNING_STATS.skillsImproved} sub="improved" color="text-green-400" />
          <KpiCard icon={<Flame size={18} />} label="Rank" value={`#${LEARNING_STATS.rank}`} sub={`of ${LEARNING_STATS.totalEmployees}`} color="text-orange-400" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-400/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Catalog Tab */}
        {activeTab === 'catalog' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input type="text" placeholder="Search courses, skills..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
              </div>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Levels</option>
                {Object.entries(LEVEL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCourses.map((c) => <CourseCard key={c.id} course={c} selected={selectedCourse?.id === c.id} onSelect={() => setSelectedCourse(c)} />)}
            </div>
          </div>
        )}

        {/* Skills Tab */}
        {activeTab === 'skills' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SKILL_ASSESSMENTS.map((sa) => <SkillCard key={sa.id} assessment={sa} />)}
          </div>
        )}

        {/* Paths Tab */}
        {activeTab === 'paths' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LEARNING_PATHS.map((lp) => <PathCard key={lp.id} path={lp} selected={false} onSelect={() => {}} />)}
          </div>
        )}

        {/* Certifications Tab */}
        {activeTab === 'certifications' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CERTIFICATIONS.map((cert) => <CertCard key={cert.id} cert={cert} />)}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-3 max-w-3xl">
            <h2 className="text-lg font-bold text-white">Learning Insights</h2>
            {LEARNING_INSIGHTS.sort((a, b) => a.priority - b.priority).map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Map({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>; }
function Cloud({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>; }
