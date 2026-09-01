import React, { useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Users, Target,
  Award, Shield, Search, Filter, ChevronDown, ChevronUp, ArrowUpRight,
  ArrowDownRight, CheckCircle2, XCircle, AlertTriangle, Clock, Globe,
  MapPin, Briefcase, GraduationCap, Star, Sparkles, Download, RefreshCw,
  Eye, EyeOff, Info, Zap, Heart, Flame, Crown, Medal, Calculator,
  CreditCard, Wallet, PiggyBank, Receipt, Scale, Building2, Landmark,
  Banknote, Coins, Percent, Hash, ArrowRight, ExternalLink, Bookmark,
  Share2, Settings, Bell, Lightbulb, Brain, Rocket, Flag, Compass,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */

type PayBandLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director' | 'vp';
type CompensationType = 'base' | 'bonus' | 'equity' | 'benefits' | 'total';
type MarketSource = 'glassdoor' | 'levels_fyi' | 'payscale' | 'linkedin' | 'bls';
type EquityRisk = 'low' | 'moderate' | 'high' | 'critical';
type Region = 'us_tech' | 'us_nontech' | 'uk' | 'eu' | 'india' | 'remote_global';

interface SalaryBenchmark {
  id: string;
  title: string;
  level: PayBandLevel;
  department: string;
  region: Region;
  baseSalary: number;
  baseLow: number;
  baseHigh: number;
  bonusPercent: number;
  equityAnnual: number;
  benefitsValue: number;
  totalComp: number;
  marketPercentile: number;
  ourPosition: 'below' | 'at' | 'above';
  employeesInBand: number;
  lastUpdated: string;
  sources: MarketSource[];
  trend: 'rising' | 'stable' | 'declining';
  yearOverYear: number;
}

interface CompensationBand {
  id: string;
  level: PayBandLevel;
  title: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  spread: number;
  employees: number;
  avgTenure: number;
  avgPerformance: number;
  promotionRate: number;
  color: string;
}

interface PayEquityRecord {
  id: string;
  role: string;
  department: string;
  totalEmployees: number;
  maleAvg: number;
  femaleAvg: number;
  nonBinaryAvg: number;
  gapPercent: number;
  gapSignificance: 'significant' | 'marginal' | 'none';
  riskLevel: EquityRisk;
  lastAudit: string;
  recommendations: string[];
}

interface TotalRewardsStatement {
  employeeName: string;
  role: string;
  baseSalary: number;
  bonusTarget: number;
  bonusActual: number;
  equityGrant: number;
  equityVesting: string;
  healthInsurance: number;
  dentalVision: number;
  retirement401k: number;
  retirementMatch: number;
  ptoValue: number;
  learningBudget: number;
  wellnessBenefit: number;
  commuterBenefit: number;
  otherBenefits: number;
  totalRewards: number;
  year: number;
}

interface CompensationInsight {
  id: string;
  type: 'alert' | 'opportunity' | 'benchmark' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: string;
  priority: number;
  icon: React.ReactNode;
  color: string;
}

/* ─────────────── Constants ─────────────── */

const LEVEL_CONFIG: Record<PayBandLevel, { color: string; bg: string; label: string; icon: string }> = {
  junior: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Junior', icon: '🌱' },
  mid: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Mid-Level', icon: '🌿' },
  senior: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Senior', icon: '🌳' },
  lead: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Lead', icon: '⭐' },
  principal: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Principal', icon: '🏆' },
  director: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Director', icon: '👑' },
  vp: { color: 'text-pink-400', bg: 'bg-pink-500/20', label: 'VP', icon: '💎' },
};

const REGION_CONFIG: Record<Region, { label: string; currency: string; multiplier: number }> = {
  us_tech: { label: 'US Tech Hub', currency: '$', multiplier: 1.0 },
  us_nontech: { label: 'US Non-Tech', currency: '$', multiplier: 0.82 },
  uk: { label: 'United Kingdom', currency: '£', multiplier: 0.78 },
  eu: { label: 'European Union', currency: '€', multiplier: 0.85 },
  india: { label: 'India', currency: '₹', multiplier: 0.35 },
  remote_global: { label: 'Remote (Global)', currency: '$', multiplier: 0.75 },
};

const RISK_CONFIG: Record<EquityRisk, { color: string; bg: string; label: string }> = {
  low: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Low Risk' },
  moderate: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Moderate' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'High Risk' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Critical' },
};

