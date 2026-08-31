import React, { useState, useMemo } from 'react';
import {
  Users, UserPlus, UserCheck, UserX, Gift, Trophy, Award, Star,
  TrendingUp, TrendingDown, BarChart3, Clock, Calendar, Search,
  Filter, ChevronDown, ChevronUp, ArrowUpRight, CheckCircle2, XCircle,
  AlertTriangle, Info, Sparkles, Download, RefreshCw, Eye, DollarSign,
  Target, Zap, Heart, Flame, Crown, Medal, Briefcase, MapPin, Globe,
  Share2, Copy, Mail, MessageCircle, Phone, ExternalLink, Bookmark,
  Bell, Settings, Plus, Hash, Award as AwardIcon, BadgeCheck,
  Coins, Wallet, CreditCard, PiggyBank, Receipt, Banknote, Landmark,
  ArrowRight, CircleDot, Flag, Compass, Timer, Hourglass, Repeat,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */

type ReferralStatus = 'submitted' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn';
type ReferralTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
type RewardType = 'cash' | 'gift_card' | 'extra_pto' | 'experience' | 'charity_donation';
type Department = 'engineering' | 'product' | 'design' | 'marketing' | 'sales' | 'hr' | 'finance';

interface Referral {
  id: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  department: Department;
  status: ReferralStatus;
  submittedAt: string;
  lastUpdated: string;
  referrerName: string;
  notes: string;
  resumeUrl: string | null;
  interviewDate: string | null;
  feedback: string;
  reward: number;
  rewardClaimed: boolean;
}

interface ReferralReward {
  id: string;
  type: RewardType;
  title: string;
  description: string;
  value: number;
  icon: React.ReactNode;
  earned: boolean;
  earnedDate: string | null;
  requirement: string;
  tier: ReferralTier;
}

interface ReferralLeaderboard {
  rank: number;
  name: string;
  avatar: string;
  department: string;
  referrals: number;
  hired: number;
  conversionRate: number;
  totalEarned: number;
  tier: ReferralTier;
  streak: number;
}

interface ReferralStats {
  totalReferrals: number;
  hiredThisQuarter: number;
  pendingReferrals: number;
  totalEarned: number;
  avgTimeToHire: number;
  conversionRate: number;
  topDepartment: string;
  rank: number;
  totalEmployees: number;
  tier: ReferralTier;
  tierProgress: number;
  nextTier: ReferralTier | null;
}

interface ReferralInsight {
  id: string;
  type: 'tip' | 'achievement' | 'opportunity' | 'alert' | 'trend';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  priority: number;
}

/* ─────────────── Constants ─────────────── */

const STATUS_CONFIG: Record<ReferralStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  submitted: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <Clock size={14} />, label: 'Submitted' },
  screening: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <Eye size={14} />, label: 'Screening' },
  interview: { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: <Users size={14} />, label: 'Interview' },
  offer: { color: 'text-green-400', bg: 'bg-green-500/20', icon: <Briefcase size={14} />, label: 'Offer' },
  hired: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: <UserCheck size={14} />, label: 'Hired' },
  rejected: { color: 'text-red-400', bg: 'bg-red-500/20', icon: <UserX size={14} />, label: 'Rejected' },
  withdrawn: { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: <XCircle size={14} />, label: 'Withdrawn' },
};

const TIER_CONFIG: Record<ReferralTier, { color: string; bg: string; label: string; icon: string; minReferrals: number }> = {
  bronze: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Bronze', icon: '🥉', minReferrals: 1 },
  silver: { color: 'text-gray-300', bg: 'bg-gray-400/20', label: 'Silver', icon: '🥈', minReferrals: 5 },
  gold: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Gold', icon: '🥇', minReferrals: 10 },
  platinum: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Platinum', icon: '💎', minReferrals: 20 },
  diamond: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Diamond', icon: '👑', minReferrals: 50 },
};

const DEPT_CONFIG: Record<Department, { color: string; label: string }> = {
  engineering: { color: 'text-blue-400', label: 'Engineering' },
  product: { color: 'text-purple-400', label: 'Product' },
  design: { color: 'text-pink-400', label: 'Design' },
  marketing: { color: 'text-orange-400', label: 'Marketing' },
  sales: { color: 'text-green-400', label: 'Sales' },
  hr: { color: 'text-cyan-400', label: 'HR' },
  finance: { color: 'text-yellow-400', label: 'Finance' },
};

