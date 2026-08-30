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
  Groups as GroupsIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  Assessment as AssessmentIcon,
  Insights as InsightsIcon,
  Favorite as HeartIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Timer as TimerIcon,
  Email as EmailIcon,
  Chat as ChatIcon,
  VideoCall as VideoIcon,
  MeetingRoom as MeetingIcon,
  CalendarMonth as CalendarIcon,
  SentimentSatisfied as HappyIcon,
  SentimentDissatisfied as SadIcon,
  SentimentNeutral as NeutralIcon,
  Speed as SpeedIcon,
  Balance as BalanceIcon,
  NetworkCheck as NetworkIcon,
  Hub as HubIcon,
  Handshake as HandshakeIcon,
  Psychology as BrainIcon,
  TrackChanges as TargetIcon,
  ElectricBolt as BoltIcon,
  RecordVoiceOver as VoiceIcon,
  Forum as ForumIcon,
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  Notifications as BellIcon,
  Share as ShareIcon,
  GroupAdd as GroupAddIcon,
  PersonSearch as SearchIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon,
  DataUsage as DataIcon,
  Workspaces as WorkspacesIcon,
  MarkEmailRead as ReadEmailIcon,
  Drafts as DraftIcon,
  AltRoute as RouteIcon,
} from '@mui/icons-material';

// ── Mock Data ──────────────────────────────────────────────────────────────

const KPI_CARDS = [
  { label: 'Team Health Score', value: '78/100', change: 4, icon: <HeartIcon />, color: '#e91e63', bg: '#fce4ec' },
  { label: 'Meeting Load', value: '14.2h/wk', change: -1.5, icon: <MeetingIcon />, color: '#ff9800', bg: '#fff3e0', invert: true },
  { label: 'Response Time', value: '2.4h', change: -0.6, icon: <SpeedIcon />, color: '#4caf50', bg: '#e8f5e9' },
  { label: 'Collaboration Index', value: '8.4/10', change: 0.8, icon: <HandshakeIcon />, color: '#2196f3', bg: '#e3f2fd' },
  { label: 'Cross-Team Links', value: '156', change: 18, icon: <NetworkIcon />, color: '#9c27b0', bg: '#f3e5f5' },
  { label: 'After-Hours Activity', value: '18%', change: -5, icon: <TimerIcon />, color: '#f44336', bg: '#fce4ec', invert: true },
  { label: 'Async Adoption', value: '72%', change: 12, icon: <ForumIcon />, color: '#00bcd4', bg: '#e0f7fa' },
  { label: 'Meeting NPS', value: '+42', change: 8, icon: <HappyIcon />, color: '#3f51b5', bg: '#e8eaf6' },
];

const TEAM_SCORES = [
  { team: 'Engineering', score: 82, meetingLoad: 12.5, responseTime: 1.8, asyncAdoption: 78, satisfaction: 4.4, trend: 6, color: '#2196f3', headcount: 48 },
  { team: 'Product', score: 85, meetingLoad: 16.2, responseTime: 2.0, asyncAdoption: 82, satisfaction: 4.5, trend: 3, color: '#9c27b0', headcount: 18 },
  { team: 'Design', score: 88, meetingLoad: 10.8, responseTime: 2.2, asyncAdoption: 75, satisfaction: 4.6, trend: 5, color: '#e91e63', headcount: 12 },
  { team: 'Marketing', score: 72, meetingLoad: 18.5, responseTime: 3.1, asyncAdoption: 62, satisfaction: 3.8, trend: -4, color: '#ff9800', headcount: 22 },
  { team: 'Sales', score: 68, meetingLoad: 20.2, responseTime: 2.8, asyncAdoption: 55, satisfaction: 3.6, trend: -6, color: '#4caf50', headcount: 36 },
  { team: 'HR', score: 80, meetingLoad: 14.0, responseTime: 2.0, asyncAdoption: 80, satisfaction: 4.3, trend: 2, color: '#00bcd4', headcount: 8 },
  { team: 'Finance', score: 76, meetingLoad: 12.0, responseTime: 2.5, asyncAdoption: 70, satisfaction: 4.1, trend: 1, color: '#3f51b5', headcount: 14 },
  { team: 'Operations', score: 74, meetingLoad: 15.8, responseTime: 3.0, asyncAdoption: 58, satisfaction: 3.9, trend: -2, color: '#607d8b', headcount: 26 },
];

