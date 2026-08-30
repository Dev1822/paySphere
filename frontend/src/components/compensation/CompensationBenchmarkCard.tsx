/**
 * Compensation Benchmarking — Card Components
 *
 * StatCard, EmployeeCompCard, GapCard, GeoCOLCard, EquityCard,
 * AlertCard, and OverviewStats for the benchmarking dashboard.
 */

import React from 'react';
import {
  EmployeeCompensation, CompensationGap, GeographicCOL,
  PayEquityMetric, CompensationAlert, BenchmarkSummary,
  formatCurrency, formatPercent, formatNumber,
  STATUS_COLORS, STATUS_BG, LEVEL_COLORS, FAMILY_ICONS,
  CompensationStatus,
} from './CompensationBenchmarkTypes';

// ── Stat Card ──────────────────────────────────────────────────────────────

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  subtitle?: string;
}> = ({ label, value, icon, color = '#2563EB', subtitle }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    flex: '1 1 200px', minWidth: 180,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
    {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{subtitle}</div>}
  </div>
);

// ── Overview Stats ─────────────────────────────────────────────────────────

export const OverviewStats: React.FC<{ summary: BenchmarkSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Total Employees" value={summary.totalEmployees} icon="👥" />
    <StatCard label="Avg Base Salary" value={formatCurrency(summary.avgBaseSalary)} icon="💵" />
    <StatCard label="Avg Total Comp" value={formatCurrency(summary.avgTotalComp)} icon="💰" />
    <StatCard label="Market Position" value={`${summary.marketPositionPct}th`} icon="📊" subtitle="percentile" />
    <StatCard label="Comp Cost" value={formatCurrency(summary.compensationCost)} icon="🏢" subtitle="annual" />
    <StatCard label="Budget Used" value={`${summary.budgetUtilization}%`} icon="📈" color={summary.budgetUtilization > 90 ? '#ef4444' : '#22c55e'} />
    <StatCard label="Below Market" value={summary.belowMarketCount} icon="⚠️" color="#ef4444" />
    <StatCard label="Gender Pay Gap" value={formatPercent(summary.avgGenderPayGapPct)} icon="⚖️" color={Math.abs(summary.avgGenderPayGapPct) > 5 ? '#ef4444' : '#22c55e'} />
  </div>
);

// ── Status Badge ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: CompensationStatus }> = ({ status }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    fontSize: 11, fontWeight: 700, color: STATUS_COLORS[status],
    background: STATUS_BG[status], border: `1px solid ${STATUS_COLORS[status]}30`,
  }}>{status}</span>
);

// ── Employee Comp Card ─────────────────────────────────────────────────────

