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
  People as PeopleIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  PersonAdd as HiredIcon,
  PersonRemove as ExitIcon,
  Assessment as AssessmentIcon,
  Insights as InsightsIcon,
  Group as GroupIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Balance as BalanceIcon,
  CalendarMonth as CalendarIcon,
  Map as MapIcon,
  PieChart as PieIcon,
  BarChart as BarIcon,
  ShowChart as LineIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Business as BusinessIcon,
  Engineering as EngineeringIcon,
  Code as CodeIcon,
  DesignServices as DesignIcon,
  Campaign as MarketingIcon,
  AttachMoney as FinanceIcon,
  LocalHospital as HealthIcon,
  AdminPanelSettings as AdminIcon,
  Diversity3 as DiversityIcon,
  GlobalTrade as GlobalIcon,
  Timer as TimerIcon,
  SentimentSatisfied as HappyIcon,
  Handshake as HandshakeIcon,
  EmojiEvents as TrophyIcon,
  QueryStats as StatsIcon,
  PublishedWithChanges as PromotionIcon,
  MoveUp as TransferIcon,
  Biotech as RnDIcon,
} from '@mui/icons-material';

// ── Mock Data ──────────────────────────────────────────────────────────────

const COMPANY_OVERVIEW = {
  totalEmployees: 486,
  newHiresThisMonth: 18,
  exitsThisMonth: 7,
  openPositions: 34,
  avgTenure: 2.8,
  avgAge: 31.4,
  genderRatio: { male: 267, female: 204, nonBinary: 15 },
  diversityIndex: 0.78,
};

const KPI_CARDS = [
  { label: 'Total Headcount', value: '486', change: 11, icon: <PeopleIcon />, color: '#2196f3', bg: '#e3f2fd' },
  { label: 'New Hires (MTD)', value: '18', change: 5, icon: <HiredIcon />, color: '#4caf50', bg: '#e8f5e9' },
  { label: 'Exits (MTD)', value: '7', change: -2, icon: <ExitIcon />, color: '#f44336', bg: '#fce4ec', invert: true },
  { label: 'Turnover Rate', value: '11.2%', change: -1.8, icon: <TrendDownIcon />, color: '#ff9800', bg: '#fff3e0', invert: true },
  { label: 'Open Positions', value: '34', change: 8, icon: <WorkIcon />, color: '#9c27b0', bg: '#f3e5f5' },
  { label: 'Avg Tenure', value: '2.8y', change: 0.3, icon: <TimerIcon />, color: '#00bcd4', bg: '#e0f7fa' },
  { label: 'Time to Fill', value: '28d', change: -4, icon: <CalendarIcon />, color: '#3f51b5', bg: '#e8eaf6' },
  { label: 'Diversity Index', value: '0.78', change: 0.04, icon: <DiversityIcon />, color: '#e91e63', bg: '#fce4ec' },
];

const DEPARTMENT_HEADCOUNT = [
  { dept: 'Engineering', count: 124, male: 82, female: 38, nonBinary: 4, openRoles: 12, avgTenure: 3.1, attrition: 9.2 },
  { dept: 'Product', count: 42, male: 24, female: 16, nonBinary: 2, openRoles: 4, avgTenure: 2.6, attrition: 14.3 },
  { dept: 'Design', count: 28, male: 14, female: 12, nonBinary: 2, openRoles: 3, avgTenure: 2.9, attrition: 10.7 },
  { dept: 'Marketing', count: 46, male: 22, female: 22, nonBinary: 2, openRoles: 5, avgTenure: 2.2, attrition: 17.4 },
  { dept: 'Sales', count: 82, male: 48, female: 32, nonBinary: 2, openRoles: 8, avgTenure: 1.8, attrition: 22.0 },
  { dept: 'HR', count: 18, male: 8, female: 9, nonBinary: 1, openRoles: 1, avgTenure: 3.4, attrition: 5.6 },
  { dept: 'Finance', count: 32, male: 18, female: 13, nonBinary: 1, openRoles: 2, avgTenure: 3.6, attrition: 6.3 },
  { dept: 'Operations', count: 58, male: 32, female: 24, nonBinary: 2, openRoles: 4, avgTenure: 2.4, attrition: 13.8 },
  { dept: 'Legal', count: 14, male: 8, female: 6, nonBinary: 0, openRoles: 0, avgTenure: 4.1, attrition: 7.1 },
  { dept: 'Data Science', count: 24, male: 14, female: 9, nonBinary: 1, openRoles: 3, avgTenure: 2.3, attrition: 12.5 },
  { dept: 'Customer Success', count: 18, male: 8, female: 9, nonBinary: 1, openRoles: 2, avgTenure: 2.0, attrition: 16.7 },
];

