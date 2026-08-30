// BenefitsEnrollmentCard — Glassmorphism card for benefits plan enrollment display
import React, { useState } from 'react';

interface BenefitsEnrollmentCardProps {
  employeeName: string;
  department: string;
  planName: string;
  planType: string;
  tier: string;
  status: string;
  monthlyPremium: number;
  employerContribution: number;
  employeeContribution: number;
  dependents: Array<{ name: string; relationship: string }>;
  ytdEmployerSpend: number;
}

const planTypeIcons: Record<string, string> = {
  health_insurance: '🏥', dental: '🦷', vision: '👁️', life_insurance: '🛡️',
  disability: '♿', retirement_401k: '💰', hsa: '🏦', commuter: '🚌',
  wellness: '🧘', tuition_reimbursement: '🎓',
};

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  pending: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
  terminated: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  cobra: { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
  waived: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
};

const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const BenefitsEnrollmentCard: React.FC<BenefitsEnrollmentCardProps> = ({
  employeeName, department, planName, planType, tier, status, monthlyPremium,
  employerContribution, employeeContribution, dependents, ytdEmployerSpend,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sc = statusColors[status] || statusColors.active;
  const icon = planTypeIcons[planType] || '📋';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${sc.border}`,
        borderRadius: '16px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>{icon}</span>
          <div>
            <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '15px', fontWeight: 700 }}>{employeeName}</h3>
            <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '12px' }}>{department} • {planName}</p>
          </div>
        </div>
        <span style={{
          background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '8px',
          padding: '4px 10px', color: sc.text, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
        }}>
          {status}
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Tier</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '14px', fontWeight: 700, textTransform: 'capitalize' }}>{tier}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Monthly Premium</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '14px', fontWeight: 700 }}>{formatCurrency(monthlyPremium)}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Your Share</p>
          <p style={{ color: '#60a5fa', margin: '4px 0 0', fontSize: '14px', fontWeight: 700 }}>{formatCurrency(employeeContribution)}</p>
        </div>
      </div>

      {/* Employer Contribution Bar */}
      {monthlyPremium > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 600 }}>Employer: {formatCurrency(employerContribution)}/mo</span>
            <span style={{ color: '#64748b', fontSize: '11px' }}>{Math.round((employerContribution / monthlyPremium) * 100)}% covered</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', height: '6px' }}>
            <div style={{
              background: 'linear-gradient(90deg, #22c55e, #34d399)',
              borderRadius: '6px', height: '100%',
              width: `${Math.round((employerContribution / monthlyPremium) * 100)}%`,
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
          {dependents.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: '#94a3b8', margin: '0 0 6px', fontSize: '12px', fontWeight: 600 }}>👥 Dependents</p>
              {dependents.map((d, i) => (
                <p key={i} style={{ color: '#cbd5e1', margin: '2px 0', fontSize: '12px', paddingLeft: '12px' }}>
                  • {d.name} ({d.relationship})
                </p>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            <div>
              <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>YTD Employer Spend</p>
              <p style={{ color: '#22c55e', margin: '2px 0 0', fontSize: '16px', fontWeight: 700 }}>{formatCurrency(ytdEmployerSpend)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Annual Employee Cost</p>
              <p style={{ color: '#60a5fa', margin: '2px 0 0', fontSize: '16px', fontWeight: 700 }}>{formatCurrency(employeeContribution * 12)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BenefitsEnrollmentCard;
