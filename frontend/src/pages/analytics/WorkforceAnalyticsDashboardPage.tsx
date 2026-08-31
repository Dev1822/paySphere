import React, { useState, useMemo } from 'react';
import {
  Users, UserMinus, UserPlus, TrendingUp, TrendingDown, BarChart3,
  PieChart, Activity, Target, Award, Shield, Globe, MapPin, Briefcase,
  Clock, Calendar, Search, Filter, ChevronDown, ChevronUp, ArrowUpRight,
  ArrowDownRight, CheckCircle2, XCircle, AlertTriangle, Info, Sparkles,
  Download, RefreshCw, Eye, Brain, Zap, Heart, Flame, Star, Crown,
  DollarSign, Building2, GraduationCap, Layers, GitBranch, Hash,
  Percent, Scale, Compass, Flag, Lightbulb, Rocket, Medal,
  BrainCircuit, Network, Workflow, Timer, Hourglass, CalendarDays,
  Repeat, Share2, Bookmark, ExternalLink, Bell, Settings,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */

type Department = 'engineering' | 'product' | 'design' | 'marketing' | 'sales' | 'hr' | 'finance' | 'legal' | 'operations' | 'executive';
type TurnoverRisk = 'very_low' | 'low' | 'medium' | 'high' | 'critical';
type HeadcountTrend = 'growing' | 'stable' | 'shrinking';
type DiversityDimension = 'gender' | 'ethnicity' | 'age' | 'location' | 'disability';

interface HeadcountMetric {
  department: Department;
  totalHeadcount: number;
  lastQuarter: number;
  change: number;
  changePercent: number;
  trend: HeadcountTrend;
  openRoles: number;
  avgTenure: number;
  avgAge: number;
  avgSalary: number;
  attritionRate: number;
  color: string;
}

interface TurnoverPrediction {
  employeeId: string;
  name: string;
  department: Department;
  role: string;
  tenure: number;
  riskLevel: TurnoverRisk;
  riskScore: number;
  riskFactors: string[];
  lastPromotion: string;
  salaryGrowth: number;
  engagementScore: number;
  managerRating: number;
  performanceRating: number;
  daysSinceRaise: number;
}

interface DiversityMetric {
  dimension: DiversityDimension;
  label: string;
  categories: { name: string; count: number; percentage: number; target: number; color: string }[];
  overallScore: number;
  trend: 'improving' | 'stable' | 'declining';
  yearOverYear: number;
}

interface WorkforcePlan {
  id: string;
  title: string;
  department: Department;
  timeline: string;
  headcountTarget: number;
  currentHeadcount: number;
  budgetAllocated: number;
  budgetSpent: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  milestones: { label: string; completed: boolean; date: string }[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface WorkforceInsight {
  id: string;
  type: 'alert' | 'opportunity' | 'trend' | 'recommendation' | 'achievement';
  title: string;
  description: string;
  impact: string;
  priority: number;
  icon: React.ReactNode;
  color: string;
}

/* ─────────────── Constants ─────────────── */

const DEPT_CONFIG: Record<Department, { color: string; bg: string; label: string; icon: string }> = {
  engineering: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Engineering', icon: '⚙️' },
  product: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Product', icon: '🎯' },
  design: { color: 'text-pink-400', bg: 'bg-pink-500/20', label: 'Design', icon: '🎨' },
  marketing: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Marketing', icon: '📢' },
  sales: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Sales', icon: '💰' },
  hr: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'HR', icon: '👥' },
  finance: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Finance', icon: '📊' },
  legal: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Legal', icon: '⚖️' },
  operations: { color: 'text-teal-400', bg: 'bg-teal-500/20', label: 'Operations', icon: '🔄' },
  executive: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Executive', icon: '👑' },
};

const RISK_CONFIG: Record<TurnoverRisk, { color: string; bg: string; label: string }> = {
  very_low: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Very Low' },
  low: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Low' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Medium' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'High' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Critical' },
};

const fmt = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

/* ─────────────── Sample Data ─────────────── */

const HEADCOUNT: HeadcountMetric[] = [
  { department: 'engineering', totalHeadcount: 142, lastQuarter: 128, change: 14, changePercent: 10.9, trend: 'growing', openRoles: 18, avgTenure: 2.8, avgAge: 31, avgSalary: 165000, attritionRate: 12, color: '#3b82f6' },
  { department: 'product', totalHeadcount: 35, lastQuarter: 32, change: 3, changePercent: 9.4, trend: 'growing', openRoles: 5, avgTenure: 2.1, avgAge: 29, avgSalary: 145000, attritionRate: 8, color: '#a855f7' },
  { department: 'design', totalHeadcount: 18, lastQuarter: 16, change: 2, changePercent: 12.5, trend: 'growing', openRoles: 3, avgTenure: 1.9, avgAge: 28, avgSalary: 125000, attritionRate: 6, color: '#ec4899' },
  { department: 'marketing', totalHeadcount: 28, lastQuarter: 30, change: -2, changePercent: -6.7, trend: 'shrinking', openRoles: 2, avgTenure: 1.5, avgAge: 27, avgSalary: 95000, attritionRate: 18, color: '#f97316' },
  { department: 'sales', totalHeadcount: 45, lastQuarter: 42, change: 3, changePercent: 7.1, trend: 'growing', openRoles: 8, avgTenure: 1.8, avgAge: 30, avgSalary: 110000, attritionRate: 22, color: '#22c55e' },
  { department: 'hr', totalHeadcount: 12, lastQuarter: 12, change: 0, changePercent: 0, trend: 'stable', openRoles: 1, avgTenure: 3.2, avgAge: 34, avgSalary: 105000, attritionRate: 5, color: '#06b6d4' },
  { department: 'finance', totalHeadcount: 15, lastQuarter: 14, change: 1, changePercent: 7.1, trend: 'stable', openRoles: 2, avgTenure: 3.5, avgAge: 35, avgSalary: 120000, attritionRate: 4, color: '#eab308' },
  { department: 'operations', totalHeadcount: 22, lastQuarter: 20, change: 2, changePercent: 10, trend: 'growing', openRoles: 3, avgTenure: 2.4, avgAge: 32, avgSalary: 98000, attritionRate: 10, color: '#14b8a6' },
];

const TURNOVER_PREDICTIONS: TurnoverPrediction[] = [
  { employeeId: 'e1', name: 'Marcus Williams', department: 'engineering', role: 'Senior Backend Engineer', tenure: 3.2, riskLevel: 'high', riskScore: 78, riskFactors: ['No promotion in 2 years', 'Below-market salary', 'Low engagement score'], lastPromotion: '2024-06-01', salaryGrowth: 5, engagementScore: 45, managerRating: 3.8, performanceRating: 4.2, daysSinceRaise: 450 },
  { employeeId: 'e2', name: 'Priya Sharma', department: 'product', role: 'Product Manager', tenure: 1.8, riskLevel: 'medium', riskScore: 55, riskFactors: ['Workload concerns', 'Limited growth path'], lastPromotion: '2025-01-01', salaryGrowth: 8, engagementScore: 62, managerRating: 4.0, performanceRating: 3.9, daysSinceRaise: 300 },
  { employeeId: 'e3', name: 'David Chen', department: 'engineering', role: 'Frontend Developer', tenure: 2.5, riskLevel: 'critical', riskScore: 89, riskFactors: ['Competitor offer received', 'Disengaged in meetings', 'Requested transfer twice'], lastPromotion: '2023-12-01', salaryGrowth: 3, engagementScore: 32, managerRating: 3.5, performanceRating: 4.0, daysSinceRaise: 600 },
  { employeeId: 'e4', name: 'Sarah Kim', department: 'design', role: 'UX Designer', tenure: 1.2, riskLevel: 'low', riskScore: 25, riskFactors: ['Slight workload increase'], lastPromotion: '2026-01-01', salaryGrowth: 12, engagementScore: 82, managerRating: 4.5, performanceRating: 4.3, daysSinceRaise: 120 },
  { employeeId: 'e5', name: 'James Rodriguez', department: 'sales', role: 'Account Executive', tenure: 2.1, riskLevel: 'high', riskScore: 72, riskFactors: ['Commission structure change', 'Territory reassignment', 'Missed quota last quarter'], lastPromotion: '2025-03-01', salaryGrowth: 4, engagementScore: 48, managerRating: 3.6, performanceRating: 3.5, daysSinceRaise: 380 },
];

const DIVERSITY: DiversityMetric[] = [
  {
    dimension: 'gender', label: 'Gender Distribution', overallScore: 72, trend: 'improving', yearOverYear: 4.2,
    categories: [
      { name: 'Male', count: 198, percentage: 58, target: 55, color: '#3b82f6' },
      { name: 'Female', count: 132, percentage: 39, target: 42, color: '#ec4899' },
      { name: 'Non-Binary', count: 10, percentage: 3, target: 3, color: '#a855f7' },
    ],
  },
  {
    dimension: 'ethnicity', label: 'Ethnic Diversity', overallScore: 65, trend: 'stable', yearOverYear: 1.8,
    categories: [
      { name: 'White', count: 165, percentage: 48, target: 45, color: '#6b7280' },
      { name: 'Asian', count: 85, percentage: 25, target: 22, color: '#3b82f6' },
      { name: 'Hispanic/Latino', count: 45, percentage: 13, target: 15, color: '#22c55e' },
      { name: 'Black', count: 35, percentage: 10, target: 13, color: '#f97316' },
      { name: 'Other', count: 15, percentage: 4, target: 5, color: '#a855f7' },
    ],
  },
  {
    dimension: 'age', label: 'Age Distribution', overallScore: 78, trend: 'stable', yearOverYear: 0.5,
    categories: [
      { name: '18-25', count: 52, percentage: 15, target: 15, color: '#22c55e' },
      { name: '26-35', count: 170, percentage: 50, target: 48, color: '#3b82f6' },
      { name: '36-45', count: 82, percentage: 24, target: 25, color: '#a855f7' },
      { name: '46-55', count: 28, percentage: 8, target: 8, color: '#f97316' },
      { name: '55+', count: 8, percentage: 3, target: 4, color: '#eab308' },
    ],
  },
];

const WORKFORCE_PLANS: WorkforcePlan[] = [
  { id: 'wp1', title: 'Engineering Expansion', department: 'engineering', timeline: 'Q3-Q4 2026', headcountTarget: 180, currentHeadcount: 142, budgetAllocated: 8500000, budgetSpent: 5200000, status: 'on_track', priority: 'critical', milestones: [{ label: 'Hire 18 engineers', completed: true, date: '2026-08-01' }, { label: 'Open 2 new teams', completed: false, date: '2026-09-15' }, { label: 'Reach 180 headcount', completed: false, date: '2026-12-31' }] },
  { id: 'wp2', title: 'Sales Team Scaling', department: 'sales', timeline: 'Q3 2026', headcountTarget: 55, currentHeadcount: 45, budgetAllocated: 3200000, budgetSpent: 2100000, status: 'at_risk', priority: 'high', milestones: [{ label: 'Hire 10 AEs', completed: true, date: '2026-07-01' }, { label: 'Territory expansion', completed: false, date: '2026-08-30' }, { label: 'Reach 55 headcount', completed: false, date: '2026-09-30' }] },
  { id: 'wp3', title: 'Diversity Leadership Initiative', department: 'hr', timeline: 'H2 2026', headcountTarget: 15, currentHeadcount: 12, budgetAllocated: 500000, budgetSpent: 180000, status: 'on_track', priority: 'medium', milestones: [{ label: 'Launch ERGs', completed: true, date: '2026-07-15' }, { label: 'Diversity hiring pipeline', completed: true, date: '2026-08-01' }, { label: 'Reach 40% female leadership', completed: false, date: '2026-12-31' }] },
];

const WORKFORCE_INSIGHTS: WorkforceInsight[] = [
  { id: 'wi1', type: 'alert', title: 'Critical Turnover Risk: David Chen', description: 'Frontend developer with competitor offer. 89% turnover risk. Immediate retention action needed.', impact: '$165K replacement cost', priority: 1, icon: <AlertTriangle size={16} />, color: 'text-red-400' },
  { id: 'wi2', type: 'trend', title: 'Sales Attrition Rising', description: 'Sales department attrition at 22% — highest across all departments. Commission structure concerns.', impact: 'Revenue impact: $1.2M', priority: 2, icon: <TrendingUp size={16} />, color: 'text-orange-400' },
  { id: 'wi3', type: 'opportunity', title: 'Engineering Hiring Surpassing Targets', description: '14 new engineers hired in Q3, exceeding the 12 target. Two new teams launching in September.', impact: '+10.9% headcount growth', priority: 3, icon: <Rocket size={16} />, color: 'text-green-400' },
  { id: 'wi4', type: 'recommendation', title: 'Address Gender Gap in Leadership', description: 'Female representation at 39% vs 42% target. Consider targeted leadership development program.', impact: 'Diversity score: 72/100', priority: 4, icon: <Scale size={16} />, color: 'text-purple-400' },
  { id: 'wi5', type: 'achievement', title: 'HR Team Zero Attrition', description: 'HR department achieved 0% attrition this quarter with 3.2 year avg tenure. Best in company.', impact: 'Knowledge retention: excellent', priority: 5, icon: <Award size={16} />, color: 'text-yellow-400' },
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

const DeptCard: React.FC<{ metric: HeadcountMetric; selected: boolean; onSelect: () => void }> = ({ metric, selected, onSelect }) => {
  const deptCfg = DEPT_CONFIG[metric.department];
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{deptCfg.icon}</span>
          <span className="font-semibold text-white text-sm">{deptCfg.label}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${metric.trend === 'growing' ? 'bg-green-500/20 text-green-400' : metric.trend === 'shrinking' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {metric.trend === 'growing' ? '↑ Growing' : metric.trend === 'shrinking' ? '↓ Shrinking' : '→ Stable'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Headcount</div><div className="text-white font-bold">{metric.totalHeadcount}</div></div>
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Open Roles</div><div className="text-yellow-400 font-bold">{metric.openRoles}</div></div>
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Attrition</div><div className={`font-bold ${metric.attritionRate > 15 ? 'text-red-400' : metric.attritionRate > 10 ? 'text-yellow-400' : 'text-green-400'}`}>{metric.attritionRate}%</div></div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>Avg tenure: {metric.avgTenure}y</span>
        <span className={metric.changePercent > 0 ? 'text-green-400' : metric.changePercent < 0 ? 'text-red-400' : 'text-gray-400'}>
          {metric.changePercent > 0 ? '+' : ''}{metric.changePercent}% QoQ
        </span>
      </div>
    </div>
  );
};

const TurnoverRow: React.FC<{ prediction: TurnoverPrediction; selected: boolean; onSelect: () => void }> = ({ prediction, selected, onSelect }) => {
  const riskCfg = RISK_CONFIG[prediction.riskLevel];
  const deptCfg = DEPT_CONFIG[prediction.department];
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10' : prediction.riskLevel === 'critical' ? 'border-red-400/30 bg-red-500/5' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{prediction.name}</span>
          <span className="text-[10px] text-gray-500">{prediction.role}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${deptCfg.bg} ${deptCfg.color}`}>{deptCfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>{riskCfg.label}</span>
          <span className={`text-sm font-bold ${prediction.riskScore > 70 ? 'text-red-400' : prediction.riskScore > 50 ? 'text-yellow-400' : 'text-green-400'}`}>{prediction.riskScore}%</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {prediction.riskFactors.map((f, i) => <span key={i} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-gray-400">⚠️ {f}</span>)}
      </div>
      {selected && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs mt-3 border-t border-white/10 pt-3">
          <div><div className="text-gray-500">Engagement</div><div className={`font-bold ${prediction.engagementScore < 50 ? 'text-red-400' : 'text-green-400'}`}>{prediction.engagementScore}%</div></div>
          <div><div className="text-gray-500">Perf Rating</div><div className="text-white font-bold">{prediction.performanceRating}/5</div></div>
          <div><div className="text-gray-500">Salary Growth</div><div className="text-white font-bold">{prediction.salaryGrowth}%</div></div>
          <div><div className="text-gray-500">Days Since Raise</div><div className={`font-bold ${prediction.daysSinceRaise > 400 ? 'text-red-400' : 'text-white'}`}>{prediction.daysSinceRaise}</div></div>
        </div>
      )}
    </div>
  );
};

const DiversityCard: React.FC<{ metric: DiversityMetric }> = ({ metric }) => (
  <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-white font-bold">{metric.label}</h3>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${metric.overallScore >= 70 ? 'text-green-400' : metric.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{metric.overallScore}/100</span>
        <span className={`text-[10px] ${metric.trend === 'improving' ? 'text-green-400' : metric.trend === 'declining' ? 'text-red-400' : 'text-gray-400'}`}>
          {metric.trend === 'improving' ? '↑' : metric.trend === 'declining' ? '↓' : '→'} {metric.yearOverYear > 0 ? '+' : ''}{metric.yearOverYear}% YoY
        </span>
      </div>
    </div>
    <div className="space-y-3">
      {metric.categories.map((cat) => (
        <div key={cat.name}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">{cat.name}</span>
            <span className="text-white">{cat.count} ({cat.percentage}%)</span>
          </div>
          <div className="relative w-full bg-white/10 rounded-full h-3">
            <div className="absolute h-3 rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
            <div className="absolute h-3 w-0.5 bg-white/50" style={{ left: `${cat.target}%` }} title={`Target: ${cat.target}%`} />
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Target: {cat.target}%</div>
        </div>
      ))}
    </div>
  </div>
);

const PlanCard: React.FC<{ plan: WorkforcePlan; selected: boolean; onSelect: () => void }> = ({ plan, selected, onSelect }) => {
  const deptCfg = DEPT_CONFIG[plan.department];
  const statusConfig: Record<string, { color: string; bg: string; label: string }> = { on_track: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'On Track' }, at_risk: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'At Risk' }, behind: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Behind' }, completed: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Completed' } };
  const sc = statusConfig[plan.status];
  const progress = (plan.currentHeadcount / plan.headcountTarget) * 100;
  const budgetProgress = (plan.budgetSpent / plan.budgetAllocated) * 100;
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{deptCfg.icon}</span>
          <span className="font-semibold text-white text-sm">{plan.title}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
      </div>
      <div className="text-xs text-gray-400 mb-2">{plan.timeline} · {plan.department}</div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <div className="flex justify-between mb-0.5"><span className="text-gray-500">Headcount</span><span className="text-white">{plan.currentHeadcount}/{plan.headcountTarget}</span></div>
          <div className="w-full bg-white/10 rounded-full h-2"><div className="bg-cyan-400 h-2 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
        </div>
        <div>
          <div className="flex justify-between mb-0.5"><span className="text-gray-500">Budget</span><span className="text-white">{fmt(plan.budgetSpent)}/{fmt(plan.budgetAllocated)}</span></div>
          <div className="w-full bg-white/10 rounded-full h-2"><div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min(budgetProgress, 100)}%` }} /></div>
        </div>
      </div>
      {selected && (
        <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
          {plan.milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {m.completed ? <CheckCircle2 size={12} className="text-green-400" /> : <CircleDot size={12} className="text-gray-500" />}
              <span className={m.completed ? 'text-gray-400 line-through' : 'text-white'}>{m.label}</span>
              <span className="text-[10px] text-gray-500 ml-auto">{m.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InsightCard: React.FC<{ insight: WorkforceInsight }> = ({ insight }) => {
  const typeColors: Record<string, string> = { alert: 'border-red-400/30 bg-red-500/5', opportunity: 'border-green-400/30 bg-green-500/5', trend: 'border-orange-400/30 bg-orange-500/5', recommendation: 'border-purple-400/30 bg-purple-500/5', achievement: 'border-yellow-400/30 bg-yellow-500/5' };
  return (
    <div className={`rounded-xl p-3 border ${typeColors[insight.type]} flex items-start gap-3`}>
      <span className={insight.color}>{insight.icon}</span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-white">{insight.title}</div>
        <div className="text-xs text-gray-400">{insight.description}</div>
        <div className="text-[10px] text-gray-500 mt-1">Impact: {insight.impact}</div>
      </div>
    </div>
  );
};

function CircleDot({ size, className }: { size: number; className?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>; }

/* ─────────────── Main Component ─────────────── */

export default function WorkforceAnalyticsDashboardPage() {
  const [activeTab, setActiveTab] = useState<'headcount' | 'turnover' | 'diversity' | 'planning' | 'insights'>('headcount');
  const [selectedDept, setSelectedDept] = useState<HeadcountMetric | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<TurnoverPrediction | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkforcePlan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<TurnoverRisk | 'all'>('all');

  const stats = useMemo(() => {
    const totalHeadcount = HEADCOUNT.reduce((s, h) => s + h.totalHeadcount, 0);
    const totalOpenRoles = HEADCOUNT.reduce((s, h) => s + h.openRoles, 0);
    const avgAttrition = HEADCOUNT.reduce((s, h) => s + h.attritionRate, 0) / HEADCOUNT.length;
    const criticalRisks = TURNOVER_PREDICTIONS.filter((p) => p.riskLevel === 'critical' || p.riskLevel === 'high').length;
    const avgDiversity = DIVERSITY.reduce((s, d) => s + d.overallScore, 0) / DIVERSITY.length;
    return { totalHeadcount, totalOpenRoles, avgAttrition: avgAttrition.toFixed(1), criticalRisks, avgDiversity: Math.round(avgDiversity) };
  }, []);

  const filteredPredictions = useMemo(() => {
    let result = [...TURNOVER_PREDICTIONS];
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter((p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)); }
    if (filterRisk !== 'all') result = result.filter((p) => p.riskLevel === filterRisk);
    return result.sort((a, b) => b.riskScore - a.riskScore);
  }, [searchQuery, filterRisk]);

  const tabs = [
    { id: 'headcount' as const, label: 'Headcount', icon: <Users size={14} /> },
    { id: 'turnover' as const, label: 'Turnover Risk', icon: <UserMinus size={14} /> },
    { id: 'diversity' as const, label: 'Diversity', icon: <Globe size={14} /> },
    { id: 'planning' as const, label: 'Workforce Plan', icon: <Workflow size={14} /> },
    { id: 'insights' as const, label: 'Insights', icon: <Sparkles size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">Workforce Analytics</h1>
                <p className="text-blue-300/60 text-sm">Headcount · Turnover · Diversity · Planning</p>
              </div>
            </div>
            <button className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20 transition border border-white/10">
              <Download size={14} />Export Report
            </button>
          </div>
        </header>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={<Users size={18} />} label="Total Headcount" value={stats.totalHeadcount} color="text-blue-400" trend="+27 this quarter" trendUp />
          <KpiCard icon={<UserPlus size={18} />} label="Open Roles" value={stats.totalOpenRoles} color="text-yellow-400" />
          <KpiCard icon={<UserMinus size={18} />} label="Avg Attrition" value={`${stats.avgAttrition}%`} color={Number(stats.avgAttrition) > 12 ? 'text-red-400' : 'text-green-400'} />
          <KpiCard icon={<AlertTriangle size={18} />} label="High Risk" value={stats.criticalRisks} sub="turnover risks" color="text-orange-400" />
          <KpiCard icon={<Globe size={18} />} label="Diversity" value={`${stats.avgDiversity}/100`} color="text-purple-400" trend="+2.5 YoY" trendUp />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Headcount Tab */}
        {activeTab === 'headcount' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {HEADCOUNT.map((h) => <DeptCard key={h.department} metric={h} selected={selectedDept?.department === h.department} onSelect={() => setSelectedDept(h)} />)}
          </div>
        )}

        {/* Turnover Tab */}
        {activeTab === 'turnover' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input type="text" placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
              </div>
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Risk Levels</option>
                {Object.entries(RISK_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              {filteredPredictions.map((p) => <TurnoverRow key={p.employeeId} prediction={p} selected={selectedPrediction?.employeeId === p.employeeId} onSelect={() => setSelectedPrediction(p)} />)}
            </div>
          </div>
        )}

        {/* Diversity Tab */}
        {activeTab === 'diversity' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DIVERSITY.map((d) => <DiversityCard key={d.dimension} metric={d} />)}
          </div>
        )}

        {/* Planning Tab */}
        {activeTab === 'planning' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {WORKFORCE_PLANS.map((p) => <PlanCard key={p.id} plan={p} selected={selectedPlan?.id === p.id} onSelect={() => setSelectedPlan(p)} />)}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-3 max-w-3xl">
            <h2 className="text-lg font-bold text-white">Workforce Insights</h2>
            {WORKFORCE_INSIGHTS.sort((a, b) => a.priority - b.priority).map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        )}
      </div>
    </div>
  );
}
