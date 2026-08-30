// CompensationBandCard — Strictly typed salary band benchmarking card
import React, { useState, useCallback } from 'react';
import { formatCurrency } from '../../services/workforce/workforceService';

/** Equity grant range with typed discriminator */
interface EquityRange {
  min: number;
  max: number;
  type: 'stock_option' | 'rsu' | 'espp' | 'none';
}

/** Color scheme for a compensation grade tier */
interface GradeColorScheme {
  gradient: string;
  accent: string;
}

/** Strict union for all supported compensation grades */
type CompensationGrade =
  | 'executive'
  | 'director'
  | 'senior_manager'
  | 'manager'
  | 'senior_individual'
  | 'individual';

/** Props for CompensationBandCard — all properties strictly typed */
interface CompensationBandCardProps {
  grade: CompensationGrade;
  title: string;
  minSalary: number;
  midpoint: number;
  maxSalary: number;
  marketP25: number;
  marketP50: number;
  marketP75: number;
  bonusTarget: number;
  benefitsValue: number;
  equityRange: EquityRange;
  headcount: number;
  location: string;
  lastUpdated: string;
  onExpand?: (grade: CompensationGrade, expanded: boolean) => void;
  onCompare?: (grade: CompensationGrade) => void;
}

const gradeColors: Record<CompensationGrade, GradeColorScheme> = {
  executive: {
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
    accent: '#d946ef',
  },
  director: {
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    accent: '#818cf8',
  },
  senior_manager: {
    gradient: 'linear-gradient(135deg, #020617 0%, #1e293b 100%)',
    accent: '#38bdf8',
  },
  manager: {
    gradient: 'linear-gradient(135deg, #090d16 0%, #111827 100%)',
    accent: '#34d399',
  },
  senior_individual: {
    gradient: 'linear-gradient(135deg, #090d16 0%, #111827 100%)',
    accent: '#fbbf24',
  },
  individual: {
    gradient: 'linear-gradient(135deg, #090d16 0%, #111827 100%)',
    accent: '#94a3b8',
  },
};

const CompensationBandCard: React.FC<CompensationBandCardProps> = ({
  grade,
  title,
  minSalary,
  midpoint,
  maxSalary,
  marketP25,
  marketP50,
  marketP75,
  bonusTarget,
  benefitsValue,
  equityRange,
  headcount,
  location,
  lastUpdated,
  onExpand,
  onCompare,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const gc: GradeColorScheme = gradeColors[grade] ?? gradeColors.individual;
  const range: number = maxSalary - minSalary;

  const renderBandBar = (value: number, label: string, color: string): React.ReactElement => {
    const pct = Math.min(Math.max(((value - minSalary) / range) * 100, 0), 100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: '#64748b', fontSize: '11px', width: '80px', textAlign: 'right' }}>{label}</span>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '8px', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: `${pct}%`, top: '-4px',
            width: '2px', height: '16px', background: color, borderRadius: '1px',
          }} />
        </div>
        <span style={{ color, fontSize: '11px', fontWeight: 600, width: '70px' }}>{formatCurrency(value)}</span>
      </div>
    );
  };
  const handleToggleExpand = useCallback((): void => {
    const next = !expanded;
    setExpanded(next);
    onExpand?.(grade, next);
  }, [expanded, grade, onExpand]);

  const handleCompare = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      onCompare?.(grade);
    },
    [grade, onCompare],
  );


  return (
    <div
      onClick={handleToggleExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>): void => {
        if (e.key === 'Enter' || e.key === ' ') handleToggleExpand();
      }}
      style={{
        background: gc.gradient,
        border: `1px solid ${gc.accent}33`,
        borderRadius: '16px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: `0 0 20px ${gc.accent}11`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <h3 style={{ color: gc.accent, margin: 0, fontSize: '16px', fontWeight: 700 }}>{title}</h3>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '12px' }}>{location} • {headcount} employees</p>
        </div>
        <span style={{
          background: `${gc.accent}22`, border: `1px solid ${gc.accent}44`,
          borderRadius: '8px', padding: '4px 10px', color: gc.accent, fontSize: '11px', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {grade.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Salary Range Visual */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '11px' }}>Salary Range</span>
          <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>{formatCurrency(minSalary)} — {formatCurrency(maxSalary)}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', height: '10px', position: 'relative', overflow: 'visible' }}>
          <div style={{
            background: `linear-gradient(90deg, ${gc.accent}66, ${gc.accent})`,
            borderRadius: '8px', height: '100%', width: '100%',
          }} />
          {/* Midpoint marker */}
          <div style={{
            position: 'absolute', left: '50%', top: '-3px',
            width: '2px', height: '16px', background: '#fff', borderRadius: '1px',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px' }}>P25: {formatCurrency(marketP25)}</span>
          <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>P50: {formatCurrency(marketP50)}</span>
          <span style={{ color: '#64748b', fontSize: '10px' }}>P75: {formatCurrency(marketP75)}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Bonus Target</p>
          <p style={{ color: gc.accent, margin: '4px 0 0', fontSize: '16px', fontWeight: 700 }}>{bonusTarget}%</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Benefits Value</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '14px', fontWeight: 700 }}>{formatCurrency(benefitsValue)}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Equity</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '12px', fontWeight: 700 }}>
            {equityRange.type === 'none' ? 'N/A' : `${formatCurrency(equityRange.min)}-${formatCurrency(equityRange.max)}`}
          </p>
        </div>
      </div>

      {/* Expanded: Market Comparison Bars */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
          <p style={{ color: '#94a3b8', margin: '0 0 8px', fontSize: '12px', fontWeight: 600 }}>📊 Market Percentile Comparison</p>
          {renderBandBar(minSalary, 'Band Min', '#64748b')}
          {renderBandBar(marketP25, 'Market P25', '#94a3b8')}
          {renderBandBar(midpoint, 'Midpoint', gc.accent)}
          {renderBandBar(marketP50, 'Market P50', '#e2e8f0')}
          {renderBandBar(marketP75, 'Market P75', '#fbbf24')}
          {renderBandBar(maxSalary, 'Band Max', '#ef4444')}
          <p style={{ color: '#64748b', margin: '10px 0 0', fontSize: '10px' }}>Last updated: {lastUpdated}</p>
        </div>
      )}

      {onCompare && (
        <button
          onClick={handleCompare}
          className="compare-btn"
          style={{
            marginTop: '12px',
            width: '100%',
            background: `${gc.accent}22`,
            border: `1px solid ${gc.accent}44`,
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          ⚖️ Compare Grade
        </button>
      )}
    </div>
  );
};

export default CompensationBandCard;

export type { CompensationBandCardProps, CompensationGrade, EquityRange, GradeColorScheme };