export const EmployeeCompCard: React.FC<{
  emp: EmployeeCompensation;
  onClick?: () => void;
}> = ({ emp, onClick }) => (
  <div onClick={onClick} style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: '1px solid #e5e7eb', cursor: onClick ? 'pointer' : 'default',
    transition: 'box-shadow 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{emp.employeeName}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {FAMILY_ICONS[emp.jobFamily] || '📋'} {emp.jobFamily} · {emp.level}
        </div>
      </div>
      <StatusBadge status={emp.status} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
      <div><span style={{ color: '#9ca3af' }}>Base:</span> <b>{formatCurrency(emp.baseSalary)}</b></div>
      <div><span style={{ color: '#9ca3af' }}>Total:</span> <b>{formatCurrency(emp.totalCompensation)}</b></div>
      <div><span style={{ color: '#9ca3af' }}>Bonus:</span> {emp.annualBonusPct}%</div>
      <div><span style={{ color: '#9ca3af' }}>Equity:</span> {emp.equityType || '—'}</div>
    </div>
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${emp.percentile}%`, background: STATUS_COLORS[emp.status],
        }} />
      </div>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>P{emp.percentile}</span>
    </div>
    <div style={{ marginTop: 6, display: 'flex', gap: 8, fontSize: 11, color: '#9ca3af' }}>
      <span>⭐ {emp.performanceRating.toFixed(1)}</span>
      <span>📍 {emp.location}</span>
      {emp.promotionReady && <span style={{ color: '#8b5cf6', fontWeight: 700 }}>🎯 Promo Ready</span>}
    </div>
  </div>
);

// ── Gap Card ───────────────────────────────────────────────────────────────

export const GapCard: React.FC<{ gap: CompensationGap }> = ({ gap }) => {
  const riskColor = gap.riskLevel === 'Critical' ? '#ef4444' : gap.riskLevel === 'High' ? '#f97316' : gap.riskLevel === 'Medium' ? '#eab308' : '#22c55e';
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      border: `1px solid ${riskColor}30`, boxShadow: `0 0 0 1px ${riskColor}10`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{FAMILY_ICONS[gap.jobFamily]} {gap.jobFamily} · {gap.level}</div>
        <span style={{
          padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
          color: riskColor, background: `${riskColor}15`, border: `1px solid ${riskColor}30`,
        }}>{gap.riskLevel}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12, marginBottom: 8 }}>
        <div><span style={{ color: '#9ca3af' }}>Gap:</span> <b style={{ color: gap.gapPct < 0 ? '#ef4444' : '#22c55e' }}>{formatPercent(gap.gapPct)}</b></div>
        <div><span style={{ color: '#9ca3af' }}>Market P50:</span> {formatCurrency(gap.marketP50)}</div>
        <div><span style={{ color: '#9ca3af' }}>Internal:</span> {formatCurrency(gap.internalMedian)}</div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        👥 {gap.affectedEmployees} employees affected · {gap.region}
      </div>
      <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', borderRadius: 8, padding: '8px 12px', marginTop: 6 }}>
        💡 {gap.recommendation}
      </div>
    </div>
  );
};

// ── Geo COL Card ───────────────────────────────────────────────────────────

export const GeoCOLCard: React.FC<{ geo: GeographicCOL }> = ({ geo }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>📍 {geo.city}, {geo.country}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
      <div><span style={{ color: '#9ca3af' }}>COL Index:</span> <b>{geo.costOfLivingIndex}</b></div>
      <div><span style={{ color: '#9ca3af' }}>Tax Rate:</span> <b>{geo.taxRate}%</b></div>
      <div><span style={{ color: '#9ca3af' }}>Purchasing Power:</span> <b style={{ color: geo.purchasingPowerPct > 100 ? '#22c55e' : '#ef4444' }}>{geo.purchasingPowerPct}%</b></div>
      <div><span style={{ color: '#9ca3af' }}>Salary Mult:</span> <b>×{geo.avgSalaryMultiplier}</b></div>
    </div>
    <div style={{ marginTop: 8, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${Math.min(geo.costOfLivingIndex, 200) / 2}%`,
        background: geo.costOfLivingIndex > 150 ? '#ef4444' : geo.costOfLivingIndex > 100 ? '#eab308' : '#22c55e',
      }} />
    </div>
  </div>
);

// ── Equity Card ────────────────────────────────────────────────────────────

export const EquityCard: React.FC<{ metric: PayEquityMetric }> = ({ metric }) => {
  const statusColor = metric.complianceStatus === 'Compliant' ? '#22c55e' : metric.complianceStatus === 'Needs Review' ? '#eab308' : '#ef4444';
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      border: `1px solid ${statusColor}30`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{FAMILY_ICONS[metric.jobFamily]} {metric.jobFamily} · {metric.level}</div>
        <span style={{
          padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
          color: statusColor, background: `${statusColor}15`,
        }}>{metric.complianceStatus}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
        <div><span style={{ color: '#9ca3af' }}>Gender Gap:</span> <b style={{ color: Math.abs(metric.genderPayGapPct) > 5 ? '#ef4444' : '#22c55e' }}>{formatPercent(metric.genderPayGapPct)}</b></div>
        <div><span style={{ color: '#9ca3af' }}>Adjusted:</span> {formatPercent(metric.adjustedGapPct)}</div>
        <div><span style={{ color: '#9ca3af' }}>Male Median:</span> {formatCurrency(metric.medianMaleSalary)}</div>
        <div><span style={{ color: '#9ca3af' }}>Female Median:</span> {formatCurrency(metric.medianFemaleSalary)}</div>
        <div><span style={{ color: '#9ca3af' }}>Male Count:</span> {metric.maleCount}</div>
        <div><span style={{ color: '#9ca3af' }}>Female Count:</span> {metric.femaleCount}</div>
      </div>
    </div>
  );
};

// ── Alert Card ─────────────────────────────────────────────────────────────

export const AlertCard: React.FC<{ alert: CompensationAlert }> = ({ alert }) => {
  const sevColor = alert.severity === 'Critical' ? '#ef4444' : alert.severity === 'High' ? '#f97316' : alert.severity === 'Medium' ? '#eab308' : '#6b7280';
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      borderLeft: `4px solid ${sevColor}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{alert.title}</div>
        <span style={{
          padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          color: sevColor, background: `${sevColor}15`,
        }}>{alert.severity}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{alert.description}</div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
        {alert.affectedCount > 0 && <span>👥 {alert.affectedCount} affected</span>}
        {alert.estimatedCost > 0 && <span>💰 {formatCurrency(alert.estimatedCost)} est. cost</span>}
        <span>📅 {alert.createdAt}</span>
      </div>
    </div>
  );
};
