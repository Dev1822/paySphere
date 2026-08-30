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
  Gauge,
  Heart,
  HeartPulse,
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
  Zap,
} from 'lucide-react';

interface McsPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: 'Male' | 'Female';
  heightCm: number;
  actualWeightKg: number;
  bodySurfaceAreaM2: number;
  location: string;
  primaryDiagnosis: string;
  deviceType: 'IMPELLA_5_5' | 'IMPELLA_CP' | 'IMPELLA_RP' | 'HEARTMATE_3_LVAD';
  deviceLocation: string;
  implantDurationHours: number;
  scaiStage: 'STAGE_E_EXTREMIS' | 'STAGE_D_DETERIORATING' | 'STAGE_C_CLASSIC' | 'POST_IMPLANT_STABLE' | 'WEANING_TRIAL_CANDIDATE';
  pLevel: string;
  impellaFlowLitersMin: number;
  motorCurrentMilliamps: number;
  purgePressureMmHg: number;
  purgeFlowMlPerHour: number;
  opticalPlacementSignal: string;
  lvadSpeedRpm: number;
  lvadPowerWatts: number;
  lvadPulsatilityIndex: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  meanArterialPressure: number;
  cardiacOutputTotalLitersMin: number;
  cardiacIndexLitersMinM2: number;
  cardiacPowerOutputWatts: number;
  pulmonaryArterySystolicBp: number;
  pulmonaryArteryDiastolicBp: number;
  centralVenousPressure: number;
  pulmonaryArteryPulsatilityIndex: number;
  pulmonaryCapillaryWedgePressure: number;
  lvedpEstimatedMmHg: number;
  serumLactate: number;
  plasmaFreeHemoglobinMgDl: number;
  ldhUnitsPerLiter: number;
  antiXaUnitsPerMl: number;
  inotropesVasopressors: string;
  suctionAlarmActive: boolean;
  weaningTrialStatus: string;
}

interface WaveformPoint {
  time: number;
  aoPressure: number;
  lvPressure: number;
  motorCurrent: number;
}

