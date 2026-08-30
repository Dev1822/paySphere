import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeAlert,
  Beaker,
  Bed,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  Droplet,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Flame,
  Gauge,
  Heart,
  HeartPulse,
  Hospital,
  Layers,
  Maximize2,
  Navigation,
  Pause,
  Pill,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Timer,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';

interface CommandCenterPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: 'Male' | 'Female';
  heightCm: number;
  actualWeightKg: number;
  unit: string;
  bedNumber: string;
  primaryDiagnosis: string;
  admissionHours: number;
  acuityLevel: 'CRITICAL_DETERIORATION' | 'IMMINENT_ICU_ESCALATION' | 'UNSTABLE_PROGRESSION' | 'MODERATE_ACUITY' | 'CLINICALLY_STABLE' | 'STEP_DOWN_READY';
  earlyDeteriorationIndex: number;
  ediTrend24h: number[];
  icuEscalationRisk12hPct: number;
  icuEscalationRisk24hPct: number;
  news2Score: number;
  news2Delta4h: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  meanArterialPressure: number;
  respRate: number;
  spO2: number;
  fio2: number;
  tempC: number;
  gcsScore: number;
  serumLactate: number;
  wbcCount: number;
  serumCreatinine: number;
  baselineCreatinine: number;
  urineOutputMlPerHour: number;
  shockIndex: number;
  modifiedShockIndex: number;
  activeVasopressor: string;
  rrtStatus: string;
  topRiskDrivers: Array<{ factor: string; weightPct: number }>;
}

