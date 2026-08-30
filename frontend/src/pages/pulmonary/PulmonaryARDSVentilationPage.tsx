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
  HeartPulse,
  Layers,
  Maximize2,
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

interface WaveformPoint {
  time: number;
  pressure: number;
  flow: number;
  volume: number;
}

interface ArdsPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: 'Male' | 'Female';
  heightCm: number;
  actualWeightKg: number;
  location: string;
  diagnosis: string;
  admissionDay: number;
  severity: 'SEVERE_ARDS' | 'MODERATE_ARDS' | 'MILD_ARDS' | 'AT_RISK_LUNG_INJURY' | 'WEANING_CANDIDATE';
  ventilatorMode: 'VC_CMV' | 'PC_CMV' | 'PRVC' | 'PSV_CPAP' | 'APRV';
  setVtMl: number;
  measuredVtMl: number;
  setRr: number;
  measuredRr: number;
  fio2: number;
  setPeep: number;
  measuredPeakPressure: number;
  plateauPressure: number;
  drivingPressure: number;
  staticCompliance: number;
  autoPeep: number;
  inspiratoryTimeSec: number;
  ieRatio: string;
  pao2: number;
  paco2: number;
  pao2Fio2Ratio: number;
  arterialPh: number;
  hco3: number;
  lactate: number;
  spO2: number;
  heartRate: number;
  meanArterialPressure: number;
  mechanicalPowerJoulesMin: number;
  ventilatoryRatio: number;
  asynchronyIndexPct: number;
  primaryAsynchrony: string;
  isProned: boolean;
  proneHoursElapsed: number;
  proneTargetHours: number;
  paralyzedNmb: boolean;
  inhaledVasodilator: string;
  ecmoEvaluationStatus: string;
}