const INITIAL_MCS_PATIENTS: McsPatient[] = [
  {
    id: 'MCS-401',
    mrn: 'MCS-891024',
    name: 'Julian Vance',
    ageYears: 58,
    sex: 'Male',
    heightCm: 178,
    actualWeightKg: 86.0,
    bodySurfaceAreaM2: 2.05,
    location: 'Cardiac Surgical ICU - Bed 01',
    primaryDiagnosis: 'Post-Cardiotomy Cardiogenic Shock s/p Emergent CABG & Mitral Repair',
    deviceType: 'IMPELLA_5_5',
    deviceLocation: 'Right Axillary Surgical Conduit',
    implantDurationHours: 72,
    scaiStage: 'STAGE_C_CLASSIC',
    pLevel: 'P7',
    impellaFlowLitersMin: 4.8,
    motorCurrentMilliamps: 710,
    purgePressureMmHg: 540,
    purgeFlowMlPerHour: 14.2,
    opticalPlacementSignal: 'CORRECT_LV_POSITION',
    lvadSpeedRpm: 0,
    lvadPowerWatts: 0,
    lvadPulsatilityIndex: 0,
    heartRate: 88,
    systolicBp: 104,
    diastolicBp: 68,
    meanArterialPressure: 80.0,
    cardiacOutputTotalLitersMin: 5.6,
    cardiacIndexLitersMinM2: 2.73,
    cardiacPowerOutputWatts: 0.99,
    pulmonaryArterySystolicBp: 34,
    pulmonaryArteryDiastolicBp: 18,
    centralVenousPressure: 12,
    pulmonaryArteryPulsatilityIndex: 1.33,
    pulmonaryCapillaryWedgePressure: 16,
    lvedpEstimatedMmHg: 14,
    serumLactate: 1.4,
    plasmaFreeHemoglobinMgDl: 18.2,
    ldhUnitsPerLiter: 290,
    antiXaUnitsPerMl: 0.35,
    inotropesVasopressors: 'Epinephrine 0.02 mcg/kg/min • Vasopressin 0.03 U/min',
    suctionAlarmActive: false,
    weaningTrialStatus: 'Active Hemodynamic Unloading - Stable',
  },
  {
    id: 'MCS-402',
    mrn: 'MCS-662910',
    name: 'Evelyn St. Claire',
    ageYears: 62,
    sex: 'Female',
    heightCm: 160,
    actualWeightKg: 64.0,
    bodySurfaceAreaM2: 1.68,
    location: 'CCU / Cath Lab Recovery - Bed 04',
    primaryDiagnosis: 'Anterior STEMI Cardiogenic Shock with Refractory Ventricular Tachycardia',
    deviceType: 'IMPELLA_CP',
    deviceLocation: 'Right Femoral Artery 14 Fr',
    implantDurationHours: 18,
    scaiStage: 'STAGE_D_DETERIORATING',
    pLevel: 'P8',
    impellaFlowLitersMin: 3.4,
    motorCurrentMilliamps: 890,
    purgePressureMmHg: 780,
    purgeFlowMlPerHour: 6.8,
    opticalPlacementSignal: 'AORTIC_MIGRATION_WARNING',
    lvadSpeedRpm: 0,
    lvadPowerWatts: 0,
    lvadPulsatilityIndex: 0,
    heartRate: 118,
    systolicBp: 84,
    diastolicBp: 54,
    meanArterialPressure: 64.0,
    cardiacOutputTotalLitersMin: 3.8,
    cardiacIndexLitersMinM2: 2.26,
    cardiacPowerOutputWatts: 0.54,
    pulmonaryArterySystolicBp: 44,
    pulmonaryArteryDiastolicBp: 26,
    centralVenousPressure: 20,
    pulmonaryArteryPulsatilityIndex: 0.90,
    pulmonaryCapillaryWedgePressure: 24,
    lvedpEstimatedMmHg: 22,
    serumLactate: 3.6,
    plasmaFreeHemoglobinMgDl: 62.0,
    ldhUnitsPerLiter: 640,
    antiXaUnitsPerMl: 0.22,
    inotropesVasopressors: 'Norepinephrine 0.12 mcg/kg/min • Milrinone 0.375 mcg/kg/min',
    suctionAlarmActive: true,
    weaningTrialStatus: 'Unstable - Suction & Repositioning Required',
  },
  {
    id: 'MCS-403',
    mrn: 'MCS-102948',
    name: 'Marcus Sterling',
    ageYears: 51,
    sex: 'Male',
    heightCm: 185,
    actualWeightKg: 95.0,
    bodySurfaceAreaM2: 2.18,
    location: 'Heart Failure ICU - Bed 07',
    primaryDiagnosis: 'Non-Ischemic Dilated Cardiomyopathy (Bridge to Heart Transplant)',
    deviceType: 'HEARTMATE_3_LVAD',
    deviceLocation: 'Left Ventricular Apex to Ascending Aorta',
    implantDurationHours: 360,
    scaiStage: 'POST_IMPLANT_STABLE',
    pLevel: 'N/A',
    impellaFlowLitersMin: 0,
    motorCurrentMilliamps: 0,
    purgePressureMmHg: 0,
    purgeFlowMlPerHour: 0,
    opticalPlacementSignal: 'N/A',
    lvadSpeedRpm: 5400,
    lvadPowerWatts: 4.8,
    lvadPulsatilityIndex: 3.8,
    heartRate: 76,
    systolicBp: 108,
    diastolicBp: 78,
    meanArterialPressure: 88.0,
    cardiacOutputTotalLitersMin: 5.4,
    cardiacIndexLitersMinM2: 2.48,
    cardiacPowerOutputWatts: 1.05,
    pulmonaryArterySystolicBp: 28,
    pulmonaryArteryDiastolicBp: 12,
    centralVenousPressure: 8,
    pulmonaryArteryPulsatilityIndex: 2.00,
    pulmonaryCapillaryWedgePressure: 12,
    lvedpEstimatedMmHg: 10,
    serumLactate: 0.9,
    plasmaFreeHemoglobinMgDl: 12.0,
    ldhUnitsPerLiter: 210,
    antiXaUnitsPerMl: 0.42,
    inotropesVasopressors: 'None (Oral Heart Failure Meds Optimizing)',
    suctionAlarmActive: false,
    weaningTrialStatus: 'Stable Long-Term MCS Support',
  },
  {
    id: 'MCS-404',
    mrn: 'MCS-551920',
    name: 'Robert Thorne',
    ageYears: 67,
    sex: 'Male',
    heightCm: 172,
    actualWeightKg: 78.0,
    bodySurfaceAreaM2: 1.92,
    location: 'Cardiac Surgical ICU - Bed 03',
    primaryDiagnosis: 'Ischemic Cardiomyopathy s/p High-Risk CABG & Impella 5.5 (Recovery Wean)',
    deviceType: 'IMPELLA_5_5',
    deviceLocation: 'Right Axillary Conduit',
    implantDurationHours: 120,
    scaiStage: 'WEANING_TRIAL_CANDIDATE',
    pLevel: 'P2',
    impellaFlowLitersMin: 1.8,
    motorCurrentMilliamps: 420,
    purgePressureMmHg: 480,
    purgeFlowMlPerHour: 16.5,
    opticalPlacementSignal: 'CORRECT_LV_POSITION',
    lvadSpeedRpm: 0,
    lvadPowerWatts: 0,
    lvadPulsatilityIndex: 0,
    heartRate: 72,
    systolicBp: 116,
    diastolicBp: 74,
    meanArterialPressure: 88.0,
    cardiacOutputTotalLitersMin: 5.2,
    cardiacIndexLitersMinM2: 2.71,
    cardiacPowerOutputWatts: 1.01,
    pulmonaryArterySystolicBp: 26,
    pulmonaryArteryDiastolicBp: 12,
    centralVenousPressure: 7,
    pulmonaryArteryPulsatilityIndex: 2.00,
    pulmonaryCapillaryWedgePressure: 11,
    lvedpEstimatedMmHg: 9,
    serumLactate: 0.8,
    plasmaFreeHemoglobinMgDl: 14.5,
    ldhUnitsPerLiter: 230,
    antiXaUnitsPerMl: 0.38,
    inotropesVasopressors: 'None',
    suctionAlarmActive: false,
    weaningTrialStatus: 'Weaning Protocol Stage 3 (P2 Trial Passed - Ready for Explant)',
  },
];