const MEETING_ANALYTICS = {
  weeklyAverage: 14.2,
  totalHours: 284,
  byType: [
    { type: 'Standups', hours: 3.2, count: 12, avgAttendees: 8, efficiency: 72, color: '#4caf50' },
    { type: 'Sprint Planning', hours: 2.5, count: 2, avgAttendees: 14, efficiency: 68, color: '#2196f3' },
    { type: '1:1s', hours: 2.0, count: 8, avgAttendees: 2, efficiency: 85, color: '#9c27b0' },
    { type: 'All-Hands', hours: 1.5, count: 1, avgAttendees: 42, efficiency: 55, color: '#ff9800' },
    { type: 'Brainstorm', hours: 2.8, count: 4, avgAttendees: 6, efficiency: 62, color: '#e91e63' },
    { type: 'Client Calls', hours: 1.2, count: 3, avgAttendees: 4, efficiency: 78, color: '#00bcd4' },
    { type: 'Retrospective', hours: 1.0, count: 2, avgAttendees: 10, efficiency: 70, color: '#3f51b5' },
  ],
  optimalVsActual: { optimal: 10.0, actual: 14.2, excess: 4.2 },
  noMeetingDays: 12,
  meetingFreePct: 55,
};

const DAILY_MEETING_LOAD = [
  { day: 'Mon', hours: 4.2, meetings: 8, focusBlocks: 2 },
  { day: 'Tue', hours: 3.8, meetings: 7, focusBlocks: 3 },
  { day: 'Wed', hours: 1.2, meetings: 2, focusBlocks: 6 },
  { day: 'Thu', hours: 3.5, meetings: 6, focusBlocks: 3 },
  { day: 'Fri', hours: 1.5, meetings: 3, focusBlocks: 5 },
];

const COMMUNICATION_PATTERNS = {
  byChannel: [
    { channel: 'Slack Messages', volume: 12400, change: 8, avgResponse: '18min', sentiment: 72, color: '#4caf50' },
    { channel: 'Email', volume: 4200, change: -5, avgResponse: '2.4h', sentiment: 65, color: '#2196f3' },
    { channel: 'Video Calls', volume: 186, change: -12, avgResponse: '—', sentiment: 78, color: '#9c27b0' },
    { channel: 'PR Reviews', volume: 342, change: 15, avgResponse: '4.2h', sentiment: 68, color: '#ff9800' },
    { channel: 'Jira Comments', volume: 2800, change: 5, avgResponse: '3.1h', sentiment: 58, color: '#00bcd4' },
    { channel: 'Documents', volume: 180, change: 22, avgResponse: '—', sentiment: 80, color: '#3f51b5' },
  ],
  peakHours: [
    { hour: '9AM', activity: 65 }, { hour: '10AM', activity: 92 }, { hour: '11AM', activity: 88 },
    { hour: '12PM', activity: 45 }, { hour: '1PM', activity: 55 }, { hour: '2PM', activity: 85 },
    { hour: '3PM', activity: 78 }, { hour: '4PM', activity: 70 }, { hour: '5PM', activity: 52 },
    { hour: '6PM', activity: 35 }, { hour: '7PM', activity: 22 }, { hour: '8PM', activity: 12 },
  ],
};

const COLLABORATION_GRAPH = {
  nodes: [
    { id: 'eng', label: 'Engineering', connections: 38, centrality: 0.92, color: '#2196f3' },
    { id: 'prod', label: 'Product', connections: 35, centrality: 0.88, color: '#9c27b0' },
    { id: 'des', label: 'Design', connections: 28, centrality: 0.72, color: '#e91e63' },
    { id: 'mkt', label: 'Marketing', connections: 22, centrality: 0.55, color: '#ff9800' },
    { id: 'sales', label: 'Sales', connections: 20, centrality: 0.48, color: '#4caf50' },
    { id: 'hr', label: 'HR', connections: 18, centrality: 0.42, color: '#00bcd4' },
    { id: 'fin', label: 'Finance', connections: 15, centrality: 0.35, color: '#3f51b5' },
    { id: 'ops', label: 'Operations', connections: 24, centrality: 0.58, color: '#607d8b' },
  ],
  crossTeamFlows: [
    { from: 'Engineering', to: 'Product', strength: 92, type: 'Daily' },
    { from: 'Engineering', to: 'Design', strength: 78, type: 'Weekly' },
    { from: 'Product', to: 'Design', strength: 85, type: 'Daily' },
    { from: 'Product', to: 'Marketing', strength: 65, type: 'Weekly' },
    { from: 'Sales', to: 'Marketing', strength: 72, type: 'Weekly' },
    { from: 'Sales', to: 'Product', strength: 58, type: 'Bi-weekly' },
    { from: 'HR', to: 'All', strength: 88, type: 'Monthly' },
    { from: 'Finance', to: 'Operations', strength: 62, type: 'Weekly' },
  ],
};

