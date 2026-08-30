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
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Alert,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  Assessment as AssessmentIcon,
  Insights as InsightsIcon,
  Groups as GroupsIcon,
  Balance as BalanceIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Engineering as EngineeringIcon,
  Code as CodeIcon,
  DesignServices as DesignIcon,
  Campaign as MarketingIcon,
  LocalHospital as HealthIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  Shield as ShieldIcon,
  PieChart as PieIcon,
  BarChart as BarIcon,
  ShowChart as LineIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon,
  PersonAdd as HiredIcon,
  PersonRemove as ExitIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  WorkspacePremium as PremiumIcon,
  CurrencyRupee as RupeeIcon,
  CompareArrows as CompareIcon,
  QueryStats as StatsIcon,
  Diversity3 as DiversityIcon,
  CorporateFare as CorpIcon,
  TrendingFlat as FlatIcon,
} from '@mui/icons-material';

// ── Mock Data ──────────────────────────────────────────────────────────────

const KPI_CARDS = [
  { label: 'Avg CTC (Annual)', value: '₹18.4L', change: 12, icon: <MoneyIcon />, color: '#4caf50', bg: '#e8f5e9' },
  { label: 'Median CTC', value: '₹15.2L', change: 8, icon: <RupeeIcon />, color: '#2196f3', bg: '#e3f2fd' },
  { label: 'Pay Equity Index', value: '0.91', change: 0.04, icon: <BalanceIcon />, color: '#9c27b0', bg: '#f3e5f5' },
  { label: 'Market Position', value: 'P62', change: 5, icon: <CompareIcon />, color: '#ff9800', bg: '#fff3e0' },
  { label: 'Budget Utilization', value: '87%', change: 3, icon: <StatsIcon />, color: '#00bcd4', bg: '#e0f7fa' },
  { label: 'Gender Pay Gap', value: '4.2%', change: -1.8, icon: <DiversityIcon />, color: '#e91e63', bg: '#fce4ec', invert: true },
  { label: 'Salary Band Compliance', value: '92%', change: 4, icon: <ShieldIcon />, color: '#3f51b5', bg: '#e8eaf6' },
  { label: 'Compa-Ratio >1.0', value: '38%', change: 6, icon: <PremiumIcon />, color: '#ff5722', bg: '#fbe9e7' },
];

const MARKET_BENCHMARKS = [
  { role: 'Software Engineer', level: 'L3', company: '₹14.5L', market: '₹16.2L', p25: '₹12.8L', p50: '₹16.2L', p75: '₹21.5L', p90: '₹28.0L', position: 52, gap: -10.5 },
  { role: 'Senior Software Engineer', level: 'L5', company: '₹28.0L', market: '₹32.5L', p25: '₹24.0L', p50: '₹32.5L', p75: '₹42.0L', p90: '₹55.0L', position: 45, gap: -13.8 },
  { role: 'Product Manager', level: 'L5', company: '₹30.0L', market: '₹35.0L', p25: '₹26.0L', p50: '₹35.0L', p75: '₹48.0L', p90: '₹62.0L', position: 42, gap: -14.3 },
  { role: 'UX Designer', level: 'L4', company: '₹18.5L', market: '₹20.0L', p25: '₹14.5L', p50: '₹20.0L', p75: '₹27.0L', p90: '₹35.0L', position: 58, gap: -7.5 },
  { role: 'Data Scientist', level: 'L4', company: '₹22.0L', market: '₹24.5L', p25: '₹17.0L', p50: '₹24.5L', p75: '₹33.0L', p90: '₹44.0L', position: 55, gap: -10.2 },
  { role: 'Engineering Manager', level: 'L7', company: '₹48.0L', market: '₹52.0L', p25: '₹38.0L', p50: '₹52.0L', p75: '₹68.0L', p90: '₹88.0L', position: 55, gap: -7.7 },
  { role: 'Sales Executive', level: 'L3', company: '₹10.5L', market: '₹9.8L', p25: '₹7.5L', p50: '₹9.8L', p75: '₹14.0L', p90: '₹18.5L', position: 68, gap: 7.1 },
  { role: 'Marketing Manager', level: 'L5', company: '₹22.0L', market: '₹25.0L', p25: '₹18.0L', p50: '₹25.0L', p75: '₹34.0L', p90: '₹45.0L', position: 48, gap: -12.0 },
  { role: 'HR Business Partner', level: 'L5', company: '₹18.0L', market: '₹19.5L', p25: '₹14.0L', p50: '₹19.5L', p75: '₹26.0L', p90: '₹34.0L', position: 56, gap: -7.7 },
  { role: 'Finance Analyst', level: 'L3', company: '₹12.0L', market: '₹13.0L', p25: '₹9.5L', p50: '₹13.0L', p75: '₹18.0L', p90: '₹24.0L', position: 54, gap: -7.7 },
  { role: 'DevOps Engineer', level: 'L4', company: '₹20.0L', market: '₹22.0L', p25: '₹16.0L', p50: '₹22.0L', p75: '₹30.0L', p90: '₹40.0L', position: 52, gap: -9.1 },
  { role: 'Staff Engineer', level: 'L7', company: '₹55.0L', market: '₹58.0L', p25: '₹42.0L', p50: '₹58.0L', p75: '₹75.0L', p90: '₹95.0L', position: 56, gap: -5.2 },
];