const INITIAL_COMMAND_PATIENTS: CommandCenterPatient[] = [
  {
    id: 'PRED-101',
    mrn: 'CMD-904128',
    name: 'Arthur Pendelton',
    ageYears: 71,
    sex: 'Male',
    heightCm: 175,
    actualWeightKg: 84.0,
    unit: 'Progressive Care (PCU)',
    bedNumber: 'PCU-14',
    primaryDiagnosis: 'Severe Sepsis secondary to Obstructive Pyelonephritis & Septic Shock',
    admissionHours: 36,
    acuityLevel: 'CRITICAL_DETERIORATION',
    earlyDeteriorationIndex: 28.4,
    ediTrend24h: [58.2, 54.0, 48.6, 42.1, 35.8, 28.4],
    icuEscalationRisk12hPct: 88.5,
    icuEscalationRisk24hPct: 94.2,
    news2Score: 10,
    news2Delta4h: 4,
    heartRate: 124,
    systolicBp: 86,
    diastolicBp: 48,
    meanArterialPressure: 60.7,
    respRate: 30,
    spO2: 91,
    fio2: 0.50,
    tempC: 38.9,
    gcsScore: 13,
    serumLactate: 3.8,
    wbcCount: 19.4,
    serumCreatinine: 2.3,
    baselineCreatinine: 1.0,
    urineOutputMlPerHour: 18,
    shockIndex: 1.44,
    modifiedShockIndex: 2.04,
    activeVasopressor: 'Norepinephrine 0.08 mcg/kg/min titrating',
    rrtStatus: 'RRT DISPATCHED - BED EN ROUTE (ETA 2 min)',
    topRiskDrivers: [
      { factor: 'Accelerating Tachypnea & Hypoxemic Gap', weightPct: 34 },
      { factor: 'Severe Shock Index & Vasopressor Requirement', weightPct: 28 },
      { factor: 'Lactate Hyperprogression (> 3.5 mmol/L)', weightPct: 22 },
      { factor: 'Acute Oliguria & Creatinine Doubling (KDIGO 2)', weightPct: 16 },
    ],
  },
  {
    id: 'PRED-102',
    mrn: 'CMD-771920',
    name: 'Helena Kowalski',
    ageYears: 64,
    sex: 'Female',
    heightCm: 162,
    actualWeightKg: 68.0,
    unit: 'Cardiac Telemetry (4 East)',
    bedNumber: 'TELE-09',
    primaryDiagnosis: 'Acute Decompensated Heart Failure (HFrEF EF 25%) & Pre-Renal AKI',
    admissionHours: 48,
    acuityLevel: 'IMMINENT_ICU_ESCALATION',
    earlyDeteriorationIndex: 41.2,
    ediTrend24h: [65.0, 61.5, 57.0, 50.2, 45.8, 41.2],
    icuEscalationRisk12hPct: 68.0,
    icuEscalationRisk24hPct: 76.5,
    news2Score: 7,
    news2Delta4h: 2,
    heartRate: 106,
    systolicBp: 92,
    diastolicBp: 58,
    meanArterialPressure: 69.3,
    respRate: 24,
    spO2: 93,
    fio2: 0.36,
    tempC: 36.8,
    gcsScore: 14,
    serumLactate: 2.1,
    wbcCount: 11.2,
    serumCreatinine: 1.9,
    baselineCreatinine: 1.1,
    urineOutputMlPerHour: 28,
    shockIndex: 1.15,
    modifiedShockIndex: 1.53,
    activeVasopressor: 'None (Milrinone Infusion planned)',
    rrtStatus: 'CLINICIAN CONSULT NOTIFIED - ACTIVE MONITORING',
    topRiskDrivers: [
      { factor: 'Cardiogenic Decompensation & Hypotension', weightPct: 38 },
      { factor: 'Worsening Cardiorenal Syndrome & Azotemia', weightPct: 30 },
      { factor: 'Elevated Shock Index (> 1.0)', weightPct: 20 },
      { factor: 'Oxygen Desaturation Trajectory', weightPct: 12 },
    ],
  },
  {
    id: 'PRED-103',
    mrn: 'CMD-382901',
    name: 'James Rodriguez',
    ageYears: 53,
    sex: 'Male',
    heightCm: 182,
    actualWeightKg: 91.0,
    unit: 'General Med-Surg (5 North)',
    bedNumber: 'MS-22',
    primaryDiagnosis: 'Post-Operative Small Bowel Resection s/p Exploratory Laparotomy',
    admissionHours: 24,
    acuityLevel: 'UNSTABLE_PROGRESSION',
    earlyDeteriorationIndex: 54.0,
    ediTrend24h: [72.0, 69.0, 64.5, 60.0, 56.5, 54.0],
    icuEscalationRisk12hPct: 38.5,
    icuEscalationRisk24hPct: 48.0,
    news2Score: 5,
    news2Delta4h: 1,
    heartRate: 98,
    systolicBp: 108,
    diastolicBp: 68,
    meanArterialPressure: 81.3,
    respRate: 20,
    spO2: 96,
    fio2: 0.28,
    tempC: 38.2,
    gcsScore: 15,
    serumLactate: 1.7,
    wbcCount: 14.8,
    serumCreatinine: 1.2,
    baselineCreatinine: 0.9,
    urineOutputMlPerHour: 42,
    shockIndex: 0.91,
    modifiedShockIndex: 1.21,
    activeVasopressor: 'None',
    rrtStatus: 'STABLE - PROTOCOL MONITORING',
    topRiskDrivers: [
      { factor: 'Post-Op Systemic Inflammatory Response', weightPct: 40 },
      { factor: 'Mild Tachycardia & Low-Grade Fever', weightPct: 32 },
      { factor: 'Mild Leukocytosis Trajectory', weightPct: 28 },
    ],
  },
  {
    id: 'PRED-104',
    mrn: 'CMD-592831',
    name: 'Clara Oswald',
    ageYears: 45,
    sex: 'Female',
    heightCm: 168,
    actualWeightKg: 62.0,
    unit: 'Medical ICU (MICU)',
    bedNumber: 'MICU-06',
    primaryDiagnosis: 'Resolving Diabetic Ketoacidosis (DKA) & Aspiration Pneumonitis',
    admissionHours: 60,
    acuityLevel: 'STEP_DOWN_READY',
    earlyDeteriorationIndex: 86.5,
    ediTrend24h: [32.0, 48.5, 62.0, 74.0, 81.2, 86.5],
    icuEscalationRisk12hPct: 4.2,
    icuEscalationRisk24hPct: 6.8,
    news2Score: 1,
    news2Delta4h: -2,
    heartRate: 74,
    systolicBp: 122,
    diastolicBp: 76,
    meanArterialPressure: 91.3,
    respRate: 15,
    spO2: 99,
    fio2: 0.21,
    tempC: 36.9,
    gcsScore: 15,
    serumLactate: 0.8,
    wbcCount: 8.4,
    serumCreatinine: 0.8,
    baselineCreatinine: 0.8,
    urineOutputMlPerHour: 65,
    shockIndex: 0.61,
    modifiedShockIndex: 0.81,
    activeVasopressor: 'None (Weaned off pressors 18h ago)',
    rrtStatus: 'READY FOR FLOOR TRANSFER',
    topRiskDrivers: [
      { factor: 'Anion Gap Closed & Electrolytes Normalized', weightPct: 50 },
      { factor: 'Hemodynamics Fully Stable on Room Air', weightPct: 50 },
    ],
  },
];

