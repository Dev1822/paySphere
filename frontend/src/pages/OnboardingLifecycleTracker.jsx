import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Avatar,
  AvatarGroup,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Alert,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Stack,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PersonAdd as HiredIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  Assessment as AssessmentIcon,
  Insights as InsightsIcon,
  Groups as GroupsIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Schedule as ScheduleIcon,
  School as SchoolIcon,
  Handshake as HandshakeIcon,
  CalendarMonth as CalendarIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  EmojiEvents as TrophyIcon,
  Timer as TimerIcon,
  Task as TaskIcon,
  Assignment as AssignmentIcon,
  FactCheck as FactCheckIcon,
  Psychology as BrainIcon,
  Engineering as EngineeringIcon,
  Code as CodeIcon,
  DesignServices as DesignIcon,
  Campaign as MarketingIcon,
  Work as WorkIcon,
  Security as SecurityIcon,
  Laptop as LaptopIcon,
  Badge as BadgeIcon,
  CardTravel as TravelIcon,
  Coffee as CoffeeIcon,
  Chat as ChatIcon,
  Feedback as FeedbackIcon,
  Flag as FlagIcon,
  Rocket as RocketIcon,
  PsychologyAlt as MentorIcon,
  SentimentSatisfied as HappyIcon,
  SentimentDissatisfied as SadIcon,
  SentimentNeutral as NeutralIcon,
  Visibility as VisibilityIcon,
  Recommend as RecommendIcon,
  LocalFireDepartment as FireIcon,
} from '@mui/icons-material';

// ── Mock Data ──────────────────────────────────────────────────────────────

const KPI_CARDS = [
  { label: 'Active Onboarding', value: '24', change: 8, icon: <HiredIcon />, color: '#2196f3', bg: '#e3f2fd' },
  { label: '90-Day Retention', value: '82%', change: 5, icon: <CheckIcon />, color: '#4caf50', bg: '#e8f5e9' },
  { label: 'Avg Time to Productive', value: '47d', change: -6, icon: <TimerIcon />, color: '#9c27b0', bg: '#f3e5f5', invert: true },
  { label: 'Task Completion', value: '74%', change: 8, icon: <FactCheckIcon />, color: '#ff9800', bg: '#fff3e0' },
  { label: 'Mentor Match Rate', value: '96%', change: 3, icon: <MentorIcon />, color: '#00bcd4', bg: '#e0f7fa' },
  { label: 'Satisfaction Score', value: '4.3/5', change: 0.2, icon: <HappyIcon />, color: '#e91e63', bg: '#fce4ec' },
  { label: 'Pending IT Setup', value: '6', change: -2, icon: <LaptopIcon />, color: '#f44336', bg: '#fce4ec', invert: true },
  { label: 'Buddy Assignments', value: '22/24', change: 2, icon: <HandshakeIcon />, color: '#3f51b5', bg: '#e8eaf6' },
];