const SALARY_BANDS = [
  { band: 'Junior (L1-L2)', min: 4.5, mid: 8.0, max: 14.0, count: 148, within: 132, below: 8, above: 8, color: '#4caf50' },
  { band: 'Mid (L3-L4)', min: 10.0, mid: 18.0, max: 30.0, count: 178, within: 162, below: 6, above: 10, color: '#2196f3' },
  { band: 'Senior (L5-L6)', min: 22.0, mid: 35.0, max: 55.0, count: 92, within: 84, below: 2, above: 6, color: '#9c27b0' },
  { band: 'Staff (L7-L8)', min: 42.0, mid: 62.0, max: 90.0, count: 32, within: 30, below: 0, above: 2, color: '#ff9800' },
  { band: 'Principal (L9+)', min: 80.0, mid: 120.0, max: 180.0, count: 8, within: 8, below: 0, above: 0, color: '#f44336' },
];

const GENDER_PAY_GAP = {
  overall: { male: 19.2, female: 18.4, gap: 4.2 },
  byLevel: [
    { level: 'Junior (L1-L2)', male: 8.2, female: 7.9, gap: 3.7 },
    { level: 'Mid (L3-L4)', male: 18.8, female: 17.8, gap: 5.3 },
    { level: 'Senior (L5-L6)', male: 36.5, female: 34.8, gap: 4.7 },
    { level: 'Staff (L7-L8)', male: 64.2, female: 60.8, gap: 5.3 },
    { level: 'Principal (L9+)', male: 128.0, female: 122.0, gap: 4.7 },
  ],
  byDepartment: [
    { dept: 'Engineering', male: 24.5, female: 22.8, gap: 6.9 },
    { dept: 'Product', male: 32.0, female: 30.5, gap: 4.7 },
    { dept: 'Design', male: 19.8, female: 19.2, gap: 3.0 },
    { dept: 'Marketing', male: 21.0, female: 20.5, gap: 2.4 },
    { dept: 'Sales', male: 14.2, female: 13.5, gap: 4.9 },
    { dept: 'HR', male: 17.5, female: 17.0, gap: 2.9 },
    { dept: 'Finance', male: 16.8, female: 16.2, gap: 3.6 },
    { dept: 'Operations', male: 15.0, female: 14.2, gap: 5.3 },
  ],
};

const COMPA_RATIO_DATA = [
  { dept: 'Engineering', avg: 0.96, median: 0.94, below: 18, within: 82, above: 24 },
  { dept: 'Product', avg: 0.92, median: 0.90, below: 12, within: 70, above: 8 },
  { dept: 'Design', avg: 0.98, median: 0.97, below: 2, within: 85, above: 6 },
  { dept: 'Marketing', avg: 0.94, median: 0.93, below: 8, within: 75, above: 9 },
  { dept: 'Sales', avg: 1.02, median: 1.01, below: 6, within: 68, above: 14 },
  { dept: 'HR', avg: 0.97, median: 0.96, below: 1, within: 88, above: 3 },
  { dept: 'Finance', avg: 0.99, median: 0.98, below: 2, within: 84, above: 6 },
  { dept: 'Operations', avg: 0.95, median: 0.93, below: 10, within: 72, above: 10 },
  { dept: 'Data Science', avg: 1.01, median: 1.00, below: 2, within: 80, above: 6 },
  { dept: 'Customer Success', avg: 0.93, median: 0.91, below: 5, within: 70, above: 5 },
];

const TOTAL_COMPENSATION_HISTORY = [
  { year: 'FY21', totalSpend: 68.2, headcount: 324, avgCTC: 14.2, budget: 72.0 },
  { year: 'FY22', totalSpend: 82.5, headcount: 378, avgCTC: 15.8, budget: 85.0 },
  { year: 'FY23', totalSpend: 96.8, headcount: 412, avgCTC: 17.1, budget: 100.0 },
  { year: 'FY24', totalSpend: 112.4, headcount: 452, avgCTC: 18.2, budget: 118.0 },
  { year: 'FY25', totalSpend: 128.6, headcount: 478, avgCTC: 19.4, budget: 135.0 },
  { year: 'FY26', totalSpend: 141.2, headcount: 486, avgCTC: 20.1, budget: 150.0, projected: true },
];