const INITIAL_PATIENTS: ArdsPatient[] = [
  {
    id: 'ARDS-901',
    mrn: 'PULM-482910',
    name: 'Eleanor Vance',
    ageYears: 54,
    sex: 'Female',
    heightCm: 165,
    actualWeightKg: 82.5,
    location: 'Medical ICU - Bed 04 (Isolation)',
    diagnosis: 'Severe Primary Viral ARDS secondary to Influenza A H1N1 Pneumonia',
    admissionDay: 4,
    severity: 'SEVERE_ARDS',
    ventilatorMode: 'VC_CMV',
    setVtMl: 340,
    measuredVtMl: 338,
    setRr: 28,
    measuredRr: 28,
    fio2: 0.85,
    setPeep: 16,
    measuredPeakPressure: 38,
    plateauPressure: 31,
    drivingPressure: 15,
    staticCompliance: 22.5,
    autoPeep: 2.1,
    inspiratoryTimeSec: 0.8,
    ieRatio: '1:1.7',
    pao2: 68,
    paco2: 52,
    pao2Fio2Ratio: 80.0,
    arterialPh: 7.28,
    hco3: 24.1,
    lactate: 2.4,
    spO2: 89,
    heartRate: 112,
    meanArterialPressure: 74,
    mechanicalPowerJoulesMin: 29.4,
    ventilatoryRatio: 2.18,
    asynchronyIndexPct: 14.5,
    primaryAsynchrony: 'Double Triggering / Breath Stacking',
    isProned: true,
    proneHoursElapsed: 9.5,
    proneTargetHours: 16,
    paralyzedNmb: true,
    inhaledVasodilator: 'Inhaled Epoprostenol 30 ng/kg/min',
    ecmoEvaluationStatus: 'VV-ECMO Candidate on Standby (EOLIA Criteria Met)',
  },
  {
    id: 'ARDS-902',
    mrn: 'PULM-839201',
    name: 'Marcus Thorne',
    ageYears: 42,
    sex: 'Male',
    heightCm: 180,
    actualWeightKg: 94.0,
    location: 'Trauma ICU - Bed 08',
    diagnosis: 'Moderate Post-Traumatic ARDS & Pulmonary Contusions s/p High-Speed MVC',
    admissionDay: 2,
    severity: 'MODERATE_ARDS',
    ventilatorMode: 'PRVC',
    setVtMl: 450,
    measuredVtMl: 452,
    setRr: 22,
    measuredRr: 23,
    fio2: 0.55,
    setPeep: 12,
    measuredPeakPressure: 29,
    plateauPressure: 24,
    drivingPressure: 12,
    staticCompliance: 37.7,
    autoPeep: 0.8,
    inspiratoryTimeSec: 0.9,
    ieRatio: '1:1.9',
    pao2: 88,
    paco2: 44,
    pao2Fio2Ratio: 160.0,
    arterialPh: 7.36,
    hco3: 24.8,
    lactate: 1.6,
    spO2: 95,
    heartRate: 94,
    meanArterialPressure: 82,
    mechanicalPowerJoulesMin: 18.2,
    ventilatoryRatio: 1.42,
    asynchronyIndexPct: 4.2,
    primaryAsynchrony: 'Flow Starvation',
    isProned: false,
    proneHoursElapsed: 0,
    proneTargetHours: 16,
    paralyzedNmb: false,
    inhaledVasodilator: 'None',
    ecmoEvaluationStatus: 'Not Indicated - Responding to LTVV',
  },
  {
    id: 'ARDS-903',
    mrn: 'PULM-194830',
    name: 'David Chen',
    ageYears: 67,
    sex: 'Male',
    heightCm: 172,
    actualWeightKg: 78.0,
    location: 'Surgical ICU - Bed 02',
    diagnosis: 'Mild Secondary ARDS post Emergency Peritonitis & Septic Shock',
    admissionDay: 5,
    severity: 'MILD_ARDS',
    ventilatorMode: 'VC_CMV',
    setVtMl: 410,
    measuredVtMl: 408,
    setRr: 18,
    measuredRr: 18,
    fio2: 0.40,
    setPeep: 8,
    measuredPeakPressure: 24,
    plateauPressure: 19,
    drivingPressure: 11,
    staticCompliance: 37.1,
    autoPeep: 0.5,
    inspiratoryTimeSec: 1.0,
    ieRatio: '1:2.3',
    pao2: 96,
    paco2: 39,
    pao2Fio2Ratio: 240.0,
    arterialPh: 7.41,
    hco3: 24.5,
    lactate: 1.2,
    spO2: 97,
    heartRate: 80,
    meanArterialPressure: 78,
    mechanicalPowerJoulesMin: 12.8,
    ventilatoryRatio: 1.15,
    asynchronyIndexPct: 1.8,
    primaryAsynchrony: 'None',
    isProned: false,
    proneHoursElapsed: 0,
    proneTargetHours: 16,
    paralyzedNmb: false,
    inhaledVasodilator: 'None',
    ecmoEvaluationStatus: 'Not Indicated',
  },
  {
    id: 'ARDS-904',
    mrn: 'PULM-773829',
    name: 'Sarah Jenkins',
    ageYears: 36,
    sex: 'Female',
    heightCm: 170,
    actualWeightKg: 64.0,
    location: 'Medical ICU - Bed 11',
    diagnosis: 'Resolving Aspiration Pneumonitis - Spontaneous Breathing Trial (SBT)',
    admissionDay: 7,
    severity: 'WEANING_CANDIDATE',
    ventilatorMode: 'PSV_CPAP',
    setVtMl: 0,
    measuredVtMl: 480,
    setRr: 0,
    measuredRr: 16,
    fio2: 0.30,
    setPeep: 5,
    measuredPeakPressure: 13,
    plateauPressure: 11,
    drivingPressure: 6,
    staticCompliance: 58.0,
    autoPeep: 0.0,
    inspiratoryTimeSec: 0.85,
    ieRatio: '1:2.8',
    pao2: 98,
    paco2: 38,
    pao2Fio2Ratio: 326.7,
    arterialPh: 7.42,
    hco3: 24.2,
    lactate: 0.9,
    spO2: 99,
    heartRate: 72,
    meanArterialPressure: 86,
    mechanicalPowerJoulesMin: 6.4,
    ventilatoryRatio: 0.92,
    asynchronyIndexPct: 0.5,
    primaryAsynchrony: 'None',
    isProned: false,
    proneHoursElapsed: 0,
    proneTargetHours: 16,
    paralyzedNmb: false,
    inhaledVasodilator: 'None',
    ecmoEvaluationStatus: 'Not Indicated - Extubation Ready',
  },
];