const fmt = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
};

/* ─────────────── Sample Data ─────────────── */

const REFERRALS: Referral[] = [
  { id: 'r1', candidateName: 'Emily Zhang', candidateEmail: 'emily@example.com', position: 'Senior Frontend Engineer', department: 'engineering', status: 'hired', submittedAt: '2026-07-15', lastUpdated: '2026-08-20', referrerName: 'You', notes: 'Former colleague, strong React skills', resumeUrl: '#', interviewDate: '2026-08-01', feedback: 'Excellent technical skills and culture fit', reward: 3000, rewardClaimed: true },
  { id: 'r2', candidateName: 'Marcus Johnson', candidateEmail: 'marcus@example.com', position: 'Product Manager', department: 'product', status: 'interview', submittedAt: '2026-08-10', lastUpdated: '2026-08-28', referrerName: 'You', notes: 'Met at tech conference, experienced PM', resumeUrl: '#', interviewDate: '2026-09-02', feedback: '', reward: 2500, rewardClaimed: false },
  { id: 'r3', candidateName: 'Priya Patel', candidateEmail: 'priya@example.com', position: 'UX Designer', department: 'design', status: 'screening', submittedAt: '2026-08-25', lastUpdated: '2026-08-27', referrerName: 'You', notes: 'Strong portfolio, 5 years experience', resumeUrl: '#', interviewDate: null, feedback: '', reward: 2000, rewardClaimed: false },
  { id: 'r4', candidateName: 'David Kim', candidateEmail: 'david@example.com', position: 'Backend Engineer', department: 'engineering', status: 'offer', submittedAt: '2026-06-20', lastUpdated: '2026-08-29', referrerName: 'You', notes: 'Former teammate, Go expert', resumeUrl: '#', interviewDate: '2026-08-15', feedback: 'Outstanding system design skills', reward: 3000, rewardClaimed: false },
  { id: 'r5', candidateName: 'Sarah Williams', candidateEmail: 'sarah@example.com', position: 'Marketing Manager', department: 'marketing', status: 'rejected', submittedAt: '2026-07-01', lastUpdated: '2026-07-20', referrerName: 'You', notes: 'LinkedIn connection', resumeUrl: '#', interviewDate: '2026-07-10', feedback: 'Good experience but not the right fit for growth stage', reward: 0, rewardClaimed: false },
  { id: 'r6', candidateName: 'Alex Rivera', candidateEmail: 'alex@example.com', position: 'Sales Executive', department: 'sales', status: 'submitted', submittedAt: '2026-08-29', lastUpdated: '2026-08-29', referrerName: 'You', notes: 'Referred by Emily Zhang', resumeUrl: null, interviewDate: null, feedback: '', reward: 1500, rewardClaimed: false },
];

const REWARDS: ReferralReward[] = [
  { id: 'rw1', type: 'cash', title: 'First Referral Bonus', description: 'Earned your first referral bonus for a successful hire', value: 3000, icon: <DollarSign size={16} />, earned: true, earnedDate: '2026-08-20', requirement: '1 successful hire', tier: 'bronze' },
  { id: 'rw2', type: 'gift_card', title: 'Referral Streak', description: 'Submitted 3 referrals in a single month', value: 100, icon: <Flame size={16} />, earned: true, earnedDate: '2026-08-15', requirement: '3 referrals in 1 month', tier: 'bronze' },
  { id: 'rw3', type: 'extra_pto', title: 'Silver Referrer', description: 'Reached Silver tier with 5+ referrals', value: 500, icon: <Award size={16} />, earned: false, earnedDate: null, requirement: '5 total referrals', tier: 'silver' },
  { id: 'rw4', type: 'experience', title: 'Gold Referrer', description: 'Reached Gold tier with 10+ referrals', value: 1000, icon: <Crown size={16} />, earned: false, earnedDate: null, requirement: '10 total referrals', tier: 'gold' },
  { id: 'rw5', type: 'charity_donation', title: 'Referral Champion', description: 'Had 5 successful hires in one quarter', value: 2000, icon: <Heart size={16} />, earned: false, earnedDate: null, requirement: '5 hires in 1 quarter', tier: 'platinum' },
  { id: 'rw6', type: 'cash', title: 'Department Top Referrer', description: 'Top referrer in your department for the quarter', value: 500, icon: <Trophy size={16} />, earned: true, earnedDate: '2026-06-30', requirement: '#1 in department', tier: 'bronze' },
];