const HEADCOUNT_FORECAST = [
  { month: 'Sep 25', actual: 452, forecast: 452, low: 452, high: 452 },
  { month: 'Oct 25', actual: 458, forecast: 458, low: 455, high: 461 },
  { month: 'Nov 25', actual: 464, forecast: 464, low: 458, high: 470 },
  { month: 'Dec 25', actual: 468, forecast: 468, low: 460, high: 476 },
  { month: 'Jan 26', actual: 472, forecast: 472, low: 462, high: 482 },
  { month: 'Feb 26', actual: 475, forecast: 475, low: 463, high: 487 },
  { month: 'Mar 26', actual: 478, forecast: 478, low: 464, high: 492 },
  { month: 'Apr 26', actual: 480, forecast: 480, low: 463, high: 497 },
  { month: 'May 26', actual: 483, forecast: 483, low: 462, high: 504 },
  { month: 'Jun 26', actual: 484, forecast: 484, low: 461, high: 507 },
  { month: 'Jul 26', actual: 485, forecast: 485, low: 458, high: 512 },
  { month: 'Aug 26', actual: 486, forecast: 486, low: 456, high: 516 },
  { month: 'Sep 26', actual: null, forecast: 492, low: 454, high: 530 },
  { month: 'Oct 26', actual: null, forecast: 498, low: 452, high: 544 },
  { month: 'Nov 26', actual: null, forecast: 505, low: 449, high: 561 },
  { month: 'Dec 26', actual: null, forecast: 512, low: 445, high: 579 },
];

const ATTRITION_RISK = [
  { name: 'Priya Sharma', dept: 'Sales', role: 'Account Executive', risk: 92, tenure: 0.8, lastPromotion: '18m ago', signals: ['Missed 2 1:1s', 'Declining KPIs', 'Updated LinkedIn'], avatar: 'PS' },
  { name: 'Rohit Mehta', dept: 'Engineering', role: 'Senior Dev', risk: 85, tenure: 3.2, lastPromotion: '24m ago', signals: ['Low eNPS score', 'No equity refresh', 'Peer left'], avatar: 'RM' },
  { name: 'Sneha Patel', dept: 'Marketing', role: 'Content Lead', risk: 78, tenure: 1.5, lastPromotion: '12m ago', signals: ['Passed over for promotion', 'Workload spike', 'PTO pattern change'], avatar: 'SP' },
  { name: 'Amit Kumar', dept: 'Sales', role: 'Sales Manager', risk: 74, tenure: 2.1, lastPromotion: '15m ago', signals: ['Comp below market', 'Team attrition', 'Reduced engagement'], avatar: 'AK' },
  { name: 'Deepa Nair', dept: 'Customer Success', role: 'CS Manager', risk: 68, tenure: 1.9, lastPromotion: '10m ago', signals: ['Role scope reduced', 'New manager conflict', 'Hiring freeze impact'], avatar: 'DN' },
  { name: 'Vikram Singh', dept: 'Engineering', role: 'Staff Dev', risk: 62, tenure: 4.1, lastPromotion: '30m ago', signals: ['Stale role growth', 'Requested transfer denied', 'Referral offers'], avatar: 'VS' },
  { name: 'Neha Gupta', dept: 'Design', role: 'UX Lead', risk: 58, tenure: 2.8, lastPromotion: '20m ago', signals: ['Burnout indicators', 'Late commits', 'Declining satisfaction'], avatar: 'NG' },
  { name: 'Karan Joshi', dept: 'Operations', role: 'Ops Analyst', risk: 52, tenure: 1.2, lastPromotion: '8m ago', signals: ['Market salary gap', 'LinkedIn activity', 'Peer departures'], avatar: 'KJ' },
];

const ATTRITION_TRENDS = [
  { month: 'Jan', hires: 22, exits: 12, net: 10 },
  { month: 'Feb', hires: 18, exits: 9, net: 9 },
  { month: 'Mar', hires: 25, exits: 14, net: 11 },
  { month: 'Apr', hires: 15, exits: 11, net: 4 },
  { month: 'May', hires: 20, exits: 8, net: 12 },
  { month: 'Jun', hires: 28, exits: 15, net: 13 },
  { month: 'Jul', hires: 16, exits: 10, net: 6 },
  { month: 'Aug', hires: 18, exits: 7, net: 11 },
];

const EXIT_REASONS = [
  { reason: 'Better Compensation', pct: 28, count: 31, color: '#f44336' },
  { reason: 'Career Growth', pct: 22, count: 24, color: '#ff9800' },
  { reason: 'Work-Life Balance', pct: 16, count: 18, color: '#ffeb3b' },
  { reason: 'Manager Issues', pct: 12, count: 13, color: '#9c27b0' },
  { reason: 'Relocation', pct: 8, count: 9, color: '#2196f3' },
  { reason: 'Company Culture', pct: 7, count: 8, color: '#00bcd4' },
  { reason: 'Role Misalignment', pct: 5, count: 6, color: '#4caf50' },
  { reason: 'Other', pct: 2, count: 2, color: '#9e9e9e' },
];