export default function PulmonaryARDSVentilationPage() {
  const [patients, setPatients] = useState<ArdsPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('ARDS-901');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Simulation controls
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'mechanics' | 'waveforms' | 'prone' | 'weaning' | 'alerts'>('mechanics');

  // Modals
  const [showFhirModal, setShowFhirModal] = useState<boolean>(false);
  const [showSbtModal, setShowSbtModal] = useState<boolean>(false);
  const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
  const [selectedActionAlert, setSelectedActionAlert] = useState<string | null>(null);

  // SBT interactive inputs
  const [sbtDurationMinutes, setSbtDurationMinutes] = useState<number>(30);
  const [sbtSpontRr, setSbtSpontRr] = useState<number>(18);
  const [sbtSpontVtMl, setSbtSpontVtMl] = useState<number>(460);
  const [sbtCuffLeakPassed, setSbtCuffLeakPassed] = useState<boolean>(true);
  const [sbtSecretionsManageable, setSbtSecretionsManageable] = useState<boolean>(true);

  // Waveform buffer
  const [waveformHistory, setWaveformHistory] = useState<WaveformPoint[]>([]);

  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Predicted Body Weight (Devine Formula)
  const predictedBodyWeight = useMemo(() => {
    const isMale = selectedPatient.sex === 'Male';
    const baseWeight = isMale ? 50.0 : 45.5;
    const heightDiff = selectedPatient.heightCm - 152.4;
    return Math.round((baseWeight + 0.91 * heightDiff) * 10) / 10;
  }, [selectedPatient.heightCm, selectedPatient.sex]);

  // ARDSNet Tidal Volume Targets (4, 6, 8 mL/kg PBW)
  const ltvvTargets = useMemo(() => {
    return {
      target4: Math.round(predictedBodyWeight * 4),
      target6: Math.round(predictedBodyWeight * 6),
      target8: Math.round(predictedBodyWeight * 8),
      currentPerKg: Math.round((selectedPatient.measuredVtMl / predictedBodyWeight) * 10) / 10,
    };
  }, [predictedBodyWeight, selectedPatient.measuredVtMl]);

  // Driving Pressure target compliance
  const isDrivingPressureSafe = selectedPatient.drivingPressure < 14;
  const isPplatSafe = selectedPatient.plateauPressure <= 30;
  const isMechanicalPowerSafe = selectedPatient.mechanicalPowerJoulesMin < 17;

  // Real-time waveform synthesizer
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      setWaveformHistory((prev) => {
        const now = Date.now();
        const cycleDuration = (60 / selectedPatient.measuredRr) * 1000;
        const phase = (now % cycleDuration) / cycleDuration; // 0 to 1

        let pressure = selectedPatient.setPeep;
        let flow = 0;
        let volume = 0;

        const iRatioFrac = selectedPatient.inspiratoryTimeSec / (60 / selectedPatient.measuredRr);

        if (phase < iRatioFrac) {
          // Inspiratory phase
          const inspProgress = phase / iRatioFrac;
          // Ramp pressure up to peak, then plateau
          pressure =
            selectedPatient.setPeep +
            (selectedPatient.measuredPeakPressure - selectedPatient.setPeep) * Math.sin(inspProgress * Math.PI * 0.5);
          if (inspProgress > 0.7) {
            pressure = selectedPatient.plateauPressure;
          }
          // Decelerating flow
          flow = 60 * (1 - inspProgress * 0.8);
          // Increasing volume
          volume = selectedPatient.measuredVtMl * Math.sin(inspProgress * Math.PI * 0.5);
        } else {
          // Expiratory phase
          const expProgress = (phase - iRatioFrac) / (1 - iRatioFrac);
          pressure =
            selectedPatient.plateauPressure -
            (selectedPatient.plateauPressure - selectedPatient.setPeep) * Math.min(1, expProgress * 3);
          // Negative expiratory flow
          flow = -50 * Math.exp(-expProgress * 4) - selectedPatient.autoPeep * 2;
          volume = selectedPatient.measuredVtMl * Math.max(0, 1 - expProgress * 2.5);
        }

        const newPoint: WaveformPoint = {
          time: now,
          pressure: Math.round(pressure * 10) / 10,
          flow: Math.round(flow * 10) / 10,
          volume: Math.round(volume),
        };

        const updated = [...prev, newPoint];
        if (updated.length > 60) updated.shift();
        return updated;
      });
    }, 100 / simSpeed);

    return () => clearInterval(interval);
  }, [isLiveStreaming, simSpeed, selectedPatient]);

  // Live telemetry subtle fluctuation
  useEffect(() => {
    if (!isLiveStreaming) return;

    const jitterInterval = setInterval(() => {
      setPatients((prev) =>
        prev.map((p) => {
          if (p.id !== selectedPatientId) return p;

          const dpJitter = (Math.random() - 0.5) * 0.4;
          const newPplat = Math.round((p.plateauPressure + dpJitter) * 10) / 10;
          const newDp = Math.round((newPplat - p.setPeep) * 10) / 10;
          const newVt = Math.round(p.measuredVtMl + (Math.random() - 0.5) * 4);
          const newCstat = Math.round((newVt / Math.max(1, newDp)) * 10) / 10;

          // Gattinoni formula MP
          const mp =
            0.098 *
            p.measuredRr *
            (newVt / 1000.0) *
            (p.measuredPeakPressure - 0.5 * newDp);

          return {
            ...p,
            plateauPressure: newPplat,
            drivingPressure: newDp,
            measuredVtMl: newVt,
            staticCompliance: newCstat,
            mechanicalPowerJoulesMin: Math.round(mp * 10) / 10,
            spO2: Math.min(100, Math.max(82, Math.round(p.spO2 + (Math.random() - 0.5) * 0.6))),
            heartRate: Math.min(140, Math.max(60, Math.round(p.heartRate + (Math.random() - 0.5) * 1.5))),
          };
        })
      );
    }, 2000 / simSpeed);

    return () => clearInterval(jitterInterval);
  }, [isLiveStreaming, simSpeed, selectedPatientId]);

  // RSBI calculation for SBT
  const calculatedRsbi = useMemo(() => {
    const vtLiters = sbtSpontVtMl / 1000.0;
    if (vtLiters <= 0) return 0;
    return Math.round(sbtSpontRr / vtLiters);
  }, [sbtSpontRr, sbtSpontVtMl]);

  const isSbtFavorable = calculatedRsbi < 105 && sbtCuffLeakPassed && sbtSecretionsManageable;

  // Filtered patients
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        p.mrn.toLowerCase().includes(filterQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(filterQuery.toLowerCase()) ||
        p.diagnosis.toLowerCase().includes(filterQuery.toLowerCase());

      const matchesSeverity =
        severityFilter === 'ALL' ||
        p.severity === severityFilter ||
        (severityFilter === 'PRONED' && p.isProned);

      return matchesSearch && matchesSeverity;
    });
  }, [patients, filterQuery, severityFilter]);

  // CSV Export handler
  const handleExportCsv = useCallback(() => {
    const headers = [
      'PatientID',
      'MRN',
      'Name',
      'Diagnosis',
      'Severity',
      'Mode',
      'Vt_mL',
      'Vt_per_kg_PBW',
      'RR',
      'PEEP',
      'Pplat',
      'DrivingPressure',
      'StaticCompliance',
      'PaO2_FiO2',
      'MechanicalPower_J_min',
      'VentilatoryRatio',
      'Proned',
    ];

    const rows = patients.map((p) => {
      const isMale = p.sex === 'Male';
      const pbw = (isMale ? 50.0 : 45.5) + 0.91 * (p.heightCm - 152.4);
      const vtPerKg = Math.round((p.measuredVtMl / pbw) * 10) / 10;
      return [
        p.id,
        p.mrn,
        `"${p.name}"`,
        `"${p.diagnosis}"`,
        p.severity,
        p.ventilatorMode,
        p.measuredVtMl,
        vtPerKg,
        p.measuredRr,
        p.setPeep,
        p.plateauPressure,
        p.drivingPressure,
        p.staticCompliance,
        p.pao2Fio2Ratio,
        p.mechanicalPowerJoulesMin,
        p.ventilatoryRatio,
        p.isProned ? 'YES' : 'NO',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pulmonary_ards_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patients]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-6 space-y-6 font-sans">
      {/* ── COMMAND HEADER ─────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-4 lg:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-950/80 border border-cyan-500/30 rounded-lg text-cyan-400">
                <Wind className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  Pulmonary Critical Care & ARDS Mechanical Ventilation
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                    COMMAND STATION
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Berlin ARDS Staging • ARDSNet 4-8 mL/kg PBW Lung Protection • Driving Pressure (ΔP &lt; 14) • Gattinoni Mechanical Power • PROSEVA Prone Tracker
                </p>
              </div>
            </div>
          </div>

          {/* Operational Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Telemetry Streaming Toggle */}
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isLiveStreaming
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'text-emerald-400 animate-pulse' : ''}`} />
              {isLiveStreaming ? 'STREAMING ACTIVE' : 'STREAMING PAUSED'}
            </button>

            {/* Sim Speed Multiplier */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSimSpeed(speed)}
                  className={`px-2 py-0.5 rounded transition-all font-mono ${
                    simSpeed === speed ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* FHIR Export Button */}
            <button
              onClick={() => setShowFhirModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60 rounded-lg text-xs font-semibold transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              HL7 FHIR R4
            </button>

            {/* CSV Export */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            {/* Reset Simulation */}
            <button
              onClick={() => setPatients(INITIAL_PATIENTS)}
              title="Reset Patient Dataset"
              className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg text-xs transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── PATIENT SELECTOR CAROUSEL & SEARCH ─────────────────────────────── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Patient Name, MRN, Bed, or Clinical Diagnosis..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          {/* Acuity Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'ALL', label: 'All Patients' },
              { id: 'SEVERE_ARDS', label: 'Severe ARDS (P/F ≤ 100)' },
              { id: 'MODERATE_ARDS', label: 'Moderate ARDS' },
              { id: 'MILD_ARDS', label: 'Mild ARDS' },
              { id: 'PRONED', label: 'Active Prone' },
              { id: 'WEANING_CANDIDATE', label: 'Weaning / SBT' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSeverityFilter(filter.id)}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                  severityFilter === filter.id
                    ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 shadow-sm'
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
            const pbw = (p.sex === 'Male' ? 50.0 : 45.5) + 0.91 * (p.heightCm - 152.4);
            const vtPerKg = Math.round((p.measuredVtMl / pbw) * 10) / 10;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className={`cursor-pointer rounded-xl p-3.5 border transition-all relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-500 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{p.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{p.mrn}</span>
                    </div>
                    <p className="text-[11px] text-cyan-400 font-medium">{p.location}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      p.severity === 'SEVERE_ARDS'
                        ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300 animate-pulse'
                        : p.severity === 'MODERATE_ARDS'
                        ? 'bg-orange-950/80 border border-orange-500/40 text-orange-300'
                        : p.severity === 'MILD_ARDS'
                        ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
                        : 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {p.severity.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px]">P/F RATIO</span>
                    <span
                      className={`font-mono font-bold ${
                        p.pao2Fio2Ratio <= 100
                          ? 'text-rose-400'
                          : p.pao2Fio2Ratio <= 200
                          ? 'text-orange-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {p.pao2Fio2Ratio}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">ΔP (cmH₂O)</span>
                    <span
                      className={`font-mono font-bold ${
                        p.drivingPressure >= 14 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {p.drivingPressure}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Vt / PBW</span>
                    <span className="font-mono font-bold text-slate-200">
                      {vtPerKg} mL/kg
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 flex items-center gap-1 font-mono">
                    <Activity className="w-3 h-3 text-cyan-400" />
                    {p.ventilatorMode} • PEEP {p.setPeep}
                  </span>
                  {p.isProned && (
                    <span className="text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30 text-[9px] font-bold">
                      PRONE {p.proneHoursElapsed}h
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── ACTIVE PATIENT CLINICAL TELEMETRY COMMAND DECK ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-time Telemetry, Ventilator Waveforms & Mechanics */}
        <div className="xl:col-span-2 space-y-6">
          {/* Patient Overview Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{selectedPatient.name}</span>
                <span className="text-xs font-mono text-slate-400">({selectedPatient.sex}, {selectedPatient.ageYears}y)</span>
                <span className="text-xs text-slate-400 font-mono">Height: {selectedPatient.heightCm} cm • Actual: {selectedPatient.actualWeightKg} kg • <strong>PBW: {predictedBodyWeight} kg</strong></span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Diagnosis: <span className="text-cyan-300">{selectedPatient.diagnosis}</span> (ICU Day {selectedPatient.admissionDay})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-500 block text-[9px]">MODE</span>
                <span className="font-bold text-cyan-300">{selectedPatient.ventilatorMode}</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-500 block text-[9px]">FIO₂</span>
                <span className="font-bold text-white">{Math.round(selectedPatient.fio2 * 100)}%</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-500 block text-[9px]">PEEP</span>
                <span className="font-bold text-emerald-400">{selectedPatient.setPeep} cmH₂O</span>
              </div>
            </div>
          </div>

          {/* Primary Ventilator Telemetry Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {/* Peak Pressure */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Ppeak (Peak)</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {selectedPatient.measuredPeakPressure}
                <span className="text-xs text-slate-500 font-normal ml-1">cmH₂O</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Ceiling &lt; 35</span>
            </div>

            {/* Plateau Pressure */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Pplat (Plateau)</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  isPplatSafe ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
                }`}
              >
                {selectedPatient.plateauPressure}
                <span className="text-xs text-slate-500 font-normal ml-1">cmH₂O</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Target ≤ 30</span>
            </div>

            {/* Driving Pressure (ΔP) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative overflow-hidden">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">ΔP (Driving)</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  isDrivingPressureSafe ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {selectedPatient.drivingPressure}
                <span className="text-xs text-slate-500 font-normal ml-1">cmH₂O</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Target &lt; 14</span>
            </div>

            {/* Tidal Volume */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Vt (Measured)</span>
              <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                {selectedPatient.measuredVtMl}
                <span className="text-xs text-slate-500 font-normal ml-1">mL</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                {ltvvTargets.currentPerKg} mL/kg PBW
              </span>
            </div>

            {/* Respiratory Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">RR (Total/Set)</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {selectedPatient.measuredRr}
                <span className="text-xs text-slate-500 font-normal ml-1">/ {selectedPatient.setRr}</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">I:E {selectedPatient.ieRatio}</span>
            </div>

            {/* Static Compliance */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Cstat (Compliance)</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  selectedPatient.staticCompliance < 25
                    ? 'text-rose-400'
                    : selectedPatient.staticCompliance < 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {selectedPatient.staticCompliance}
                <span className="text-xs text-slate-500 font-normal ml-1">mL/cmH₂O</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Normal &gt; 50</span>
            </div>
          </div>

          {/* Secondary Clinical Biomarkers & Gas Exchange Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* PaO2 / FiO2 Ratio */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">PaO₂/FiO₂ Ratio</span>
                <Beaker className="w-4 h-4 text-cyan-400" />
              </div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  selectedPatient.pao2Fio2Ratio <= 100
                    ? 'text-rose-400'
                    : selectedPatient.pao2Fio2Ratio <= 200
                    ? 'text-orange-400'
                    : 'text-emerald-400'
                }`}
              >
                {selectedPatient.pao2Fio2Ratio}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                PaO₂: {selectedPatient.pao2} mmHg • SpO₂: {selectedPatient.spO2}%
              </p>
            </div>

            {/* Gattinoni Mechanical Power */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Mechanical Power</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  selectedPatient.mechanicalPowerJoulesMin >= 27
                    ? 'text-rose-400 animate-pulse'
                    : selectedPatient.mechanicalPowerJoulesMin >= 17
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {selectedPatient.mechanicalPowerJoulesMin}
                <span className="text-xs text-slate-500 font-normal ml-1">J/min</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                VILI Threshold &lt; 17 J/min
              </p>
            </div>

            {/* Ventilatory Ratio */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Ventilatory Ratio</span>
                <Waves className="w-4 h-4 text-indigo-400" />
              </div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  selectedPatient.ventilatoryRatio > 1.8 ? 'text-amber-400' : 'text-slate-100'
                }`}
              >
                {selectedPatient.ventilatoryRatio}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                PaCO₂: {selectedPatient.paco2} • pH: {selectedPatient.arterialPh}
              </p>
            </div>

            {/* Asynchrony Index */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Asynchrony Index</span>
                <AlertCircle className="w-4 h-4 text-violet-400" />
              </div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  selectedPatient.asynchronyIndexPct > 10 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {selectedPatient.asynchronyIndexPct}%
              </div>
              <p className="text-[10px] text-slate-400 mt-1 truncate" title={selectedPatient.primaryAsynchrony}>
                {selectedPatient.primaryAsynchrony}
              </p>
            </div>
          </div>

          {/* ── WAVEFORM OSCILLOSCOPE MONITOR ─────────────────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Real-Time Ventilator Waveforms
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-cyan-400 font-mono">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> Airway Pressure (Paw)
                </span>
                <span className="flex items-center gap-1 text-amber-400 font-mono">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Flow (L/min)
                </span>
                <span className="flex items-center gap-1 text-emerald-400 font-mono">
                  <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> Volume (mL)
                </span>
              </div>
            </div>

            {/* SVG Waveform Visualizer */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative h-48 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 180" preserveAspectRatio="none">
                {/* Background Grid Lines */}
                <line x1="0" y1="45" x2="600" y2="45" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="600" y2="90" stroke="#334155" strokeWidth="1" />
                <line x1="0" y1="135" x2="600" y2="135" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />

                {/* Pressure Curve (Paw) */}
                {waveformHistory.length > 1 && (
                  <path
                    d={waveformHistory
                      .map((pt, i) => {
                        const x = (i / (waveformHistory.length - 1)) * 600;
                        const y = 90 - (pt.pressure / 45) * 75; // Map 0-45 cmH2O to upper half
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(10, Math.min(170, y))}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                  />
                )}

                {/* Flow Curve */}
                {waveformHistory.length > 1 && (
                  <path
                    d={waveformHistory
                      .map((pt, i) => {
                        const x = (i / (waveformHistory.length - 1)) * 600;
                        const y = 135 - (pt.flow / 70) * 35; // Map Flow around baseline 135
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(90, Math.min(175, y))}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="2 1"
                  />
                )}
              </svg>

              {/* Dynamic Oscilloscope Legend Overlays */}
              <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-400 bg-slate-900/80 px-2 py-0.5 rounded border border-cyan-500/20">
                Ppeak: {selectedPatient.measuredPeakPressure} | Pplat: {selectedPatient.plateauPressure} | PEEP: {selectedPatient.setPeep}
              </div>
              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                Sweep Speed: 25 mm/s • {isLiveStreaming ? 'LIVE' : 'FREEZE'}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: ARDS Clinical Protocols, Prone Tracker & Action Center */}
        <div className="space-y-6">
          {/* ARDSNet Low Tidal Volume (LTVV) Compliance Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  ARDSNet Lung Protection Protocol
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-300">
                PBW: {predictedBodyWeight} kg
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Target 4 mL/kg PBW:</span>
                <span className="font-mono font-bold text-slate-200">{ltvvTargets.target4} mL</span>
              </div>
              <div className="flex justify-between items-center text-emerald-300 font-semibold bg-emerald-950/40 p-1.5 rounded border border-emerald-500/20">
                <span>Standard Initial 6 mL/kg:</span>
                <span className="font-mono font-bold">{ltvvTargets.target6} mL</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Ceiling 8 mL/kg PBW:</span>
                <span className="font-mono font-bold text-slate-200">{ltvvTargets.target8} mL</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Current Delivered:</span>
                <span
                  className={`font-mono font-bold ${
                    ltvvTargets.currentPerKg <= 6.5
                      ? 'text-emerald-400'
                      : ltvvTargets.currentPerKg <= 8.0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {selectedPatient.measuredVtMl} mL ({ltvvTargets.currentPerKg} mL/kg)
                </span>
              </div>
            </div>
          </div>

          {/* PROSEVA Prone Positioning Protocol Tracker */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  PROSEVA Prone Tracker (≥ 16h)
                </h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedPatient.isProned
                    ? 'bg-indigo-950 border border-indigo-500/40 text-indigo-300 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {selectedPatient.isProned ? 'IN PRONE POSITION' : 'SUPINE'}
              </span>
            </div>

            {selectedPatient.isProned ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Session Progress:</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {selectedPatient.proneHoursElapsed} / {selectedPatient.proneTargetHours} hours
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedPatient.proneHoursElapsed / selectedPatient.proneTargetHours) * 100
                      )}%`,
                    }}
                  />
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[11px] text-slate-300 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    Swimmer position turn scheduled q2h (next in 45m).
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    Neuromuscular blockade: {selectedPatient.paralyzedNmb ? 'Active Cisatracurium' : 'Off'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
                <p className="text-slate-300">
                  Prone eligibility: {selectedPatient.pao2Fio2Ratio < 150 ? 'INDICATED (P/F < 150)' : 'Not indicated currently'}.
                </p>
                {selectedPatient.pao2Fio2Ratio < 150 && (
                  <button
                    onClick={() => {
                      setPatients((prev) =>
                        prev.map((p) => (p.id === selectedPatient.id ? { ...p, isProned: true, proneHoursElapsed: 0.1 } : p))
                      );
                    }}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded text-xs transition-all"
                  >
                    Initiate 16-Hour Prone Turn Protocol
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Weaning & Spontaneous Breathing Trial (SBT) Engine */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  SBT & Extubation Readiness
                </h3>
              </div>
              <button
                onClick={() => setShowSbtModal(true)}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-medium"
              >
                Calculator <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">RSBI Benchmark (RR / Vt_L):</span>
                <span
                  className={`font-mono font-bold ${
                    selectedPatient.severity === 'WEANING_CANDIDATE' ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {selectedPatient.severity === 'WEANING_CANDIDATE' ? '33 (Passed < 105)' : 'N/A (Intubated VC)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Resolution Trajectory:</span>
                <span className="text-slate-300 font-medium">
                  {selectedPatient.severity === 'WEANING_CANDIDATE'
                    ? 'Candidate for Extubation'
                    : 'Acute ARDS Ongoing'}
                </span>
              </div>
              {selectedPatient.severity === 'WEANING_CANDIDATE' && (
                <div className="p-2 bg-emerald-950/60 border border-emerald-500/30 rounded text-emerald-300 text-[11px]">
                  ✓ Spontaneous Breathing Trial passed (30 min on PSV 5/5). Airway reflexes intact.
                </div>
              )}
            </div>
          </div>

          {/* Rescue Interventions & ECMO Evaluation */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Rescue & Extracorporeal Support
                </h3>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Inhaled Vasodilator:</span>
                <span className="font-medium text-slate-200">{selectedPatient.inhaledVasodilator}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">VV-ECMO Status:</span>
                <span className="font-semibold text-rose-300 text-right max-w-[180px] truncate">
                  {selectedPatient.ecmoEvaluationStatus}
                </span>
              </div>
              {selectedPatient.severity === 'SEVERE_ARDS' && (
                <button
                  onClick={() => setShowRescueModal(true)}
                  className="w-full py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-semibold rounded text-xs transition-all flex items-center justify-center gap-2"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  Code ARDS / ECMO Activation Checklist
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: SBT & WEANING CALCULATOR ───────────────────────────────── */}
      {showSbtModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Spontaneous Breathing Trial (SBT) & RSBI Inspector
                </h3>
              </div>
              <button
                onClick={() => setShowSbtModal(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Spontaneous RR (breaths/min)</label>
                  <input
                    type="number"
                    value={sbtSpontRr}
                    onChange={(e) => setSbtSpontRr(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Spontaneous Vt (mL)</label>
                  <input
                    type="number"
                    value={sbtSpontVtMl}
                    onChange={(e) => setSbtSpontVtMl(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* Live RSBI Output */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px]">CALCULATED RSBI (Yang & Tobin)</span>
                  <span
                    className={`text-xl font-bold font-mono ${
                      calculatedRsbi < 105 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {calculatedRsbi} breaths/min/L
                  </span>
                </div>
                <div className="text-right text-[11px]">
                  <span className="text-slate-400 block">Extubation Threshold</span>
                  <span className="text-slate-200 font-bold">&lt; 105</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sbtCuffLeakPassed}
                    onChange={(e) => setSbtCuffLeakPassed(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                  />
                  <span>Cuff Leak Test &gt; 110 mL or &gt; 15% (Laryngeal Edema Excluded)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sbtSecretionsManageable}
                    onChange={(e) => setSbtSecretionsManageable(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                  />
                  <span>Effective Cough Reflex &amp; Minimal Tracheobronchial Secretions</span>
                </label>
              </div>

              <div
                className={`p-3 rounded-lg border text-xs ${
                  isSbtFavorable
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                }`}
              >
                {isSbtFavorable
                  ? '✓ Patient satisfies all clinical weaning criteria. Favorable prognosis for planned extubation.'
                  : '⚠ Patient exhibits elevated RSBI or failure criteria. Continue mechanical ventilation.'}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowSbtModal(false)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
              >
                Close Inspector
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
                <Cpu className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  HL7 FHIR R4 DeviceObservation Bundle Export
                </h3>
              </div>
              <button
                onClick={() => setShowFhirModal(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-cyan-300 max-h-96 overflow-y-auto">
              {JSON.stringify(
                {
                  resourceType: 'Bundle',
                  id: `bundle-pulmonary-ards-${selectedPatient.id.toLowerCase()}`,
                  type: 'collection',
                  timestamp: new Date().toISOString(),
                  entry: [
                    {
                      resource: {
                        resourceType: 'Patient',
                        id: selectedPatient.id,
                        identifier: [{ value: selectedPatient.mrn }],
                        name: [{ text: selectedPatient.name }],
                        predictedBodyWeightKg: predictedBodyWeight,
                      },
                    },
                    {
                      resource: {
                        resourceType: 'Observation',
                        id: 'obs-pao2-fio2',
                        code: { coding: [{ system: 'http://loinc.org', code: '50983-6' }], text: 'PaO2/FiO2 Ratio' },
                        valueQuantity: { value: selectedPatient.pao2Fio2Ratio, unit: 'mmHg' },
                        interpretation: [{ text: selectedPatient.severity }],
                      },
                    },
                    {
                      resource: {
                        resourceType: 'Observation',
                        id: 'obs-driving-pressure',
                        code: { coding: [{ system: 'http://loinc.org', code: '76527-1' }], text: 'Driving Pressure' },
                        valueQuantity: { value: selectedPatient.drivingPressure, unit: 'cmH2O' },
                      },
                    },
                    {
                      resource: {
                        resourceType: 'Observation',
                        id: 'obs-mechanical-power',
                        code: { coding: [{ system: 'https://medtrack.org', code: 'VENT-MP' }], text: 'Gattinoni Mechanical Power' },
                        valueQuantity: { value: selectedPatient.mechanicalPowerJoulesMin, unit: 'J/min' },
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
                    JSON.stringify(
                      {
                        resourceType: 'Bundle',
                        patient: selectedPatient,
                        pbwKg: predictedBodyWeight,
                      },
                      null,
                      2
                    )
                  );
                  alert('FHIR R4 Bundle copied to clipboard!');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold"
              >
                Copy JSON
              </button>
              <button
                onClick={() => setShowFhirModal(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RESCUE ARDS / ECMO PROTOCOL CHECKLIST ──────────────────── */}
      {showRescueModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse" />
                <h3 className="text-base font-bold text-white">
                  Refractory Hypoxemic ARDS / ECMO Escalation Protocol
                </h3>
              </div>
              <button
                onClick={() => setShowRescueModal(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p className="text-rose-300 font-semibold">
                Patient {selectedPatient.name} ({selectedPatient.mrn}) exhibits severe ARDS with P/F = {selectedPatient.pao2Fio2Ratio} mmHg.
              </p>

              <div className="space-y-2 bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <div className="font-bold text-white mb-1">Evidence-Based Escalation Sequence (ESICM/ATS):</div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-cyan-400 font-bold">1.</span>
                  <span><strong>Ultra-Protective Ventilation:</strong> Lower Vt to 4 mL/kg PBW ({ltvvTargets.target4} mL) to reduce driving pressure &lt; 14 cmH₂O.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-cyan-400 font-bold">2.</span>
                  <span><strong>Neuromuscular Blockade:</strong> 48-hour continuous Cisatracurium infusion to abolish patient-ventilator dyssynchrony (ROSE/ACURASYS).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-cyan-400 font-bold">3.</span>
                  <span><strong>Prone Positioning:</strong> Execute PROSEVA 16-hour continuous prone turn immediately.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-cyan-400 font-bold">4.</span>
                  <span><strong>Inhaled Pulmonary Vasodilators:</strong> Inhaled Epoprostenol 20-50 ng/kg/min or Inhaled Nitric Oxide 20 ppm.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-rose-400 font-bold">5.</span>
                  <span><strong>VV-ECMO Cannulation Evaluation:</strong> Activate ECMO Retrieval Team if PaO₂/FiO₂ &lt; 80 for &gt; 6h or pH &lt; 7.15 (EOLIA criteria).</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  alert('ECMO Cannulation Team & Critical Care Fellow Notified.');
                  setShowRescueModal(false);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold shadow-lg shadow-rose-950/40"
              >
                Confirm Clinical Protocol Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