const EQUITY_ISSUES = [
  { employee: 'Rohit Mehta', dept: 'Engineering', role: 'Staff Dev', currentCTC: 42.0, marketP50: 58.0, gap: -27.6, compaRatio: 0.72, severity: 'critical', lastAdj: '24m ago' },
  { employee: 'Sneha Patel', dept: 'Marketing', role: 'Content Lead', currentCTC: 16.0, marketP50: 20.0, gap: -20.0, compaRatio: 0.80, severity: 'critical', lastAdj: '18m ago' },
  { employee: 'Amit Kumar', dept: 'Sales', role: 'Sales Manager', currentCTC: 22.0, marketP50: 28.0, gap: -21.4, compaRatio: 0.79, severity: 'critical', lastAdj: '20m ago' },
  { employee: 'Deepa Nair', dept: 'Customer Success', role: 'CS Manager', currentCTC: 18.0, marketP50: 22.0, gap: -18.2, compaRatio: 0.82, severity: 'high', lastAdj: '15m ago' },
  { employee: 'Vikram Singh', dept: 'Engineering', role: 'Senior Dev', currentCTC: 20.0, marketP50: 26.0, gap: -23.1, compaRatio: 0.77, severity: 'critical', lastAdj: '28m ago' },
  { employee: 'Neha Gupta', dept: 'Design', role: 'UX Lead', currentCTC: 22.0, marketP50: 27.0, gap: -18.5, compaRatio: 0.81, severity: 'high', lastAdj: '16m ago' },
  { employee: 'Karan Joshi', dept: 'Operations', role: 'Ops Analyst', currentCTC: 9.5, marketP50: 13.0, gap: -26.9, compaRatio: 0.73, severity: 'critical', lastAdj: '22m ago' },
  { employee: 'Priya Sharma', dept: 'Sales', role: 'Account Executive', currentCTC: 8.5, marketP50: 10.5, gap: -19.0, compaRatio: 0.81, severity: 'high', lastAdj: '14m ago' },
];

const BUDGET_ALLOCATION = [
  { dept: 'Engineering', budget: 48.2, actual: 44.8, headcount: 124, perCapita: 3.61, color: '#2196f3' },
  { dept: 'Sales', budget: 18.5, actual: 17.2, headcount: 82, perCapita: 2.10, color: '#4caf50' },
  { dept: 'Product', budget: 14.2, actual: 13.1, headcount: 42, perCapita: 3.12, color: '#9c27b0' },
  { dept: 'Marketing', budget: 10.8, actual: 10.2, headcount: 46, perCapita: 2.22, color: '#ff9800' },
  { dept: 'Operations', budget: 10.5, actual: 9.8, headcount: 58, perCapita: 1.69, color: '#00bcd4' },
  { dept: 'Finance', budget: 6.8, actual: 6.4, headcount: 32, perCapita: 2.00, color: '#3f51b5' },
  { dept: 'Data Science', budget: 6.2, actual: 5.8, headcount: 24, perCapita: 2.42, color: '#e91e63' },
  { dept: 'Design', budget: 5.4, actual: 5.1, headcount: 28, perCapita: 1.82, color: '#ff5722' },
  { dept: 'HR', budget: 3.8, actual: 3.6, headcount: 18, perCapita: 2.00, color: '#607d8b' },
  { dept: 'Legal', budget: 2.8, actual: 2.6, headcount: 14, perCapita: 1.86, color: '#795548' },
  { dept: 'Customer Success', budget: 3.5, actual: 3.2, headcount: 18, perCapita: 1.78, color: '#009688' },
];

