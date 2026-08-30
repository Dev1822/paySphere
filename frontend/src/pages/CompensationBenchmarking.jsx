/**
 * Compensation Benchmarking Dashboard (#1389)
 *
 * Industry salary benchmarking, geographic cost-of-living,
 * internal equity analysis, and total-rewards comparison.
 */

import { useMemo, useState } from 'react';

import { getCompensationBenchmarkData } from '../components/compensation/CompensationBenchmarkService';
import {
  OverviewStats,
  EmployeeCompCard,
  GapCard,
  GeoCOLCard,
  EquityCard,
  AlertCard,
} from '../components/compensation/CompensationBenchmarkCard';
import {
  BarChart,
  DonutChart,
  TrendLine,
  HorizontalBar,
  RadarChart,
} from '../components/compensation/CompensationBenchmarkCharts';
import {
  formatCurrency,
  STATUS_COLORS,
  LEVEL_COLORS,
  FAMILY_ICONS,
} from '../components/compensation/CompensationBenchmarkTypes';

const TABS = [
  'Overview',
  'Employees',
  'Market Gaps',
  'Geo & COL',
  'Pay Equity',
  'Alerts',
];

export default function CompensationBenchmarking() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [search, setSearch] = useState('');
  const [filterFamily, setFilterFamily] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const data = useMemo(() => getCompensationBenchmarkData(), []);

  const filteredEmployees = useMemo(() => {
    return data.employees.filter((e) => {
      if (
        search &&
        !e.employeeName.toLowerCase().includes(search.toLowerCase()) &&
        !e.department.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (filterFamily !== 'All' && e.jobFamily !== filterFamily) return false;
      if (filterLevel !== 'All' && e.level !== filterLevel) return false;
      if (filterRegion !== 'All' && e.region !== filterRegion) return false;
      if (filterStatus !== 'All' && e.status !== filterStatus) return false;
      return true;
    });
  }, [
    data.employees,
    search,
    filterFamily,
    filterLevel,
    filterRegion,
    filterStatus,
  ]);

  const statusDonutData = [
    {
      label: 'Below Market',
      value: data.summary.belowMarketCount,
      color: STATUS_COLORS['Below Market'],
    },
    {
      label: 'At Market',
      value: data.summary.atMarketCount,
      color: STATUS_COLORS['At Market'],
    },
    {
      label: 'Above Market',
      value: data.summary.aboveMarketCount,
      color: STATUS_COLORS['Above Market'],
    },
    {
      label: 'Significantly Above',
      value: data.summary.significantAboveCount,
      color: STATUS_COLORS['Significantly Above'],
    },
  ];

  const topGapsByFamily = useMemo(() => {
    const map = new Map();
    data.gaps
      .filter((g) => g.gapPct < 0)
      .forEach((g) => {
        map.set(g.jobFamily, (map.get(g.jobFamily) || 0) + g.gapPct);
      });
    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        value: Math.round(value * 10) / 10,
        color: '#ef4444',
      }))
      .sort((a, b) => a.value - b.value);
  }, [data.gaps]);

  const equityRadar = useMemo(() => {
    const families = [
      'Engineering',
      'Product',
      'Design',
      'Data Science',
      'Marketing',
      'Sales',
    ];
    return families.map((f) => {
      const metrics = data.equityMetrics.filter((m) => m.jobFamily === f);
      const avgGap = metrics.length
        ? metrics.reduce((s, m) => s + Math.abs(m.genderPayGapPct), 0) /
          metrics.length
        : 0;
      return { axis: f.slice(0, 8), value: Math.min(avgGap / 10, 1) };
    });
  }, [data.equityMetrics]);

  const filterBarStyle = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 12,
    color: '#374151',
    background: '#fff',
    outline: 'none',
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: 1400,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#111827',
            marginBottom: 4,
          }}
        >
          💰 Compensation Benchmarking
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Industry salary benchmarks, geographic cost-of-living, internal equity
          analysis, and total-rewards comparison.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? '#2563EB' : '#6b7280',
              background: activeTab === tab ? '#eff6ff' : 'transparent',
              borderBottom:
                activeTab === tab
                  ? '2px solid #2563EB'
                  : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <OverviewStats summary={data.summary} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
            }}
          >
            <DonutChart
              data={statusDonutData}
              title="Market Position Distribution"
            />
            <BarChart
              data={topGapsByFamily.slice(0, 8)}
              title="Compensation Gaps by Family (%)"
              height={200}
            />
            <RadarChart data={equityRadar} title="Pay Equity Radar" />
          </div>
          <TrendLine
            trends={data.trends}
            title="Compensation Trend vs Market"
          />
          {/* Recent Alerts */}
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              🚨 Active Alerts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.alerts.slice(0, 3).map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === 'Employees' && (
        <div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              placeholder="Search by name or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...filterBarStyle, minWidth: 200 }}
            />
            <select
              value={filterFamily}
              onChange={(e) => setFilterFamily(e.target.value)}
              style={filterBarStyle}
            >
              <option value="All">All Families</option>
              {[
                'Engineering',
                'Product',
                'Design',
                'Data Science',
                'DevOps',
                'Marketing',
                'Sales',
                'Finance',
                'HR',
                'Legal',
              ].map((f) => (
                <option key={f} value={f}>
                  {FAMILY_ICONS[f]} {f}
                </option>
              ))}
            </select>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={filterBarStyle}
            >
              <option value="All">All Levels</option>
              {[
                'Junior',
                'Mid-Level',
                'Senior',
                'Staff',
                'Principal',
                'Director',
                'VP',
              ].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              style={filterBarStyle}
            >
              <option value="All">All Regions</option>
              {['North America', 'Europe', 'Asia Pacific', 'South Asia'].map(
                (r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ),
              )}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={filterBarStyle}
            >
              <option value="All">All Statuses</option>
              {[
                'Below Market',
                'At Market',
                'Above Market',
                'Significantly Above',
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {filteredEmployees.length} results
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {filteredEmployees.map((emp) => (
              <EmployeeCompCard key={emp.id} emp={emp} />
            ))}
          </div>
        </div>
      )}

      {/* Market Gaps Tab */}
      {activeTab === 'Market Gaps' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <BarChart
              data={topGapsByFamily}
              title="Compensation Gap by Job Family (%)"
              height={220}
            />
            <HorizontalBar data={topGapsByFamily} title="Gap Ranking" />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: 12,
            }}
          >
            {data.gaps
              .filter((g) => g.gapPct < 0)
              .sort((a, b) => a.gapPct - b.gapPct)
              .map((g) => (
                <GapCard key={g.id} gap={g} />
              ))}
          </div>
        </div>
      )}

      {/* Geo & COL Tab */}
      {activeTab === 'Geo & COL' && (
        <div>
          <BarChart
            data={data.geoData.map((g) => ({
              label: g.city,
              value: g.costOfLivingIndex,
              color:
                g.costOfLivingIndex > 150
                  ? '#ef4444'
                  : g.costOfLivingIndex > 100
                    ? '#eab308'
                    : '#22c55e',
            }))}
            title="Cost of Living Index (NYC = 100 baseline)"
            height={220}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
              marginTop: 16,
            }}
          >
            {data.geoData.map((g) => (
              <GeoCOLCard key={g.id} geo={g} />
            ))}
          </div>
        </div>
      )}

      {/* Pay Equity Tab */}
      {activeTab === 'Pay Equity' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <RadarChart data={equityRadar} title="Gender Pay Gap by Family" />
            <DonutChart
              data={[
                {
                  label: 'Compliant',
                  value: data.equityMetrics.filter(
                    (m) => m.complianceStatus === 'Compliant',
                  ).length,
                  color: '#22c55e',
                },
                {
                  label: 'Needs Review',
                  value: data.equityMetrics.filter(
                    (m) => m.complianceStatus === 'Needs Review',
                  ).length,
                  color: '#eab308',
                },
                {
                  label: 'Non-Compliant',
                  value: data.equityMetrics.filter(
                    (m) => m.complianceStatus === 'Non-Compliant',
                  ).length,
                  color: '#ef4444',
                },
              ]}
              title="Compliance Status"
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: 12,
            }}
          >
            {data.equityMetrics.map((m) => (
              <EquityCard key={m.id} metric={m} />
            ))}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'Alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.alerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </div>
  );
}
