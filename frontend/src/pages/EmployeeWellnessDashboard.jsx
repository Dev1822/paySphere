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
  Favorite as HeartIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  Psychology as BrainIcon,
  FitnessCenter as FitnessIcon,
  SelfImprovement as MeditationIcon,
  Groups as TeamIcon,
  AccessTime as TimeIcon,
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  SolarPower as EnergyIcon,
  SentimentSatisfied as HappyIcon,
  SentimentDissatisfied as SadIcon,
  SentimentNeutral as NeutralIcon,
  CalendarMonth as CalendarIcon,
  Assessment as AssessmentIcon,
  Insights as InsightsIcon,
  Shield as ShieldIcon,
  WaterDrop as WaterDropIcon,
  Nightlight as SleepIcon,
  MonitorHeart as MonitorIcon,
  AccountBalance as BalanceIcon,
  Handshake as HandshakeIcon,
  Restaurant as NutritionIcon,
} from '@mui/icons-material';

// ── Mock Data ──────────────────────────────────────────────────────────────

const DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Legal'];

const WELLNESS_SCORES = {
  overall: 76,
  byDepartment: [
    { dept: 'Engineering', score: 72, trend: -2, burnoutRisk: 'moderate', headcount: 48 },
    { dept: 'Design', score: 81, trend: 5, burnoutRisk: 'low', headcount: 18 },
    { dept: 'Marketing', score: 68, trend: -4, burnoutRisk: 'high', headcount: 24 },
    { dept: 'Sales', score: 64, trend: -6, burnoutRisk: 'high', headcount: 32 },
    { dept: 'HR', score: 85, trend: 2, burnoutRisk: 'low', headcount: 12 },
    { dept: 'Finance', score: 78, trend: 1, burnoutRisk: 'low', headcount: 16 },
    { dept: 'Operations', score: 71, trend: -1, burnoutRisk: 'moderate', headcount: 28 },
    { dept: 'Legal', score: 80, trend: 3, burnoutRisk: 'low', headcount: 8 },
  ],
};

const KPI_CARDS = [
  { label: 'Overall Wellness', value: '76%', change: -2, icon: <HeartIcon />, color: '#e91e63', bg: '#fce4ec' },
  { label: 'Burnout Risk', value: '23%', change: 5, icon: <FireIcon />, color: '#ff5722', bg: '#fbe9e7', invert: true },
  { label: 'Work-Life Balance', value: '72%', change: 3, icon: <BalanceIcon />, color: '#2196f3', bg: '#e3f2fd' },
  { label: 'Engagement Score', value: '8.2/10', change: 0.4, icon: <BrainIcon />, color: '#9c27b0', bg: '#f3e5f5' },
  { label: 'Avg Sleep Hours', value: '6.8h', change: -0.3, icon: <SleepIcon />, color: '#3f51b5', bg: '#e8eaf6' },
  { label: 'Wellness Activities', value: '342', change: 28, icon: <FitnessIcon />, color: '#4caf50', bg: '#e8f5e9' },
  { label: 'EAP Utilization', value: '18%', change: 3, icon: <HandshakeIcon />, color: '#00bcd4', bg: '#e0f7fa' },
  { label: 'PTO Usage', value: '67%', change: -5, icon: <CalendarIcon />, color: '#ff9800', bg: '#fff3e0' },
];

const MENTAL_HEALTH_METRICS = [
  { category: 'Stress Level', score: 6.2, max: 10, status: 'moderate', color: '#ff9800' },
  { category: 'Anxiety Index', score: 4.8, max: 10, status: 'low', color: '#4caf50' },
  { category: 'Depression Screening', score: 3.1, max: 10, status: 'low', color: '#4caf50' },
  { category: 'Resilience Score', score: 7.4, max: 10, status: 'good', color: '#2196f3' },
  { category: 'Social Connection', score: 6.8, max: 10, status: 'moderate', color: '#ff9800' },
  { category: 'Job Satisfaction', score: 7.1, max: 10, status: 'good', color: '#2196f3' },
];