const ACTIVE_NEW_HIRES = [
  { name: 'Arjun Reddy', dept: 'Engineering', role: 'Software Engineer', startDate: '2026-08-18', phase: 'day30', progress: 78, mentor: 'Karan M.', buddy: 'Priya S.', avatar: 'AR', tasksCompleted: 28, tasksTotal: 36, satisfaction: 4.5, status: 'on-track' },
  { name: 'Meera Iyer', dept: 'Product', role: 'Product Manager', startDate: '2026-08-11', phase: 'day60', progress: 85, mentor: 'Deepak R.', buddy: 'Sneha G.', avatar: 'MI', tasksCompleted: 42, tasksTotal: 48, satisfaction: 4.7, status: 'ahead' },
  { name: 'Rohan Kapoor', dept: 'Design', role: 'UX Designer', startDate: '2026-07-28', phase: 'day60', progress: 72, mentor: 'Neha P.', buddy: 'Amit K.', avatar: 'RK', tasksCompleted: 38, tasksTotal: 48, satisfaction: 4.1, status: 'on-track' },
  { name: 'Sanya Gupta', dept: 'Marketing', role: 'Content Strategist', startDate: '2026-08-25', phase: 'day30', progress: 35, mentor: 'Rajesh K.', buddy: 'Vikram S.', avatar: 'SG', tasksCompleted: 12, tasksTotal: 36, satisfaction: 4.0, status: 'at-risk' },
  { name: 'Kabir Sharma', dept: 'Engineering', role: 'Senior Dev', startDate: '2026-07-15', phase: 'day90', progress: 92, mentor: 'Vikram S.', buddy: 'Rohit M.', avatar: 'KS', tasksCompleted: 55, tasksTotal: 60, satisfaction: 4.8, status: 'ahead' },
  { name: 'Ananya Das', dept: 'Sales', role: 'Account Executive', startDate: '2026-08-04', phase: 'day60', progress: 68, mentor: 'Amit P.', buddy: 'Priya S.', avatar: 'AD', tasksCompleted: 34, tasksTotal: 48, satisfaction: 3.9, status: 'on-track' },
  { name: 'Vivaan Nair', dept: 'Data Science', role: 'Data Analyst', startDate: '2026-08-20', phase: 'day30', progress: 52, mentor: 'Deepak R.', buddy: 'Karan M.', avatar: 'VN', tasksCompleted: 18, tasksTotal: 36, satisfaction: 4.2, status: 'on-track' },
  { name: 'Ishita Malhotra', dept: 'HR', role: 'HR Coordinator', startDate: '2026-07-21', phase: 'day90', progress: 88, mentor: 'Mohit J.', buddy: 'Anita D.', avatar: 'IM', tasksCompleted: 52, tasksTotal: 60, satisfaction: 4.6, status: 'ahead' },
  { name: 'Aditya Verma', dept: 'Finance', role: 'Finance Analyst', startDate: '2026-08-14', phase: 'day30', progress: 65, mentor: 'Deepa N.', buddy: 'Pooja R.', avatar: 'AV', tasksCompleted: 23, tasksTotal: 36, satisfaction: 4.3, status: 'on-track' },
  { name: 'Nisha Chopra', dept: 'Operations', role: 'Ops Manager', startDate: '2026-08-07', phase: 'day60', progress: 71, mentor: 'Mohit J.', buddy: 'Karan J.', avatar: 'NC', tasksCompleted: 36, tasksTotal: 48, satisfaction: 4.0, status: 'on-track' },
];

const ONBOARDING_PHASES = [
  {
    phase: 'Pre-Boarding',
    range: 'Before Day 1',
    color: '#9c27b0',
    tasks: [
      { task: 'Offer letter signed', completed: true },
      { task: 'Background verification', completed: true },
      { task: 'IT equipment ordered', completed: true },
      { task: 'Email & accounts provisioned', completed: true },
      { task: 'Welcome kit shipped', completed: true },
      { task: 'Mentor assigned', completed: true },
      { task: 'Buddy assigned', completed: true },
      { task: 'Day 1 agenda shared', completed: true },
    ],
  },
  {
    phase: 'First 30 Days',
    range: 'Week 1–4',
    color: '#2196f3',
    tasks: [
      { task: 'Company orientation', completed: true },
      { task: 'Team introductions', completed: true },
      { task: 'IT & security setup', completed: true },
      { task: 'Role expectations review', completed: true },
      { task: 'Tool access & training', completed: true },
      { task: 'First 1:1 with manager', completed: true },
      { task: 'Meet cross-functional partners', completed: false },
      { task: 'Complete compliance training', completed: false },
      { task: 'First small deliverable', completed: false },
      { task: '30-day check-in survey', completed: false },
    ],
  },
  {
    phase: '30–60 Days',
    range: 'Week 5–8',
    color: '#ff9800',
    tasks: [
      { task: 'Own first project/module', completed: false },
      { task: 'Participate in sprint planning', completed: false },
      { task: 'Shadow senior team member', completed: false },
      { task: 'Mid-point manager review', completed: false },
      { task: 'Cross-team collaboration', completed: false },
      { task: 'Knowledge sharing session', completed: false },
      { task: 'Feedback exchange with mentor', completed: false },
      { task: 'Self-assessment form', completed: false },
    ],
  },
  {
    phase: '60–90 Days',
    range: 'Week 9–12',
    color: '#4caf50',
    tasks: [
      { task: 'Lead a feature/project', completed: false },
      { task: 'Present to team', completed: false },
      { task: 'Process improvement suggestion', completed: false },
      { task: '90-day comprehensive review', completed: false },
      { task: 'Performance goal setting', completed: false },
      { task: 'Career development plan', completed: false },
      { task: 'Peer feedback collection', completed: false },
      { task: 'Onboarding exit survey', completed: false },
    ],
  },
];

