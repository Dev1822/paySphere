import React, { useState, useMemo } from 'react';
import {
  Heart, Brain, Smile, Sun, Moon, Cloud, CloudRain, Activity, Flame,
  Target, Award, Star, Trophy, Zap, Clock, Calendar, Users, Search,
  Filter, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, TrendingUp,
  TrendingDown, BarChart3, PieChart, CheckCircle2, XCircle, AlertTriangle,
  Info, Sparkles, Shield, Eye, EyeOff, Bell, Download, RefreshCw,
  Share2, Bookmark, ExternalLink, Phone, MessageCircle, Mail,
  MapPin, Compass, Flag, Lightbulb, Rocket, Crown, Medal,
  HeartHandshake, Stethoscope, Pill, BrainCircuit, SmilePlus, Frown,
  Meh, Annoyed, Angry, Dizzy, Thermometer, Droplets, Wind, Sunrise,
  Sunset, Timer, Hourglass, CalendarDays, Repeat, Hash, DollarSign,
  Wallet, CreditCard, Gift, Coffee, Leaf, TreePine, Mountain, Waves,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */

type WellnessCategory = 'mental_health' | 'physical_health' | 'financial_wellness' | 'social_wellbeing' | 'work_life_balance' | 'professional_growth';
type MoodLevel = 'great' | 'good' | 'okay' | 'low' | 'struggling';
type ChallengeType = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type ResourceType = 'hotline' | 'counselor' | 'article' | 'video' | 'app' | 'workshop' | 'group';
type RiskLevel = 'thriving' | 'healthy' | 'moderate' | 'concern' | 'crisis';

interface WellnessCheckIn {
  id: string;
  date: string;
  mood: MoodLevel;
  stressLevel: number;
  energyLevel: number;
  sleepHours: number;
  exerciseMinutes: number;
  waterGlasses: number;
  mindfulnessMinutes: number;
  gratitudeNote: string;
  tags: string[];
}

interface WellnessChallenge {
  id: string;
  title: string;
  description: string;
  category: WellnessCategory;
  type: ChallengeType;
  duration: string;
  participants: number;
  completionRate: number;
  points: number;
  streak: number;
  progress: number;
  maxProgress: number;
  active: boolean;
  icon: string;
  color: string;
}

interface EAPResource {
  id: string;
  name: string;
  type: ResourceType;
  description: string;
  contact: string;
  availability: string;
  free: boolean;
  rating: number;
  uses: number;
  category: WellnessCategory;
  tags: string[];
}

interface WellnessMetric {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  icon: React.ReactNode;
  color: string;
}

interface WeeklyWellnessData {
  day: string;
  mood: MoodLevel;
  stress: number;
  energy: number;
  sleep: number;
  exercise: number;
  mindfulness: number;
}

interface WellnessInsight {
  id: string;
  type: 'positive' | 'suggestion' | 'alert' | 'achievement' | 'pattern';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  priority: number;
}

interface PeerSupport {
  id: string;
  name: string;
  avatar: string;
  role: string;
  specialties: string[];
  availability: string;
  rating: number;
  sessions: number;
  online: boolean;
}

/* ─────────────── Constants ─────────────── */

const MOOD_CONFIG: Record<MoodLevel, { emoji: string; color: string; bg: string; label: string; value: number }> = {
  great: { emoji: '😄', color: 'text-green-400', bg: 'bg-green-500/20', label: 'Great', value: 5 },
  good: { emoji: '🙂', color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Good', value: 4 },
  okay: { emoji: '😐', color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Okay', value: 3 },
  low: { emoji: '😔', color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Low', value: 2 },
  struggling: { emoji: '😢', color: 'text-red-400', bg: 'bg-red-500/20', label: 'Struggling', value: 1 },
};

const CATEGORY_CONFIG: Record<WellnessCategory, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  mental_health: { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: <Brain size={14} />, label: 'Mental Health' },
  physical_health: { color: 'text-green-400', bg: 'bg-green-500/20', icon: <Activity size={14} />, label: 'Physical Health' },
  financial_wellness: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <DollarSign size={14} />, label: 'Financial Wellness' },
  social_wellbeing: { color: 'text-pink-400', bg: 'bg-pink-500/20', icon: <Users size={14} />, label: 'Social Wellbeing' },
  work_life_balance: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <Clock size={14} />, label: 'Work-Life Balance' },
  professional_growth: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: <Rocket size={14} />, label: 'Professional Growth' },
};

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; label: string; emoji: string }> = {
  thriving: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Thriving', emoji: '🚀' },
  healthy: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Healthy', emoji: '😊' },
  moderate: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Moderate', emoji: '⚠️' },
  concern: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Concern', emoji: '😰' },
  crisis: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Crisis', emoji: '🛑' },
};