const BURNOUT_SIGNALS = [
  { employee: 'Priya Sharma', dept: 'Sales', risk: 87, signals: ['Working 60+ hrs/week', 'Skipped 3 meals', 'No PTO in 4 months', 'Late-night commits'], avatar: 'PS', status: 'critical' },
  { employee: 'Rajesh Kumar', dept: 'Marketing', risk: 78, signals: ['Missed 2 wellness sessions', 'Sleep < 5h avg', 'Declining output quality'], avatar: 'RK', status: 'high' },
  { employee: 'Amit Patel', dept: 'Engineering', risk: 72, signals: ['Overtime streak: 14 days', 'No exercise in 3 weeks', 'High meeting load'], avatar: 'AP', status: 'high' },
  { employee: 'Sneha Gupta', dept: 'Operations', risk: 65, signals: ['Social isolation detected', 'Burnout survey flagged', 'PTO request denied'], avatar: 'SG', status: 'moderate' },
  { employee: 'Vikram Singh', dept: 'Engineering', risk: 61, signals: ['Late commits increasing', 'Wellness score dropped 15pts'], avatar: 'VS', status: 'moderate' },
];

const WELLNESS_ACTIVITIES = [
  { name: 'Yoga Session', participants: 24, frequency: 'Weekly', satisfaction: 4.6, icon: <MeditationIcon />, category: 'Mindfulness' },
  { name: 'Meditation Club', participants: 18, frequency: 'Daily', satisfaction: 4.4, icon: <BrainIcon />, category: 'Mindfulness' },
  { name: 'Fitness Challenge', participants: 42, frequency: 'Monthly', satisfaction: 4.2, icon: <FitnessIcon />, category: 'Physical' },
  { name: 'Nutrition Workshop', participants: 16, frequency: 'Bi-weekly', satisfaction: 4.7, icon: <NutritionIcon />, category: 'Nutrition' },
  { name: 'Sleep Hygiene Talk', participants: 31, frequency: 'Monthly', satisfaction: 4.1, icon: <SleepIcon />, category: 'Sleep' },
  { name: 'Stress Management', participants: 28, frequency: 'Weekly', satisfaction: 4.5, icon: <HeartIcon />, category: 'Mental' },
  { name: 'Walking Meetings', participants: 12, frequency: 'Daily', satisfaction: 4.8, icon: <FitnessIcon />, category: 'Physical' },
  { name: 'Team Outing', participants: 36, frequency: 'Monthly', satisfaction: 4.9, icon: <TeamIcon />, category: 'Social' },
];

const MONTHLY_TRENDS = [
  { month: 'Jan', wellness: 74, burnout: 18, engagement: 7.8, sleep: 7.0, activity: 280 },
  { month: 'Feb', wellness: 75, burnout: 20, engagement: 7.9, sleep: 6.9, activity: 295 },
  { month: 'Mar', wellness: 72, burnout: 24, engagement: 7.6, sleep: 6.7, activity: 260 },
  { month: 'Apr', wellness: 70, burnout: 28, engagement: 7.4, sleep: 6.5, activity: 240 },
  { month: 'May', wellness: 68, burnout: 30, engagement: 7.2, sleep: 6.4, activity: 220 },
  { month: 'Jun', wellness: 73, burnout: 22, engagement: 7.7, sleep: 6.8, activity: 310 },
  { month: 'Jul', wellness: 76, burnout: 19, engagement: 8.0, sleep: 7.1, activity: 342 },
  { month: 'Aug', wellness: 76, burnout: 23, engagement: 8.2, sleep: 6.8, activity: 342 },
];

const WORK_LIFE_METRICS = [
  { metric: 'Avg Hours Worked/Day', value: '8.4h', benchmark: '8.0h', status: 'above' },
  { metric: 'Overtime Hours/Month', value: '14.2h', benchmark: '10.0h', status: 'above' },
  { metric: 'After-Hours Messages', value: '23/week', benchmark: '15/week', status: 'above' },
  { metric: 'Meeting Load', value: '12.5h/week', benchmark: '10.0h', status: 'above' },
  { metric: 'Focus Time', value: '18.3h/week', benchmark: '20.0h', status: 'below' },
  { metric: 'PTO Taken (YTD)', value: '14.2 days', benchmark: '18.0 days', status: 'below' },
  { metric: 'Break Compliance', value: '62%', benchmark: '80%', status: 'below' },
];