const fmt = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

/* ─────────────── Sample Data ─────────────── */

const BENCHMARKS: SalaryBenchmark[] = [
  { id: 'sb1', title: 'Software Engineer', level: 'mid', department: 'Engineering', region: 'us_tech', baseSalary: 145000, baseLow: 125000, baseHigh: 168000, bonusPercent: 15, equityAnnual: 40000, benefitsValue: 25000, totalComp: 231750, marketPercentile: 72, ourPosition: 'above', employeesInBand: 45, lastUpdated: '2026-08-15', sources: ['levels_fyi', 'glassdoor'], trend: 'rising', yearOverYear: 8.2 },
  { id: 'sb2', title: 'Senior Software Engineer', level: 'senior', department: 'Engineering', region: 'us_tech', baseSalary: 195000, baseLow: 170000, baseHigh: 225000, bonusPercent: 18, equityAnnual: 75000, benefitsValue: 28000, totalComp: 338100, marketPercentile: 68, ourPosition: 'at', employeesInBand: 28, lastUpdated: '2026-08-15', sources: ['levels_fyi', 'payscale'], trend: 'rising', yearOverYear: 6.5 },
  { id: 'sb3', title: 'Engineering Manager', level: 'lead', department: 'Engineering', region: 'us_tech', baseSalary: 215000, baseLow: 190000, baseHigh: 245000, bonusPercent: 20, equityAnnual: 95000, benefitsValue: 30000, totalComp: 383000, marketPercentile: 65, ourPosition: 'below', employeesInBand: 12, lastUpdated: '2026-08-10', sources: ['glassdoor', 'linkedin'], trend: 'stable', yearOverYear: 4.1 },
  { id: 'sb4', title: 'Product Designer', level: 'mid', department: 'Design', region: 'us_tech', baseSalary: 125000, baseLow: 108000, baseHigh: 145000, bonusPercent: 12, equityAnnual: 30000, benefitsValue: 24000, totalComp: 194000, marketPercentile: 75, ourPosition: 'above', employeesInBand: 8, lastUpdated: '2026-08-12', sources: ['glassdoor', 'payscale'], trend: 'rising', yearOverYear: 7.0 },
  { id: 'sb5', title: 'Data Scientist', level: 'senior', department: 'Data', region: 'us_tech', baseSalary: 180000, baseLow: 155000, baseHigh: 210000, bonusPercent: 15, equityAnnual: 60000, benefitsValue: 26000, totalComp: 294000, marketPercentile: 70, ourPosition: 'at', employeesInBand: 15, lastUpdated: '2026-08-14', sources: ['levels_fyi', 'linkedin'], trend: 'rising', yearOverYear: 9.3 },
  { id: 'sb6', title: 'DevOps Engineer', level: 'mid', department: 'Infrastructure', region: 'us_tech', baseSalary: 140000, baseLow: 120000, baseHigh: 162000, bonusPercent: 12, equityAnnual: 35000, benefitsValue: 25000, totalComp: 212800, marketPercentile: 66, ourPosition: 'at', employeesInBand: 10, lastUpdated: '2026-08-13', sources: ['glassdoor'], trend: 'rising', yearOverYear: 5.8 },
  { id: 'sb7', title: 'VP of Engineering', level: 'vp', department: 'Engineering', region: 'us_tech', baseSalary: 320000, baseLow: 280000, baseHigh: 380000, bonusPercent: 30, equityAnnual: 250000, benefitsValue: 45000, totalComp: 901000, marketPercentile: 62, ourPosition: 'below', employeesInBand: 3, lastUpdated: '2026-08-01', sources: ['levels_fyi', 'glassdoor', 'linkedin'], trend: 'stable', yearOverYear: 3.2 },
  { id: 'sb8', title: 'Frontend Developer', level: 'junior', department: 'Engineering', region: 'us_tech', baseSalary: 95000, baseLow: 80000, baseHigh: 112000, bonusPercent: 10, equityAnnual: 15000, benefitsValue: 22000, totalComp: 141500, marketPercentile: 78, ourPosition: 'above', employeesInBand: 18, lastUpdated: '2026-08-16', sources: ['glassdoor', 'payscale'], trend: 'rising', yearOverYear: 10.1 },
];