/* ─────────────── Sample Data ─────────────── */

const CHECK_INS: WellnessCheckIn[] = [
  { id: 'ci1', date: '2026-08-30', mood: 'good', stressLevel: 4, energyLevel: 7, sleepHours: 7.5, exerciseMinutes: 30, waterGlasses: 8, mindfulnessMinutes: 10, gratitudeNote: 'Grateful for supportive team and clear project goals', tags: ['productive', 'focused', 'social'] },
  { id: 'ci2', date: '2026-08-29', mood: 'great', stressLevel: 2, energyLevel: 9, sleepHours: 8, exerciseMinutes: 45, waterGlasses: 10, mindfulnessMinutes: 15, gratitudeNote: 'Beautiful morning run and great standup', tags: ['energized', 'positive', 'active'] },
  { id: 'ci3', date: '2026-08-28', mood: 'okay', stressLevel: 6, energyLevel: 5, sleepHours: 6, exerciseMinutes: 0, waterGlasses: 5, mindfulnessMinutes: 0, gratitudeNote: 'Deadline pressure but code review went well', tags: ['stressed', 'deadline', 'tired'] },
  { id: 'ci4', date: '2026-08-27', mood: 'low', stressLevel: 7, energyLevel: 4, sleepHours: 5.5, exerciseMinutes: 15, waterGlasses: 4, mindfulnessMinutes: 5, gratitudeNote: 'Supportive manager check-in helped', tags: ['anxious', 'overwhelmed', 'recovering'] },
  { id: 'ci5', date: '2026-08-26', mood: 'good', stressLevel: 3, energyLevel: 8, sleepHours: 7, exerciseMinutes: 40, waterGlasses: 9, mindfulnessMinutes: 10, gratitudeNote: 'Team lunch and finished feature demo', tags: ['social', 'accomplished', 'balanced'] },
];

const CHALLENGES: WellnessChallenge[] = [
  { id: 'ch1', title: '30-Day Mindfulness', description: 'Meditate for 10 minutes daily for 30 days', category: 'mental_health', type: 'monthly', duration: '30 days', participants: 234, completionRate: 67, points: 500, streak: 12, progress: 12, maxProgress: 30, active: true, icon: '🧘', color: '#a855f7' },
  { id: 'ch2', title: 'Step Challenge', description: 'Walk 10,000 steps daily this week', category: 'physical_health', type: 'weekly', duration: '7 days', participants: 189, completionRate: 72, points: 200, streak: 3, progress: 5, maxProgress: 7, active: true, icon: '🚶', color: '#22c55e' },
  { id: 'ch3', title: 'No-Spend Week', description: 'Track all expenses and avoid non-essential purchases', category: 'financial_wellness', type: 'weekly', duration: '7 days', participants: 156, completionRate: 58, points: 150, streak: 2, progress: 3, maxProgress: 7, active: true, icon: '💰', color: '#eab308' },
  { id: 'ch4', title: 'Team Bonding', description: 'Have 3 meaningful conversations with colleagues', category: 'social_wellbeing', type: 'weekly', duration: '7 days', participants: 112, completionRate: 81, points: 100, streak: 4, progress: 2, maxProgress: 3, active: true, icon: '🤝', color: '#ec4899' },
  { id: 'ch5', title: 'Digital Detox', description: 'No screens 1 hour before bed for 14 days', category: 'work_life_balance', type: 'monthly', duration: '14 days', participants: 98, completionRate: 45, points: 300, streak: 0, progress: 0, maxProgress: 14, active: true, icon: '📵', color: '#3b82f6' },
  { id: 'ch6', title: 'Learn Something New', description: 'Complete one online course or workshop this quarter', category: 'professional_growth', type: 'quarterly', duration: '90 days', participants: 67, completionRate: 34, points: 400, streak: 0, progress: 1, maxProgress: 1, active: true, icon: '📚', color: '#06b6d4' },
];