const LEADERBOARD: ReferralLeaderboard[] = [
  { rank: 1, name: 'Alex Chen', avatar: '👨‍💻', department: 'Engineering', referrals: 12, hired: 5, conversionRate: 42, totalEarned: 15000, tier: 'gold', streak: 4 },
  { rank: 2, name: 'Sarah Kim', avatar: '👩‍🎨', department: 'Design', referrals: 8, hired: 4, conversionRate: 50, totalEarned: 12000, tier: 'gold', streak: 3 },
  { rank: 3, name: 'Marcus Lee', avatar: '🧑‍💼', department: 'Sales', referrals: 15, hired: 3, conversionRate: 20, totalEarned: 9000, tier: 'silver', streak: 2 },
  { rank: 4, name: 'Priya Sharma', avatar: '👩‍💻', department: 'Engineering', referrals: 6, hired: 3, conversionRate: 50, totalEarned: 9000, tier: 'silver', streak: 5 },
  { rank: 5, name: 'David Wilson', avatar: '🧑‍🔬', department: 'Product', referrals: 7, hired: 2, conversionRate: 29, totalEarned: 5000, tier: 'silver', streak: 1 },
];

const REFERRAL_STATS: ReferralStats = {
  totalReferrals: 6, hiredThisQuarter: 1, pendingReferrals: 4, totalEarned: 3500,
  avgTimeToHire: 35, conversionRate: 17, topDepartment: 'Engineering',
  rank: 18, totalEmployees: 340, tier: 'bronze', tierProgress: 60,
  nextTier: 'silver',
};

const REFERRAL_INSIGHTS: ReferralInsight[] = [
  { id: 'ri1', type: 'tip', title: 'Refer for Engineering Roles', description: 'Engineering has the highest conversion rate (42%). Your network has strong engineering talent.', icon: <Target size={16} />, color: 'text-blue-400', priority: 1 },
  { id: 'ri2', type: 'achievement', title: '$3,500 Earned!', description: 'You\'ve earned $3,500 from referrals this year. Keep it up!', icon: <DollarSign size={16} />, color: 'text-green-400', priority: 2 },
  { id: 'ri3', type: 'opportunity', title: 'Marcus Johnson Interview Soon', description: 'Your referral Marcus has an interview on Sep 2. A hire here earns you $2,500!', icon: <Calendar size={16} />, color: 'text-purple-400', priority: 3 },
  { id: 'ri4', type: 'trend', title: 'Referral Quality Improving', description: 'Your referral-to-hire conversion rate improved from 12% to 17% this quarter.', icon: <TrendingUp size={16} />, color: 'text-cyan-400', priority: 4 },
  { id: 'ri5', type: 'alert', title: 'David Kim Offer Pending', description: 'Your referral David has an offer pending. Follow up to ensure he accepts!', icon: <AlertTriangle size={16} />, color: 'text-yellow-400', priority: 5 },
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

const ReferralCard: React.FC<{ referral: Referral; selected: boolean; onSelect: () => void }> = ({ referral, selected, onSelect }) => {
  const statusCfg = STATUS_CONFIG[referral.status];
  const deptCfg = DEPT_CONFIG[referral.department];
  const daysAgo = Math.floor((Date.now() - new Date(referral.submittedAt).getTime()) / 86400000);
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold text-white text-sm">{referral.candidateName}</span>
          <div className="text-[10px] text-gray-500">{referral.candidateEmail}</div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">{referral.position}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${deptCfg.color} bg-white/5`}>{deptCfg.label}</span>
      </div>
      {referral.notes && <div className="text-xs text-gray-400 mb-2 italic">"{referral.notes}"</div>}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>{daysAgo}d ago</span>
        {referral.reward > 0 && <span className={`font-bold ${referral.rewardClaimed ? 'text-green-400' : 'text-yellow-400'}`}>{fmt(referral.reward)} {referral.rewardClaimed ? '✓' : ''}</span>}
      </div>
      {referral.interviewDate && (
        <div className="mt-2 text-[10px] text-purple-400 flex items-center gap-1">
          <Calendar size={10} />Interview: {referral.interviewDate}
        </div>
      )}
    </div>
  );
};