const MENTOR_POOL = [
  { name: 'Karan Malhotra', dept: 'Engineering', expertise: 'System Design', mentees: 3, maxMentees: 4, rating: 4.8, exp: '6y', available: true, avatar: 'KM' },
  { name: 'Deepak Rao', dept: 'Product', expertise: 'Product Strategy', mentees: 4, maxMentees: 4, rating: 4.6, exp: '8y', available: false, avatar: 'DR' },
  { name: 'Neha Patel', dept: 'Design', expertise: 'UX Research', mentees: 2, maxMentees: 3, rating: 4.9, exp: '5y', available: true, avatar: 'NP' },
  { name: 'Mohit Joshi', dept: 'HR', expertise: 'Leadership', mentees: 3, maxMentees: 4, rating: 4.7, exp: '10y', available: true, avatar: 'MJ' },
  { name: 'Rajesh Kumar', dept: 'Marketing', expertise: 'Content & Brand', mentees: 2, maxMentees: 3, rating: 4.5, exp: '7y', available: true, avatar: 'RK' },
  { name: 'Vikram Singh', dept: 'Engineering', expertise: 'Backend Architecture', mentees: 4, maxMentees: 4, rating: 4.4, exp: '9y', available: false, avatar: 'VS' },
  { name: 'Deepa Nair', dept: 'Finance', expertise: 'FP&A', mentees: 1, maxMentees: 3, rating: 4.8, exp: '6y', available: true, avatar: 'DN' },
  { name: 'Amit Patel', dept: 'Sales', expertise: 'Enterprise Sales', mentees: 3, maxMentees: 4, rating: 4.3, exp: '5y', available: true, avatar: 'AP' },
];

const ONBOARDING_TRENDS = [
  { month: 'Jan', hires: 22, retained90: 18, dropped: 4, satisfaction: 4.1 },
  { month: 'Feb', hires: 18, retained90: 16, dropped: 2, satisfaction: 4.2 },
  { month: 'Mar', hires: 25, retained90: 20, dropped: 5, satisfaction: 4.0 },
  { month: 'Apr', hires: 15, retained90: 13, dropped: 2, satisfaction: 4.3 },
  { month: 'May', hires: 20, retained90: 17, dropped: 3, satisfaction: 4.4 },
  { month: 'Jun', hires: 28, retained90: 23, dropped: 5, satisfaction: 4.1 },
  { month: 'Jul', hires: 16, retained90: 14, dropped: 2, satisfaction: 4.5 },
  { month: 'Aug', hires: 18, retained90: 15, dropped: 3, satisfaction: 4.3 },
];

const DEPT_ONBOARDING = [
  { dept: 'Engineering', active: 8, avgProgress: 76, avgDays: 42, retention: 88, satisfaction: 4.4, color: '#2196f3' },
  { dept: 'Product', active: 3, avgProgress: 80, avgDays: 38, retention: 92, satisfaction: 4.5, color: '#9c27b0' },
  { dept: 'Design', active: 2, avgProgress: 72, avgDays: 45, retention: 85, satisfaction: 4.2, color: '#e91e63' },
  { dept: 'Marketing', active: 3, avgProgress: 65, avgDays: 52, retention: 78, satisfaction: 4.0, color: '#ff9800' },
  { dept: 'Sales', active: 4, avgProgress: 68, avgDays: 50, retention: 75, satisfaction: 3.9, color: '#4caf50' },
  { dept: 'HR', active: 1, avgProgress: 88, avgDays: 35, retention: 95, satisfaction: 4.6, color: '#00bcd4' },
  { dept: 'Finance', active: 1, avgProgress: 65, avgDays: 48, retention: 90, satisfaction: 4.3, color: '#3f51b5' },
  { dept: 'Data Science', active: 1, avgProgress: 52, avgDays: 55, retention: 88, satisfaction: 4.2, color: '#ff5722' },
  { dept: 'Operations', active: 1, avgProgress: 71, avgDays: 44, retention: 82, satisfaction: 4.0, color: '#607d8b' },
];

const ONBOARDING_INSIGHTS = [
  { insight: '90-day retention improved from 77% to 82% after introducing structured mentorship. Mentored hires show 23% higher satisfaction.', severity: 'positive', impact: 'high', action: 'Continue mentorship program' },
  { insight: 'Sales new hires take 50 days avg to become productive — 23% longer than Engineering. Role-specific ramp-up paths needed.', severity: 'warning', impact: 'high', action: 'Design sales-specific playbook' },
  { insight: '6 IT setup tickets pending for >3 days. Delayed equipment is the #1 complaint in Day 1 surveys.', severity: 'critical', impact: 'medium', action: 'Escalate IT procurement' },
  { insight: 'Hires with pre-boarded mentors are 31% more likely to complete 90-day review with "exceeds expectations".', severity: 'positive', impact: 'medium', action: 'Mandate pre-board mentor contact' },
  { insight: 'Marketing new hire satisfaction dropped 0.4 points — exit surveys cite unclear role boundaries.', severity: 'warning', impact: 'medium', action: 'Revise Marketing onboarding JD' },
  { insight: 'Cross-functional shadow sessions correlate with 18% faster time-to-productive. Currently only 45% of hires do them.', severity: 'info', impact: 'high', action: 'Make shadow sessions mandatory' },
];