export default function HospitalCommandCenterPredictivePage() {
  const [patients, setPatients] = useState<CommandCenterPatient[]>(INITIAL_COMMAND_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PRED-101');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [acuityFilter, setAcuityFilter] = useState<string>('ALL');

  // Simulation controls
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);

  // Modals
  const [showFhirModal, setShowFhirModal] = useState<boolean>(false);
  const [showRrtModal, setShowRrtModal] = useState<boolean>(false);
  const [showStepDownModal, setShowStepDownModal] = useState<boolean>(false);

  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Real-time jitter simulator
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      setPatients((prev) =>
        prev.map((p) => {
          if (p.id !== selectedPatientId) return p;

          const hrJitter = (Math.random() - 0.5) * 2;
          const sbpJitter = (Math.random() - 0.5) * 3;
          const newHr = Math.min(160, Math.max(45, Math.round(p.heartRate + hrJitter)));
          const newSbp = Math.min(190, Math.max(65, Math.round(p.systolicBp + sbpJitter)));
          const newDbp = Math.min(110, Math.max(35, Math.round(p.diastolicBp + (Math.random() - 0.5) * 2)));
          const newMap = Math.round(((newSbp + 2 * newDbp) / 3.0) * 10) / 10;
          const newSi = Math.round((newHr / newSbp) * 100) / 100;
          const newMsi = Math.round((newHr / newMap) * 100) / 100;

          return {
            ...p,
            heartRate: newHr,
            systolicBp: newSbp,
            diastolicBp: newDbp,
            meanArterialPressure: newMap,
            shockIndex: newSi,
            modifiedShockIndex: newMsi,
            spO2: Math.min(100, Math.max(82, Math.round(p.spO2 + (Math.random() - 0.5) * 0.5))),
          };
        })
      );
    }, 2000 / simSpeed);

    return () => clearInterval(interval);
  }, [isLiveStreaming, simSpeed, selectedPatientId]);

  // Hospital-wide KPI aggregates
  const hospitalKpis = useMemo(() => {
    const totalBeds = 196;
    const occupiedBeds = 175;
    const occupancyRate = Math.round((occupiedBeds / totalBeds) * 1000) / 10;
    const criticalCount = patients.filter((p) => p.acuityLevel === 'CRITICAL_DETERIORATION').length;
    const imminentIcuCount = patients.filter((p) => p.icuEscalationRisk12hPct >= 65).length;
    const stepDownReadyCount = patients.filter((p) => p.acuityLevel === 'STEP_DOWN_READY').length;

    return {
      totalBeds,
      occupiedBeds,
      occupancyRate,
      criticalCount,
      imminentIcuCount,
      stepDownReadyCount,
    };
  }, [patients]);

  // Filtered patients list
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.unit.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.bedNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.primaryDiagnosis.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesAcuity =
        acuityFilter === 'ALL' ||
        p.acuityLevel === acuityFilter ||
        (acuityFilter === 'RRT_ACTIVE' && p.rrtStatus.includes('RRT'));

      return matchesSearch && matchesAcuity;
    });
  }, [patients, searchFilter, acuityFilter]);

  // CSV Export handler
  const handleExportCsv = useCallback(() => {
    const headers = [
      'PatientID',
      'MRN',
      'Name',
      'Unit',
      'Bed',
      'Diagnosis',
      'AcuityLevel',
      'EDI_Score',
      'NEWS2',
      'ICU_Risk_12h_Pct',
      'HeartRate',
      'SystolicBP',
      'DiastolicBP',
      'MAP',
      'ShockIndex',
      'SerumLactate',
      'RRT_Status',
    ];

    const rows = patients.map((p) => [
      p.id,
      p.mrn,
      `"${p.name}"`,
      `"${p.unit}"`,
      p.bedNumber,
      `"${p.primaryDiagnosis}"`,
      p.acuityLevel,
      p.earlyDeteriorationIndex,
      p.news2Score,
      p.icuEscalationRisk12hPct,
      p.heartRate,
      p.systolicBp,
      p.diastolicBp,
      p.meanArterialPressure,
      p.shockIndex,
      p.serumLactate,
      `"${p.rrtStatus}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hospital_command_center_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patients]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-6 space-y-6 font-sans">
      {/* ── COMMAND HEADER ─────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-4 lg:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-950/80 border border-violet-500/30 rounded-lg text-violet-400">
                <Hospital className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  Hospital Command Center & Predictive Deterioration Hub
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-950 border border-violet-500/40 text-violet-300 font-mono">
                    BIO-AI ENGINE
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Continuous Early Deterioration Index (EDI) • NEWS2 Dynamic Velocity • Shock Index Surveillance • Automated RRT Dispatch • Bed Capacity Logistics
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isLiveStreaming
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'text-emerald-400 animate-pulse' : ''}`} />
              {isLiveStreaming ? 'LIVE PREDICTION FEED' : 'PREDICTION PAUSED'}
            </button>

            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSimSpeed(speed)}
                  className={`px-2 py-0.5 rounded transition-all font-mono ${
                    simSpeed === speed ? 'bg-violet-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFhirModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60 rounded-lg text-xs font-semibold transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              HL7 FHIR R4
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              onClick={() => setPatients(INITIAL_COMMAND_PATIENTS)}
              title="Reset Dataset"
              className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg text-xs transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── HOSPITAL-WIDE CAPACITY & RISK KPI BAR ───────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Hospital Occupancy */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Total Occupancy</span>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {hospitalKpis.occupancyRate}%
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {hospitalKpis.occupiedBeds} / {hospitalKpis.totalBeds} Beds Filled
          </span>
        </div>

        {/* Critical Deterioration Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-semibold text-rose-400 block uppercase">Critical Inpatients</span>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1 flex items-center gap-1.5">
            {hospitalKpis.criticalCount}
            <AlertOctagon className="w-4 h-4 animate-pulse" />
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Immediate RRT / ICU Alert</span>
        </div>

        {/* Imminent ICU Transfer Probability */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-semibold text-orange-400 block uppercase">Imminent ICU Risk</span>
          <div className="text-xl font-bold font-mono text-orange-400 mt-1">
            {hospitalKpis.imminentIcuCount}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">12h ICU Risk &gt; 65%</span>
        </div>

        {/* Active RRT Dispatches */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-semibold text-cyan-400 block uppercase">Active RRT Teams</span>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
            1 En Route
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Avg Response: 3.2 min</span>
        </div>

        {/* Step-Down Ready */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-semibold text-teal-400 block uppercase">Step-Down Ready</span>
          <div className="text-xl font-bold font-mono text-teal-400 mt-1">
            {hospitalKpis.stepDownReadyCount}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">ICU De-escalation Candidates</span>
        </div>

        {/* Bio-AI Model Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] font-semibold text-violet-400 block uppercase">Bio-AI Model Status</span>
          <div className="text-xl font-bold font-mono text-violet-300 mt-1 flex items-center gap-1">
            99.8%
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">AUC-ROC 0.942 (Inpatient)</span>
        </div>
      </section>

      {/* ── PATIENT SELECTOR & ACUITY MATRIX ───────────────────────────────── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Inpatient Name, MRN, Bed, Unit, or Diagnosis..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-all"
            />
          </div>

          {/* Acuity Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'ALL', label: 'All Inpatients' },
              { id: 'CRITICAL_DETERIORATION', label: 'Critical Deterioration' },
              { id: 'IMMINENT_ICU_ESCALATION', label: 'High ICU Risk (> 65%)' },
              { id: 'UNSTABLE_PROGRESSION', label: 'NEWS2 >= 5' },
              { id: 'RRT_ACTIVE', label: 'RRT Dispatched' },
              { id: 'STEP_DOWN_READY', label: 'Step-Down Ready' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setAcuityFilter(filter.id)}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                  acuityFilter === filter.id
                    ? 'bg-violet-950 border border-violet-500/50 text-violet-300 shadow-sm'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPatients.map((p) => {
            const isSelected = p.id === selectedPatient.id;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className={`cursor-pointer rounded-xl p-3.5 border transition-all relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-800/90 border-violet-500 shadow-lg shadow-violet-950/40 ring-1 ring-violet-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{p.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{p.mrn}</span>
                    </div>
                    <p className="text-[11px] text-cyan-400 font-medium">
                      {p.unit} • {p.bedNumber}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      p.acuityLevel === 'CRITICAL_DETERIORATION'
                        ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300 animate-pulse'
                        : p.acuityLevel === 'IMMINENT_ICU_ESCALATION'
                        ? 'bg-orange-950/80 border border-orange-500/40 text-orange-300'
                        : p.acuityLevel === 'UNSTABLE_PROGRESSION'
                        ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
                        : 'bg-teal-950/80 border border-teal-500/40 text-teal-300'
                    }`}
                  >
                    {p.acuityLevel.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px]">EDI SCORE</span>
                    <span
                      className={`font-mono font-bold ${
                        p.earlyDeteriorationIndex < 35
                          ? 'text-rose-400'
                          : p.earlyDeteriorationIndex < 55
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {p.earlyDeteriorationIndex}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">NEWS2</span>
                    <span
                      className={`font-mono font-bold ${
                        p.news2Score >= 7
                          ? 'text-rose-400'
                          : p.news2Score >= 5
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {p.news2Score} ({p.news2Delta4h >= 0 ? `+${p.news2Delta4h}` : p.news2Delta4h})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">12h ICU RISK</span>
                    <span
                      className={`font-mono font-bold ${
                        p.icuEscalationRisk12hPct >= 65 ? 'text-rose-400' : 'text-slate-200'
                      }`}
                    >
                      {p.icuEscalationRisk12hPct}%
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono">
                    HR {p.heartRate} • BP {p.systolicBp}/{p.diastolicBp}
                  </span>
                  {p.rrtStatus.includes('RRT') && (
                    <span className="text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/30 text-[9px] font-bold flex items-center gap-1">
                      <Bell className="w-2.5 h-2.5 animate-bounce" /> RRT ACTIVE
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── SELECTED PATIENT DEEP PREDICTIVE COMMAND DECK ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-time Telemetry, Trajectory Graphs & Explainable AI */}
        <div className="xl:col-span-2 space-y-6">
          {/* Patient Overview Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{selectedPatient.name}</span>
                <span className="text-xs font-mono text-slate-400">({selectedPatient.sex}, {selectedPatient.ageYears}y)</span>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedPatient.unit} • Bed {selectedPatient.bedNumber} • Inpatient Day {Math.round(selectedPatient.admissionHours / 24)}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Primary Diagnosis: <span className="text-cyan-300">{selectedPatient.primaryDiagnosis}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-500 block text-[9px]">PRESSOR</span>
                <span className="font-bold text-rose-300">{selectedPatient.activeVasopressor}</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-500 block text-[9px]">NEWS2</span>
                <span className="font-bold text-amber-400">{selectedPatient.news2Score} Points</span>
              </div>
            </div>
          </div>

          {/* Core Telemetry & Hemodynamic Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {/* Heart Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Heart Rate</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  selectedPatient.heartRate > 110 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {selectedPatient.heartRate}
                <span className="text-xs text-slate-500 font-normal ml-1">BPM</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Ref 60-90</span>
            </div>

            {/* Blood Pressure */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Blood Pressure</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  selectedPatient.systolicBp < 90 ? 'text-rose-400 animate-pulse' : 'text-white'
                }`}
              >
                {selectedPatient.systolicBp}/{selectedPatient.diastolicBp}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                MAP {selectedPatient.meanArterialPressure} mmHg
              </span>
            </div>

            {/* Shock Index */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Shock Index (HR/SBP)</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  selectedPatient.shockIndex >= 0.9 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {selectedPatient.shockIndex}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Critical &ge; 0.9</span>
            </div>

            {/* Respiratory Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Resp Rate</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  selectedPatient.respRate >= 25 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {selectedPatient.respRate}
                <span className="text-xs text-slate-500 font-normal ml-1">/min</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Ref 12-20</span>
            </div>

            {/* SpO2 & FiO2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">SpO₂ / FiO₂</span>
              <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                {selectedPatient.spO2}%
                <span className="text-xs text-slate-500 font-normal ml-1">
                  ({Math.round(selectedPatient.fio2 * 100)}%)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Target &ge; 94%</span>
            </div>

            {/* Serum Lactate */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Serum Lactate</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  selectedPatient.serumLactate > 2.0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {selectedPatient.serumLactate}
                <span className="text-xs text-slate-500 font-normal ml-1">mmol/L</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Normal &lt; 2.0</span>
            </div>
          </div>

          {/* ── 24-HOUR EARLY DETERIORATION INDEX TRAJECTORY GRAPH ───────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  24-Hour Continuous Deterioration Trajectory (EDI Score)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-rose-400 font-mono text-[11px]">
                  &lt; 30 (Critical Zone)
                </span>
                <span className="text-amber-400 font-mono text-[11px]">
                  30-50 (Warning Zone)
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  &gt; 50 (Stable Zone)
                </span>
              </div>
            </div>

            {/* SVG Trajectory Chart */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative h-48 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 180" preserveAspectRatio="none">
                {/* Zone Fills */}
                <rect x="0" y="126" width="600" height="54" fill="#881337" fillOpacity="0.15" />
                <rect x="0" y="90" width="600" height="36" fill="#78350f" fillOpacity="0.15" />
                <rect x="0" y="0" width="600" height="90" fill="#064e3b" fillOpacity="0.15" />

                {/* Threshold Guides */}
                <line x1="0" y1="126" x2="600" y2="126" stroke="#f43f5e" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="600" y2="90" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />

                {/* EDI Trend Line */}
                {selectedPatient.ediTrend24h.length > 1 && (
                  <path
                    d={selectedPatient.ediTrend24h
                      .map((val, i) => {
                        const x = (i / (selectedPatient.ediTrend24h.length - 1)) * 600;
                        const y = 180 - (val / 100) * 180; // Inverted mapping
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(10, Math.min(170, y))}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="3"
                  />
                )}

                {/* Data Points */}
                {selectedPatient.ediTrend24h.map((val, i) => {
                  const x = (i / (selectedPatient.ediTrend24h.length - 1)) * 600;
                  const y = 180 - (val / 100) * 180;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={Math.max(10, Math.min(170, y))}
                      r="4"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>

              <div className="absolute top-2 left-3 text-[10px] font-mono text-violet-300 bg-slate-900/80 px-2 py-0.5 rounded border border-violet-500/20">
                Current EDI: {selectedPatient.earlyDeteriorationIndex} (Velocity: -5.4 pts/4h)
              </div>
              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                -24h Timeline to Present
              </div>
            </div>
          </div>

          {/* ── EXPLAINABLE AI (XAI) TOP RISK DRIVERS ─────────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Explainable AI (XAI) Physiological Risk Contribution
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">SHAP Feature Weights</span>
            </div>

            <div className="space-y-2.5">
              {selectedPatient.topRiskDrivers.map((driver, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">{driver.factor}</span>
                    <span className="font-mono font-bold text-violet-400">{driver.weightPct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-violet-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${driver.weightPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Rapid Response Team, Step-Down Hub & Escalations */}
        <div className="space-y-6">
          {/* Bio-AI Predictive Risk Radar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  12h / 24h ICU Escalation Forecast
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 border border-rose-500/30 text-rose-300">
                HIGH RISK
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
              <div>
                <span className="text-slate-400 block text-[10px]">12-HOUR ICU RISK</span>
                <span
                  className={`text-2xl font-bold font-mono ${
                    selectedPatient.icuEscalationRisk12hPct >= 65 ? 'text-rose-400' : 'text-slate-200'
                  }`}
                >
                  {selectedPatient.icuEscalationRisk12hPct}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">24-HOUR ICU RISK</span>
                <span
                  className={`text-2xl font-bold font-mono ${
                    selectedPatient.icuEscalationRisk24hPct >= 75 ? 'text-rose-400' : 'text-slate-200'
                  }`}
                >
                  {selectedPatient.icuEscalationRisk24hPct}%
                </span>
              </div>
            </div>
          </div>

          {/* Rapid Response Team (RRT) Dispatch Hub */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-500 animate-pulse" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Rapid Response Team (RRT) Station
                </h3>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Current Status:</span>
                <span className="font-bold text-rose-300">{selectedPatient.rrtStatus}</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800">
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  Trigger: SBP &lt; 90 with Shock Index {selectedPatient.shockIndex} &gt; 1.0.
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  Target: Resuscitation within 15 min; ICU bed reservation.
                </p>
              </div>

              <button
                onClick={() => setShowRrtModal(true)}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-all shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Dispatch Rapid Response Team Pager
              </button>
            </div>
          </div>

          {/* Step-Down & De-escalation Evaluator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bed className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Step-Down & Floor Readiness
                </h3>
              </div>
              <button
                onClick={() => setShowStepDownModal(true)}
                className="text-[11px] text-teal-400 hover:underline flex items-center gap-1 font-medium"
              >
                Evaluator <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Transfer Readiness Score:</span>
                <span
                  className={`font-mono font-bold ${
                    selectedPatient.acuityLevel === 'STEP_DOWN_READY' ? 'text-teal-400' : 'text-slate-400'
                  }`}
                >
                  {selectedPatient.acuityLevel === 'STEP_DOWN_READY' ? '88 / 100 (Ready)' : '24 / 100 (Unsafe)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {selectedPatient.acuityLevel === 'STEP_DOWN_READY'
                  ? 'Patient meets all de-escalation criteria. Ready for transfer.'
                  : 'Active vasopressor and high shock index preclude step-down.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: RRT DISPATCH CONSOLE ───────────────────────────────────── */}
      {showRrtModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-rose-500 animate-pulse" />
                <h3 className="text-base font-bold text-white">
                  Rapid Response Team (RRT) Immediate Dispatch Console
                </h3>
              </div>
              <button onClick={() => setShowRrtModal(false)} className="text-slate-400 hover:text-white text-xs p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg text-rose-200">
                <strong>Emergency Notification:</strong> Patient {selectedPatient.name} ({selectedPatient.mrn}) in {selectedPatient.unit} ({selectedPatient.bedNumber}).
              </div>

              <div className="space-y-1.5 bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <div className="font-bold text-white mb-1">Automated Clinical RRT Dispatch Team:</div>
                <p>• ICU Attending Physician & Critical Care Fellow</p>
                <p>• Senior Respiratory Care Practitioner (RCP)</p>
                <p>• Critical Care Rapid Response Nurse (RRN)</p>
                <p>• Clinical Pharmacist & Code Cart Team</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  alert('RRT Pagers Dispatched Hospital-Wide. ETA 90 seconds.');
                  setShowRrtModal(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs shadow-lg shadow-rose-950/40"
              >
                Confirm & Broadcast Emergency RRT Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: STEP-DOWN EVALUATOR ────────────────────────────────────── */}
      {showStepDownModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bed className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">
                  Step-Down & Inpatient De-escalation Protocol Checklist
                </h3>
              </div>
              <button onClick={() => setShowStepDownModal(false)} className="text-slate-400 hover:text-white text-xs p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="font-bold text-white">Clinical De-escalation Benchmarks:</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400">1.</span>
                  <span>Off all continuous inotrope/vasopressor infusions for &ge; 12 hours.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400">2.</span>
                  <span>Weaned to low-flow supplemental oxygen (FiO2 &le; 35% or room air).</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400">3.</span>
                  <span>Serum lactate &le; 1.8 mmol/L and resolving organ dysfunction.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400">4.</span>
                  <span>NEWS2 score &le; 3 for &ge; 8 consecutive hours.</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowStepDownModal(false)}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HL7 FHIR R4 BUNDLE VIEWER ──────────────────────────────── */}
      {showFhirModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-violet-400" />
                <h3 className="text-base font-bold text-white">
                  HL7 FHIR R4 RiskAssessment & Telemetry Bundle
                </h3>
              </div>
              <button onClick={() => setShowFhirModal(false)} className="text-slate-400 hover:text-white text-xs p-1">
                ✕
              </button>
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-cyan-300 max-h-96 overflow-y-auto">
              {JSON.stringify(
                {
                  resourceType: 'Bundle',
                  id: `bundle-commandcenter-predictive-${selectedPatient.id.toLowerCase()}`,
                  type: 'collection',
                  timestamp: new Date().toISOString(),
                  entry: [
                    {
                      resource: {
                        resourceType: 'Patient',
                        id: selectedPatient.id,
                        identifier: [{ value: selectedPatient.mrn }],
                        name: [{ text: selectedPatient.name }],
                      },
                    },
                    {
                      resource: {
                        resourceType: 'RiskAssessment',
                        id: 'risk-icu-12h',
                        subject: { reference: `Patient/${selectedPatient.id}` },
                        prediction: [
                          {
                            outcome: { text: '12-Hour ICU Escalation Risk' },
                            probabilityDecimal: selectedPatient.icuEscalationRisk12hPct / 100.0,
                          },
                        ],
                      },
                    },
                    {
                      resource: {
                        resourceType: 'Observation',
                        id: 'obs-news2',
                        code: { coding: [{ system: 'https://medtrack.org', code: 'NEWS2' }], text: 'NEWS2 Score' },
                        valueInteger: selectedPatient.news2Score,
                      },
                    },
                    {
                      resource: {
                        resourceType: 'Observation',
                        id: 'obs-shock-index',
                        code: { coding: [{ system: 'http://loinc.org', code: '76510-7' }], text: 'Shock Index' },
                        valueQuantity: { value: selectedPatient.shockIndex },
                      },
                    },
                  ],
                },
                null,
                2
              )}
            </pre>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify({ patient: selectedPatient, date: new Date().toISOString() }, null, 2)
                  );
                  alert('FHIR R4 Bundle copied!');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold"
              >
                Copy JSON
              </button>
              <button
                onClick={() => setShowFhirModal(false)}
                className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