const HIRING_PIPELINE = [
  { stage: 'Applied', count: 842, conversion: 100 },
  { stage: 'Screened', count: 412, conversion: 49 },
  { stage: 'Phone Interview', count: 198, conversion: 48 },
  { stage: 'Technical', count: 112, conversion: 57 },
  { stage: 'Onsite', count: 68, conversion: 61 },
  { stage: 'Offer', count: 42, conversion: 62 },
  { stage: 'Accepted', count: 34, conversion: 81 },
];

const DEMOGRAPHICS = {
  ageBands: [
    { label: '20-25', count: 98, pct: 20.2, color: '#4caf50' },
    { label: '26-30', count: 162, pct: 33.3, color: '#2196f3' },
    { label: '31-35', count: 124, pct: 25.5, color: '#9c27b0' },
    { label: '36-40', count: 62, pct: 12.8, color: '#ff9800' },
    { label: '41-45', count: 26, pct: 5.3, color: '#f44336' },
    { label: '46+', count: 14, pct: 2.9, color: '#607d8b' },
  ],
  experienceBands: [
    { label: '<1y', count: 72, color: '#e3f2fd' },
    { label: '1-3y', count: 148, color: '#bbdefb' },
    { label: '3-5y', count: 126, color: '#90caf9' },
    { label: '5-10y', count: 92, color: '#42a5f5' },
    { label: '10y+', count: 48, color: '#1e88e5' },
  ],
  locations: [
    { city: 'Bangalore', count: 186, pct: 38.3 },
    { city: 'Mumbai', count: 92, pct: 18.9 },
    { city: 'Delhi NCR', count: 78, pct: 16.0 },
    { city: 'Hyderabad', count: 54, pct: 11.1 },
    { city: 'Pune', count: 38, pct: 7.8 },
    { city: 'Chennai', count: 24, pct: 5.0 },
    { city: 'Remote (Intl)', count: 14, pct: 2.9 },
  ],
};

const TENURE_DISTRIBUTION = [
  { band: '<6m', count: 52, color: '#f44336' },
  { band: '6m-1y', count: 68, color: '#ff9800' },
  { band: '1-2y', count: 124, color: '#ffc107' },
  { band: '2-3y', count: 98, color: '#4caf50' },
  { band: '3-5y', count: 86, color: '#2196f3' },
  { band: '5y+', count: 58, color: '#9c27b0' },
];

const PROMOTION_DATA = [
  { dept: 'Engineering', promoted: 14, eligible: 62, rate: 22.6, avgTime: '2.1y' },
  { dept: 'Product', promoted: 6, eligible: 22, rate: 27.3, avgTime: '1.8y' },
  { dept: 'Design', promoted: 4, eligible: 14, rate: 28.6, avgTime: '2.0y' },
  { dept: 'Marketing', promoted: 5, eligible: 28, rate: 17.9, avgTime: '2.4y' },
  { dept: 'Sales', promoted: 12, eligible: 52, rate: 23.1, avgTime: '1.6y' },
  { dept: 'HR', promoted: 3, eligible: 8, rate: 37.5, avgTime: '2.8y' },
  { dept: 'Finance', promoted: 4, eligible: 16, rate: 25.0, avgTime: '2.5y' },
  { dept: 'Operations', promoted: 7, eligible: 32, rate: 21.9, avgTime: '2.2y' },
];

const ORG_INSIGHTS = [
  { insight: 'Sales has 22% attrition — highest across all departments. Comp-audit reveals 15% below market for mid-level AEs.', severity: 'critical', impact: 'high', action: 'Urgent salary band review' },
  { insight: 'Engineering staff-IC ratio is 1:8 — above the 1:6 industry benchmark. Promotions are stalling.', severity: 'warning', impact: 'high', action: 'Expand IC career ladder' },
  { insight: 'Gender diversity in Engineering is 30.6% female — up from 24.2% last year. Hiring initiatives are working.', severity: 'positive', impact: 'medium', action: 'Continue diversity sourcing' },
  { insight: '90-day new hire retention dropped to 76%. Onboarding gaps identified in anonymous surveys.', severity: 'warning', impact: 'medium', action: 'Redesign 30-60-90 plan' },
  { insight: 'Remote employees show 18% higher engagement than in-office. Hybrid policy review recommended.', severity: 'info', impact: 'low', action: 'Expand remote-first options' },
  { insight: 'Promotion velocity in Marketing (2.4y avg) is 40% slower than Product (1.8y). Equity risk.', severity: 'warning', impact: 'high', action: 'Review promotion criteria' },
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
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>
        {value}%
      </text>
      {label && <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize="8" fill="#999">{label}</text>}
    </svg>
  );
}