const FOCUS_TIME_DATA = {
  avgDailyFocus: 3.2,
  targetDailyFocus: 4.0,
  byTeam: [
    { team: 'Engineering', focus: 4.1, meetings: 2.5, deepWork: 3.2, color: '#2196f3' },
    { team: 'Product', focus: 3.5, meetings: 3.8, deepWork: 2.1, color: '#9c27b0' },
    { team: 'Design', focus: 4.5, meetings: 2.0, deepWork: 3.8, color: '#e91e63' },
    { team: 'Marketing', focus: 2.8, meetings: 4.2, deepWork: 1.8, color: '#ff9800' },
    { team: 'Sales', focus: 2.2, meetings: 5.0, deepWork: 1.2, color: '#4caf50' },
    { team: 'HR', focus: 3.8, meetings: 3.2, deepWork: 2.5, color: '#00bcd4' },
    { team: 'Finance', focus: 4.0, meetings: 2.8, deepWork: 3.0, color: '#3f51b5' },
    { team: 'Operations', focus: 3.0, meetings: 3.8, deepWork: 2.0, color: '#607d8b' },
  ],
};

const PSYCHOLOGICAL_SAFETY = [
  { dimension: 'I can ask questions without fear', score: 82, benchmark: 78 },
  { dimension: 'I can disagree with my manager', score: 68, benchmark: 72 },
  { dimension: 'I can admit mistakes openly', score: 74, benchmark: 70 },
  { dimension: 'I feel comfortable taking risks', score: 76, benchmark: 75 },
  { dimension: 'My unique skills are valued', score: 85, benchmark: 80 },
  { dimension: 'I receive constructive feedback', score: 78, benchmark: 76 },
];

const TEAM_INSIGHTS = [
  { insight: 'Marketing meets 18.5h/week — 30% above company avg. Meeting-free Wednesdays reduced load by 22% in pilot teams.', severity: 'warning', impact: 'high', action: 'Expand no-meeting Wed' },
  { insight: 'Sales after-hours messaging dropped 15% after implementing async-first policy. Continue reinforcement.', severity: 'positive', impact: 'medium', action: 'Reward async champions' },
  { insight: 'Engineering has highest focus time (4.1h/day) but lowest cross-team connectivity. Integration risk.', severity: 'warning', impact: 'medium', action: 'Schedule cross-team syncs' },
  { insight: 'Design team has highest health score (88) — their "creative hours" policy is a model for other teams.', severity: 'positive', impact: 'high', action: 'Share Design playbook' },
  { insight: 'Product-Engineering sync time increased 40% after shared OKRs. Collaboration index up 0.8 points.', severity: 'positive', impact: 'high', action: 'Extend OKR model' },
  { insight: 'Psychological safety dropped 4pts in Sales — exit surveys cite fear of reporting pipeline issues.', severity: 'critical', impact: 'high', action: 'Sales culture intervention' },
];

const WEEKLY_TRENDS = [
  { week: 'W28', health: 72, meetings: 16.5, async: 58, focus: 2.8 },
  { week: 'W29', health: 74, meetings: 15.8, async: 62, focus: 3.0 },
  { week: 'W30', health: 73, meetings: 16.0, async: 60, focus: 2.9 },
  { week: 'W31', health: 75, meetings: 15.2, async: 65, focus: 3.1 },
  { week: 'W32', health: 76, meetings: 14.8, async: 68, focus: 3.2 },
  { week: 'W33', health: 77, meetings: 14.5, async: 70, focus: 3.3 },
  { week: 'W34', health: 78, meetings: 14.2, async: 72, focus: 3.2 },
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

function RadarChart({ data, size = 200, labels }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;
  const angleStep = (2 * Math.PI) / data.length;

  const points = data.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const dist = (d.score / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  });

  const gridLevels = [25, 50, 75, 100];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid circles */}
      {gridLevels.map(level => {
        const gr = (level / 100) * r;
        return <circle key={level} cx={cx} cy={cy} r={gr} fill="none" stroke="#eee" strokeWidth="0.5" />;
      })}
      {/* Axis lines */}
      {data.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="#eee" strokeWidth="0.5" />;
      })}
      {/* Data polygon */}
      <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="#2196f3" fillOpacity={0.15} stroke="#2196f3" strokeWidth="1.5" />
      {/* Data points */}
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#2196f3" />)}
      {/* Labels */}
      {data.map((d, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const lx = cx + (r + 18) * Math.cos(angle);
        const ly = cy + (r + 18) * Math.sin(angle);
        return <text key={i} x={lx} y={ly + 3} textAnchor="middle" fontSize="7" fill="#666">{d.label?.substring(0, 8) || ''}</text>;
      })}
    </svg>
  );
}

