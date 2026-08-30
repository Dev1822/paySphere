import React from 'react';
import { CheckCircle2, ShieldCheck, Heart, Activity, Clock } from 'lucide-react';
import BenefitsEnrollmentCard from './BenefitsEnrollmentCard';

const ENROLLMENT_CARDS_DATA = [
  {
    employeeName: 'Elena Rostova',
    department: 'Engineering',
    planName: 'Platinum PPO Healthcare & Vision',
    planType: 'health_insurance',
    tier: 'family',
    status: 'active',
    monthlyPremium: 770,
    employerContribution: 650,
    employeeContribution: 120,
    dependents: [
      { name: 'Ivan Rostov', relationship: 'Spouse' },
      { name: 'Anya Rostova', relationship: 'Child' },
    ],
    ytdEmployerSpend: 5850,
  },
  {
    employeeName: 'Marcus Vance',
    department: 'Product Management',
    planName: '401(k) Retirement & Match',
    planType: 'retirement_401k',
    tier: 'individual',
    status: 'active',
    monthlyPremium: 900,
    employerContribution: 450,
    employeeContribution: 450,
    dependents: [],
    ytdEmployerSpend: 4050,
  },
  {
    employeeName: 'David Chen',
    department: 'Design',
    planName: 'Global Dental Premier',
    planType: 'dental',
    tier: 'individual',
    status: 'pending',
    monthlyPremium: 105,
    employerContribution: 85,
    employeeContribution: 20,
    dependents: [],
    ytdEmployerSpend: 765,
  },
  {
    employeeName: 'Sarah Jenkins',
    department: 'Operations',
    planName: 'Basic Life Insurance',
    planType: 'life_insurance',
    tier: 'individual',
    status: 'waived',
    monthlyPremium: 0,
    employerContribution: 0,
    employeeContribution: 0,
    dependents: [],
    ytdEmployerSpend: 0,
  },
];

interface EnrollmentEvent {
  id: string;
  employeeName: string;
  planEnrolled: string;
  coverageTier: string;
  monthlyDeductionUSD: number;
  effectiveStartDate: string;
  timestampAgo: string;
}

const RECENT_ENROLLMENTS: EnrollmentEvent[] = [
  {
    id: 'enr-1',
    employeeName: 'Elena Rostova',
    planEnrolled: 'Platinum PPO Healthcare & Vision',
    coverageTier: 'Employee + Family',
    monthlyDeductionUSD: 120,
    effectiveStartDate: 'Nov 1, 2026',
    timestampAgo: '30 mins ago',
  },
  {
    id: 'enr-2',
    employeeName: 'Marcus Vance',
    planEnrolled: '401(k) Retirement & 6% Employer Match',
    coverageTier: '6% Salary Contribution',
    monthlyDeductionUSD: 450,
    effectiveStartDate: 'Immediate',
    timestampAgo: '2 hours ago',
  },
  {
    id: 'enr-3',
    employeeName: 'David Chen',
    planEnrolled: 'Global Dental Premier & Orthodontia',
    coverageTier: 'Individual Standard',
    monthlyDeductionUSD: 20,
    effectiveStartDate: 'Nov 1, 2026',
    timestampAgo: '5 hours ago',
  },
];

export default function BenefitsEnrollmentTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" /> Open Enrollment Telemetry Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Real-time employee plan elections, carrier EDI sync logs, and payroll deduction triggers.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-cyan-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> HIPAA Carrier EDI 834 Sync
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_ENROLLMENTS.map((evt) => (
          <div
            key={evt.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-cyan-500/10 text-cyan-400 text-[11px] font-mono px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                  {evt.coverageTier}
                </span>
                <span className="text-slate-500 text-xs font-mono">{evt.timestampAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{evt.employeeName}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Plan: <span className="text-slate-200 font-semibold">{evt.planEnrolled}</span> • Starts: <span className="text-cyan-300 font-bold">{evt.effectiveStartDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-base bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${evt.monthlyDeductionUSD}/mo Deduction
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> EDI Transmitted
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active & Pending Enrollment Cards Section */}
      <div className="mt-12 border-t border-slate-800/80 pt-8">
        <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-cyan-400" /> Active & Pending Enrollment Records
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="benefits-enrollment-grid">
          {ENROLLMENT_CARDS_DATA.map((card, idx) => (
            <BenefitsEnrollmentCard key={idx} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}