const EAP_RESOURCES: EAPResource[] = [
  { id: 'r1', name: 'Crisis Hotline', type: 'hotline', description: '24/7 confidential crisis support', contact: '1-800-273-8255', availability: '24/7', free: true, rating: 4.9, uses: 45, category: 'mental_health', tags: ['crisis', 'immediate', 'confidential'] },
  { id: 'r2', name: 'Dr. Sarah Mitchell', type: 'counselor', description: 'Licensed therapist specializing in workplace stress and anxiety', contact: 'Book via EAP portal', availability: 'Mon-Fri 9am-6pm', free: true, rating: 4.8, uses: 23, category: 'mental_health', tags: ['therapy', 'anxiety', 'stress'] },
  { id: 'r3', name: 'Headspace App', type: 'app', description: 'Guided meditation and mindfulness exercises', contact: 'Download from app store', availability: '24/7', free: true, rating: 4.7, uses: 156, category: 'mental_health', tags: ['meditation', 'mindfulness', 'sleep'] },
  { id: 'r4', name: 'Financial Advisor Session', type: 'workshop', description: 'One-on-one financial planning consultation', contact: 'Schedule via HR portal', availability: 'By appointment', free: true, rating: 4.5, uses: 34, category: 'financial_wellness', tags: ['financial', 'planning', 'retirement'] },
  { id: 'r5', name: 'Ergonomic Assessment', type: 'workshop', description: 'Professional workspace ergonomic evaluation', contact: 'Request via facilities', availability: 'By appointment', free: true, rating: 4.6, uses: 67, category: 'physical_health', tags: ['ergonomic', 'posture', 'workspace'] },
  { id: 'r6', name: 'Peer Support Network', type: 'group', description: 'Trained peer supporters for confidential conversations', contact: 'Slack #wellness-support', availability: 'Mon-Fri 10am-4pm', free: true, rating: 4.4, uses: 89, category: 'social_wellbeing', tags: ['peer', 'support', 'confidential'] },
];

const WEEKLY_DATA: WeeklyWellnessData[] = [
  { day: 'Mon', mood: 'good', stress: 4, energy: 7, sleep: 7.5, exercise: 30, mindfulness: 10 },
  { day: 'Tue', mood: 'great', stress: 2, energy: 9, sleep: 8, exercise: 45, mindfulness: 15 },
  { day: 'Wed', mood: 'okay', stress: 6, energy: 5, sleep: 6, exercise: 0, mindfulness: 0 },
  { day: 'Thu', mood: 'low', stress: 7, energy: 4, sleep: 5.5, exercise: 15, mindfulness: 5 },
  { day: 'Fri', mood: 'good', stress: 3, energy: 8, sleep: 7, exercise: 40, mindfulness: 10 },
  { day: 'Sat', mood: 'great', stress: 1, energy: 9, sleep: 8.5, exercise: 60, mindfulness: 20 },
  { day: 'Sun', mood: 'great', stress: 1, energy: 8, sleep: 9, exercise: 30, mindfulness: 15 },
];