function ActivityHeatmap({ data, height = 140 }) {
  return (
    <svg width="100%" height={height} viewBox="0 0 400 140">
      {data.map((d, i) => {
        const barWidth = 28;
        const x = 30 + i * 34;
        const barH = (d.activity / 100) * (height - 40);
        const hue = d.activity > 80 ? 0 : d.activity > 60 ? 30 : d.activity > 40 ? 60 : 120;
        return (
          <g key={i}>
            <rect x={x} y={height - 28 - barH} width={barWidth} height={barH} rx="4"
              fill={`hsl(${hue}, 65%, 50%)`} opacity={0.85} />
            <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" fontSize="9" fill="#666">{d.hour}</text>
            <text x={x + barWidth / 2} y={height - 32 - barH} textAnchor="middle" fontSize="8" fill="#333" fontWeight="600">{d.activity}%</text>
          </g>
        );
      })}
    </svg>
  );
}

function CollaborationNetwork({ data, height = 220 }) {
  const cx = 180;
  const cy = 110;
  const r = 80;

  const nodes = data.nodes.map((n, i) => {
    const angle = (i / data.nodes.length) * 2 * Math.PI - Math.PI / 2;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <svg width="100%" height={height} viewBox="0 0 360 220">
      {/* Edges */}
      {data.crossTeamFlows.map((f, i) => {
        const from = nodes.find(n => n.label === f.from);
        const to = nodes.find(n => n.label === f.to);
        if (!from || !to) return null;
        const opacity = f.strength / 100 * 0.6;
        return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2196f3" strokeWidth={f.strength / 30} opacity={opacity} />;
      })}
      {/* Nodes */}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={12 + n.centrality * 8} fill={n.color} opacity={0.85} />
          <circle cx={n.x} cy={n.y} r={12 + n.centrality * 8} fill="none" stroke="white" strokeWidth="2" />
          <text x={n.x} y={n.y + 22} textAnchor="middle" fontSize="7" fill="#666">{n.label.substring(0, 6)}</text>
          <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize="7" fill="white" fontWeight="600">{n.connections}</text>
        </g>
      ))}
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

      {/* Team Health Scores */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Team Health Scores" subheader="Collaboration, communication, and wellbeing by team" avatar={<HeartIcon color="error" />} />
          <CardContent>
            <Stack spacing={1.5}>
              {TEAM_SCORES.sort((a, b) => b.score - a.score).map((t, i) => (
                <Paper key={i} sx={{ p: 1.5, border: `1px solid ${t.score >= 80 ? alpha('#4caf50', 0.2) : t.score >= 70 ? alpha('#ff9800', 0.2) : alpha('#f44336', 0.2)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 80 }}>{t.team}</Typography>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress variant="determinate" value={t.score}
                          sx={{ height: 12, borderRadius: 6, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { borderRadius: 6, bgcolor: t.color } }} />
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ minWidth: 35, textAlign: 'right' }}>{t.score}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 2 }}>
                      {t.trend >= 0 ? <TrendUpIcon sx={{ fontSize: 12, color: 'success.main' }} /> : <TrendDownIcon sx={{ fontSize: 12, color: 'error.main' }} />}
                      <Typography variant="caption">{t.trend > 0 ? '+' : ''}{t.trend}</Typography>
                      <Chip size="small" label={`${t.headcount} ppl`} variant="outlined" sx={{ fontSize: 10 }} />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Weekly Trends */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="7-Week Trend" />
          <CardContent>
            <svg width="100%" height="200" viewBox="0 0 200 200">
              {WEEKLY_TRENDS.map((d, i) => {
                const x = 15 + i * 27;
                const healthH = (d.health / 100) * 140;
                return (
                  <g key={i}>
                    <rect x={x} y={160 - healthH} width="20" height={healthH} rx="3" fill="#2196f3" opacity={0.85} />
                    <text x={x + 10} y={155 - healthH} textAnchor="middle" fontSize="8" fill="#333" fontWeight="600">{d.health}</text>
                    <text x={x + 10} y={178} textAnchor="middle" fontSize="7" fill="#666">{d.week}</text>
                  </g>
                );
              })}
            </svg>
            <Stack direction="row" justifyContent="space-around" sx={{ mt: 1 }}>
              <Stack alignItems="center">
                <Typography variant="body2" fontWeight={700} color="success.main">+6</Typography>
                <Typography variant="caption" color="text.secondary">7W Growth</Typography>
              </Stack>
              <Stack alignItems="center">
                <Typography variant="body2" fontWeight={700}>78</Typography>
                <Typography variant="caption" color="text.secondary">Current</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Cross-Team Network */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Cross-Team Collaboration Network" subheader="Node size = connections, edge width = flow strength" avatar={<NetworkIcon color="primary" />} />
          <CardContent>
            <CollaborationNetwork data={COLLABORATION_GRAPH} height={220} />
          </CardContent>
        </Card>
      </Grid>

      {/* Psychological Safety */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Psychological Safety Index" subheader="6-dimension assessment vs benchmark" avatar={<BrainIcon color="secondary" />} />
          <CardContent>
            <RadarChart data={PSYCHOLOGICAL_SAFETY.map(p => ({ score: p.score, label: p.dimension.split(' ').slice(0, 2).join(' ') }))} size={200} />
            <Stack spacing={1} sx={{ mt: 2 }}>
              {PSYCHOLOGICAL_SAFETY.map((p, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ flex: 1, fontSize: 10 }}>{p.dimension}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" fontWeight={700} color={p.score >= p.benchmark ? 'success.main' : 'error.main'}>{p.score}</Typography>
                    <Typography variant="caption" color="text.secondary">vs {p.benchmark}</Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Insights */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="AI Team Health Insights" subheader="Actionable recommendations for improving collaboration" avatar={<InsightsIcon color="primary" />} />
          <CardContent>
            <Grid container spacing={2}>
              {TEAM_INSIGHTS.map((insight, i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Alert severity={insight.severity === 'positive' ? 'success' : insight.severity === 'critical' ? 'error' : 'warning'}
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

function MeetingAnalyticsTab() {
  return (
    <Grid container spacing={3}>
      {/* Meeting Overview */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Meeting Overview" />
          <CardContent>
            <Stack spacing={2} alignItems="center">
              <DonutChart value={Math.round(MEETING_ANALYTICS.meetingFreePct)} color="#4caf50" label="Meeting-Free Days" size={120} thickness={10} />
              <Stack spacing={1} sx={{ width: '100%' }}>
                {[
                  { label: 'Weekly Avg', value: `${MEETING_ANALYTICS.weeklyAverage}h`, color: '#ff9800' },
                  { label: 'Total (Monthly)', value: `${MEETING_ANALYTICS.totalHours}h`, color: '#2196f3' },
                  { label: 'Optimal Target', value: `${MEETING_ANALYTICS.optimalVsActual.optimal}h/wk`, color: '#4caf50' },
                  { label: 'Excess Load', value: `${MEETING_ANALYTICS.optimalVsActual.excess}h/wk`, color: '#f44336' },
                  { label: 'Meeting-Free Days', value: `${MEETING_ANALYTICS.noMeetingDays}/mo`, color: '#9c27b0' },
                ].map((m, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                    <Typography variant="caption" fontWeight={700} color={m.color}>{m.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Meeting by Type */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Meeting Breakdown by Type" subheader="Hours, count, attendees, and efficiency" avatar={<MeetingIcon color="warning" />} />
          <CardContent>
            <Stack spacing={1.5}>
              {MEETING_ANALYTICS.byType.sort((a, b) => b.hours - a.hours).map((m, i) => (
                <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                      <Box sx={{ width: 4, height: 30, borderRadius: 2, bgcolor: m.color }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{m.type}</Typography>
                        <Typography variant="caption" color="text.secondary">{m.count}/week · ~{m.avgAttendees} people</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Stack alignItems="center">
                        <Typography variant="body2" fontWeight={700}>{m.hours}h</Typography>
                        <Typography variant="caption" color="text.secondary">/week</Typography>
                      </Stack>
                      <Stack alignItems="center">
                        <Typography variant="body2" fontWeight={700} color={m.efficiency >= 75 ? 'success.main' : m.efficiency >= 60 ? 'warning.main' : 'error.main'}>
                          {m.efficiency}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">efficiency</Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Daily Load */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Daily Meeting Load" subheader="Meetings and focus blocks by day" />
          <CardContent>
            <svg width="100%" height="200" viewBox="0 0 350 200">
              {DAILY_MEETING_LOAD.map((d, i) => {
                const x = 20 + i * 65;
                const meetingH = (d.hours / 5) * 100;
                const focusH = (d.focusBlocks / 7) * 100;
                return (
                  <g key={i}>
                    <rect x={x} y={150 - meetingH} width="24" height={meetingH} rx="3" fill="#f44336" opacity={0.7} />
                    <rect x={x + 28} y={150 - focusH} width="24" height={focusH} rx="3" fill="#4caf50" opacity={0.7} />
                    <text x={x + 26} y={168} textAnchor="middle" fontSize="10" fill="#666">{d.day}</text>
                    <text x={x + 12} y={145 - meetingH} textAnchor="middle" fontSize="8" fill="#f44336" fontWeight="600">{d.hours}h</text>
                    <text x={x + 40} y={145 - focusH} textAnchor="middle" fontSize="8" fill="#4caf50" fontWeight="600">{d.focusBlocks}b</text>
                  </g>
                );
              })}
              <g transform="translate(20, 4)">
                <rect x="0" y="0" width="8" height="8" rx="2" fill="#f44336" opacity={0.7} />
                <text x="12" y="8" fontSize="8" fill="#666">Meetings</text>
                <rect x="70" y="0" width="8" height="8" rx="2" fill="#4caf50" opacity={0.7} />
                <text x="82" y="8" fontSize="8" fill="#666">Focus Blocks</text>
              </g>
            </svg>
            <Alert severity="info" sx={{ mt: 1, fontSize: 12 }}>
              <strong>Wednesday</strong> is the best focus day with only 1.2h of meetings. Consider making it company-wide meeting-free.
            </Alert>
          </CardContent>
        </Card>
      </Grid>

      {/* Meeting NPS */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Meeting Satisfaction (NPS)" />
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 2 }}>
              <Stack alignItems="center">
                <DonutChart value={68} color="#4caf50" label="Promoters" size={80} thickness={8} />
                <Typography variant="caption" fontWeight={600}>68%</Typography>
              </Stack>
              <Stack alignItems="center">
                <DonutChart value={22} color="#ff9800" label="Passive" size={80} thickness={8} />
                <Typography variant="caption" fontWeight={600}>22%</Typography>
              </Stack>
              <Stack alignItems="center">
                <DonutChart value={10} color="#f44336" label="Detractors" size={80} thickness={8} />
                <Typography variant="caption" fontWeight={600}>10%</Typography>
              </Stack>
            </Box>
            <Stack direction="row" justifyContent="center" sx={{ mb: 2 }}>
              <Typography variant="h3" fontWeight={700} color="primary.main">+42</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1, alignSelf: 'flex-end' }}>NPS</Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack spacing={1}>
              {[
                { feedback: '"Start and end on time"', pct: 72, color: '#4caf50' },
                { feedback: '"Clear agenda before meeting"', pct: 68, color: '#2196f3' },
                { feedback: '"Could have been an email"', pct: 35, color: '#f44336' },
                { feedback: '"Good use of my time"', pct: 62, color: '#9c27b0' },
              ].map((f, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" fontWeight={500}>{f.feedback}</Typography>
                    <Typography variant="caption" fontWeight={700}>{f.pct}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={f.pct}
                    sx={{ mt: 0.3, height: 5, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: f.color, borderRadius: 3 } }} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function CommunicationTab() {
  return (
    <Grid container spacing={3}>
      {/* Communication Channels */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Communication Channel Analytics" subheader="Volume, response time, and sentiment by channel" avatar={<ChatIcon color="primary" />} />
          <CardContent>
            <Stack spacing={1.5}>
              {COMMUNICATION_PATTERNS.byChannel.map((ch, i) => (
                <Paper key={i} sx={{ p: 1.5, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                      <Box sx={{ width: 4, height: 30, borderRadius: 2, bgcolor: ch.color }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{ch.channel}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {typeof ch.volume === 'number' ? ch.volume.toLocaleString() : ch.volume} volume · Avg response: {ch.avgResponse}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Stack alignItems="center">
                        <Typography variant="caption" fontWeight={700} color={ch.change >= 0 ? 'success.main' : 'error.main'}>
                          {ch.change > 0 ? '+' : ''}{ch.change}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">WoW</Typography>
                      </Stack>
                      <Stack alignItems="center">
                        <DonutChart value={ch.sentiment} color={ch.color} size={40} thickness={5} />
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Peak Activity Hours */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Peak Activity Hours" subheader="Communication intensity by hour" />
          <CardContent>
            <ActivityHeatmap data={COMMUNICATION_PATTERNS.peakHours} height={160} />
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" fontWeight={600}>🔥 Peak Hour</Typography>
                <Typography variant="caption" fontWeight={700} color="error.main">10AM (92%)</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" fontWeight={600}>🧘 Focus Window</Typography>
                <Typography variant="caption" fontWeight={700} color="success.main">6PM–8PM</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" fontWeight={600}>📊 Avg Activity</Typography>
                <Typography variant="caption" fontWeight={700}>58%</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Communication Health Metrics */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Communication Health Metrics" subheader="Key indicators of healthy team communication" />
          <CardContent>
            <Grid container spacing={2}>
              {[
                { metric: 'Avg Slack Response', value: '18min', target: '<30min', status: 'good', icon: <ChatIcon />, color: '#4caf50' },
                { metric: 'Email Response', value: '2.4h', target: '<4h', status: 'good', icon: <EmailIcon />, color: '#2196f3' },
                { metric: 'PR Review Time', value: '4.2h', target: '<4h', status: 'warning', icon: <DraftIcon />, color: '#ff9800' },
                { metric: 'Doc Collaboration', value: '22%', target: '>15%', status: 'good', icon: <ShareIcon />, color: '#9c27b0' },
                { metric: 'Async vs Sync', value: '72%', target: '>70%', status: 'good', icon: <ForumIcon />, color: '#00bcd4' },
                { metric: 'Read Receipt Rate', value: '85%', target: '>80%', status: 'good', icon: <ReadEmailIcon />, color: '#3f51b5' },
                { metric: 'After-Hours Msg', value: '18%', target: '<15%', status: 'warning', icon: <BellIcon />, color: '#f44336' },
                { metric: 'Meeting Follow-Up', value: '72%', target: '>75%', status: 'warning', icon: <FactCheckIcon />, color: '#607d8b' },
              ].map((m, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Paper sx={{ p: 1.5, borderTop: `3px solid ${m.color}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Avatar sx={{ bgcolor: alpha(m.color, 0.15), color: m.color, width: 32, height: 32 }}>{m.icon}</Avatar>
                      <Chip size="small" label={m.status} color={m.status === 'good' ? 'success' : 'warning'} sx={{ fontSize: 9, height: 18 }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{m.metric}</Typography>
                    <Typography variant="h6" fontWeight={700} color={m.color}>{m.value}</Typography>
                    <Typography variant="caption" color="text.secondary">Target: {m.target}</Typography>
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

function FocusTimeTab() {
  return (
    <Grid container spacing={3}>
      {/* Focus Time Overview */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Focus Time Overview" />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <DonutChart value={Math.round(FOCUS_TIME_DATA.avgDailyFocus / 8 * 100)} color="#4caf50" label={`${FOCUS_TIME_DATA.avgDailyFocus}h avg/day`} size={140} thickness={12} />
            <Stack spacing={1} sx={{ width: '100%' }}>
              {[
                { label: 'Avg Daily Focus', value: `${FOCUS_TIME_DATA.avgDailyFocus}h`, target: `${FOCUS_TIME_DATA.targetDailyFocus}h`, color: '#4caf50' },
                { label: 'Weekly Deep Work', value: '16.0h', target: '20.0h', color: '#2196f3' },
                { label: 'Focus Blocks/Day', value: '3.8', target: '5.0', color: '#9c27b0' },
                { label: 'Uninterrupted Streak', value: '1.2h', target: '2.0h', color: '#ff9800' },
              ].map((f, i) => (
                <Paper key={i} sx={{ p: 1, border: '1px solid #f0f0f0' }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption">{f.label}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Typography variant="caption" fontWeight={700} color={f.color}>{f.value}</Typography>
                      <Typography variant="caption" color="text.secondary">/ {f.target}</Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Focus by Team */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Focus Time by Team" subheader="Daily average: meetings vs focus vs deep work" avatar={<TargetIcon color="primary" />} />
          <CardContent>
            <svg width="100%" height="220" viewBox="0 0 500 220">
              {FOCUS_TIME_DATA.byTeam.map((t, i) => {
                const x = 20 + i * 60;
                const meetingH = (t.meetings / 8) * 140;
                const focusH = (t.focus / 8) * 140;
                const deepH = (t.deepWork / 8) * 140;
                return (
                  <g key={i}>
                    <rect x={x} y={180 - meetingH} width="16" height={meetingH} rx="2" fill="#f44336" opacity={0.7} />
                    <rect x={x + 18} y={180 - focusH} width="16" height={focusH} rx="2" fill="#2196f3" opacity={0.7} />
                    <rect x={x + 36} y={180 - deepH} width="16" height={deepH} rx="2" fill="#4caf50" opacity={0.7} />
                    <text x={x + 26} y={198} textAnchor="middle" fontSize="8" fill="#666">{t.team.substring(0, 6)}</text>
                    <text x={x + 8} y={175 - meetingH} textAnchor="middle" fontSize="7" fill="#f44336">{t.meetings}</text>
                    <text x={x + 26} y={175 - focusH} textAnchor="middle" fontSize="7" fill="#2196f3">{t.focus}</text>
                    <text x={x + 44} y={175 - deepH} textAnchor="middle" fontSize="7" fill="#4caf50">{t.deepWork}</text>
                  </g>
                );
              })}
              <g transform="translate(20, 4)">
                <rect x="0" y="0" width="8" height="8" rx="2" fill="#f44336" opacity={0.7} />
                <text x="12" y="8" fontSize="8" fill="#666">Meetings</text>
                <rect x="70" y="0" width="8" height="8" rx="2" fill="#2196f3" opacity={0.7} />
                <text x="82" y="8" fontSize="8" fill="#666">Focus</text>
                <rect x="130" y="0" width="8" height="8" rx="2" fill="#4caf50" opacity={0.7} />
                <text x="142" y="8" fontSize="8" fill="#666">Deep Work</text>
              </g>
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Focus Time Recommendations */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Focus Time Optimization Recommendations" avatar={<InsightsIcon color="primary" />} />
          <CardContent>
            <Grid container spacing={2}>
              {[
                { team: 'Sales', current: '2.2h', target: '3.5h', action: 'Batch client calls to morning blocks', impact: '+59% focus', color: '#4caf50', icon: '📞' },
                { team: 'Marketing', current: '2.8h', target: '4.0h', action: 'Implement "Creative Hours" (10AM–12PM)', impact: '+43% focus', color: '#2196f3', icon: '🎨' },
                { team: 'Operations', current: '3.0h', target: '4.0h', action: 'Consolidate standup + status meetings', impact: '+33% focus', color: '#9c27b0', icon: '⚙️' },
                { team: 'Product', current: '3.5h', target: '4.5h', action: 'Move stakeholder reviews to async docs', impact: '+29% focus', color: '#ff9800', icon: '📋' },
              ].map((r, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Paper sx={{ p: 2, borderLeft: `4px solid ${r.color}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>{r.icon} {r.team}</Typography>
                        <Typography variant="body2">{r.action}</Typography>
                      </Box>
                      <Chip size="small" label={r.impact} color="success" variant="outlined" sx={{ fontWeight: 700, fontSize: 10 }} />
                    </Stack>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      <Stack>
                        <Typography variant="caption" color="text.secondary">Current</Typography>
                        <Typography variant="body2" fontWeight={700} color="error.main">{r.current}/day</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ alignSelf: 'center' }}>→</Typography>
                      <Stack>
                        <Typography variant="caption" color="text.secondary">Target</Typography>
                        <Typography variant="body2" fontWeight={700} color="success.main">{r.target}/day</Typography>
                      </Stack>
                    </Stack>
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

export default function TeamHealthScoreDashboard() {
  const [tab, setTab] = useState(0);

  const tabLabels = [
    { label: 'Overview', icon: <AssessmentIcon /> },
    { label: 'Meeting Analytics', icon: <MeetingIcon /> },
    { label: 'Communication', icon: <ChatIcon /> },
    { label: 'Focus Time', icon: <TargetIcon /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <HeartIcon sx={{ fontSize: 32, color: '#e91e63' }} />
            <Box>
              <Typography variant="h4" fontWeight={700}>Team Collaboration Health Score</Typography>
              <Typography variant="body2" color="text.secondary">
                Meeting analytics · Communication patterns · Focus time · Team dynamics
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip icon={<HeartIcon />} label="Score: 78/100" color="secondary" variant="outlined" size="small" />
          <Chip icon={<SpeedIcon />} label="72% Async" color="success" variant="outlined" size="small" />
        </Stack>
      </Stack>

      {/* Alert */}
      <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>⚠️ Sales & Marketing meeting load exceeds 18h/week</strong> — 30% above optimal. After-hours messaging also elevated.{' '}
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
      {tab === 1 && <MeetingAnalyticsTab />}
      {tab === 2 && <CommunicationTab />}
      {tab === 3 && <FocusTimeTab />}

      {/* Footer */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Data updated: Aug 26, 2026 · Source: Slack + Google Calendar + Zoom + GitHub + Jira · 184 employees across 8 teams
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Export Report">
              <IconButton size="small"><AssessmentIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Schedule Pulse Survey">
              <IconButton size="small"><AnalyticsIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