const TEAM_INSIGHTS = [
  { team: 'Engineering', insight: 'Late-night commit frequency increased 35% in Q3. Recommend implementing code-freeze windows after 8 PM.', severity: 'warning', impact: 'high' },
  { team: 'Sales', insight: 'Average PTO usage is 40% below company average. Encourage mandatory time-off to prevent chronic fatigue.', severity: 'critical', impact: 'high' },
  { team: 'Marketing', insight: 'Meeting load exceeds 15h/week — highest across all departments. Propose meeting-free Wednesdays.', severity: 'warning', impact: 'medium' },
  { team: 'Design', insight: 'Wellness score improved 12% after introducing flexible hours. Model for other departments.', severity: 'positive', impact: 'low' },
  { team: 'HR', insight: 'EAP utilization increased 23% after anonymous access was enabled. Continue destigmatization efforts.', severity: 'positive', impact: 'medium' },
  { team: 'Operations', insight: 'Shift rotation patterns correlated with elevated stress markers. Review scheduling algorithm.', severity: 'warning', impact: 'high' },
];

const WELLNESS_RECOMMENDATIONS = [
  { title: 'Implement No-Meeting Wednesdays', dept: 'Marketing', expectedImpact: '+15% focus time', effort: 'Low', timeframe: '2 weeks' },
  { title: 'Mandatory PTO Reminder for >90 Day Streak', dept: 'Sales', expectedImpact: '-20% burnout risk', effort: 'Low', timeframe: '1 week' },
  { title: 'Flexible Hours Pilot for Engineering', dept: 'Engineering', expectedImpact: '+8% wellness score', effort: 'Medium', timeframe: '1 month' },
  { title: 'Night-Shift Wellness Program', dept: 'Operations', expectedImpact: '-12% stress level', effort: 'High', timeframe: '3 months' },
  { title: 'On-Site Meditation Room', dept: 'All', expectedImpact: '+5% engagement', effort: 'Medium', timeframe: '1 month' },
  { title: 'Manager Wellness Training', dept: 'All', expectedImpact: '-15% turnover risk', effort: 'Medium', timeframe: '2 months' },
];

// ── SVG Chart Components ───────────────────────────────────────────────────