const DROPOUT_REASONS = [
  { reason: 'Role Mismatch', pct: 32, count: 8, color: '#f44336' },
  { reason: 'Poor Manager Fit', pct: 24, count: 6, color: '#ff9800' },
  { reason: 'Better Offer', pct: 20, count: 5, color: '#9c27b0' },
  { reason: 'Culture Misalignment', pct: 12, count: 3, color: '#2196f3' },
  { reason: 'Relocation Issues', pct: 8, count: 2, color: '#00bcd4' },
  { reason: 'Other', pct: 4, count: 1, color: '#9e9e9e' },
];

// ── SVG Chart Components ───────────────────────────────────────────────────

function DonutChart({ value, maxValue = 100, size = 100, color = '#2196f3', label, thickness = 8 }) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value / maxValue;
  const offset = circumference * (1 - pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eee" strokeWidth={thickness} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={thickness}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{value}%</text>
      {label && <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize="8" fill="#999">{label}</text>}
    </svg>
  );
}

function ProgressTimeline({ phases, height = 160 }) {
  const phaseWidth = 100 / phases.length;
  return (
    <svg width="100%" height={height} viewBox="0 0 500 160">
      {/* Background track */}
      <rect x="30" y="70" width="440" height="8" rx="4" fill="#f0f0f0" />
      {/* Phase segments */}
      {phases.map((p, i) => {
        const x = 30 + i * 110;
        const completedCount = p.tasks.filter(t => t.completed).length;
        const pct = (completedCount / p.tasks.length) * 100;
        const fillW = (pct / 100) * 100;
        return (
          <g key={i}>
            <rect x={x} y="68" width="100" height="12" rx="6" fill="#f0f0f0" />
            <rect x={x} y="68" width={fillW} height="12" rx="6" fill={p.color} opacity={0.85} />
            {/* Phase label */}
            <text x={x + 50} y="55" textAnchor="middle" fontSize="10" fill={p.color} fontWeight="600">{p.phase}</text>
            <text x={x + 50} y="95" textAnchor="middle" fontSize="8" fill="#999">{p.range}</text>
            <text x={x + 50} y="108" textAnchor="middle" fontSize="9" fill="#333" fontWeight="600">{completedCount}/{p.tasks.length} tasks</text>
            <text x={x + 50} y="122" textAnchor="middle" fontSize="9" fill={p.color}>{Math.round(pct)}% complete</text>
          </g>
        );
      })}
      {/* Connector dots */}
      {phases.map((_, i) => {
        if (i === phases.length - 1) return null;
        const x = 30 + (i + 1) * 110;
        return <circle key={i} cx={x} cy={74} r="4" fill="white" stroke="#ddd" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

function StackedBarChart({ data, height = 180, width = 400 }) {
  const maxVal = Math.max(...data.map(d => d.hires));
  const barWidth = Math.floor((width - 80) / data.length) - 6;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const x = 50 + i * (barWidth + 6);
        const retainedH = (d.retained90 / maxVal) * (height - 50);
        const droppedH = (d.dropped / maxVal) * (height - 50);
        return (
          <g key={i}>
            <rect x={x} y={height - 28 - retainedH} width={barWidth} height={retainedH} rx="2" fill="#4caf50" opacity={0.85} />
            <rect x={x} y={height - 28 - retainedH - droppedH} width={barWidth} height={droppedH} rx="2" fill="#f44336" opacity={0.85} />
            <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" fontSize="9" fill="#666">{d.month}</text>
          </g>
        );
      })}
      <g transform="translate(50, 4)">
        <rect x="0" y="0" width="8" height="8" rx="2" fill="#4caf50" />
        <text x="12" y="8" fontSize="8" fill="#666">Retained (90d)</text>
        <rect x="90" y="0" width="8" height="8" rx="2" fill="#f44336" />
        <text x="102" y="8" fontSize="8" fill="#666">Dropped</text>
      </g>
    </svg>
  );
}

function MentorCapacityChart({ data, height = 180 }) {
  return (
    <svg width="100%" height={height} viewBox={`0 0 350 ${height}`}>
      {data.map((m, i) => {
        const y = 8 + i * 22;
        const capacityW = (m.maxMentees / 5) * 200;
        const currentW = (m.mentees / 5) * 200;
        return (
          <g key={i}>
            <text x="75" y={y + 10} textAnchor="end" fontSize="9" fill="#666">{m.name.split(' ')[0]}</text>
            <rect x="80" y={y} width={capacityW} height="12" rx="3" fill="#f0f0f0" />
            <rect x="80" y={y} width={currentW} height="12" rx="3" fill={m.available ? '#4caf50' : '#ff9800'} opacity={0.85} />
            <text x={85 + capacityW} y={y + 10} fontSize="8" fill="#666">{m.mentees}/{m.maxMentees}</text>
            {m.available && <text x={85 + capacityW + 30} y={y + 10} fontSize="8" fill="#4caf50">★</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Tab Panels ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const theme = useTheme();
  return (
    <Grid container spacing={3}>
      {/* KPI Cards */}
      {KPI_CARDS.map((kpi, i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${kpi.bg}, white)`, border: `1px solid ${alpha(kpi.color, 0.1)}` }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                  <Typography variant="h5" fontWeight={700} color={kpi.color}>{kpi.value}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(kpi.color, 0.15), color: kpi.color, width: 40, height: 40 }}>{kpi.icon}</Avatar>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
                {kpi.change > 0 ? (
                  kpi.invert ? <TrendUpIcon sx={{ fontSize: 14, color: 'error.main' }} /> : <TrendUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                ) : kpi.change < 0 ? (
                  kpi.invert ? <TrendDownIcon sx={{ fontSize: 14, color: 'success.main' }} /> : <TrendDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
                ) : null}
                <Typography variant="caption" color={kpi.change > 0 ? (kpi.invert ? 'error' : 'success') : kpi.change < 0 ? (kpi.invert ? 'success' : 'error') : 'text.secondary'}>
                  {Math.abs(kpi.change)}% vs last month
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* Onboarding Timeline */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Onboarding Phases — Master Checklist" subheader="Pre-boarding → 30 → 60 → 90 days" avatar={<RocketIcon color="primary" />} />
          <CardContent>
            <ProgressTimeline phases={ONBOARDING_PHASES} height={140} />
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              {ONBOARDING_PHASES.map((phase, i) => {
                const completed = phase.tasks.filter(t => t.completed).length;
                return (
                  <Grid item xs={12} sm={6} md={3} key={i}>
                    <Paper sx={{ p: 1.5, borderTop: `3px solid ${phase.color}` }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700} color={phase.color}>{phase.phase}</Typography>
                        <Typography variant="caption" fontWeight={600}>{completed}/{phase.tasks.length}</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={(completed / phase.tasks.length) * 100}
                        sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: phase.color, borderRadius: 3 } }} />
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Active New Hires */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Active New Hires" subheader={`${ACTIVE_NEW_HIRES.length} employees currently in onboarding`} avatar={<GroupsIcon color="primary" />} />
          <CardContent>
            <Grid container spacing={2}>
              {ACTIVE_NEW_HIRES.map((hire, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Paper sx={{
                    p: 2, border: `2px solid ${hire.status === 'ahead' ? alpha('#4caf50', 0.3) : hire.status === 'at-risk' ? alpha('#f44336', 0.3) : alpha('#2196f3', 0.2)}`,
                  }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={<Box sx={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', bgcolor: hire.status === 'ahead' ? 'success.main' : hire.status === 'at-risk' ? 'error.main' : 'info.main' }} />}
                      >
                        <Avatar sx={{ bgcolor: hire.status === 'ahead' ? 'success.main' : hire.status === 'at-risk' ? 'error.main' : 'info.main', width: 40, height: 40, fontSize: 14 }}>
                          {hire.avatar}
                        </Avatar>
                      </Badge>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>{hire.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{hire.role} · {hire.dept}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Chip size="small" label={hire.phase}
                        color={hire.phase === 'day90' ? 'success' : hire.phase === 'day60' ? 'warning' : 'primary'}
                        sx={{ fontSize: 10, height: 20 }} />
                      <Typography variant="caption" fontWeight={600}>{hire.tasksCompleted}/{hire.tasksTotal} tasks</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={hire.progress}
                      sx={{ height: 8, borderRadius: 4, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: hire.status === 'ahead' ? 'success.main' : hire.status === 'at-risk' ? 'error.main' : 'primary' } }} />
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">🧑‍🏫 {hire.mentor}</Typography>
                      <Typography variant="caption" color="text.secondary">🤝 {hire.buddy}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                      {[...Array(5)].map((_, s) => (
                        <Box key={s} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s < Math.round(hire.satisfaction) ? '#ffc107' : '#e0e0e0' }} />
                      ))}
                      <Typography variant="caption" sx={{ ml: 0.5 }}>{hire.satisfaction}</Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Insights */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Onboarding Intelligence" subheader="AI-powered insights to improve new hire experience" avatar={<InsightsIcon color="primary" />} />
          <CardContent>
            <Grid container spacing={2}>
              {ONBOARDING_INSIGHTS.map((insight, i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Alert severity={insight.severity === 'positive' ? 'success' : insight.severity === 'critical' ? 'error' : insight.severity === 'info' ? 'info' : 'warning'}
                    sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                    <Typography variant="body2">{insight.insight}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip size="small" label={insight.action} variant="outlined" sx={{ fontSize: 10 }} />
                      <Chip size="small" label={`Impact: ${insight.impact}`} color={insight.impact === 'high' ? 'error' : 'default'} variant="outlined" sx={{ fontSize: 10 }} />
                    </Stack>
                  </Alert>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function TaskTrackingTab() {
  return (
    <Grid container spacing={3}>
      {/* Phase Task Breakdown */}
      {ONBOARDING_PHASES.map((phase, pi) => {
        const completedCount = phase.tasks.filter(t => t.completed).length;
        return (
          <Grid item xs={12} md={6} key={pi}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title={`${phase.phase}`}
                subheader={phase.range}
                action={
                  <Chip size="small" label={`${completedCount}/${phase.tasks.length}`}
                    color={completedCount === phase.tasks.length ? 'success' : 'default'}
                    sx={{ fontWeight: 700 }} />
                }
                sx={{ borderBottom: `3px solid ${phase.color}` }}
              />
              <CardContent>
                <LinearProgress variant="determinate" value={(completedCount / phase.tasks.length) * 100}
                  sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: phase.color, borderRadius: 4 } }} />
                <List disablePadding>
                  {phase.tasks.map((task, ti) => (
                    <ListItem key={ti} sx={{ px: 0, py: 0.75 }}>
                      <ListItemAvatar sx={{ minWidth: 36 }}>
                        {task.completed ? (
                          <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
                        ) : (
                          <UncheckedIcon sx={{ fontSize: 20, color: '#ccc' }} />
                        )}
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'text.secondary' : 'text.primary' }}>
                            {task.task}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        );
      })}

      {/* Task Stats */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Task Completion by Department" subheader="Average progress across all new hires" />
          <CardContent>
            <Stack spacing={1.5}>
              {DEPT_ONBOARDING.sort((a, b) => b.avgProgress - a.avgProgress).map((d, i) => (
                <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 100 }}>{d.dept}</Typography>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress variant="determinate" value={d.avgProgress}
                          sx={{ height: 10, borderRadius: 5, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: d.color } }} />
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ minWidth: 40, textAlign: 'right' }}>{d.avgProgress}%</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
                      <Chip size="small" label={`${d.active} active`} variant="outlined" sx={{ fontSize: 10 }} />
                      <Chip size="small" label={`${d.avgDays}d avg`} variant="outlined" sx={{ fontSize: 10 }} />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function MentorshipTab() {
  return (
    <Grid container spacing={3}>
      {/* Mentor Pool */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Mentor Pool" subheader={`${MENTOR_POOL.filter(m => m.available).length} mentors available`} avatar={<MentorIcon color="secondary" />} />
          <CardContent>
            <MentorCapacityChart data={MENTOR_POOL} height={200} />
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1.5}>
              {MENTOR_POOL.map((m, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Paper sx={{ p: 1.5, border: `1px solid ${m.available ? alpha('#4caf50', 0.2) : '#f0f0f0'}` }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: m.available ? 'success.main' : 'grey.400', width: 36, height: 36, fontSize: 12 }}>
                        {m.avatar}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2" fontWeight={600}>{m.name}</Typography>
                          <Chip size="small" label={m.available ? 'Available' : 'Full'}
                            color={m.available ? 'success' : 'default'} sx={{ fontSize: 9, height: 18 }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{m.expertise} · {m.exp} exp</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {[...Array(5)].map((_, s) => (
                              <Box key={s} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s < Math.round(m.rating) ? '#ffc107' : '#e0e0e0' }} />
                            ))}
                            <Typography variant="caption" sx={{ ml: 0.5 }}>{m.rating}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">|</Typography>
                          <Typography variant="caption" color="text.secondary">{m.mentees}/{m.maxMentees} mentees</Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Mentorship Stats */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Mentorship Metrics" />
          <CardContent>
            <Stack spacing={2}>
              {[
                { label: 'Match Rate', value: '96%', sub: '23 of 24 hires matched', color: '#4caf50', icon: <HandshakeIcon /> },
                { label: 'Avg Mentee Rating', value: '4.6/5', sub: 'Based on 18 surveys', color: '#ffc107', icon: <StarIcon /> },
                { label: '1:1 Frequency', value: '2.4x/wk', sub: 'Target: 2x/week', color: '#2196f3', icon: <ChatIcon /> },
                { label: 'Mentor Capacity', value: '87%', sub: '22 of 25 slots filled', color: '#9c27b0', icon: <GroupsIcon /> },
                { label: 'Retention Impact', value: '+23%', sub: 'Mentored vs non-mentored', color: '#4caf50', icon: <TrendUpIcon /> },
              ].map((m, i) => (
                <Paper key={i} sx={{ p: 1.5, borderLeft: `4px solid ${m.color}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{m.label}</Typography>
                      <Typography variant="h6" fontWeight={700} color={m.color}>{m.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.sub}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(m.color, 0.15), color: m.color, width: 36, height: 36 }}>{m.icon}</Avatar>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Mentorship Pairs */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Active Mentorship Pairs" subheader="Current mentor-mentee assignments" />
          <CardContent>
            <Stack spacing={1.5}>
              {ACTIVE_NEW_HIRES.map((hire, i) => (
                <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, fontSize: 11, bgcolor: 'info.main' }}>{hire.avatar}</Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{hire.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{hire.role}</Typography>
                      </Box>
                    </Stack>
                    <Avatar sx={{ bgcolor: '#ccc', width: 28, height: 28, fontSize: 10 }}>
                      <HandshakeIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={600} textAlign="right">{hire.mentor}</Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="right">Mentor</Typography>
                      </Box>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 11, bgcolor: 'success.main' }}>{hire.mentor.split(' ').map(n => n[0]).join('')}</Avatar>
                    </Stack>
                    <Stack alignItems="center" sx={{ ml: 2 }}>
                      <Typography variant="caption" fontWeight={600}>{hire.progress}%</Typography>
                      <Typography variant="caption" color="text.secondary">progress</Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function AnalyticsTab() {
  return (
    <Grid container spacing={3}>
      {/* Retention Trends */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="90-Day Retention Trends" subheader="Hires retained vs dropped by month" avatar={<TimelineIcon color="primary" />} />
          <CardContent>
            <StackedBarChart data={ONBOARDING_TRENDS} height={200} />
            <Stack direction="row" justifyContent="space-around" sx={{ mt: 2 }}>
              {[
                { label: 'Total Hires (YTD)', value: '162', color: '#2196f3' },
                { label: 'Retained (90d)', value: '136', color: '#4caf50' },
                { label: 'Dropped', value: '26', color: '#f44336' },
                { label: 'Retention Rate', value: '84%', color: '#9c27b0' },
              ].map((s, i) => (
                <Stack key={i} alignItems="center">
                  <Typography variant="h6" fontWeight={700} color={s.color}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Satisfaction Trend */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Satisfaction Trend" />
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <DonutChart value={86} color="#4caf50" label="Above 4.0" size={120} thickness={10} />
            </Box>
            <Stack spacing={1}>
              {ONBOARDING_TRENDS.map((d, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption">{d.month}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    {[...Array(5)].map((_, s) => (
                      <Box key={s} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s < Math.round(d.satisfaction) ? '#ffc107' : '#e0e0e0' }} />
                    ))}
                    <Typography variant="caption" fontWeight={600} sx={{ ml: 0.5 }}>{d.satisfaction}</Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Drop-out Reasons */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Onboarding Drop-out Reasons" subheader="26 hires dropped before 90-day mark" avatar={<SadIcon color="error" />} />
          <CardContent>
            <Stack spacing={1.5}>
              {DROPOUT_REASONS.map((r, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.color }} />
                      <Typography variant="body2" fontWeight={500}>{r.reason}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={700}>{r.pct}%</Typography>
                      <Typography variant="caption" color="text.secondary">({r.count})</Typography>
                    </Stack>
                  </Stack>
                  <LinearProgress variant="determinate" value={r.pct}
                    sx={{ mt: 0.3, height: 6, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: r.color, borderRadius: 3 } }} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Department Onboarding */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Department Onboarding Performance" subheader="Progress, retention, and satisfaction by dept" />
          <CardContent>
            <svg width="100%" height="220" viewBox="0 0 400 220">
              {DEPT_ONBOARDING.sort((a, b) => b.avgProgress - a.avgProgress).map((d, i) => {
                const y = 10 + i * 24;
                const progressW = (d.avgProgress / 100) * 180;
                return (
                  <g key={i}>
                    <text x="85" y={y + 12} textAnchor="end" fontSize="9" fill="#666">{d.dept.substring(0, 10)}</text>
                    <rect x="90" y={y} width="180" height="14" rx="3" fill="#f5f5f5" />
                    <rect x="90" y={y} width={progressW} height="14" rx="3" fill={d.color} opacity={0.85} />
                    <text x={95 + progressW} y={y + 10} fontSize="9" fill="#333" fontWeight="600">{d.avgProgress}%</text>
                    <text x="280" y={y + 10} fontSize="8" fill="#4caf50">{d.retention}% ret</text>
                    <text x="340" y={y + 10} fontSize="8" fill="#ffc107">{d.satisfaction}★</text>
                  </g>
                );
              })}
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Time to Productive */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Time to Productive — By Role" subheader="Days until new hire reaches full productivity" />
          <CardContent>
            <Grid container spacing={2}>
              {[
                { role: 'Software Engineer', days: 42, target: 35, color: '#2196f3' },
                { role: 'Product Manager', days: 38, target: 30, color: '#9c27b0' },
                { role: 'UX Designer', days: 45, target: 40, color: '#e91e63' },
                { role: 'Sales Executive', days: 50, target: 45, color: '#4caf50' },
                { role: 'Data Analyst', days: 55, target: 45, color: '#ff5722' },
                { role: 'Content Strategist', days: 48, target: 40, color: '#ff9800' },
                { role: 'HR Coordinator', days: 35, target: 30, color: '#00bcd4' },
                { role: 'Finance Analyst', days: 48, target: 40, color: '#3f51b5' },
              ].map((r, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Paper sx={{ p: 1.5, borderTop: `3px solid ${r.color}` }}>
                    <Typography variant="caption" color="text.secondary">{r.role}</Typography>
                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <Typography variant="h5" fontWeight={700} color={r.days <= r.target ? 'success.main' : 'warning.main'}>{r.days}d</Typography>
                      <Typography variant="caption" color="text.secondary">target: {r.target}d</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={(r.days / 60) * 100}
                      sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: r.days <= r.target ? 'success.main' : 'warning.main', borderRadius: 3 } }} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function OnboardingLifecycleTracker() {
  const [tab, setTab] = useState(0);

  const tabLabels = [
    { label: 'Overview', icon: <AssessmentIcon /> },
    { label: 'Task Tracking', icon: <FactCheckIcon /> },
    { label: 'Mentorship', icon: <MentorIcon /> },
    { label: 'Analytics', icon: <InsightsIcon /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RocketIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" fontWeight={700}>Onboarding Lifecycle Tracker</Typography>
              <Typography variant="body2" color="text.secondary">
                30-60-90 day tracking · Mentorship matching · Task completion · New hire analytics
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip icon={<HiredIcon />} label="24 Active" color="primary" variant="outlined" size="small" />
          <Chip icon={<CheckIcon />} label="82% Retention" color="success" variant="outlined" size="small" />
        </Stack>
      </Stack>

      {/* Alert */}
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>📋 6 IT setup tickets pending</strong> — 3 new hires awaiting equipment. Average delay: 4.2 days.{' '}
        <Button size="small" color="inherit" sx={{ fontWeight: 700 }}>Escalate IT →</Button>
      </Alert>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 500 } }}>
          {tabLabels.map((t, i) => (
            <Tab key={i} icon={t.icon} label={t.label} iconPosition="start" />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {tab === 0 && <OverviewTab />}
      {tab === 1 && <TaskTrackingTab />}
      {tab === 2 && <MentorshipTab />}
      {tab === 3 && <AnalyticsTab />}

      {/* Footer */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Data updated: Aug 26, 2026 · Source: HRIS + Onboarding Platform + Surveys · 24 active new hires across 9 departments
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Export Report">
              <IconButton size="small"><AssessmentIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Schedule Review">
              <IconButton size="small"><CalendarIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