export default function MechanicalCirculatorySupportPage() {
  const [patients, setPatients] = useState<McsPatient[]>(INITIAL_MCS_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('MCS-401');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Simulation state
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);

  // Modals
  const [showFhirModal, setShowFhirModal] = useState<boolean>(false);
  const [showRvdModal, setShowRvdModal] = useState<boolean>(false);
  const [showRampModal, setShowRampModal] = useState<boolean>(false);
  const [showSuctionRescueModal, setShowSuctionRescueModal] = useState<boolean>(false);

  // Ramp test interactive controls
  const [rampSpeedRpm, setRampSpeedRpm] = useState<number>(5400);

  // Waveform buffer
  const [waveformHistory, setWaveformHistory] = useState<WaveformPoint[]>([]);

  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // CPO & PAPi calculations
  const isCpoShock = selectedPatient.cardiacPowerOutputWatts < 0.60;
  const isPapiRvFailure = selectedPatient.pulmonaryArteryPulsatilityIndex < 1.0;
  const isPfHbElevated = selectedPatient.plasmaFreeHemoglobinMgDl >= 40.0;

  // Real-time waveform synthesizer
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      setWaveformHistory((prev) => {
        const now = Date.now();
        const cycleDuration = (60 / selectedPatient.heartRate) * 1000;
        const phase = (now % cycleDuration) / cycleDuration;

        let ao = selectedPatient.diastolicBp;
        let lv = selectedPatient.lvedpEstimatedMmHg;
        let current = selectedPatient.motorCurrentMilliamps;

        if (phase < 0.35) {
          // Systolic ejection phase
          const sProgress = phase / 0.35;
          ao = selectedPatient.diastolicBp + (selectedPatient.systolicBp - selectedPatient.diastolicBp) * Math.sin(sProgress * Math.PI);
          lv = selectedPatient.systolicBp * 0.95 * Math.sin(sProgress * Math.PI) + selectedPatient.lvedpEstimatedMmHg;
          current = selectedPatient.motorCurrentMilliamps + 30 * Math.sin(sProgress * Math.PI);
        } else {
          // Diastolic filling / unloading phase
          const dProgress = (phase - 0.35) / 0.65;
          ao = selectedPatient.systolicBp - (selectedPatient.systolicBp - selectedPatient.diastolicBp) * Math.min(1, dProgress * 1.5);
          // LV pressure drops low during diastole due to microaxial pump unloading
          lv = selectedPatient.lvedpEstimatedMmHg + 4 * Math.sin(dProgress * Math.PI);
          current = selectedPatient.motorCurrentMilliamps - 15 * Math.sin(dProgress * Math.PI);
        }

        if (selectedPatient.suctionAlarmActive) {
          // Spiky erratic motor current during suction
          current += (Math.random() - 0.5) * 120;
        }

        const newPoint: WaveformPoint = {
          time: now,
          aoPressure: Math.round(ao * 10) / 10,
          lvPressure: Math.round(lv * 10) / 10,
          motorCurrent: Math.round(current),
        };

        const updated = [...prev, newPoint];
        if (updated.length > 60) updated.shift();
        return updated;
      });
    }, 100 / simSpeed);

    return () => clearInterval(interval);
  }, [isLiveStreaming, simSpeed, selectedPatient]);

  // Jitter simulator
  useEffect(() => {
    if (!isLiveStreaming) return;

    const jitterInterval = setInterval(() => {
      setPatients((prev) =>
        prev.map((p) => {
          if (p.id !== selectedPatientId) return p;

          const mapJitter = (Math.random() - 0.5) * 1.5;
          const newMap = Math.round((p.meanArterialPressure + mapJitter) * 10) / 10;
          const newCo = Math.round((p.cardiacOutputTotalLitersMin + (Math.random() - 0.5) * 0.1) * 10) / 10;
          const newCpo = Math.round(((newMap * newCo) / 451.0) * 100) / 100;
          const newCi = Math.round((newCo / p.bodySurfaceAreaM2) * 100) / 100;

          return {
            ...p,
            meanArterialPressure: newMap,
            cardiacOutputTotalLitersMin: newCo,
            cardiacPowerOutputWatts: newCpo,
            cardiacIndexLitersMinM2: newCi,
            motorCurrentMilliamps: Math.round(p.motorCurrentMilliamps + (Math.random() - 0.5) * 6),
            purgePressureMmHg: Math.round(p.purgePressureMmHg + (Math.random() - 0.5) * 4),
          };
        })
      );
    }, 2000 / simSpeed);

    return () => clearInterval(jitterInterval);
  }, [isLiveStreaming, simSpeed, selectedPatientId]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.deviceType.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.location.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.primaryDiagnosis.toLowerCase().includes(searchFilter.toLowerCase());

      const matchesStage =
        stageFilter === 'ALL' ||
        p.scaiStage === stageFilter ||
        (stageFilter === 'SUCTION' && p.suctionAlarmActive);

      return matchesSearch && matchesStage;
    });
  }, [patients, searchFilter, stageFilter]);

  // CSV Export handler
  const handleExportCsv = useCallback(() => {
    const headers = [
      'PatientID',
      'MRN',
      'Name',
      'DeviceType',
      'SCAI_Stage',
      'P_Level_or_Speed',
      'PumpFlow_L_min',
      'MotorCurrent_mA',
      'PurgePressure_mmHg',
      'MAP_mmHg',
      'TotalCO_L_min',
      'CardiacIndex',
      'CPO_Watts',
      'PAPi_RV_Index',
      'Lactate_mmol_L',
      'PlasmaFreeHb_mg_dL',
      'SuctionAlarm',
    ];

    const rows = patients.map((p) => [
      p.id,
      p.mrn,
      `"${p.name}"`,
      p.deviceType,
      p.scaiStage,
      p.deviceType.includes('LVAD') ? `${p.lvadSpeedRpm} RPM` : p.pLevel,
      p.deviceType.includes('LVAD') ? p.cardiacOutputTotalLitersMin : p.impellaFlowLitersMin,
      p.motorCurrentMilliamps,
      p.purgePressureMmHg,
      p.meanArterialPressure,
      p.cardiacOutputTotalLitersMin,
      p.cardiacIndexLitersMinM2,
      p.cardiacPowerOutputWatts,
      p.pulmonaryArteryPulsatilityIndex,
      p.serumLactate,
      p.plasmaFreeHemoglobinMgDl,
      p.suctionAlarmActive ? 'ACTIVE' : 'NONE',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mechanical_circulatory_support_${Date.now()}.csv`);
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
                <HeartPulse className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  Mechanical Circulatory Support & Impella/LVAD Hemodynamics
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                    COMMAND STATION
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Microaxial Flow & Motor Current Surveillance • Cardiac Power Output (CPO &ge; 0.6W) • PAPi RV Failure Index • Suction & Purge Management • SCAI Shock Staging
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
              {isLiveStreaming ? 'PUMP TELEMETRY LIVE' : 'TELEMETRY PAUSED'}
            </button>

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
              onClick={() => setPatients(INITIAL_MCS_PATIENTS)}
              title="Reset Dataset"
              className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-lg text-xs transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── PATIENT SELECTOR ──────────────────────────────────────────────── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Patient Name, MRN, Device, Bed, or Diagnosis..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'ALL', label: 'All MCS Inpatients' },
              { id: 'STAGE_D_DETERIORATING', label: 'SCAI Stage D/E Shock' },
              { id: 'SUCTION', label: 'Suction Alarms' },
              { id: 'WEANING_TRIAL_CANDIDATE', label: 'Weaning Candidates' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStageFilter(filter.id)}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                  stageFilter === filter.id
                    ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-950/60 border border-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPatients.map((p) => {
            const isSelected = p.id === selectedPatient.id;

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
                      p.scaiStage.includes('EXTREMIS') || p.scaiStage.includes('DETERIORATING')
                        ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300 animate-pulse'
                        : p.scaiStage.includes('CLASSIC')
                        ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
                        : 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {p.scaiStage.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px]">PUMP FLOW</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {p.deviceType.includes('LVAD') ? p.cardiacOutputTotalLitersMin : p.impellaFlowLitersMin} L/min
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">CPO (WATTS)</span>
                    <span
                      className={`font-mono font-bold ${
                        p.cardiacPowerOutputWatts < 0.60 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {p.cardiacPowerOutputWatts} W
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">PAPi (RV)</span>
                    <span
                      className={`font-mono font-bold ${
                        p.pulmonaryArteryPulsatilityIndex < 1.0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {p.pulmonaryArteryPulsatilityIndex}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono flex items-center gap-1">
                    <Activity className="w-3 h-3 text-cyan-400" />
                    {p.deviceType.replace('_', ' ')} • {p.pLevel !== 'N/A' ? p.pLevel : `${p.lvadSpeedRpm} RPM`}
                  </span>
                  {p.suctionAlarmActive && (
                    <span className="text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/30 text-[9px] font-bold animate-pulse">
                      SUCTION
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── SELECTED PATIENT DEEP TELEMETRY & HEMODYNAMIC COMMAND DECK ─────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-time MCS Telemetry, Waveforms & Hemodynamics */}
        <div className="xl:col-span-2 space-y-6">
          {/* Patient Overview Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{selectedPatient.name}</span>
                <span className="text-xs font-mono text-slate-400">({selectedPatient.sex}, {selectedPatient.ageYears}y)</span>
                <span className="text-xs text-slate-400 font-mono">
                  BSA: {selectedPatient.bodySurfaceAreaM2} m² • Device: <strong>{selectedPatient.deviceType}</strong> ({selectedPatient.deviceLocation})
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Indication: <span className="text-cyan-300">{selectedPatient.primaryDiagnosis}</span> (Implant Day {Math.round(selectedPatient.implantDurationHours / 24)})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-500 block text-[9px]">SCAI STAGE</span>
                <span className="font-bold text-rose-300">{selectedPatient.scaiStage}</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <span className="text-slate-500 block text-[9px]">P-LEVEL / SPEED</span>
                <span className="font-bold text-cyan-300">
                  {selectedPatient.pLevel !== 'N/A' ? selectedPatient.pLevel : `${selectedPatient.lvadSpeedRpm} RPM`}
                </span>
              </div>
            </div>
          </div>

          {/* Microaxial & Centrifugal Pump Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {/* Impella Flow */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Pump Flow</span>
              <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                {selectedPatient.deviceType.includes('LVAD') ? selectedPatient.cardiacOutputTotalLitersMin : selectedPatient.impellaFlowLitersMin}
                <span className="text-xs text-slate-500 font-normal ml-1">L/min</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Continuous Support</span>
            </div>

            {/* Motor Current */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Motor Current</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  selectedPatient.motorCurrentMilliamps > 850 ? 'text-rose-400 animate-pulse' : 'text-white'
                }`}
              >
                {selectedPatient.motorCurrentMilliamps}
                <span className="text-xs text-slate-500 font-normal ml-1">mA</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Ref 600-800 mA</span>
            </div>

            {/* Purge Pressure */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Purge Pressure</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {selectedPatient.purgePressureMmHg}
                <span className="text-xs text-slate-500 font-normal ml-1">mmHg</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Flow: {selectedPatient.purgeFlowMlPerHour} mL/h
              </span>
            </div>

            {/* Cardiac Power Output (CPO) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Cardiac Power (CPO)</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  isCpoShock ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                }`}
              >
                {selectedPatient.cardiacPowerOutputWatts}
                <span className="text-xs text-slate-500 font-normal ml-1">W</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Target &ge; 0.60 W</span>
            </div>

            {/* PAPi (RV Pulsatility) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">PAPi (RV Function)</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  isPapiRvFailure ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                }`}
              >
                {selectedPatient.pulmonaryArteryPulsatilityIndex}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Critical &lt; 1.0</span>
            </div>

            {/* Cardiac Index (CI) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Cardiac Index</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {selectedPatient.cardiacIndexLitersMinM2}
                <span className="text-xs text-slate-500 font-normal ml-1">L/min/m²</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Ref &ge; 2.2</span>
            </div>
          </div>

          {/* ── REAL-TIME UNLOADING OSCILLOSCOPE MONITOR ──────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Real-Time LV Unloading & Hemodynamic Oscilloscope
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-cyan-400 font-mono">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> Aortic Pressure (Pao)
                </span>
                <span className="flex items-center gap-1 text-rose-400 font-mono">
                  <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> LV Pressure (Plv Unloaded)
                </span>
                <span className="flex items-center gap-1 text-amber-400 font-mono">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Motor Current (mA)
                </span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative h-48 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 180" preserveAspectRatio="none">
                <line x1="0" y1="45" x2="600" y2="45" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="600" y2="90" stroke="#334155" strokeWidth="1" />
                <line x1="0" y1="135" x2="600" y2="135" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />

                {/* Aortic Pressure Waveform */}
                {waveformHistory.length > 1 && (
                  <path
                    d={waveformHistory
                      .map((pt, i) => {
                        const x = (i / (waveformHistory.length - 1)) * 600;
                        const y = 180 - (pt.aoPressure / 150) * 160;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(10, Math.min(170, y))}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                  />
                )}

                {/* LV Pressure Waveform (Unloaded) */}
                {waveformHistory.length > 1 && (
                  <path
                    d={waveformHistory
                      .map((pt, i) => {
                        const x = (i / (waveformHistory.length - 1)) * 600;
                        const y = 180 - (pt.lvPressure / 150) * 160;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(10, Math.min(170, y))}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="3 1"
                  />
                )}
              </svg>

              <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-300 bg-slate-900/80 px-2 py-0.5 rounded border border-cyan-500/20">
                Optical Placement: {selectedPatient.opticalPlacementSignal} • MAP: {selectedPatient.meanArterialPressure} mmHg
              </div>
              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                LVEDP: {selectedPatient.lvedpEstimatedMmHg} mmHg • PCWP: {selectedPatient.pulmonaryCapillaryWedgePressure} mmHg
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Anticoagulation, Hemolysis, RV Failure & Weaning Checklist */}
        <div className="space-y-6">
          {/* Anticoagulation & Hemolysis Surveillance */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Hemolysis & Anticoagulation Watch
                </h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPfHbElevated
                    ? 'bg-rose-950 border border-rose-500/40 text-rose-300 animate-pulse'
                    : 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                }`}
              >
                {isPfHbElevated ? 'HEMOLYSIS ALERT' : 'NORMAL SERUM'}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Plasma Free Hb (pfHb):</span>
                <span className={`font-mono font-bold ${isPfHbElevated ? 'text-rose-400' : 'text-slate-200'}`}>
                  {selectedPatient.plasmaFreeHemoglobinMgDl} mg/dL (Ref &lt; 40)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Serum LDH:</span>
                <span className="font-mono font-bold text-slate-200">{selectedPatient.ldhUnitsPerLiter} U/L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Anti-Xa Heparin Activity:</span>
                <span
                  className={`font-mono font-bold ${
                    selectedPatient.antiXaUnitsPerMl < 0.30 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {selectedPatient.antiXaUnitsPerMl} IU/mL (Target 0.3-0.5)
                </span>
              </div>
            </div>
          </div>

          {/* Right Ventricular Failure (PAPi) Surveillance */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Right Ventricular Dysfunction Risk
                </h3>
              </div>
              <button
                onClick={() => setShowRvdModal(true)}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-medium"
              >
                Protocol <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">PAPi (PASP - PADP) / CVP:</span>
                <span
                  className={`font-mono font-bold ${
                    isPapiRvFailure ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {selectedPatient.pulmonaryArteryPulsatilityIndex}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CVP / RA Pressure:</span>
                <span className="font-mono font-bold text-slate-200">{selectedPatient.centralVenousPressure} mmHg</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                {isPapiRvFailure
                  ? '⚠ PAPi < 1.0: Severe RV compromise. Evaluate for Impella RP insertion or inodilator titration.'
                  : '✓ Right ventricular compliance and pulsatility are physiologically preserved.'}
              </p>
            </div>
          </div>

          {/* Weaning & Explant Protocol Station */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Impella Weaning & Recovery Hub
                </h3>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Weaning Status:</span>
                <span className="font-bold text-emerald-300">{selectedPatient.weaningTrialStatus}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Native CPO: {selectedPatient.cardiacPowerOutputWatts} W • Off Inotropes: {selectedPatient.inotropesVasopressors === 'None' ? 'YES' : 'NO'}
              </p>
              {selectedPatient.scaiStage === 'WEANING_TRIAL_CANDIDATE' && (
                <div className="p-2 bg-emerald-950/60 border border-emerald-500/30 rounded text-emerald-300 text-[11px]">
                  ✓ Patient passed 2-hour P2 trial with stable MAP &gt; 65 mmHg and CI &gt; 2.2. Explant scheduled.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: RV FAILURE PROTOCOL & IMPELLA RP ────────────────────────── */}
      {showRvdModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">
                  Right Ventricular Dysfunction & Impella RP Escalation
                </h3>
              </div>
              <button onClick={() => setShowRvdModal(false)} className="text-slate-400 hover:text-white text-xs p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="font-bold text-white">Acute RV Failure Escalation Pathway:</div>
                <p>1. <strong>Optimize RV Preload:</strong> Target CVP 10-14 mmHg; avoid excessive fluid loading.</p>
                <p>2. <strong>Reduce RV Afterload:</strong> Inhaled Epoprostenol or Milrinone / Dobutamine infusion.</p>
                <p>3. <strong>Mechanical RV Support:</strong> If PAPi &lt; 1.0 and CVP &gt; 15 mmHg persist, proceed with <strong>Impella RP Flex</strong> percutaneous cannulation.</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowRvdModal(false)}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-semibold"
              >
                Close Protocol
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
                  HL7 FHIR R4 DeviceObservation & MCS Bundle Export
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
                  id: `bundle-mcs-telemetry-${selectedPatient.id.toLowerCase()}`,
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
                        resourceType: 'Device',
                        id: `dev-mcs-${selectedPatient.id}`,
                        type: { text: selectedPatient.deviceType },
                        status: 'active',
                      },
                    },
                    {
                      resource: {
                        resourceType: 'Observation',
                        id: 'obs-cpo',
                        code: { coding: [{ system: 'https://medtrack.org', code: 'CPO-WATTS' }], text: 'Cardiac Power Output' },
                        valueQuantity: { value: selectedPatient.cardiacPowerOutputWatts, unit: 'W' },
                      },
                    },
                    {
                      resource: {
                        resourceType: 'Observation',
                        id: 'obs-papi',
                        code: { coding: [{ system: 'https://medtrack.org', code: 'PAPI' }], text: 'Pulmonary Artery Pulsatility Index' },
                        valueQuantity: { value: selectedPatient.pulmonaryArteryPulsatilityIndex },
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
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
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