function SparkLine({ data, color = '#2196f3', width = 120, height = 32 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

function MiniBarChart({ data, labels, colors, height = 140, maxValue }) {
  const max = maxValue || Math.max(...data);
  const barWidth = Math.floor(280 / data.length) - 6;

  return (
    <svg width="100%" height={height} viewBox={`0 0 280 ${height}`}>
      {data.map((v, i) => {
        const barH = (v / max) * (height - 30);
        const x = i * (barWidth + 6) + 8;
        const y = height - barH - 20;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} rx="3" fill={colors?.[i] || '#2196f3'} opacity={0.85} />
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="#999">
              {labels?.[i] || ''}
            </text>
            <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#666" fontWeight="600">
              {typeof v === 'number' ? v : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TrendChart({ data, keys, colors, labels, height = 180, width = 400 }) {
  const allVals = data.flatMap(d => keys.map(k => d[k]));
  const max = Math.max(...allVals);
  const min = Math.min(...allVals) * 0.9;
  const range = max - min || 1;

  const paths = keys.map((key, ki) => {
    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (width - 40) + 20;
      const y = height - 20 - ((d[key] - min) / range) * (height - 40);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    return { path: pts, color: colors[ki], label: labels?.[ki] || key };
  });

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = height - 20 - pct * (height - 40);
        return <line key={i} x1="20" y1={y} x2={width - 20} y2={y} stroke="#eee" strokeWidth="0.5" />;
      })}
      {/* Data lines */}
      {paths.map((p, i) => (
        <path key={i} d={p.path} fill="none" stroke={p.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* Labels */}
      {data.map((d, i) => (
        <text key={i} x={(i / (data.length - 1)) * (width - 40) + 20} y={height - 4} textAnchor="middle" fontSize="9" fill="#999">
          {d.month}
        </text>
      ))}
      {/* Legend */}
      {paths.map((p, i) => (
        <g key={`l${i}`} transform={`translate(${20 + i * 90}, 4)`}>
          <line x1="0" y1="4" x2="14" y2="4" stroke={p.color} strokeWidth="2" />
          <text x="18" y="7" fontSize="9" fill="#666">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

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

function RiskGauge({ value, size = 120 }) {
  const angle = (value / 100) * 180;
  const color = value >= 75 ? '#f44336' : value >= 50 ? '#ff9800' : value >= 25 ? '#ffc107' : '#4caf50';

  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = (size - 20) / 2;

  const startAngle = Math.PI;
  const endAngle = startAngle + (angle / 180) * Math.PI;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
      {/* Background arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${y1}`} fill="none" stroke="#eee" strokeWidth="8" strokeLinecap="round" />
      {/* Value arc */}
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="20" fontWeight="700" fill={color}>{value}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#999">Risk Level</text>
    </svg>
  );
}

// ── Tab Panels ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const theme = useTheme();
  return (
    <Grid container spacing={3}>
      {/* KPI Row */}
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
                ) : <NeutralIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                <Typography variant="caption" color={kpi.change > 0 ? (kpi.invert ? 'error' : 'success') : kpi.change < 0 ? (kpi.invert ? 'success' : 'error') : 'text.secondary'}>
                  {Math.abs(kpi.change)}% vs last month
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* Trend Chart */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Wellness Trends (8 Months)" subheader="Wellness score vs burnout rate vs engagement" />
          <CardContent>
            <TrendChart
              data={MONTHLY_TRENDS}
              keys={['wellness', 'burnout', 'engagement']}
              colors={['#2196f3', '#f44336', '#9c27b0']}
              labels={['Wellness', 'Burnout %', 'Engagement']}
              height={200}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Overall Donut */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Wellness Distribution" />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <DonutChart value={76} color="#2196f3" label="Healthy" size={140} thickness={12} />
            <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
              {[
                { label: 'Healthy', value: 52, color: '#4caf50' },
                { label: 'At Risk', value: 25, color: '#ff9800' },
                { label: 'Burnout', value: 15, color: '#f44336' },
                { label: 'Critical', value: 8, color: '#9c27b0' },
              ].map((item, i) => (
                <Stack key={i} alignItems="center">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>{item.value}%</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Department Overview */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Department Wellness Scores" subheader="Score, trend, and burnout risk by department" />
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
              {WELLNESS_SCORES.byDepartment.map((d, i) => (
                <Paper key={i} sx={{ minWidth: 160, p: 2, flexShrink: 0, border: '1px solid #eee' }}>
                  <Typography variant="subtitle2" fontWeight={600}>{d.dept}</Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ color: d.score >= 80 ? 'success.main' : d.score >= 70 ? 'warning.main' : 'error.main' }}>
                    {d.score}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    {d.trend >= 0 ? <TrendUpIcon sx={{ fontSize: 12, color: 'success.main' }} /> : <TrendDownIcon sx={{ fontSize: 12, color: 'error.main' }} />}
                    <Typography variant="caption">{d.trend > 0 ? '+' : ''}{d.trend}%</Typography>
                  </Stack>
                  <Chip size="small" label={d.burnoutRisk} color={d.burnoutRisk === 'high' ? 'error' : d.burnoutRisk === 'moderate' ? 'warning' : 'success'} sx={{ mt: 1, fontSize: 10 }} />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{d.headcount} employees</Typography>
                </Paper>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Team Insights */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="AI-Powered Team Insights" subheader="Actionable wellness insights per department" avatar={<InsightsIcon color="primary" />} />
          <CardContent>
            <Grid container spacing={2}>
              {TEAM_INSIGHTS.map((insight, i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Alert
                    severity={insight.severity === 'positive' ? 'success' : insight.severity === 'critical' ? 'error' : 'warning'}
                    sx={{ '& .MuiAlert-message': { width: '100%' } }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>{insight.team}</Typography>
                    <Typography variant="body2">{insight.insight}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Chip size="small" label={`Impact: ${insight.impact}`} variant="outlined" />
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

function MentalHealthTab() {
  return (
    <Grid container spacing={3}>
      {/* Mental Health Metrics */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Mental Health Metrics" subheader="Population-level screening scores" avatar={<BrainIcon color="secondary" />} />
          <CardContent>
            <Stack spacing={2.5}>
              {MENTAL_HEALTH_METRICS.map((m, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={500}>{m.category}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={700} color={m.color}>{m.score}/{m.max}</Typography>
                      <Chip size="small" label={m.status} sx={{ bgcolor: alpha(m.color, 0.1), color: m.color, fontWeight: 600, fontSize: 10 }} />
                    </Stack>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(m.score / m.max) * 100}
                    sx={{
                      mt: 0.5, height: 8, borderRadius: 4,
                      bgcolor: '#f5f5f5',
                      '& .MuiLinearProgress-bar': { bgcolor: m.color, borderRadius: 4 },
                    }}
                  />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Burnout Risk Signals */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Burnout Risk Signals" subheader="Employees showing early warning signs" avatar={<WarningIcon color="warning" />} />
          <CardContent>
            <List disablePadding>
              {BURNOUT_SIGNALS.map((emp, i) => (
                <ListItem key={i} sx={{ px: 0, py: 1.5, borderBottom: i < BURNOUT_SIGNALS.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Box sx={{
                          width: 14, height: 14, borderRadius: '50%', border: '2px solid white',
                          bgcolor: emp.status === 'critical' ? 'error.main' : emp.status === 'high' ? 'warning.main' : 'info.main',
                        }} />
                      }
                    >
                      <Avatar sx={{
                        bgcolor: emp.status === 'critical' ? 'error.main' : emp.status === 'high' ? 'warning.main' : 'info.main',
                        width: 40, height: 40, fontSize: 14,
                      }}>
                        {emp.avatar}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="subtitle2" fontWeight={600}>{emp.employee}</Typography>}
                    secondary={
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                        {emp.signals.slice(0, 3).map((s, j) => (
                          <Chip key={j} size="small" label={s} variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                        ))}
                      </Stack>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Stack alignItems="center">
                      <Typography variant="subtitle2" fontWeight={700} color={emp.risk >= 75 ? 'error.main' : 'warning.main'}>{emp.risk}%</Typography>
                      <Typography variant="caption" color="text.secondary">{emp.dept}</Typography>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Sleep Analysis */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Sleep Pattern Analysis" subheader="Average sleep hours tracked via wellness app" />
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <DonutChart value={68} color="#3f51b5" label="Meet Target" size={130} thickness={10} />
            </Box>
            <Grid container spacing={2}>
              {[
                { label: 'Avg Sleep', value: '6.8h', target: '7.5h', color: '#3f51b5' },
                { label: 'Deep Sleep', value: '1.8h', target: '2.0h', color: '#1a237e' },
                { label: 'REM Sleep', value: '1.5h', target: '1.5h', color: '#283593' },
                { label: 'Sleep Debt', value: '4.9h/wk', target: '0h', color: '#f44336' },
              ].map((item, i) => (
                <Grid item xs={6} key={i}>
                  <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: alpha(item.color, 0.05) }}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={item.color}>{item.value}</Typography>
                    <Typography variant="caption" color="text.secondary">Target: {item.target}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Stress Heatmap */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Weekly Stress Heatmap" subheader="Average stress levels by day and time" />
          <CardContent>
            <svg width="100%" height="200" viewBox="0 0 350 200">
              {/* Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => (
                <text key={i} x={60 + i * 60} y="14" textAnchor="middle" fontSize="10" fill="#666">{day}</text>
              ))}
              {['9AM', '12PM', '3PM', '6PM'].map((time, i) => (
                <text key={i} x="25" y={40 + i * 42} textAnchor="middle" fontSize="9" fill="#666">{time}</text>
              ))}
              {/* Heat cells */}
              {[
                [3, 4, 5, 6, 4], [5, 6, 7, 8, 5], [6, 7, 8, 9, 6], [4, 5, 6, 7, 3],
              ].map((row, ri) =>
                row.map((val, ci) => {
                  const hue = Math.max(0, (1 - val / 10) * 120);
                  return (
                    <g key={`${ri}-${ci}`}>
                      <rect x={35 + ci * 60} y={25 + ri * 42} width="50" height="36" rx="4"
                        fill={`hsl(${hue}, 70%, 55%)`} opacity={0.85} />
                      <text x={60 + ci * 60} y={48 + ri * 42} textAnchor="middle" fontSize="11" fill="white" fontWeight="600">
                        {val}
                      </text>
                    </g>
                  );
                })
              )}
            </svg>
            <Stack direction="row" justifyContent="center" spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'hsl(120, 70%, 55%)' }} />
                <Typography variant="caption">Low</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'hsl(60, 70%, 55%)' }} />
                <Typography variant="caption">Medium</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: 'hsl(0, 70%, 55%)' }} />
                <Typography variant="caption">High</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function WorkLifeTab() {
  return (
    <Grid container spacing={3}>
      {/* Work-Life Metrics */}
      <Grid item xs={12} md={7}>
        <Card>
          <CardHeader title="Work-Life Balance Metrics" subheader="Company averages vs industry benchmarks" avatar={<BalanceIcon color="primary" />} />
          <CardContent>
            <Stack spacing={2}>
              {WORK_LIFE_METRICS.map((m, i) => (
                <Paper key={i} sx={{ p: 2, border: `1px solid ${m.status === 'below' ? alpha('#f44336', 0.2) : alpha('#ff9800', 0.2)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={500}>{m.metric}</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Stack alignItems="flex-end">
                        <Typography variant="body2" fontWeight={700} color={m.status === 'below' ? 'error.main' : 'warning.main'}>{m.value}</Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={m.status === 'below' ? 'Below target' : 'Above target'}
                        color={m.status === 'below' ? 'error' : 'warning'}
                        variant="outlined"
                        sx={{ fontSize: 10 }}
                      />
                    </Stack>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">Benchmark: {m.benchmark}</Typography>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* PTO Analysis */}
      <Grid item xs={12} md={5}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="PTO & Break Analysis" />
          <CardContent>
            <Grid container spacing={2}>
              {[
                { label: 'PTO Used', value: 67, color: '#ff9800', target: 85 },
                { label: 'Sick Leave', value: 23, color: '#f44336', target: 30 },
                { label: 'Break Compliance', value: 62, color: '#2196f3', target: 80 },
                { label: 'Flex Day Usage', value: 45, color: '#9c27b0', target: 70 },
              ].map((item, i) => (
                <Grid item xs={6} key={i}>
                  <Stack alignItems="center" spacing={1}>
                    <DonutChart value={item.value} color={item.color} size={80} thickness={8} />
                    <Typography variant="caption" fontWeight={600}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">Target: {item.target}%</Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info" sx={{ fontSize: 12 }}>
              <strong>Reminder:</strong> 34 employees haven't taken PTO in 60+ days. Auto-notifications have been queued.
            </Alert>
          </CardContent>
        </Card>
      </Grid>

      {/* After-Hours Activity */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="After-Hours Activity Trends" subheader="Messages, commits, and logins outside working hours" />
          <CardContent>
            <TrendChart
              data={MONTHLY_TRENDS}
              keys={['sleep', 'activity']}
              colors={['#3f51b5', '#ff5722']}
              labels={['Avg Sleep (h)', 'Wellness Activities']}
              height={160}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Focus Time */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Focus Time Distribution" />
          <CardContent>
            <svg width="100%" height="180" viewBox="0 0 300 180">
              {[
                { label: 'Deep Work', pct: 28, color: '#2196f3' },
                { label: 'Meetings', pct: 25, color: '#f44336' },
                { label: 'Admin Tasks', pct: 18, color: '#ff9800' },
                { label: 'Collaboration', pct: 17, color: '#9c27b0' },
                { label: 'Breaks', pct: 12, color: '#4caf50' },
              ].map((item, i) => {
                const y = 10 + i * 34;
                const w = (item.pct / 30) * 240;
                return (
                  <g key={i}>
                    <text x="5" y={y + 16} fontSize="10" fill="#666" textAnchor="start">{item.label}</text>
                    <rect x="95" y={y} width={w} height="22" rx="4" fill={item.color} opacity={0.85} />
                    <text x={100 + w} y={y + 15} fontSize="10" fill="#333" fontWeight="600">{item.pct}%</text>
                  </g>
                );
              })}
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Recommendations */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Wellness Recommendations" subheader="AI-suggested interventions" avatar={<InsightsIcon color="primary" />} />
          <CardContent>
            <Stack spacing={1.5}>
              {WELLNESS_RECOMMENDATIONS.slice(0, 4).map((rec, i) => (
                <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{rec.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{rec.dept} · {rec.timeframe}</Typography>
                    </Box>
                    <Stack alignItems="flex-end" spacing={0.5}>
                      <Chip size="small" label={rec.effort} color={rec.effort === 'Low' ? 'success' : rec.effort === 'Medium' ? 'warning' : 'error'} variant="outlined" sx={{ fontSize: 10 }} />
                      <Typography variant="caption" fontWeight={600} color="success.main">{rec.expectedImpact}</Typography>
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

function ActivitiesTab() {
  const categoryColors = { Mindfulness: '#9c27b0', Physical: '#4caf50', Nutrition: '#ff9800', Sleep: '#3f51b5', Mental: '#e91e63', Social: '#00bcd4' };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Wellness Programs & Activities" subheader="Participation, satisfaction, and frequency" avatar={<FitnessIcon color="success" />} />
          <CardContent>
            <Grid container spacing={2}>
              {WELLNESS_ACTIVITIES.map((act, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Paper sx={{ p: 2, border: `2px solid ${alpha(categoryColors[act.category] || '#666', 0.2)}`, height: '100%' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: alpha(categoryColors[act.category] || '#666', 0.15), color: categoryColors[act.category], width: 36, height: 36 }}>
                        {act.icon}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>{act.name}</Typography>
                        <Chip size="small" label={act.category} sx={{ bgcolor: alpha(categoryColors[act.category], 0.1), color: categoryColors[act.category], fontSize: 9, height: 18 }} />
                      </Box>
                    </Stack>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Participants</Typography>
                        <Typography variant="caption" fontWeight={600}>{act.participants}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Frequency</Typography>
                        <Typography variant="caption" fontWeight={600}>{act.frequency}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Satisfaction</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {[...Array(5)].map((_, s) => (
                            <Box key={s} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s < Math.round(act.satisfaction) ? '#ffc107' : '#e0e0e0' }} />
                          ))}
                          <Typography variant="caption" fontWeight={600} sx={{ ml: 0.5 }}>{act.satisfaction}</Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Activity Impact */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Activity Impact Analysis" subheader="Wellness score change after 90 days of participation" />
          <CardContent>
            <svg width="100%" height="200" viewBox="0 0 350 200">
              {[
                { label: 'Yoga', before: 62, after: 78, color: '#9c27b0' },
                { label: 'Meditation', before: 65, after: 80, color: '#3f51b5' },
                { label: 'Fitness', before: 58, after: 75, color: '#4caf50' },
                { label: 'Nutrition', before: 70, after: 82, color: '#ff9800' },
                { label: 'Sleep Prog', before: 55, after: 72, color: '#00bcd4' },
              ].map((item, i) => {
                const x = 20 + i * 65;
                const bh = (item.before / 100) * 140;
                const ah = (item.after / 100) * 140;
                return (
                  <g key={i}>
                    <rect x={x} y={160 - bh} width="24" height={bh} rx="3" fill={item.color} opacity={0.4} />
                    <rect x={x + 28} y={160 - ah} width="24" height={ah} rx="3" fill={item.color} opacity={0.85} />
                    <text x={x + 26} y={178} textAnchor="middle" fontSize="9" fill="#666">{item.label}</text>
                    <text x={x + 12} y={155 - bh} textAnchor="middle" fontSize="8" fill="#999">{item.before}</text>
                    <text x={x + 40} y={155 - ah} textAnchor="middle" fontSize="8" fill="#333" fontWeight="600">{item.after}</text>
                  </g>
                );
              })}
              {/* Legend */}
              <rect x="20" y="5" width="8" height="8" rx="2" fill="#999" opacity={0.4} />
              <text x="32" y="13" fontSize="9" fill="#666">Before</text>
              <rect x="70" y="5" width="8" height="8" rx="2" fill="#333" />
              <text x="82" y="13" fontSize="9" fill="#666">After (90 days)</text>
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Participation Leaderboard */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Participation Leaderboard" subheader="Most active wellness champions" avatar={<TrophyIcon sx={{ color: '#ffc107' }} />} />
          <CardContent>
            <List disablePadding>
              {[
                { name: 'Anita Desai', dept: 'Design', activities: 12, xp: 2400, rank: 1 },
                { name: 'Mohit Joshi', dept: 'HR', activities: 11, xp: 2200, rank: 2 },
                { name: 'Deepa Nair', dept: 'Finance', activities: 10, xp: 2000, rank: 3 },
                { name: 'Karan Malhotra', dept: 'Engineering', activities: 9, xp: 1800, rank: 4 },
                { name: 'Pooja Reddy', dept: 'Marketing', activities: 8, xp: 1600, rank: 5 },
              ].map((p, i) => (
                <ListItem key={i} sx={{ px: 0, py: 1, borderBottom: i < 4 ? '1px solid #f0f0f0' : 'none' }}>
                  <ListItemAvatar>
                    <Avatar sx={{
                      bgcolor: i === 0 ? '#ffc107' : i === 1 ? '#bdbdbd' : i === 2 ? '#cd7f32' : '#e0e0e0',
                      color: i < 3 ? 'white' : '#666', width: 36, height: 36, fontSize: 14, fontWeight: 700,
                    }}>
                      {i + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="subtitle2" fontWeight={600}>{p.name}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary">{p.dept} · {p.activities} activities</Typography>}
                  />
                  <ListItemSecondaryAction>
                    <Chip size="small" label={`${p.xp} XP`} sx={{ bgcolor: alpha('#ffc107', 0.15), color: '#e65100', fontWeight: 600, fontSize: 10 }} />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function EmployeeWellnessDashboard() {
  const [tab, setTab] = useState(0);
  const theme = useTheme();

  const tabLabels = [
    { label: 'Overview', icon: <AssessmentIcon /> },
    { label: 'Mental Health', icon: <BrainIcon /> },
    { label: 'Work-Life Balance', icon: <BalanceIcon /> },
    { label: 'Activities', icon: <FitnessIcon /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <MonitorIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" fontWeight={700}>Employee Wellness & Performance</Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time wellness monitoring · Burnout prevention · Work-life balance analytics
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip icon={<ShieldIcon />} label="Privacy Protected" color="success" variant="outlined" size="small" />
          <Chip icon={<InsightsIcon />} label="AI Insights On" color="primary" variant="outlined" size="small" />
        </Stack>
      </Stack>

      {/* Alert Banner */}
      <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>⚠️ 3 employees at critical burnout risk.</strong> Immediate intervention recommended for Sales and Marketing departments.{' '}
        <Button size="small" color="inherit" sx={{ fontWeight: 700 }}>View Action Plan →</Button>
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
      {tab === 1 && <MentalHealthTab />}
      {tab === 2 && <WorkLifeTab />}
      {tab === 3 && <ActivitiesTab />}

      {/* Footer */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Data updated: Aug 26, 2026 · Source: HRIS + Wellness App + Surveys · 186 employees tracked
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Export PDF Report">
              <IconButton size="small"><AssessmentIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Send Weekly Digest">
              <IconButton size="small"><TrendUpIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
