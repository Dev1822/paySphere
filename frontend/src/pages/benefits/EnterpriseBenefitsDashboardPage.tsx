import React, { useState } from 'react';
import { Heart, ShieldCheck, Download, Search, Sparkles, CheckCircle2, Clock, Globe, ArrowUpRight, DollarSign, Users, Activity, PlusCircle } from 'lucide-react';
import BenefitPlanCard, { BenefitPlan } from '../../components/benefits/BenefitPlanCard';
import BenefitsEnrollmentTimeline from '../../components/benefits/BenefitsEnrollmentTimeline';
import CompensationBandCard, { CompensationBandCardProps } from '../../components/benefits/CompensationBandCard';

const BENEFIT_PLANS: BenefitPlan[] = [
  {
    id: 'plan-301',
    planName: 'Platinum PPO Healthcare & Vision',
    providerName: 'BlueCross BlueShield Enterprise',
    planCategory: 'Medical & Health',
    monthlyEmployerContributionUSD: 650,
    monthlyEmployeeDeductionUSD: 120,
    coveredEmployees: 420,
    tierType: 'Comprehensive PPO',
    deductibleUSD: 250,
    copayUSD: 15,
    status: 'ACTIVE',
  },
  {
    id: 'plan-302',
    planName: 'Global Dental Premier & Orthodontia',
    providerName: 'Delta Dental PPO',
    planCategory: 'Dental Care',
    monthlyEmployerContributionUSD: 85,
    monthlyEmployeeDeductionUSD: 20,
    coveredEmployees: 395,
    tierType: 'In-Network Premier',
    deductibleUSD: 50,
    copayUSD: 10,
    status: 'ACTIVE',
  },
  {
    id: 'plan-303',
    planName: '401(k) Retirement & 6% Employer Match',
    providerName: 'Fidelity Investments Enterprise',
    planCategory: 'Retirement Savings',
    monthlyEmployerContributionUSD: 450,
    monthlyEmployeeDeductionUSD: 450,
    coveredEmployees: 480,
    tierType: 'Auto-Enrollment 401(k)',
    deductibleUSD: 0,
    copayUSD: 0,
    status: 'ACTIVE',
  },
];

const COMPENSATION_BANDS: CompensationBandCardProps[] = [
  {
    grade: 'executive',
    title: 'Executive Leadership Band',
    minSalary: 180000,
    midpoint: 220000,
    maxSalary: 260000,
    marketP25: 195000,
    marketP50: 215000,
    marketP75: 240000,
    bonusTarget: 35,
    benefitsValue: 25000,
    equityRange: { min: 50000, max: 120000, type: 'rsu' },
    headcount: 5,
    location: 'San Francisco, CA',
    lastUpdated: '2026-08-01',
  },
  {
    grade: 'director',
    title: 'Engineering Director Band',
    minSalary: 140000,
    midpoint: 165000,
    maxSalary: 190000,
    marketP25: 145000,
    marketP50: 168000,
    marketP75: 185000,
    bonusTarget: 25,
    benefitsValue: 18000,
    equityRange: { min: 30000, max: 75000, type: 'stock_option' },
    headcount: 12,
    location: 'Remote, US',
    lastUpdated: '2026-08-10',
  },
  {
    grade: 'manager',
    title: 'Engineering Manager Band',
    minSalary: 110000,
    midpoint: 130000,
    maxSalary: 150000,
    marketP25: 115000,
    marketP50: 128000,
    marketP75: 142000,
    bonusTarget: 15,
    benefitsValue: 12000,
    equityRange: { min: 15000, max: 40000, type: 'rsu' },
    headcount: 24,
    location: 'New York, NY',
    lastUpdated: '2026-08-15',
  },
];

export default function EnterpriseBenefitsDashboardPage() {
  const [plans, setPlans] = useState<BenefitPlan[]>(BENEFIT_PLANS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'plans' | 'enrollment-stream' | 'compensation-bands'>('plans');
  const [selectedPlanModal, setSelectedPlanModal] = useState<BenefitPlan | null>(null);

  const totalEmployerMonthlySubsidyUSD = plans.reduce((acc, p) => acc + (p.monthlyEmployerContributionUSD * p.coveredEmployees), 0);

  const filteredPlans = plans.filter(p =>
    p.planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.planCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 border border-cyan-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-cyan-500/20 text-cyan-300 text-xs px-3 py-1 rounded-full font-semibold border border-cyan-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Total Rewards
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> ERISA & HIPAA Compliant Administration
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent">
              Global Employee Benefits & Insurance Suite
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Unified administration of medical PPO/HMO, 401(k) matching, dental, vision, life insurance, and open enrollment automation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-cyan-600/30 transition flex items-center gap-2 border border-cyan-400/20 text-sm">
              <Download className="w-4 h-4" /> Export Benefits Summary
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total Monthly Employer Subsidy</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalEmployerMonthlySubsidyUSD / 1000).toFixed(1)}k USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 85% Employer Cost Coverage Rate
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Enrolled Workforce</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">480 Staff</div>
            <div className="text-cyan-400 text-xs mt-2 font-medium">
              98.5% Total Benefits Participation
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Provider Network</span>
              <Heart className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">3 Global Carriers</div>
            <div className="text-rose-400 text-xs mt-2 font-medium">
              BlueCross, Delta Dental & Fidelity
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('plans')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'plans'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Heart className="w-4 h-4" /> Active Benefit Plans
            </button>
            <button
              onClick={() => setActiveTab('enrollment-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'enrollment-stream'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Open Enrollment Stream
            </button>
            <button
              onClick={() => setActiveTab('compensation-bands')}
              id="compensation-bands-tab"
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'compensation-bands'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Compensation Bands
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search plan or carrier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>
        </div>

        {activeTab === 'enrollment-stream' && (
          <BenefitsEnrollmentTimeline />
        )}
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPlans.map((plan) => (
              <BenefitPlanCard
                key={plan.id}
                plan={plan}
                onInspect={() => setSelectedPlanModal(plan)}
              />
            ))}
          </div>
        )}
        {activeTab === 'compensation-bands' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="compensation-bands-grid">
            {COMPENSATION_BANDS.map((band) => (
              <CompensationBandCard
                key={band.grade}
                {...band}
                onExpand={(grade, expanded) => console.log(`Card ${grade} expanded: ${expanded}`)}
                onCompare={(grade) => console.log(`Comparing grade: ${grade}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedPlanModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedPlanModal.planName}</h3>
                <div className="text-xs text-slate-400 font-mono">{selectedPlanModal.providerName}</div>
              </div>
              <span className="bg-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded font-mono text-xs font-bold border border-cyan-500/30">
                {selectedPlanModal.planCategory}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Employer Monthly Subsidy</span>
                <span className="text-emerald-400 font-bold text-sm">${selectedPlanModal.monthlyEmployerContributionUSD} / mo</span>
              </div>
              <div>
                <span className="text-slate-500 block">Employee Payroll Deduction</span>
                <span className="text-cyan-400 font-bold text-sm">${selectedPlanModal.monthlyEmployeeDeductionUSD} / mo</span>
              </div>
              <div>
                <span className="text-slate-500 block">Annual Individual Deductible</span>
                <span className="text-amber-400 font-bold text-sm">${selectedPlanModal.deductibleUSD} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Active Enrolled Staff</span>
                <span className="text-white font-bold text-sm">{selectedPlanModal.coveredEmployees} Staff Members</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedPlanModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