const BANDS: CompensationBand[] = [
  { id: 'b1', level: 'junior', title: 'Junior (L3-L4)', minSalary: 75000, midSalary: 95000, maxSalary: 115000, spread: 53, employees: 52, avgTenure: 1.2, avgPerformance: 3.4, promotionRate: 35, color: '#22c55e' },
  { id: 'b2', level: 'mid', title: 'Mid-Level (L5-L6)', minSalary: 115000, midSalary: 145000, maxSalary: 180000, spread: 56, employees: 78, avgTenure: 2.8, avgPerformance: 3.7, promotionRate: 28, color: '#3b82f6' },
  { id: 'b3', level: 'senior', title: 'Senior (L7-L8)', minSalary: 160000, midSalary: 195000, maxSalary: 240000, spread: 50, employees: 43, avgTenure: 3.5, avgPerformance: 3.9, promotionRate: 18, color: '#a855f7' },
  { id: 'b4', level: 'lead', title: 'Lead/Staff (L9)', minSalary: 195000, midSalary: 230000, maxSalary: 275000, spread: 43, employees: 15, avgTenure: 4.2, avgPerformance: 4.1, promotionRate: 12, color: '#f97316' },
  { id: 'b5', level: 'principal', title: 'Principal (L10)', minSalary: 240000, midSalary: 285000, maxSalary: 340000, spread: 41, employees: 6, avgTenure: 5.1, avgPerformance: 4.3, promotionRate: 8, color: '#eab308' },
  { id: 'b6', level: 'director', title: 'Director (L11)', minSalary: 280000, midSalary: 330000, maxSalary: 400000, spread: 43, employees: 5, avgTenure: 4.8, avgPerformance: 4.2, promotionRate: 5, color: '#ef4444' },
  { id: 'b7', level: 'vp', title: 'VP (L12+)', minSalary: 320000, midSalary: 400000, maxSalary: 520000, spread: 62, employees: 2, avgTenure: 6.0, avgPerformance: 4.5, promotionRate: 0, color: '#ec4899' },
];

const PAY_EQUITY: PayEquityRecord[] = [
  { id: 'pe1', role: 'Software Engineer', department: 'Engineering', totalEmployees: 45, maleAvg: 148000, femaleAvg: 143000, nonBinaryAvg: 146000, gapPercent: 3.4, gapSignificance: 'marginal', riskLevel: 'low', lastAudit: '2026-07-01', recommendations: ['Monitor quarterly', 'Review promotion rates by gender'] },
  { id: 'pe2', role: 'Senior Engineer', department: 'Engineering', totalEmployees: 28, maleAvg: 200000, femaleAvg: 188000, nonBinaryAvg: 195000, gapPercent: 6.0, gapSignificance: 'significant', riskLevel: 'moderate', lastAudit: '2026-07-01', recommendations: ['Conduct individual pay reviews', 'Adjust below-band salaries', 'Review equity grant distribution'] },
  { id: 'pe3', role: 'Product Designer', department: 'Design', totalEmployees: 8, maleAvg: 128000, femaleAvg: 126000, nonBinaryAvg: 0, gapPercent: 1.6, gapSignificance: 'none', riskLevel: 'low', lastAudit: '2026-07-01', recommendations: ['Continue monitoring'] },
  { id: 'pe4', role: 'Engineering Manager', department: 'Engineering', totalEmployees: 12, maleAvg: 220000, femaleAvg: 205000, nonBinaryAvg: 0, gapPercent: 6.8, gapSignificance: 'significant', riskLevel: 'high', lastAudit: '2026-06-01', recommendations: ['Immediate pay adjustment for affected employees', 'Review hiring offers', 'Conduct bias training for hiring managers'] },
  { id: 'pe5', role: 'Data Scientist', department: 'Data', totalEmployees: 15, maleAvg: 182000, femaleAvg: 178000, nonBinaryAvg: 180000, gapPercent: 2.2, gapSignificance: 'marginal', riskLevel: 'low', lastAudit: '2026-07-01', recommendations: ['Monitor quarterly'] },
];