const LeaderboardRow: React.FC<{ entry: ReferralLeaderboard; isMe?: boolean }> = ({ entry, isMe }) => {
  const tierCfg = TIER_CONFIG[entry.tier];
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isMe ? 'border border-cyan-400/30 bg-cyan-500/10' : 'border border-white/10 bg-white/5 hover:bg-white/8'}`}>
      <div className="w-8 text-center">
        {entry.rank <= 3 ? <span className={`text-lg ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : 'text-orange-400'}`}>{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}</span> : <span className="text-sm text-gray-500">#{entry.rank}</span>}
      </div>
      <span className="text-xl">{entry.avatar}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{entry.name}</span>
          {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">You</span>}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tierCfg.bg} ${tierCfg.color}`}>{tierCfg.icon} {tierCfg.label}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{entry.referrals} referrals</span>
          <span>{entry.hired} hired</span>
          <span>{entry.conversionRate}% conversion</span>
          <span className="text-orange-400">🔥 {entry.streak}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-green-400">{fmt(entry.totalEarned)}</div>
      </div>
    </div>
  );
};

const RewardCard: React.FC<{ reward: ReferralReward }> = ({ reward }) => {
  const tierCfg = TIER_CONFIG[reward.tier];
  return (
    <div className={`rounded-xl p-4 border transition-all ${reward.earned ? 'border-green-400/30 bg-green-500/5' : 'border-white/10 bg-white/5 opacity-60'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${reward.earned ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-500'}`}>
          {reward.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${reward.earned ? 'text-white' : 'text-gray-400'}`}>{reward.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tierCfg.bg} ${tierCfg.color}`}>{tierCfg.icon} {tierCfg.label}</span>
          </div>
          <div className="text-xs text-gray-400">{reward.description}</div>
          {reward.earnedDate && <div className="text-[10px] text-gray-500">Earned {reward.earnedDate}</div>}
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold ${reward.earned ? 'text-green-400' : 'text-gray-500'}`}>{fmt(reward.value)}</div>
          <div className="text-[10px] text-gray-500">{reward.requirement}</div>
        </div>
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ insight: ReferralInsight }> = ({ insight }) => {
  const typeColors: Record<string, string> = { tip: 'border-blue-400/30 bg-blue-500/5', achievement: 'border-green-400/30 bg-green-500/5', opportunity: 'border-purple-400/30 bg-purple-500/5', alert: 'border-yellow-400/30 bg-yellow-500/5', trend: 'border-cyan-400/30 bg-cyan-500/5' };
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

export default function EmployeeReferralProgramPage() {
  const [activeTab, setActiveTab] = useState<'referrals' | 'leaderboard' | 'rewards' | 'insights'>('referrals');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReferralStatus | 'all'>('all');
  const [showNewReferral, setShowNewReferral] = useState(false);
  const [referralLink] = useState('https://careers.paySphere.com/ref/ALEX-2026');

  const filteredReferrals = useMemo(() => {
    let result = [...REFERRALS];
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter((r) => r.candidateName.toLowerCase().includes(q) || r.position.toLowerCase().includes(q)); }
    if (filterStatus !== 'all') result = result.filter((r) => r.status === filterStatus);
    return result;
  }, [searchQuery, filterStatus]);

  const tabs = [
    { id: 'referrals' as const, label: 'My Referrals', icon: <Users size={14} /> },
    { id: 'leaderboard' as const, label: 'Leaderboard', icon: <Trophy size={14} /> },
    { id: 'rewards' as const, label: 'Rewards', icon: <Gift size={14} /> },
    { id: 'insights' as const, label: 'Insights', icon: <Sparkles size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                <UserPlus size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">Referral Program</h1>
                <p className="text-amber-300/60 text-sm">Refer · Hire · Earn rewards</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{TIER_CONFIG[REFERRAL_STATS.tier].icon}</span>
              <span className={`text-sm font-bold ${TIER_CONFIG[REFERRAL_STATS.tier].color}`}>{TIER_CONFIG[REFERRAL_STATS.tier].label} Referrer</span>
            </div>
          </div>
        </header>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={<Users size={18} />} label="Referrals" value={REFERRAL_STATS.totalReferrals} color="text-amber-400" />
          <KpiCard icon={<UserCheck size={18} />} label="Hired" value={REFERRAL_STATS.hiredThisQuarter} sub="this quarter" color="text-green-400" />
          <KpiCard icon={<DollarSign size={18} />} label="Earned" value={fmt(REFERRAL_STATS.totalEarned)} color="text-yellow-400" trend="+$3K this quarter" trendUp />
          <KpiCard icon={<Target size={18} />} label="Conversion" value={`${REFERRAL_STATS.conversionRate}%`} color="text-cyan-400" />
          <KpiCard icon={<Trophy size={18} />} label="Rank" value={`#${REFERRAL_STATS.rank}`} sub={`of ${REFERRAL_STATS.totalEmployees}`} color="text-purple-400" />
        </div>

        {/* Tier Progress */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-semibold">Tier Progress</span>
            <span className="text-xs text-gray-400">{REFERRAL_STATS.tierProgress}% to {REFERRAL_STATS.nextTier ? TIER_CONFIG[REFERRAL_STATS.nextTier].label : 'Max'}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-3 rounded-full" style={{ width: `${REFERRAL_STATS.tierProgress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
            <span>{TIER_CONFIG[REFERRAL_STATS.tier].icon} {TIER_CONFIG[REFERRAL_STATS.tier].label}</span>
            {REFERRAL_STATS.nextTier && <span>{TIER_CONFIG[REFERRAL_STATS.nextTier].icon} {TIER_CONFIG[REFERRAL_STATS.nextTier].label} ({TIER_CONFIG[REFERRAL_STATS.nextTier].minReferrals} referrals)</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-400 border border-amber-400/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Referrals Tab */}
        {activeTab === 'referrals' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input type="text" placeholder="Search referrals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => setShowNewReferral(true)} className="flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition border border-amber-400/30">
                <Plus size={14} />New Referral
              </button>
            </div>
            {/* Referral Link */}
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white font-semibold">Your Referral Link</div>
                  <div className="text-xs text-gray-400 font-mono">{referralLink}</div>
                </div>
                <button onClick={() => navigator.clipboard.writeText(referralLink)} className="flex items-center gap-2 bg-white/10 text-white px-3 py-2 rounded-lg text-xs hover:bg-white/20 transition">
                  <Copy size={12} />Copy
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredReferrals.map((r) => <ReferralCard key={r.id} referral={r} selected={selectedReferral?.id === r.id} onSelect={() => setSelectedReferral(r)} />)}
            </div>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-3xl space-y-2">
            <h2 className="text-lg font-bold text-white mb-3">Top Referrers</h2>
            {LEADERBOARD.map((entry) => <LeaderboardRow key={entry.rank} entry={entry} />)}
            <div className="mt-4 p-4 bg-amber-500/10 rounded-xl border border-amber-400/20">
              <div className="flex items-center gap-2 text-sm text-amber-400 font-semibold mb-1"><Crown size={16} />Your Position</div>
              <LeaderboardRow entry={{ rank: REFERRAL_STATS.rank, name: 'You', avatar: '🧑‍💻', department: 'Engineering', referrals: REFERRAL_STATS.totalReferrals, hired: REFERRAL_STATS.hiredThisQuarter, conversionRate: REFERRAL_STATS.conversionRate, totalEarned: REFERRAL_STATS.totalEarned, tier: REFERRAL_STATS.tier, streak: 2 }} isMe />
            </div>
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Your Rewards</h2>
            {REWARDS.map((r) => <RewardCard key={r.id} reward={r} />)}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-3 max-w-3xl">
            <h2 className="text-lg font-bold text-white">Referral Insights</h2>
            {REFERRAL_INSIGHTS.sort((a, b) => a.priority - b.priority).map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        )}

        {/* New Referral Modal */}
        {showNewReferral && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowNewReferral(false)}>
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-bold text-lg mb-4">Submit a Referral</h3>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-400 mb-1 block">Candidate Name</label><input type="text" placeholder="Full name" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400" /></div>
                <div><label className="text-xs text-gray-400 mb-1 block">Email</label><input type="email" placeholder="candidate@email.com" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400" /></div>
                <div><label className="text-xs text-gray-400 mb-1 block">Position</label><select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none"><option>Senior Frontend Engineer</option><option>Backend Engineer</option><option>Product Manager</option><option>UX Designer</option><option>Sales Executive</option></select></div>
                <div><label className="text-xs text-gray-400 mb-1 block">Notes</label><textarea rows={3} placeholder="Why are they a good fit?" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400 resize-none" /></div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewReferral(false)} className="flex-1 bg-white/5 text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition border border-white/10">Cancel</button>
                <button onClick={() => { alert('✅ Referral submitted!'); setShowNewReferral(false); }} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition">Submit Referral</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