const WELLNESS_INSIGHTS: WellnessInsight[] = [
  { id: 'w1', type: 'pattern', title: 'Mid-Week Energy Dip', description: 'Your energy drops 30% on Wed-Thu. Consider lighter tasks or a mid-week break.', icon: <TrendingDown size={16} />, color: 'text-orange-400', priority: 1 },
  { id: 'w2', type: 'positive', title: 'Exercise-Mood Correlation', description: 'Days with 30+ min exercise show 40% better mood. Keep it up!', icon: <TrendingUp size={16} />, color: 'text-green-400', priority: 2 },
  { id: 'w3', type: 'suggestion', title: 'Sleep Optimization', description: 'Your best days follow 7.5+ hours of sleep. Try a consistent bedtime.', icon: <Moon size={16} />, color: 'text-purple-400', priority: 3 },
  { id: 'w4', type: 'achievement', title: '12-Day Mindfulness Streak!', description: 'You\'ve meditated for 12 consecutive days. Amazing consistency!', icon: <Flame size={16} />, color: 'text-orange-400', priority: 4 },
  { id: 'w5', type: 'alert', title: 'Stress Level Rising', description: 'Your average stress increased 15% this week. Consider using EAP resources.', icon: <AlertTriangle size={16} />, color: 'text-red-400', priority: 5 },
  { id: 'w6', type: 'suggestion', title: 'Social Connection', description: 'You haven\'t had a team lunch in 2 weeks. Social time boosts wellbeing.', icon: <Users size={16} />, color: 'text-pink-400', priority: 6 },
];

const PEER_SUPPORTERS: PeerSupport[] = [
  { id: 'ps1', name: 'Alex Rivera', avatar: '🧑‍💼', role: 'Senior Engineer', specialties: ['Work Stress', 'Career Guidance'], availability: 'Mon/Wed 2-4pm', rating: 4.9, sessions: 34, online: true },
  { id: 'ps2', name: 'Maya Patel', avatar: '👩‍🏫', role: 'HR Business Partner', specialties: ['Conflict Resolution', 'Work-Life Balance'], availability: 'Tue/Thu 10am-12pm', rating: 4.8, sessions: 45, online: true },
  { id: 'ps3', name: 'Jordan Kim', avatar: '🧑‍🎨', role: 'Design Lead', specialties: ['Creative Burnout', 'Imposter Syndrome'], availability: 'Fri 1-3pm', rating: 4.7, sessions: 22, online: false },
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

const MoodSelector: React.FC<{ selected: MoodLevel | null; onSelect: (mood: MoodLevel) => void }> = ({ selected, onSelect }) => (
  <div className="flex items-center justify-center gap-4">
    {(Object.entries(MOOD_CONFIG) as [MoodLevel, typeof MOOD_CONFIG[MoodLevel]][]).map(([key, cfg]) => (
      <button key={key} onClick={() => onSelect(key)} className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${selected === key ? `${cfg.bg} ring-2 ring-current ${cfg.color} scale-110` : 'hover:bg-white/5'}`}>
        <span className="text-3xl">{cfg.emoji}</span>
        <span className="text-[10px] text-gray-400">{cfg.label}</span>
      </button>
    ))}
  </div>
);

const ChallengeCard: React.FC<{ challenge: WellnessChallenge; selected: boolean; onSelect: () => void }> = ({ challenge, selected, onSelect }) => {
  const catCfg = CATEGORY_CONFIG[challenge.category];
  const progress = (challenge.progress / challenge.maxProgress) * 100;
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-xl p-4 border transition-all ${selected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{challenge.icon}</span>
          <span className="font-semibold text-white text-sm">{challenge.title}</span>
        </div>
        {challenge.active && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
      </div>
      <p className="text-xs text-gray-400 mb-2">{challenge.description}</p>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${catCfg.bg} ${catCfg.color}`}>{catCfg.label}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">{challenge.type}</span>
      </div>
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-gray-400">{challenge.progress}/{challenge.maxProgress}</span>
          <span className="text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: challenge.color }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><Users size={10} />{challenge.participants}</span>
        <span className="flex items-center gap-1"><Flame size={10} />{challenge.streak} day streak</span>
        <span className="flex items-center gap-1"><Star size={10} />{challenge.points} pts</span>
      </div>
    </div>
  );
};

const ResourceCard: React.FC<{ resource: EAPResource }> = ({ resource }) => {
  const catCfg = CATEGORY_CONFIG[resource.category];
  const typeIcons: Record<ResourceType, React.ReactNode> = { hotline: <Phone size={14} />, counselor: <Stethoscope size={14} />, article: <Mail size={14} />, video: <Eye size={14} />, app: <Zap size={14} />, workshop: <Calendar size={14} />, group: <Users size={14} /> };
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${catCfg.bg} ${catCfg.color}`}>
          {typeIcons[resource.type]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{resource.name}</span>
            {resource.free && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">Free</span>}
          </div>
          <div className="text-[10px] text-gray-500">{resource.type} · {resource.availability}</div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1"><Star size={10} className="text-yellow-400 fill-yellow-400" /><span className="text-xs text-gray-400">{resource.rating}</span></div>
          <div className="text-[10px] text-gray-500">{resource.uses} uses</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">{resource.description}</p>
      <div className="flex flex-wrap gap-1">
        {resource.tags.map((t) => <span key={t} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-gray-400">#{t}</span>)}
      </div>
    </div>
  );
};

const WeeklyChart: React.FC<{ data: WeeklyWellnessData[] }> = ({ data }) => (
  <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
    <h3 className="text-white font-bold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-purple-400" />Weekly Wellness Trends</h3>
    <div className="space-y-3">
      {data.map((d) => {
        const moodCfg = MOOD_CONFIG[d.mood];
        return (
          <div key={d.day} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-8">{d.day}</span>
            <span className="text-lg">{moodCfg.emoji}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-white/10 rounded-full h-2 relative">
                <div className="bg-purple-400 h-2 rounded-full" style={{ width: `${d.stress * 10}%` }} />
                <div className="absolute top-0 h-2 bg-cyan-400/50 rounded-full" style={{ width: `${d.energy * 10}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 w-12">{d.sleep}h sleep</span>
              <span className="text-[10px] text-gray-500 w-16">{d.exercise}min exercise</span>
            </div>
          </div>
        );
      })}
    </div>
    <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-400" />Stress</span>
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-400/50" />Energy</span>
    </div>
  </div>
);