const COMP_INSIGHTS = [
  { insight: 'Software Engineer L3 comp is at P52 — 10.5% below market median. Risk of attrition as competitors offer P65+ packages.', severity: 'critical', impact: 'high', action: 'Adjust band to P60' },
  { insight: 'Gender pay gap narrowed from 6.0% to 4.2% YoY. Engineering gap (6.9%) remains above company target of 3%.', severity: 'warning', impact: 'high', action: 'Engineering pay equity audit' },
  { insight: 'Sales team compa-ratio (1.02) exceeds 1.0 — strong commission payouts. Consider raising base for stability.', severity: 'info', impact: 'medium', action: 'Review base vs variable split' },
  { insight: '7 employees flagged as critical equity issues — total correction cost estimated at ₹18.6L annually.', severity: 'critical', impact: 'high', action: 'Immediate off-cycle adjustments' },
  { insight: 'Total comp spend grew 14.2% YoY but headcount only 1.7% — per-capita cost rising faster than revenue.', severity: 'warning', impact: 'high', action: 'Review comp-to-revenue ratio' },
  { insight: 'Staff+ engineers (L7+) compa-ratio avg 0.94 — below market. Flight risk for senior ICs is elevated.', severity: 'warning', impact: 'high', action: 'Retention packages for L7+' },
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

function MarketPositionChart({ data, height = 200 }) {
  return (
    <svg width="100%" height={height} viewBox={`0 0 500 ${height}`}>
      {/* P25-P75 band */}
      {data.map((d, i) => {
        const y = 20 + i * 16;
        const totalRange = 100; // mapped to 0-100 scale
        const x25 = 130 + (d.p25 / 100) * 340;
        const x50 = 130 + (d.p50 / 100) * 340;
        const x75 = 130 + (d.p75 / 100) * 340;
        const x90 = 130 + (d.p90 / 100) * 340;
        const xPos = 130 + (d.position / 100) * 340;
        return (
          <g key={i}>
            <text x="125" y={y + 4} textAnchor="end" fontSize="7" fill="#666">{d.role.split(' ').slice(0, 2).join(' ')}</text>
            <rect x={x25} y={y - 3} width={x75 - x25} height="6" rx="3" fill="#e0e0e0" />
            <line x1={x50} y1={y - 4} x2={x50} y2={y + 4} stroke="#666" strokeWidth="1" />
            <circle cx={xPos} cy={y} r="3.5" fill={d.position < 50 ? '#f44336' : d.position < 60 ? '#ff9800' : '#4caf50'} />
            <text x={xPos + 6} y={y + 3} fontSize="7" fill="#333" fontWeight="600">P{d.position}</text>
          </g>
        );
      })}
      {/* Legend */}
      <text x="150" y={height - 8} fontSize="8" fill="#999">P25</text>
      <text x="220" y={height - 8} fontSize="8" fill="#999">P50 (Median)</text>
      <text x="310" y={height - 8} fontSize="8" fill="#999">P75</text>
    </svg>
  );
}

function GroupedBarChart({ data, height = 180, width = 400 }) {
  const maxVal = Math.max(...data.flatMap(d => [d.male, d.female]));
  const barGroupWidth = Math.floor((width - 80) / data.length);
  const barWidth = barGroupWidth / 3 - 2;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const x = 50 + i * barGroupWidth;
        const maleH = (d.male / maxVal) * (height - 50);
        const femaleH = (d.female / maxVal) * (height - 50);
        const gapH = (d.gap / 10) * (height - 50);
        return (
          <g key={i}>
            <rect x={x} y={height - 28 - maleH} width={barWidth} height={maleH} rx="2" fill="#2196f3" opacity={0.8} />
            <rect x={x + barWidth + 2} y={height - 28 - femaleH} width={barWidth} height={femaleH} rx="2" fill="#e91e63" opacity={0.8} />
            <text x={x + barGroupWidth / 2 - 2} y={height - 12} textAnchor="middle" fontSize="7" fill="#666">
              {d.level.split(' ')[0]}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x="50" y="4" width="8" height="8" rx="2" fill="#2196f3" />
      <text x="62" y="12" fontSize="8" fill="#666">Male Avg (₹L)</text>
      <rect x="130" y="4" width="8" height="8" rx="2" fill="#e91e63" />
      <text x="142" y="12" fontSize="8" fill="#666">Female Avg (₹L)</text>
    </svg>
  );
}

function CompaRatioHeatmap({ data, height = 200 }) {
  const getColor = (ratio) => {
    if (ratio >= 1.0) return '#4caf50';
    if (ratio >= 0.95) return '#8bc34a';
    if (ratio >= 0.90) return '#ffc107';
    if (ratio >= 0.85) return '#ff9800';
    return '#f44336';
  };

  return (
    <svg width="100%" height={height} viewBox={`0 0 400 ${height}`}>
      {data.map((d, i) => {
        const y = 15 + i * 20;
        const barWidth = d.avg * 160;
        return (
          <g key={i}>
            <text x="100" y={y + 10} textAnchor="end" fontSize="9" fill="#666">{d.dept}</text>
            <rect x="105" y={y} width="160" height="14" rx="3" fill="#f5f5f5" />
            <rect x="105" y={y} width={barWidth} height="14" rx="3" fill={getColor(d.avg)} opacity={0.85} />
            <text x={110 + barWidth} y={y + 10} fontSize="9" fill="#333" fontWeight="600">{d.avg.toFixed(2)}</text>
          </g>
        );
      })}
      <line x1={105 + 0.95 * 160} y1="5" x2={105 + 0.95 * 160} y2={height - 10} stroke="#f44336" strokeWidth="1" strokeDasharray="3,2" />
      <text x={105 + 0.95 * 160} y="10" textAnchor="middle" fontSize="7" fill="#f44336">Target: 0.95</text>
    </svg>
  );
}

function BudgetBarChart({ data, height = 200 }) {
  const maxBudget = Math.max(...data.map(d => d.budget));

  return (
    <svg width="100%" height={height} viewBox={`0 0 450 ${height}`}>
      {data.map((d, i) => {
        const y = 10 + i * 18;
        const budgetW = (d.budget / maxBudget) * 260;
        const actualW = (d.actual / maxBudget) * 260;
        const utilization = Math.round((d.actual / d.budget) * 100);
        return (
          <g key={i}>
            <text x="80" y={y + 10} textAnchor="end" fontSize="8" fill="#666">{d.dept}</text>
            <rect x="85" y={y} width={budgetW} height="7" rx="2" fill="#e0e0e0" />
            <rect x="85" y={y + 8} width={actualW} height="7" rx="2" fill={d.color} opacity={0.85} />
            <text x={90 + Math.max(budgetW, actualW)} y={y + 10} fontSize="7" fill="#999">{utilization}%</text>
          </g>
        );
      })}
      <g transform="translate(85, 10)">
        <rect x="0" y="-8" width="8" height="4" rx="1" fill="#e0e0e0" />
        <text x="12" y="-4" fontSize="7" fill="#999">Budget</text>
        <rect x="55" y="-8" width="8" height="4" rx="1" fill="#2196f3" />
        <text x="67" y="-4" fontSize="7" fill="#999">Actual</text>
      </g>
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
                  {typeof kpi.change === 'number' && Math.abs(kpi.change) < 1 ? `+${(kpi.change * 100).toFixed(0)}bp` : `${Math.abs(kpi.change)}%`} vs last year
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* Market Position */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Market Position by Role" subheader="Company comp vs market percentiles (P25–P90)" avatar={<CompareIcon color="primary" />} />
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Company</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">P25</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">P50</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">P75</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Position</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Gap</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MARKET_BENCHMARKS.map((d, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Stack>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{d.role}</Typography>
                          <Typography variant="caption" color="text.secondary">{d.level}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{d.company}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 11, color: '#999' }}>{d.p25}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 11, color: '#666' }}>{d.p50}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 11, color: '#999' }}>{d.p75}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={`P${d.position}`}
                          color={d.position >= 60 ? 'success' : d.position >= 50 ? 'warning' : 'error'}
                          sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700}
                          color={d.gap >= 0 ? 'success.main' : d.gap > -10 ? 'warning.main' : 'error.main'}
                          sx={{ fontSize: 12 }}>
                          {d.gap > 0 ? '+' : ''}{d.gap}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Budget Allocation */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Budget Allocation" subheader="₹150Cr total" />
          <CardContent>
            <Stack spacing={1.5}>
              {BUDGET_ALLOCATION.sort((a, b) => b.budget - a.budget).slice(0, 6).map((d, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" fontWeight={500}>{d.dept}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" fontWeight={700}>₹{d.budget}Cr</Typography>
                      <Typography variant="caption" color="text.secondary">({Math.round(d.budget / 150 * 100)}%)</Typography>
                    </Stack>
                  </Stack>
                  <LinearProgress variant="determinate" value={(d.actual / d.budget) * 100}
                    sx={{ mt: 0.3, height: 6, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: d.color, borderRadius: 3 } }} />
                </Box>
              ))}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="space-around">
              <Stack alignItems="center">
                <Typography variant="h6" fontWeight={700} color="success.main">87%</Typography>
                <Typography variant="caption" color="text.secondary">Utilized</Typography>
              </Stack>
              <Stack alignItems="center">
                <Typography variant="h6" fontWeight={700} color="warning.main">₹19.4Cr</Typography>
                <Typography variant="caption" color="text.secondary">Remaining</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Compensation Insights */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="AI Compensation Insights" subheader="Actionable intelligence for comp strategy" avatar={<InsightsIcon color="primary" />} />
          <CardContent>
            <Grid container spacing={2}>
              {COMP_INSIGHTS.map((insight, i) => (
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

function EquityTab() {
  return (
    <Grid container spacing={3}>
      {/* Gender Pay Gap */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Gender Pay Gap Analysis" subheader="Average CTC comparison by gender" avatar={<DiversityIcon color="secondary" />} />
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 2 }}>
              <Stack alignItems="center">
                <DonutChart value={4.2} maxValue={15} color="#e91e63" label="Overall Gap" size={100} thickness={10} />
              </Stack>
            </Box>
            <GroupedBarChart data={GENDER_PAY_GAP.byLevel} height={180} />
            <Divider sx={{ my: 2 }} />
            <Alert severity={GENDER_PAY_GAP.overall.gap <= 5 ? 'success' : 'warning'} sx={{ fontSize: 12 }}>
              Overall gap: <strong>{GENDER_PAY_GAP.overall.gap}%</strong> (male avg ₹{GENDER_PAY_GAP.overall.male}L vs female avg ₹{GENDER_PAY_GAP.overall.female}L).
              {GENDER_PAY_GAP.overall.gap <= 5 ? ' Within target range.' : ' Exceeds 5% target.'}
            </Alert>
          </CardContent>
        </Card>
      </Grid>

      {/* Pay Gap by Department */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Pay Gap by Department" subheader="% difference in avg CTC (male vs female)" />
          <CardContent>
            <Stack spacing={1.5}>
              {GENDER_PAY_GAP.byDepartment.sort((a, b) => b.gap - a.gap).map((d, i) => (
                <Paper key={i} sx={{ p: 1.5, border: `1px solid ${d.gap > 5 ? alpha('#f44336', 0.2) : d.gap > 3 ? alpha('#ff9800', 0.2) : alpha('#4caf50', 0.2)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={600}>{d.dept}</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Stack direction="row" spacing={1}>
                        <Chip size="small" label={`♂ ₹${d.male}L`} sx={{ bgcolor: alpha('#2196f3', 0.1), color: '#2196f3', fontSize: 10 }} />
                        <Chip size="small" label={`♀ ₹${d.female}L`} sx={{ bgcolor: alpha('#e91e63', 0.1), color: '#e91e63', fontSize: 10 }} />
                      </Stack>
                      <Chip size="small" label={`${d.gap}% gap`}
                        color={d.gap > 5 ? 'error' : d.gap > 3 ? 'warning' : 'success'}
                        sx={{ fontWeight: 700, fontSize: 10 }} />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Critical Equity Issues */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Critical Equity Issues — Action Required" subheader="Employees significantly below market median" avatar={<WarningIcon color="error" />} />
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Current CTC</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Market P50</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Gap</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Compa-Ratio</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Last Adjustment</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="center">Risk</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {EQUITY_ISSUES.sort((a, b) => a.compaRatio - b.compaRatio).map((d, i) => (
                    <TableRow key={i} hover sx={{ bgcolor: d.severity === 'critical' ? alpha('#f44336', 0.03) : 'inherit' }}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 28, height: 28, fontSize: 10, bgcolor: d.severity === 'critical' ? 'error.main' : 'warning.main' }}>
                            {d.employee.split(' ').map(n => n[0]).join('')}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{d.employee}</Typography>
                            <Typography variant="caption" color="text.secondary">{d.role}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontSize: 12 }}>{d.dept}</Typography></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: 12 }}>₹{d.currentCTC}L</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, color: '#666' }}>₹{d.marketP50}L</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="error.main" sx={{ fontSize: 12 }}>{d.gap}%</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={d.compaRatio.toFixed(2)}
                          color={d.compaRatio >= 0.85 ? 'warning' : 'error'} sx={{ fontWeight: 700, fontSize: 10 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 11, color: '#999' }}>{d.lastAdj}</TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={d.severity}
                          color={d.severity === 'critical' ? 'error' : 'warning'} sx={{ fontWeight: 700, fontSize: 10 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Alert severity="error" sx={{ mt: 2 }}>
              <strong>Total correction cost:</strong> ₹18.6L annually to bring all 8 employees to market P50.{' '}
              <Button size="small" color="inherit" sx={{ fontWeight: 700 }}>Generate Adjustment Plan →</Button>
            </Alert>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function CompaRatioTab() {
  return (
    <Grid container spacing={3}>
      {/* Compa-Ratio Heatmap */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Compa-Ratio by Department" subheader="Average compa-ratio (target: 0.95–1.05)" avatar={<BarIcon color="primary" />} />
          <CardContent>
            <CompaRatioHeatmap data={COMPA_RATIO_DATA} height={220} />
            <Stack direction="row" justifyContent="center" spacing={2} sx={{ mt: 2 }}>
              {[
                { label: 'Critical (<0.85)', color: '#f44336' },
                { label: 'Below (0.85–0.94)', color: '#ff9800' },
                { label: 'Target (0.95–1.05)', color: '#4caf50' },
              ].map((item, i) => (
                <Stack key={i} direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Compa-Ratio Distribution */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Compa-Ratio Distribution" subheader="Employee distribution across compa-ratio bands" />
          <CardContent>
            <svg width="100%" height="200" viewBox="0 0 350 200">
              {[
                { band: '<0.80', count: 18, color: '#d32f2f' },
                { band: '0.80-0.89', count: 42, color: '#f44336' },
                { band: '0.90-0.94', count: 86, color: '#ff9800' },
                { band: '0.95-1.00', count: 168, color: '#4caf50' },
                { band: '1.01-1.05', count: 112, color: '#2196f3' },
                { band: '1.06-1.10', count: 42, color: '#9c27b0' },
                { band: '>1.10', count: 18, color: '#607d8b' },
              ].map((d, i) => {
                const barWidth = 36;
                const maxCount = 175;
                const barH = (d.count / maxCount) * 140;
                const x = 15 + i * (barWidth + 12);
                return (
                  <g key={i}>
                    <rect x={x} y={160 - barH} width={barWidth} height={barH} rx="4" fill={d.color} opacity={0.85} />
                    <text x={x + barWidth / 2} y={155 - barH} textAnchor="middle" fontSize="10" fill="#333" fontWeight="600">{d.count}</text>
                    <text x={x + barWidth / 2} y={178} textAnchor="middle" fontSize="8" fill="#666">{d.band}</text>
                    <text x={x + barWidth / 2} y={190} textAnchor="middle" fontSize="7" fill="#999">{Math.round(d.count / 486 * 100)}%</text>
                  </g>
                );
              })}
              {/* Target zone indicator */}
              <rect x={15 + 2 * 48} y="2" width={2 * 48 + 36} height="8" rx="4" fill="#4caf50" opacity={0.2} />
              <text x={15 + 3 * 48 + 18} y="18" textAnchor="middle" fontSize="8" fill="#4caf50" fontWeight="600">Target Zone</text>
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Detailed Compa-Ratio Table */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Department Compa-Ratio Breakdown" subheader="Detailed distribution by department" />
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Avg</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Median</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Below Band</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Within Band</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Above Band</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {COMPA_RATIO_DATA.sort((a, b) => a.avg - b.avg).map((d, i) => (
                    <TableRow key={i} hover>
                      <TableCell><Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{d.dept}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color={d.avg >= 0.95 ? 'success.main' : d.avg >= 0.90 ? 'warning.main' : 'error.main'} sx={{ fontSize: 12 }}>
                          {d.avg.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{d.median.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={d.below} color={d.below > 5 ? 'error' : 'default'} variant="outlined" sx={{ fontSize: 10 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600, color: 'success.main' }}>{d.within}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{d.above}</TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={d.avg >= 0.95 ? 'On Track' : d.avg >= 0.90 ? 'Caution' : 'Action Needed'}
                          color={d.avg >= 0.95 ? 'success' : d.avg >= 0.90 ? 'warning' : 'error'}
                          sx={{ fontSize: 10, fontWeight: 600 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function TrendTab() {
  return (
    <Grid container spacing={3}>
      {/* Total Comp History */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader title="Total Compensation Spend — 6 Year Trend" subheader="Actual spend vs budget allocation (₹Cr)" avatar={<LineIcon color="primary" />} />
          <CardContent>
            <svg width="100%" height="220" viewBox="0 0 500 220">
              {/* Grid */}
              {[0, 40, 80, 120, 160].map((v, i) => {
                const y = 190 - (v / 160) * 170;
                return (
                  <g key={i}>
                    <line x1="50" y1={y} x2="480" y2={y} stroke="#f0f0f0" strokeWidth="0.5" />
                    <text x="45" y={y + 4} textAnchor="end" fontSize="9" fill="#999">₹{v}Cr</text>
                  </g>
                );
              })}
              {/* Budget bars */}
              {TOTAL_COMPENSATION_HISTORY.map((d, i) => {
                const x = 60 + i * 72;
                const budgetH = (d.budget / 160) * 170;
                return (
                  <rect key={`b${i}`} x={x - 8} y={190 - budgetH} width="16" height={budgetH} rx="2" fill="#e0e0e0" />
                );
              })}
              {/* Actual bars */}
              {TOTAL_COMPENSATION_HISTORY.map((d, i) => {
                const x = 60 + i * 72;
                const actualH = (d.totalSpend / 160) * 170;
                return (
                  <g key={`a${i}`}>
                    <rect x={x - 6} y={190 - actualH} width="12" height={actualH} rx="2"
                      fill={d.projected ? '#9c27b0' : '#2196f3'} opacity={d.projected ? 0.5 : 0.85} />
                    <text x={x} y={185 - actualH} textAnchor="middle" fontSize="8" fill="#333" fontWeight="600">₹{d.totalSpend}</text>
                    <text x={x} y={205} textAnchor="middle" fontSize="9" fill="#666">{d.year}</text>
                  </g>
                );
              })}
              {/* Legend */}
              <rect x="60" y="4" width="10" height="8" rx="2" fill="#e0e0e0" />
              <text x="74" y="11" fontSize="8" fill="#666">Budget</text>
              <rect x="120" y="4" width="10" height="8" rx="2" fill="#2196f3" />
              <text x="134" y="11" fontSize="8" fill="#666">Actual Spend</text>
              <rect x="210" y="4" width="10" height="8" rx="2" fill="#9c27b0" opacity={0.5} />
              <text x="224" y="11" fontSize="8" fill="#666">Projected</text>
            </svg>
          </CardContent>
        </Card>
      </Grid>

      {/* Key Metrics */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Compensation Trends" />
          <CardContent>
            <Stack spacing={2}>
              {[
                { label: '5Y CAGR (Total Spend)', value: '15.3%', sub: '₹68.2Cr → ₹141.2Cr', color: '#2196f3' },
                { label: '5Y CAGR (Avg CTC)', value: '9.2%', sub: '₹14.2L → ₹20.1L', color: '#4caf50' },
                { label: '5Y Headcount Growth', value: '50%', sub: '324 → 486 employees', color: '#9c27b0' },
                { label: 'Budget Variance (FY26)', value: '-5.9%', sub: '₹141.2Cr vs ₹150Cr budget', color: '#ff9800' },
                { label: 'Comp as % of Revenue', value: '32.4%', sub: 'Industry avg: 35%', color: '#00bcd4' },
                { label: 'Revenue per Employee', value: '₹61.8L', sub: '+8.2% YoY growth', color: '#3f51b5' },
              ].map((d, i) => (
                <Paper key={i} sx={{ p: 1.5, borderLeft: `4px solid ${d.color}` }}>
                  <Typography variant="body2" fontWeight={500}>{d.label}</Typography>
                  <Typography variant="h6" fontWeight={700} color={d.color}>{d.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{d.sub}</Typography>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Per-Capita Trend */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Compensation Growth Metrics — 6 Year View" />
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Year</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Total Spend (₹Cr)</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Budget (₹Cr)</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Headcount</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Avg CTC (₹L)</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Per Capita (₹L)</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">YoY Spend Growth</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TOTAL_COMPENSATION_HISTORY.map((d, i) => {
                    const prevSpend = i > 0 ? TOTAL_COMPENSATION_HISTORY[i - 1].totalSpend : null;
                    const yoyGrowth = prevSpend ? ((d.totalSpend - prevSpend) / prevSpend * 100).toFixed(1) : '—';
                    return (
                      <TableRow key={i} hover sx={{ bgcolor: d.projected ? alpha('#9c27b0', 0.05) : 'inherit' }}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{d.year}</Typography>
                            {d.projected && <Chip size="small" label="Projected" sx={{ fontSize: 9, height: 18 }} />}
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontSize: 12 }}>₹{d.totalSpend}Cr</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, color: '#666' }}>₹{d.budget}Cr</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12 }}>{d.headcount}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12 }}>₹{d.avgCTC}L</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>₹{(d.totalSpend / d.headcount * 10).toFixed(1)}L</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600} color={i === 0 ? 'text.secondary' : 'success.main'} sx={{ fontSize: 12 }}>
                            {yoyGrowth === '—' ? '—' : `+${yoyGrowth}%`}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Salary Band Compliance */}
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Salary Band Compliance" subheader="Distribution within defined salary bands by level" avatar={<ShieldIcon color="primary" />} />
          <CardContent>
            <Grid container spacing={2}>
              {SALARY_BANDS.map((band, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Paper sx={{ p: 2, borderTop: `4px solid ${band.color}` }}>
                    <Typography variant="subtitle2" fontWeight={700}>{band.band}</Typography>
                    <Stack direction="row" spacing={2} sx={{ my: 1 }}>
                      <Stack alignItems="center">
                        <Typography variant="caption" color="text.secondary">Min</Typography>
                        <Typography variant="body2" fontWeight={600}>₹{band.min}L</Typography>
                      </Stack>
                      <Stack alignItems="center">
                        <Typography variant="caption" color="text.secondary">Mid</Typography>
                        <Typography variant="body2" fontWeight={700}>₹{band.mid}L</Typography>
                      </Stack>
                      <Stack alignItems="center">
                        <Typography variant="caption" color="text.secondary">Max</Typography>
                        <Typography variant="body2" fontWeight={600}>₹{band.max}L</Typography>
                      </Stack>
                    </Stack>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="success.main">Within band</Typography>
                        <Typography variant="caption" fontWeight={700}>{band.within} ({Math.round(band.within / band.count * 100)}%)</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="error.main">Below band</Typography>
                        <Typography variant="caption" fontWeight={700}>{band.below}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="warning.main">Above band</Typography>
                        <Typography variant="caption" fontWeight={700}>{band.above}</Typography>
                      </Stack>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(band.within / band.count) * 100}
                      sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: band.color, borderRadius: 4 } }}
                    />
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

export default function CompensationBenchmarkingDashboard() {
  const [tab, setTab] = useState(0);

  const tabLabels = [
    { label: 'Overview', icon: <AssessmentIcon /> },
    { label: 'Pay Equity', icon: <BalanceIcon /> },
    { label: 'Compa-Ratio', icon: <BarIcon /> },
    { label: 'Trends & Bands', icon: <TimelineIcon /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <MoneyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" fontWeight={700}>Compensation Benchmarking & Pay Equity</Typography>
              <Typography variant="body2" color="text.secondary">
                Market comparison · Pay equity analysis · Compa-ratio tracking · Budget optimization
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip icon={<CompareIcon />} label="P62 Market Position" color="primary" variant="outlined" size="small" />
          <Chip icon={<ShieldIcon />} label="92% Band Compliant" color="success" variant="outlined" size="small" />
        </Stack>
      </Stack>

      {/* Alert */}
      <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>⚠️ 7 employees flagged as critical equity risks</strong> — compa-ratio below 0.85. Total correction cost: ₹18.6L annually.{' '}
        <Button size="small" color="inherit" sx={{ fontWeight: 700 }}>Review Adjustments →</Button>
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
      {tab === 1 && <EquityTab />}
      {tab === 2 && <CompaRatioTab />}
      {tab === 3 && <TrendTab />}

      {/* Footer */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Data updated: Aug 26, 2026 · Source: HRIS + Market Data (Mercer/Aon) + Payroll · 486 employees across 11 departments
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Export Compensation Report">
              <IconButton size="small"><AssessmentIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Schedule Equity Review">
              <IconButton size="small"><BalanceIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