function StackedBarChart({ data, keys, colors, labels, height = 200, width = 400 }) {
  const max = Math.max(...data.map(d => keys.reduce((s, k) => s + d[k], 0)));

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const barWidth = Math.floor((width - 60) / data.length) - 6;
        const x = 30 + i * (barWidth + 6);
        let yOff = 0;
        return (
          <g key={i}>
            {keys.map((key, ki) => {
              const barH = (d[key] / max) * (height - 40);
              const y = height - 24 - yOff - barH;
              yOff += barH;
              return <rect key={ki} x={x} y={y} width={barWidth} height={barH} fill={colors[ki]} rx={ki === 0 ? '0' : ki === keys.length - 1 ? '3' : '0'} />;
            })}
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="#666">
              {data[i].month}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) => (
        <g key={`l${i}`} transform={`translate(${30 + i * 80}, 4)`}>
          <rect x="0" y="0" width="10" height="10" rx="2" fill={colors[i]} />
          <text x="14" y="9" fontSize="9" fill="#666">{l}</text>
        </g>
      ))}
    </svg>
  );
}

function FunnelChart({ data, height = 200, width = 350 }) {
  const maxCount = data[0].count;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const pct = d.count / maxCount;
        const stageWidth = pct * (width - 100);
        const stageHeight = (height - 30) / data.length;
        const x = (width - stageWidth) / 2;
        const y = 10 + i * stageHeight;
        const colors = ['#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39'];
        return (
          <g key={i}>
            <rect x={x} y={y + 2} width={stageWidth} height={stageHeight - 4} rx="4" fill={colors[i] || '#9e9e9e'} opacity={0.85} />
            <text x={width / 2} y={y + stageHeight / 2 + 1} textAnchor="middle" fontSize="10" fill="white" fontWeight="600">
              {d.stage}: {d.count.toLocaleString()} ({d.conversion}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizontalBar({ data, maxValue, height = 200 }) {
  const max = maxValue || Math.max(...data.map(d => d.value || d.count));
  const barHeight = 22;

  return (
    <svg width="100%" height={height} viewBox={`0 0 350 ${height}`}>
      {data.map((d, i) => {
        const y = 8 + i * (barHeight + 8);
        const w = ((d.value || d.count) / max) * 200;
        return (
          <g key={i}>
            <text x="85" y={y + 15} textAnchor="end" fontSize="10" fill="#666">{d.label || d.city}</text>
            <rect x="90" y={y} width="200" height={barHeight} rx="4" fill="#f5f5f5" />
            <rect x="90" y={y} width={w} height={barHeight} rx="4" fill={d.color || '#2196f3'} opacity={0.85} />
            <text x={95 + w} y={y + 15} fontSize="10" fill="#333" fontWeight="600">
              {d.pct ? `${d.pct}%` : d.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Tab Panels ─────────────────────────────────────────────────────────────

function OverviewTab() {
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
                <Avatar sx={{ bgcolor: alpha(kpi.color, 0.15), color: kpi.color, width: 40, height: 40 }}>
                  {kpi.icon}
                </Avatar>
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

      {/* Department Headcount */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Department Headcount & Attrition" subheader="Employee count and attrition rate by department" />
          <CardContent>
            <Stack spacing={1.5}>
              {DEPARTMENT_HEADCOUNT.sort((a, b) => b.count - a.count).map((d, i) => (
                <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 110 }}>{d.dept}</Typography>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={(d.count / 130) * 100}
                          sx={{ height: 14, borderRadius: 7, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { borderRadius: 7, bgcolor: '#2196f3' } }}
                        />
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ minWidth: 35, textAlign: 'right' }}>{d.count}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: 2 }}>
                      <Chip size="small" label={`${d.attrition}% attr.`} color={d.attrition > 15 ? 'error' : d.attrition > 10 ? 'warning' : 'success'} variant="outlined" sx={{ fontSize: 10 }} />
                      <Chip size="small" label={`${d.openRoles} open`} color="primary" variant="outlined" sx={{ fontSize: 10 }} />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Gender Diversity */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Gender Distribution" avatar={<DiversityIcon color="secondary" />} />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DonutChart value={54.9} color="#2196f3" label="Male" size={100} thickness={10} />
              <DonutChart value={42.0} color="#e91e63" label="Female" size={100} thickness={10} />
            </Box>
            <Stack alignItems="center">
              <DonutChart value={3.1} color="#9c27b0" label="Non-Binary" size={70} thickness={8} />
            </Stack>
            <Alert severity="success" sx={{ width: '100%', fontSize: 12 }}>
              Gender diversity index: <strong>0.78</strong> (target: 0.85)
            </Alert>
            <Stack spacing={1} sx={{ width: '100%' }}>
              {DEPARTMENT_HEADCOUNT.slice(0, 5).map((d, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">{d.dept}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Box sx={{ height: 8, width: `${(d.male / d.count) * 60}px`, bgcolor: '#2196f3', borderRadius: 1 }} />
                    <Box sx={{ height: 8, width: `${(d.female / d.count) * 60}px`, bgcolor: '#e91e63', borderRadius: 1 }} />
                    <Box sx={{ height: 8, width: `${(d.nonBinary / d.count) * 60}px`, bgcolor: '#9c27b0', borderRadius: 1 }} />
                  </Stack>
                  <Typography variant="caption" fontWeight={600}>{Math.round((d.female / d.count) * 100)}% F</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Hiring Pipeline Funnel */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Hiring Pipeline Funnel" subheader="842 applicants → 34 accepted offers" avatar={<HiredIcon color="primary" />} />
          <CardContent>
            <FunnelChart data={HIRING_PIPELINE} height={220} />
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="space-around">
              {[
                { label: 'Overall Conversion', value: '4.0%', color: '#2196f3' },
                { label: 'Avg Time to Offer', value: '28d', color: '#4caf50' },
                { label: 'Offer Accept Rate', value: '81%', color: '#9c27b0' },
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

      {/* Org Insights */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="AI Org Insights" subheader="Actionable workforce intelligence" avatar={<InsightsIcon color="primary" />} />
          <CardContent>
            <Stack spacing={1.5}>
              {ORG_INSIGHTS.map((insight, i) => (
                <Alert
                  key={i}
                  severity={insight.severity === 'positive' ? 'success' : insight.severity === 'critical' ? 'error' : insight.severity === 'info' ? 'info' : 'warning'}
                  sx={{ '& .MuiAlert-message': { width: '100%' } }}
                >
                  <Typography variant="body2">{insight.insight}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip size="small" label={insight.action} variant="outlined" sx={{ fontSize: 10 }} />
                    <Chip size="small" label={`Impact: ${insight.impact}`} color={insight.impact === 'high' ? 'error' : 'default'} variant="outlined" sx={{ fontSize: 10 }} />
                  </Stack>
                </Alert>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function AttritionTab() {
  return (
    <Grid container spacing={3}>
      {/* Attrition Trends */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Hiring vs Exits — Monthly Trends" subheader="Net headcount change over 8 months" />
          <CardContent>
            <StackedBarChart
              data={ATTRITION_TRENDS}
              keys={['hires', 'exits']}
              colors={['#4caf50', '#f44336']}
              labels={['Hires', 'Exits']}
              height={200}
            />
            <Stack direction="row" justifyContent="space-around" sx={{ mt: 2 }}>
              {[
                { label: 'Total Hires (YTD)', value: '162', color: '#4caf50' },
                { label: 'Total Exits (YTD)', value: '86', color: '#f44336' },
                { label: 'Net Growth', value: '+76', color: '#2196f3' },
              ].map((s, i) => (
                <Stack key={i} alignItems="center">
                  <Typography variant="h5" fontWeight={700} color={s.color}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Exit Reasons */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Exit Reasons" subheader="111 exits analyzed" />
          <CardContent>
            <Stack spacing={1.5}>
              {EXIT_REASONS.map((r, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.color }} />
                      <Typography variant="caption" fontWeight={500}>{r.reason}</Typography>
                    </Stack>
                    <Typography variant="caption" fontWeight={700}>{r.pct}% ({r.count})</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={r.pct}
                    sx={{ mt: 0.3, height: 6, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: r.color, borderRadius: 3 } }}
                  />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* At-Risk Employees */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Attrition Risk — Top 8" subheader="ML-predicted flight risk based on 15+ behavioral signals" avatar={<WarningIcon color="warning" />} />
          <CardContent>
            <Grid container spacing={2}>
              {ATTRITION_RISK.map((emp, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                  <Paper sx={{
                    p: 2, border: `2px solid ${emp.risk >= 75 ? alpha('#f44336', 0.3) : emp.risk >= 60 ? alpha('#ff9800', 0.3) : alpha('#2196f3', 0.2)}`,
                    height: '100%',
                  }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={<Box sx={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', bgcolor: emp.risk >= 75 ? 'error.main' : emp.risk >= 60 ? 'warning.main' : 'info.main' }} />}
                      >
                        <Avatar sx={{ bgcolor: emp.risk >= 75 ? 'error.main' : emp.risk >= 60 ? 'warning.main' : 'info.main', width: 40, height: 40, fontSize: 14 }}>
                          {emp.avatar}
                        </Avatar>
                      </Badge>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>{emp.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{emp.role} · {emp.dept}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h5" fontWeight={700} color={emp.risk >= 75 ? 'error.main' : emp.risk >= 60 ? 'warning.main' : 'info.main'}>
                        {emp.risk}%
                      </Typography>
                      <Stack alignItems="flex-end">
                        <Typography variant="caption" color="text.secondary">Tenure: {emp.tenure}y</Typography>
                        <Typography variant="caption" color="text.secondary">Last promo: {emp.lastPromotion}</Typography>
                      </Stack>
                    </Stack>
                    <Stack spacing={0.5}>
                      {emp.signals.map((s, j) => (
                        <Chip key={j} size="small" label={s} variant="outlined" sx={{ fontSize: 9, height: 18, justifyContent: 'flex-start' }} />
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Tenure Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Tenure Distribution" subheader="How long employees stay" />
          <CardContent>
            <svg width="100%" height="200" viewBox="0 0 350 200">
              {TENURE_DISTRIBUTION.map((d, i) => {
                const barWidth = 42;
                const max = 130;
                const barH = (d.count / max) * 140;
                const x = 20 + i * (barWidth + 14);
                return (
                  <g key={i}>
                    <rect x={x} y={160 - barH} width={barWidth} height={barH} rx="4" fill={d.color} opacity={0.85} />
                    <text x={x + barWidth / 2} y={155 - barH} textAnchor="middle" fontSize="11" fill="#333" fontWeight="600">{d.count}</text>
                    <text x={x + barWidth / 2} y={178} textAnchor="middle" fontSize="10" fill="#666">{d.band}</text>
                  </g>
                );
              })}
              <text x="175" y="196" textAnchor="middle" fontSize="10" fill="#999">⚠ 120 employees (24.7%) have tenure under 1 year</text>
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Promotion Velocity */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Promotion Velocity" subheader="Promotion rate and avg time by department" avatar={<TrophyIcon sx={{ color: '#ffc107' }} />} />
          <CardContent>
            <Stack spacing={1.5}>
              {PROMOTION_DATA.sort((a, b) => b.rate - a.rate).map((d, i) => (
                <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={600}>{d.dept}</Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{d.rate}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={d.rate}
                        sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { borderRadius: 3 } }}
                      />
                    </Box>
                    <Stack alignItems="flex-end" sx={{ ml: 2, minWidth: 80 }}>
                      <Typography variant="caption" color="text.secondary">{d.promoted}/{d.eligible} promoted</Typography>
                      <Typography variant="caption" color="text.secondary">Avg: {d.avgTime}</Typography>
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

function DemographicsTab() {
  return (
    <Grid container spacing={3}>
      {/* Age Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Age Distribution" subheader="Employee count by age band" />
          <CardContent>
            <svg width="100%" height="200" viewBox="0 0 350 200">
              {DEMOGRAPHICS.ageBands.map((d, i) => {
                const barWidth = 40;
                const max = 170;
                const barH = (d.count / max) * 130;
                const x = 15 + i * (barWidth + 14);
                return (
                  <g key={i}>
                    <rect x={x} y={150 - barH} width={barWidth} height={barH} rx="4" fill={d.color} opacity={0.85} />
                    <text x={x + barWidth / 2} y={145 - barH} textAnchor="middle" fontSize="10" fill="#333" fontWeight="600">{d.count}</text>
                    <text x={x + barWidth / 2} y={165} textAnchor="middle" fontSize="9" fill="#666">{d.label}</text>
                    <text x={x + barWidth / 2} y={178} textAnchor="middle" fontSize="8" fill="#999">{d.pct}%</text>
                  </g>
                );
              })}
            </svg>
            <Alert severity="info" sx={{ mt: 1, fontSize: 12 }}>
              Median age: <strong>31.4 years</strong> · 53.5% under 30 — strong early-career cohort
            </Alert>
          </CardContent>
        </Card>
      </Grid>

      {/* Experience Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Experience Distribution" subheader="Years of professional experience" />
          <CardContent>
            <Stack spacing={1.5}>
              {DEMOGRAPHICS.experienceBands.map((d, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={500}>{d.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{d.count} employees ({Math.round(d.count / 486 * 100)}%)</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(d.count / 155) * 100}
                    sx={{ mt: 0.5, height: 12, borderRadius: 6, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: d.color, borderRadius: 6 } }}
                  />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Location Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Geographic Distribution" subheader="Employees by office location" avatar={<MapIcon color="primary" />} />
          <CardContent>
            <HorizontalBar
              data={DEMOGRAPHICS.locations.map(l => ({ ...l, label: l.city, value: l.count, color: l.pct > 20 ? '#2196f3' : l.pct > 10 ? '#03a9f4' : '#90caf9' }))}
              height={240}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Level Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Level Distribution" subheader="Employee count by seniority level" />
          <CardContent>
            <svg width="100%" height="220" viewBox="0 0 350 220">
              {[
                { level: 'Intern', count: 24, color: '#e8f5e9' },
                { level: 'Junior (L1-L2)', count: 148, color: '#a5d6a7' },
                { level: 'Mid (L3-L4)', count: 178, color: '#66bb6a' },
                { level: 'Senior (L5-L6)', count: 92, color: '#43a047' },
                { level: 'Staff (L7-L8)', count: 32, color: '#2e7d32' },
                { level: 'Principal (L9+)', count: 8, color: '#1b5e20' },
                { level: 'Director+', count: 4, color: '#004d40' },
              ].map((d, i) => {
                const barH = (d.count / 185) * 160;
                const x = 20 + i * 45;
                return (
                  <g key={i}>
                    <rect x={x} y={180 - barH} width="35" height={barH} rx="4" fill={d.color} />
                    <text x={x + 17} y={175 - barH} textAnchor="middle" fontSize="10" fill="#333" fontWeight="600">{d.count}</text>
                    <text x={x + 17} y={198} textAnchor="middle" fontSize="7" fill="#666" transform={`rotate(0)`}>{d.level.split(' ')[0]}</text>
                  </g>
                );
              })}
              <text x="175" y="216" textAnchor="middle" fontSize="9" fill="#999">⚠ 72% of workforce in Junior-Mid levels — succession planning needed</text>
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Education Background */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Education & Certification Highlights" />
          <CardContent>
            <Grid container spacing={2}>
              {[
                { label: "Bachelor's Degree", value: 284, pct: 58.4, icon: <SchoolIcon />, color: '#2196f3' },
                { label: "Master's Degree", value: 142, pct: 29.2, icon: <SchoolIcon />, color: '#9c27b0' },
                { label: 'PhD / Doctorate', value: 18, pct: 3.7, icon: <SchoolIcon />, color: '#f44336' },
                { label: 'Professional Certs', value: 156, pct: 32.1, icon: <AssessmentIcon />, color: '#4caf50' },
                { label: 'MBA', value: 48, pct: 9.9, icon: <BusinessIcon />, color: '#ff9800' },
                { label: 'Technical Certs (AWS/GCP)', value: 82, pct: 16.9, icon: <CodeIcon />, color: '#00bcd4' },
              ].map((d, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: alpha(d.color, 0.15), color: d.color, width: 44, height: 44 }}>{d.icon}</Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={700} color={d.color}>{d.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{d.label} ({d.pct}%)</Typography>
                    </Box>
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

function ForecastTab() {
  return (
    <Grid container spacing={3}>
      {/* Headcount Forecast */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Headcount Forecast — 12 Month Projection" subheader="Actual vs predicted with confidence intervals" avatar={<TimelineIcon color="primary" />} />
          <CardContent>
            <svg width="100%" height="260" viewBox="0 0 600 260">
              {/* Grid */}
              {[400, 430, 460, 490, 520, 550, 580].map((v, i) => {
                const y = 230 - ((v - 400) / 200) * 200;
                return (
                  <g key={i}>
                    <line x1="40" y1={y} x2="580" y2={y} stroke="#f0f0f0" strokeWidth="0.5" />
                    <text x="35" y={y + 4} textAnchor="end" fontSize="9" fill="#999">{v}</text>
                  </g>
                );
              })}
              {/* Confidence band */}
              {HEADCOUNT_FORECAST.map((d, i) => {
                const x = 50 + i * 34;
                const yLow = 230 - ((d.low - 400) / 200) * 200;
                const yHigh = 230 - ((d.high - 400) / 200) * 200;
                const yNext = i < HEADCOUNT_FORECAST.length - 1 ? 50 + (i + 1) * 34 : x;
                return (
                  <g key={i}>
                    <rect x={x - 2} y={yHigh} width="4" height={yLow - yHigh} fill="#2196f3" opacity={0.1} />
                  </g>
                );
              })}
              {/* Confidence area polygon */}
              <polygon
                points={HEADCOUNT_FORECAST.map((d, i) => `${50 + i * 34},${230 - ((d.high - 400) / 200) * 200}`).join(' ') +
                  ' ' + [...HEADCOUNT_FORECAST].reverse().map((d, i) => `${50 + (HEADCOUNT_FORECAST.length - 1 - i) * 34},${230 - ((d.low - 400) / 200) * 200}`).join(' ')}
                fill="#2196f3" opacity={0.1}
              />
              {/* Actual line */}
              <polyline
                points={HEADCOUNT_FORECAST.filter(d => d.actual).map((d, i) => `${50 + i * 34},${230 - ((d.actual - 400) / 200) * 200}`).join(' ')}
                fill="none" stroke="#2196f3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              />
              {/* Forecast line */}
              <polyline
                points={HEADCOUNT_FORECAST.map((d, i) => `${50 + i * 34},${230 - ((d.forecast - 400) / 200) * 200}`).join(' ')}
                fill="none" stroke="#9c27b0" strokeWidth="2" strokeDasharray="6,3" strokeLinecap="round" strokeLinejoin="round"
              />
              {/* Month labels */}
              {HEADCOUNT_FORECAST.map((d, i) => (
                <text key={i} x={50 + i * 34} y={248} textAnchor="middle" fontSize="8" fill="#666">
                  {d.month.split(' ')[0].substring(0, 3)}
                </text>
              ))}
              {/* Legend */}
              <line x1="50" y1="12" x2="70" y2="12" stroke="#2196f3" strokeWidth="2.5" />
              <text x="74" y="15" fontSize="9" fill="#666">Actual</text>
              <line x1="120" y1="12" x2="140" y2="12" stroke="#9c27b0" strokeWidth="2" strokeDasharray="6,3" />
              <text x="144" y="15" fontSize="9" fill="#666">Forecast</text>
              <rect x="195" y="6" width="14" height="10" rx="2" fill="#2196f3" opacity={0.15} />
              <text x="213" y="15" fontSize="9" fill="#666">Confidence Band</text>
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Forecast KPIs */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Year-End Projection" />
          <CardContent>
            <Stack spacing={2}>
              {[
                { label: 'Projected Headcount (Dec 26)', value: '512', sub: 'Range: 445–579', color: '#2196f3' },
                { label: 'Projected Net Growth', value: '+26', sub: '5.3% annual growth', color: '#4caf50' },
                { label: 'Projected Attrition', value: '~100', sub: '20.6% annualized rate', color: '#f44336' },
                { label: 'Hiring Needed', value: '~126', sub: 'To meet 512 target', color: '#9c27b0' },
                { label: 'Budget Impact', value: '₹18.4Cr', sub: 'Additional salary cost', color: '#ff9800' },
              ].map((d, i) => (
                <Paper key={i} sx={{ p: 1.5, borderLeft: `4px solid ${d.color}` }}>
                  <Typography variant="body2" fontWeight={500}>{d.label}</Typography>
                  <Typography variant="h5" fontWeight={700} color={d.color}>{d.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{d.sub}</Typography>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Scenario Planning */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Scenario Planning" subheader="Three headcount growth scenarios" />
          <CardContent>
            <Grid container spacing={2}>
              {[
                { scenario: 'Conservative', hiring: 80, exits: 120, endCount: 445, color: '#f44336', assumptions: 'Hiring freeze on 15 roles, elevated attrition continues' },
                { scenario: 'Base Case', hiring: 126, exits: 100, endCount: 512, color: '#2196f3', assumptions: 'Current hiring pace, attrition stabilizes at 20%' },
                { scenario: 'Aggressive', hiring: 180, exits: 85, endCount: 581, color: '#4caf50', assumptions: 'Accelerated hiring, retention initiatives reduce attrition to 15%' },
              ].map((s, i) => (
                <Grid item xs={12} md={4} key={i}>
                  <Paper sx={{ p: 2, borderTop: `4px solid ${s.color}`, height: '100%' }}>
                    <Typography variant="subtitle1" fontWeight={700} color={s.color}>{s.scenario}</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">New Hires</Typography>
                        <Typography variant="caption" fontWeight={700}>{s.hiring}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Expected Exits</Typography>
                        <Typography variant="caption" fontWeight={700}>{s.exits}</Typography>
                      </Stack>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={700}>Year-End Count</Typography>
                        <Typography variant="body2" fontWeight={700} color={s.color}>{s.endCount}</Typography>
                      </Stack>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{s.assumptions}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Department Growth Forecast */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Department-Level Growth Forecast" subheader="Projected headcount by department (Q4 2026)" />
          <CardContent>
            <Stack spacing={1}>
              {DEPARTMENT_HEADCOUNT.sort((a, b) => b.count - a.count).map((d, i) => {
                const projected = Math.round(d.count * (1 + (d.openRoles / d.count) * 0.8 - d.attrition / 100 * 0.4));
                const growth = projected - d.count;
                return (
                  <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 110 }}>{d.dept}</Typography>
                      <Box sx={{ flex: 1, mx: 2, display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ height: 12, width: `${(d.count / 130) * 60}%`, bgcolor: '#2196f3', borderRadius: 1, opacity: 0.6 }} />
                        <Box sx={{ height: 12, width: `${(growth / 130) * 60}%`, bgcolor: growth >= 0 ? '#4caf50' : '#f44336', borderRadius: 1 }} />
                      </Box>
                      <Stack alignItems="flex-end" sx={{ minWidth: 100 }}>
                        <Typography variant="body2" fontWeight={700}>{d.count} → {projected}</Typography>
                        <Typography variant="caption" color={growth >= 0 ? 'success.main' : 'error.main'} fontWeight={600}>
                          {growth >= 0 ? '+' : ''}{growth} ({Math.round(growth / d.count * 100)}%)
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function WorkforceAnalyticsDashboard() {
  const [tab, setTab] = useState(0);

  const tabLabels = [
    { label: 'Overview', icon: <AssessmentIcon /> },
    { label: 'Attrition & Risk', icon: <ExitIcon /> },
    { label: 'Demographics', icon: <GroupIcon /> },
    { label: 'Forecast', icon: <TimelineIcon /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <StatsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" fontWeight={700}>Workforce Analytics</Typography>
              <Typography variant="body2" color="text.secondary">
                Headcount intelligence · Attrition prediction · Demographics · Growth forecasting
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip icon={<PeopleIcon />} label="486 Employees" color="primary" variant="outlined" size="small" />
          <Chip icon={<InsightsIcon />} label="ML Insights On" color="secondary" variant="outlined" size="small" />
        </Stack>
      </Stack>

      {/* Alert */}
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>📊 Headcount forecast:</strong> Projected to reach 512 by Dec 2026 (+26 net growth). 8 employees flagged as high attrition risk — retention action recommended.{' '}
        <Button size="small" color="inherit" sx={{ fontWeight: 700 }}>View Retention Plan →</Button>
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
      {tab === 1 && <AttritionTab />}
      {tab === 2 && <DemographicsTab />}
      {tab === 3 && <ForecastTab />}

      {/* Footer */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Data updated: Aug 26, 2026 · Source: HRIS + ATS + Exit Surveys + ML Models · 486 employees across 11 departments
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