const PeerSupportCard: React.FC<{ supporter: PeerSupport }> = ({ supporter }) => (
  <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
    <div className="flex items-center gap-3 mb-2">
      <div className="relative">
        <span className="text-2xl">{supporter.avatar}</span>
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${supporter.online ? 'bg-green-400' : 'bg-gray-500'}`} />
      </div>
      <div>
        <span className="font-semibold text-white text-sm">{supporter.name}</span>
        <div className="text-[10px] text-gray-500">{supporter.role}</div>
      </div>
    </div>
    <div className="flex flex-wrap gap-1 mb-2">
      {supporter.specialties.map((s) => <span key={s} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-gray-400">{s}</span>)}
    </div>
    <div className="flex items-center justify-between text-[10px] text-gray-500">
      <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400" />{supporter.rating}</span>
      <span>{supporter.sessions} sessions</span>
      <span>{supporter.availability}</span>
    </div>
  </div>
);

const InsightCard: React.FC<{ insight: WellnessInsight }> = ({ insight }) => {
  const typeColors: Record<string, string> = { positive: 'border-green-400/30 bg-green-500/5', suggestion: 'border-blue-400/30 bg-blue-500/5', alert: 'border-red-400/30 bg-red-500/5', achievement: 'border-orange-400/30 bg-orange-500/5', pattern: 'border-purple-400/30 bg-purple-500/5' };
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

export default function EmployeeWellnessHubPage() {
  const [activeTab, setActiveTab] = useState<'checkin' | 'challenges' | 'resources' | 'insights' | 'peer_support'>('checkin');
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<WellnessChallenge | null>(null);
  const [stressLevel, setStressLevel] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(7);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<WellnessCategory | 'all'>('all');

  const stats = useMemo(() => {
    const avgMood = CHECK_INS.reduce((s, c) => s + MOOD_CONFIG[c.mood].value, 0) / CHECK_INS.length;
    const avgStress = CHECK_INS.reduce((s, c) => s + c.stressLevel, 0) / CHECK_INS.length;
    const avgSleep = CHECK_INS.reduce((s, c) => s + c.sleepHours, 0) / CHECK_INS.length;
    const totalExercise = CHECK_INS.reduce((s, c) => s + c.exerciseMinutes, 0);
    const challengesActive = CHALLENGES.filter((c) => c.active).length;
    return { avgMood, avgStress, avgSleep, totalExercise, challengesActive };
  }, []);

  const riskLevel: RiskLevel = stats.avgMood >= 4 ? 'thriving' : stats.avgMood >= 3.5 ? 'healthy' : stats.avgMood >= 2.5 ? 'moderate' : stats.avgMood >= 1.5 ? 'concern' : 'crisis';
  const riskCfg = RISK_CONFIG[riskLevel];

  const filteredResources = useMemo(() => {
    let result = [...EAP_RESOURCES];
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter((r) => r.name.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q))); }
    if (filterCategory !== 'all') result = result.filter((r) => r.category === filterCategory);
    return result;
  }, [searchQuery, filterCategory]);

  const tabs = [
    { id: 'checkin' as const, label: 'Daily Check-In', icon: <Smile size={14} /> },
    { id: 'challenges' as const, label: 'Challenges', icon: <Target size={14} /> },
    { id: 'resources' as const, label: 'EAP Resources', icon: <HeartHandshake size={14} /> },
    { id: 'insights' as const, label: 'Insights', icon: <Sparkles size={14} /> },
    { id: 'peer_support' as const, label: 'Peer Support', icon: <Users size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 bg-gradient-to-r from-purple-950 via-slate-900 to-pink-950 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center">
                <Heart size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">Wellness Hub</h1>
                <p className="text-purple-300/60 text-sm">Thrive at work · Nurture wellbeing · Grow together</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${riskCfg.bg} border ${riskCfg.color.replace('text-', 'border-').replace('400', '400/30')}`}>
              <span className="text-lg">{riskCfg.emoji}</span>
              <span className={`font-semibold ${riskCfg.color}`}>{riskCfg.label}</span>
            </div>
          </div>
        </header>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={<Smile size={18} />} label="Avg Mood" value={stats.avgMood.toFixed(1)} sub="out of 5" color="text-purple-400" trend="+0.3 this week" trendUp />
          <KpiCard icon={<Brain size={18} />} label="Avg Stress" value={stats.avgStress.toFixed(1)} sub="out of 10" color={stats.avgStress > 5 ? 'text-red-400' : 'text-green-400'} />
          <KpiCard icon={<Moon size={18} />} label="Avg Sleep" value={`${stats.avgSleep.toFixed(1)}h`} color="text-blue-400" />
          <KpiCard icon={<Activity size={18} />} label="Exercise" value={`${stats.totalExercise}min`} sub="this week" color="text-green-400" trend="+15min vs last week" trendUp />
          <KpiCard icon={<Target size={18} />} label="Challenges" value={stats.challengesActive} sub="active" color="text-orange-400" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-purple-500/20 text-purple-400 border border-purple-400/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Check-In Tab */}
        {activeTab === 'checkin' && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">How are you feeling today?</h3>
              <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Stress Level: {stressLevel}/10</label>
                  <input type="range" min="1" max="10" value={stressLevel} onChange={(e) => setStressLevel(Number(e.target.value))} className="w-full accent-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Energy Level: {energyLevel}/10</label>
                  <input type="range" min="1" max="10" value={energyLevel} onChange={(e) => setEnergyLevel(Number(e.target.value))} className="w-full accent-green-500" />
                </div>
              </div>
              <button className="mt-4 w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">
                Submit Check-In
              </button>
            </div>
            <WeeklyChart data={WEEKLY_DATA} />
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {CHALLENGES.map((c) => <ChallengeCard key={c.id} challenge={c} selected={selectedChallenge?.id === c.id} onSelect={() => setSelectedChallenge(c)} />)}
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input type="text" placeholder="Search resources..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
              </div>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredResources.map((r) => <ResourceCard key={r.id} resource={r} />)}
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-3 max-w-3xl">
            <h2 className="text-lg font-bold text-white">Wellness Insights</h2>
            {WELLNESS_INSIGHTS.sort((a, b) => a.priority - b.priority).map((insight) => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        )}

        {/* Peer Support Tab */}
        {activeTab === 'peer_support' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Peer Support Network</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PEER_SUPPORTERS.map((ps) => <PeerSupportCard key={ps.id} supporter={ps} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
