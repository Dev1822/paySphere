/**
 * Employee Engagement Pulse — Chart Visualizations
 *
 * BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart
 * — pure React + inline SVG, no external charting library.
 */

import React from 'react';
import { EngagementTrend } from './engagementPulseTypes';

// ── Bar Chart ──────────────────────────────────────────────────────────────

export const BarChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  title: string;
  height?: number;
}> = ({ data, title, height = 200 }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#111827' }}>{title}</div>
      <svg width="100%" height={height} viewBox={`0 0 ${data.length * 60} ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = (d.value / max) * (height - 40);
          return (
            <g key={i}>
              <rect x={i * 60 + 10} y={height - 24 - barH} width={40} height={barH} rx={4} fill={d.color || '#3b82f6'} />
              <text x={i * 60 + 30} y={height - 6} textAnchor="middle" fontSize={10} fill="#6b7280">
                {d.label.length > 6 ? d.label.slice(0, 6) + '…' : d.label}
              </text>
              <text x={i * 60 + 30} y={height - 28 - barH} textAnchor="middle" fontSize={10} fill="#374151" fontWeight={600}>{d.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── Donut Chart ────────────────────────────────────────────────────────────

export const DonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  title: string;
  size?: number;
}> = ({ data, title, size = 180 }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const pct = d.value / total; const dash = pct * circ; const offset = -(acc / total) * circ; acc += d.value;
          return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={20} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        })}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fontSize={20} fontWeight={800} fill="#111827">{total}</text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize={10} fill="#9ca3af">Total</text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: d.color, display: 'inline-block' }} />
            {d.label} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Trend Line ─────────────────────────────────────────────────────────────

export const TrendLine: React.FC<{
  trends: EngagementTrend[];
  title: string;
  lines: { key: keyof EngagementTrend; color: string; label: string }[];
}> = ({ trends, title, lines }) => {
  const width = 500, height = 200, pad = 40;
  const allVals = trends.flatMap(t => lines.map(l => Number(t[l.key])));
  const min = Math.min(...allVals) * 0.9;
  const max = Math.max(...allVals) * 1.1;
  const xStep = (width - pad * 2) / Math.max(trends.length - 1, 1);
  const toPath = (vals: number[]) => vals.map((v, i) => {
    const x = pad + i * xStep;
    const y = height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {lines.map((line, li) => (
          <path key={li} d={toPath(trends.map(t => Number(t[line.key])))} fill="none" stroke={line.color} strokeWidth={2} />
        ))}
        {trends.filter((_, i) => i % 2 === 0).map((t, i) => (
          <text key={i} x={pad + (i * 2) * xStep} y={height - 10} textAnchor="middle" fontSize={9} fill="#9ca3af">{t.month.slice(5)}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
            <span style={{ width: 12, height: 3, background: l.color, borderRadius: 2, display: 'inline-block' }} />{l.label}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Horizontal Bar ─────────────────────────────────────────────────────────

export const HorizontalBar: React.FC<{
  data: { label: string; value: number; color?: string }[];
  title: string;
}> = ({ data, title }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 100, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>{d.label}</span>
          <div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${(d.value / max) * 100}%`, background: d.color || '#3b82f6' }} />
          </div>
          <span style={{ width: 40, fontSize: 11, fontWeight: 600, color: '#374151' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Radar Chart ────────────────────────────────────────────────────────────

export const RadarChart: React.FC<{
  data: { axis: string; value: number }[];
  title: string;
  size?: number;
}> = ({ data, title, size = 200 }) => {
  const cx = size / 2, cy = size / 2, r = size / 2 - 20;
  const n = data.length; const step = (2 * Math.PI) / n;
  const pt = (idx: number, val: number) => {
    const a = idx * step - Math.PI / 2;
    return { x: cx + r * val * Math.cos(a), y: cy + r * val * Math.sin(a) };
  };
  const poly = data.map((d, i) => pt(i, d.value)).map(p => `${p.x},${p.y}`).join(' ');
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {[0.25, 0.5, 0.75, 1].map(s => (
          <polygon key={s} points={data.map((_, i) => pt(i, s)).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#e5e7eb" strokeWidth={1} />
        ))}
        {data.map((_, i) => { const p = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth={1} />; })}
        <polygon points={poly} fill="#8b5cf630" stroke="#8b5cf6" strokeWidth={2} />
        {data.map((d, i) => { const p = pt(i, 1.18); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#6b7280">{d.axis}</text>; })}
      </svg>
    </div>
  );
};