const TOTAL_REWARDS: TotalRewardsStatement = {
  employeeName: 'Alex Chen', role: 'Senior Software Engineer',
  baseSalary: 195000, bonusTarget: 35100, bonusActual: 38500,
  equityGrant: 75000, equityVesting: '4-year cliff, 1-year cliff',
  healthInsurance: 12000, dentalVision: 2400, retirement401k: 8000,
  retirementMatch: 9750, ptoValue: 15600, learningBudget: 5000,
  wellnessBenefit: 1200, commuterBenefit: 3000, otherBenefits: 2500,
  totalRewards: 376050, year: 2026,
};

const INSIGHTS: CompensationInsight[] = [
  { id: 'i1', type: 'alert', title: 'Engineering Manager Band Below Market', description: 'EM salaries are at the 65th percentile vs. 75th target. 3 of 12 are below band minimum.', impact: '$45K annual adjustment needed', priority: 1, icon: <AlertTriangle size={16} />, color: 'text-red-400' },
  { id: 'i2', type: 'opportunity', title: 'Pay Equity Gap in Senior Engineering', description: 'Female senior engineers earn 6% less than male counterparts. Statistical significance confirmed.', impact: 'Legal and retention risk', priority: 2, icon: <Scale size={16} />, color: 'text-orange-400' },
  { id: 'i3', type: 'benchmark', title: 'Data Scientist Compensation Rising Fast', description: 'Market rate for senior data scientists increased 9.3% YoY. Current comp is at 70th percentile.', impact: 'Budget impact: +$27K avg', priority: 3, icon: <TrendingUp size={16} />, color: 'text-cyan-400' },
  { id: 'i4', type: 'trend', title: 'Junior Developer Salaries Surging', description: 'Entry-level salaries rose 10.1% YoY — fastest growing band. Strong candidate market.', impact: 'New hire cost up 10%', priority: 4, icon: <Rocket size={16} />, color: 'text-purple-400' },
  { id: 'i5', type: 'recommendation', title: 'Consider Geographic Pay Differentials', description: 'Remote engineers in lower-cost regions could save 25-35% while maintaining quality.', impact: '$1.2M potential savings', priority: 5, icon: <Globe size={16} />, color: 'text-green-400' },
];

/* ─────────────── Sub-Components ─────────────── */

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string; trend?: string; trendUp?: boolean }> = ({ icon, label, value, sub, color = 'text-white', trend, trendUp }) => (
  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
    <div className="flex items-center gap-2 mb-2">
      <span className={color}>{icon}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    {trend && <div className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? 'text-green-400' : 'text-red-400'}`}>{trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{trend}</div>}
  </div>
);

const BenchmarkCard: React.FC<{ benchmark: SalaryBenchmark; selected: boolean; onSelect: () => void }> = ({ benchmark, selected, onSelect }) => {
  const lvlCfg = LEVEL_CONFIG[benchmark.level];
  const posColor = benchmark.ourPosition === 'above' ? 'text-green-400' : benchmark.ourPosition === 'at' ? 'text-yellow-400' : 'text-red-400';
  const posLabel = benchmark.ourPosition === 'above' ? 'Above Market' : benchmark.ourPosition === 'at' ? 'At Market' : 'Below Market';
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{lvlCfg.icon}</span>
          <span className="font-semibold text-white text-sm">{benchmark.title}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${lvlCfg.bg} ${lvlCfg.color}`}>{lvlCfg.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Base</div><div className="text-white font-bold">{fmt(benchmark.baseSalary)}</div></div>
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Bonus</div><div className="text-white font-bold">{benchmark.bonusPercent}%</div></div>
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Equity</div><div className="text-white font-bold">{fmt(benchmark.equityAnnual)}</div></div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Market:</span>
          <span className="text-sm font-bold text-cyan-400">{benchmark.marketPercentile}th</span>
        </div>
        <span className={`text-[10px] font-semibold ${posColor}`}>{posLabel}</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2 mb-2">
        <div className="bg-cyan-400 h-2 rounded-full" style={{ width: `${benchmark.marketPercentile}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><Users size={10} />{benchmark.employeesInBand} employees</span>
        <span className={`flex items-center gap-1 ${benchmark.trend === 'rising' ? 'text-green-400' : benchmark.trend === 'declining' ? 'text-red-400' : 'text-gray-400'}`}>
          {benchmark.trend === 'rising' ? <TrendingUp size={10} /> : benchmark.trend === 'declining' ? <TrendingDown size={10} /> : '→'}
          {benchmark.yearOverYear > 0 ? '+' : ''}{benchmark.yearOverYear}% YoY
        </span>
      </div>
    </div>
  );
};

const BandVisualization: React.FC<{ bands: CompensationBand[] }> = ({ bands }) => {
  const maxSalary = Math.max(...bands.map((b) => b.maxSalary));
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-cyan-400" />Compensation Bands</h3>
      <div className="space-y-3">
        {bands.map((band) => {
          const lvlCfg = LEVEL_CONFIG[band.level];
          const minPct = (band.minSalary / maxSalary) * 100;
          const maxPct = (band.maxSalary / maxSalary) * 100;
          const midPct = (band.midSalary / maxSalary) * 100;
          return (
            <div key={band.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`flex items-center gap-1 ${lvlCfg.color}`}><span>{LEVEL_CONFIG[band.level].icon}</span>{band.title}</span>
                <span className="text-gray-400">{band.employees} employees</span>
              </div>
              <div className="relative h-8 bg-white/5 rounded-lg overflow-hidden">
                <div className="absolute h-full rounded-lg opacity-30" style={{ left: `${minPct}%`, width: `${maxPct - minPct}%`, backgroundColor: band.color }} />
                <div className="absolute h-full w-0.5 bg-white" style={{ left: `${midPct}%` }} />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px]">
                  <span className="text-gray-400">{fmt(band.minSalary)}</span>
                  <span className="text-white font-bold">{fmt(band.midSalary)}</span>
                  <span className="text-gray-400">{fmt(band.maxSalary)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PayEquityRow: React.FC<{ record: PayEquityRecord }> = ({ record }) => {
  const riskCfg = RISK_CONFIG[record.riskLevel];
  return (
    <div className={`rounded-xl p-4 border transition-all ${record.riskLevel === 'critical' ? 'border-red-400/30 bg-red-500/5' : record.riskLevel === 'high' ? 'border-orange-400/30 bg-orange-500/5' : 'border-white/10 bg-white/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold text-white text-sm">{record.role}</span>
          <span className="text-xs text-gray-500 ml-2">{record.department}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>{riskCfg.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Male Avg</div><div className="text-white font-bold">{fmt(record.maleAvg)}</div></div>
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Female Avg</div><div className="text-white font-bold">{fmt(record.femaleAvg)}</div></div>
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Non-Binary</div><div className="text-white font-bold">{record.nonBinaryAvg > 0 ? fmt(record.nonBinaryAvg) : '—'}</div></div>
        <div className="bg-white/5 rounded-lg p-2"><div className="text-gray-500">Gap</div><div className={`font-bold ${record.gapPercent > 5 ? 'text-red-400' : record.gapPercent > 3 ? 'text-yellow-400' : 'text-green-400'}`}>{record.gapPercent}%</div></div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${record.gapSignificance === 'significant' ? 'bg-red-500/20 text-red-400' : record.gapSignificance === 'marginal' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
          {record.gapSignificance === 'significant' ? '⚠️ Significant' : record.gapSignificance === 'marginal' ? '~ Marginal' : '✓ No gap'}
        </span>
        <span className="text-[10px] text-gray-500">{record.totalEmployees} employees · Audited {record.lastAudit}</span>
      </div>
    </div>
  );
};

const TotalRewardsCard: React.FC<{ statement: TotalRewardsStatement }> = ({ statement }) => {
  const sections = [
    { label: 'Base Salary', value: statement.baseSalary, color: 'bg-blue-500', icon: <DollarSign size={14} /> },
    { label: 'Bonus', value: statement.bonusActual, color: 'bg-green-500', icon: <Award size={14} /> },
    { label: 'Equity', value: statement.equityGrant, color: 'bg-purple-500', icon: <TrendingUp size={14} /> },
    { label: 'Health & Dental', value: statement.healthInsurance + statement.dentalVision, color: 'bg-pink-500', icon: <Heart size={14} /> },
    { label: 'Retirement', value: statement.retirement401k + statement.retirementMatch, color: 'bg-cyan-500', icon: <PiggyBank size={14} /> },
    { label: 'PTO Value', value: statement.ptoValue, color: 'bg-yellow-500', icon: <Clock size={14} /> },
    { label: 'Other Benefits', value: statement.learningBudget + statement.wellnessBenefit + statement.commuterBenefit + statement.otherBenefits, color: 'bg-orange-500', icon: <Star size={14} /> },
  ];
  const total = sections.reduce((s, sec) => s + sec.value, 0);
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold">{statement.employeeName}</h3>
          <p className="text-xs text-gray-400">{statement.role} · {statement.year}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">{fmt(statement.totalRewards)}</div>
          <div className="text-[10px] text-gray-500">Total Compensation</div>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        {sections.map((sec) => (
          <div key={sec.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-gray-400">{sec.icon}{sec.label}</span>
              <span className="text-white font-bold">{fmt(sec.value)}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className={`${sec.color} h-2 rounded-full`} style={{ width: `${(sec.value / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 pt-3 flex items-center justify-between">
        <span className="text-sm text-gray-400">Total Rewards Value</span>
        <span className="text-lg font-bold text-green-400">{fmt(total)}</span>
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ insight: CompensationInsight }> = ({ insight }) => {
  const typeColors: Record<string, string> = { alert: 'border-red-400/30 bg-red-500/5', opportunity: 'border-orange-400/30 bg-orange-500/5', benchmark: 'border-cyan-400/30 bg-cyan-500/5', trend: 'border-purple-400/30 bg-purple-500/5', recommendation: 'border-green-400/30 bg-green-500/5' };
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

/* ─────────────── Main Component ─────────────── */

export default function CompensationIntelligencePage() {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'bands' | 'equity' | 'rewards' | 'insights'>('benchmarks');
  const [selectedBenchmark, setSelectedBenchmark] = useState<SalaryBenchmark | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<PayBandLevel | 'all'>('all');
  const [filterRegion, setFilterRegion] = useState<Region | 'all'>('all');
  const [selectedReward, setSelectedReward] = useState<TotalRewardsStatement | null>(TOTAL_REWARDS);

  const filteredBenchmarks = useMemo(() => {
    let result = [...BENCHMARKS];
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter((b) => b.title.toLowerCase().includes(q) || b.department.toLowerCase().includes(q)); }
    if (filterLevel !== 'all') result = result.filter((b) => b.level === filterLevel);
    if (filterRegion !== 'all') result = result.filter((b) => b.region === filterRegion);
    return result;
  }, [searchQuery, filterLevel, filterRegion]);

  const stats = useMemo(() => {
    const avgTotal = BENCHMARKS.reduce((s, b) => s + b.totalComp, 0) / BENCHMARKS.length;
    const avgPercentile = BENCHMARKS.reduce((s, b) => s + b.marketPercentile, 0) / BENCHMARKS.length;
    const belowMarket = BENCHMARKS.filter((b) => b.ourPosition === 'below').length;
    const totalEmployees = BANDS.reduce((s, b) => s + b.employees, 0);
    return { avgTotal, avgPercentile, belowMarket, totalEmployees };
  }, []);

  const tabs = [
    { id: 'benchmarks' as const, label: 'Market Benchmarks', icon: <BarChart3 size={14} /> },
    { id: 'bands' as const, label: 'Comp Bands', icon: <Layers size={14} /> },
    { id: 'equity' as const, label: 'Pay Equity', icon: <Scale size={14} /> },
    { id: 'rewards' as const, label: 'Total Rewards', icon: <Gift size={14} /> },
    { id: 'insights' as const, label: 'Insights', icon: <Sparkles size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <Calculator size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">Compensation Intelligence</h1>
                <p className="text-emerald-300/60 text-sm">Market benchmarks · Pay equity · Total rewards</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20 transition border border-white/10">
                <Download size={14} />Export Report
              </button>
            </div>
          </div>
        </header>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={<DollarSign size={18} />} label="Avg Total Comp" value={fmt(stats.avgTotal)} color="text-emerald-400" trend="+6.8% YoY" trendUp />
          <KpiCard icon={<Target size={18} />} label="Market Position" value={`${Math.round(stats.avgPercentile)}th`} sub="avg percentile" color="text-cyan-400" />
          <KpiCard icon={<AlertTriangle size={18} />} label="Below Market" value={stats.belowMarket} sub="of 8 roles" color={stats.belowMarket > 0 ? 'text-red-400' : 'text-green-400'} />
          <KpiCard icon={<Users size={18} />} label="Total Headcount" value={stats.totalEmployees} sub="across all bands" color="text-blue-400" />
          <KpiCard icon={<Scale size={18} />} label="Equity Alerts" value={PAY_EQUITY.filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical').length} sub="high/critical risk" color="text-orange-400" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Benchmarks Tab */}
        {activeTab === 'benchmarks' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input type="text" placeholder="Search roles, departments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
              </div>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Levels</option>
                {Object.entries(LEVEL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Regions</option>
                {Object.entries(REGION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredBenchmarks.map((b) => <BenchmarkCard key={b.id} benchmark={b} selected={selectedBenchmark?.id === b.id} onSelect={() => setSelectedBenchmark(b)} />)}
            </div>
          </div>
        )}

        {/* Bands Tab */}
        {activeTab === 'bands' && <BandVisualization bands={BANDS} />}

        {/* Equity Tab */}
        {activeTab === 'equity' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Pay Equity Analysis</h2>
            {PAY_EQUITY.map((record) => <PayEquityRow key={record.id} record={record} />)}
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && selectedReward && <TotalRewardsCard statement={selectedReward} />}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-3 max-w-3xl">
            <h2 className="text-lg font-bold text-white">Compensation Insights</h2>
            {INSIGHTS.sort((a, b) => a.priority - b.priority).map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Layers({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>; }
function Scale({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><path d="M1 6l5 6 5-6" /><path d="M13 6l5 6 5-6" /><path d="M6 12l6 6 6-6" /></svg>; }
function Gift({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>; }
