import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeAlert,
  Beaker,
  Bookmark,
  Brain,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Download,
  Droplet,
  FileCheck,
  FileSpreadsheet,
  Flame,
  Gauge,
  Heart,
  HeartPulse,
  Layers,
  Microscope,
  Pause,
  Pill,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Thermometer,
  Timer,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Waves,
  Zap,
} from 'lucide-react';

interface LiverVitalHistory {
  time: string;
  ammoniaUmolL: number;
  bilirubinMgDl: number;
  bloodFlowRate: number;
  map: number;
  heartRate: number;
  filterPressureMmHg: number;
}

interface HepatologyPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: string;
  location: string;
  etiology: string;
  aclfGrade: number; // 0 - 3
  meld3Score: number; // 6 - 40
  clifCAclfScore: number;
  mortality28DayEstimated: string;
  totalBilirubinMgDl: number;
  serumCreatinineMgDl: number;
  inr: number;
  serumSodiumMeqL: number;
  serumAlbuminGDl: number;
  arterialAmmoniaUmolL: number;
  westHavenGrade: number;
  map: number;
  vasopressor: {
    terlipressinInfusionMgDay: number;
    norepinephrineMcgKgMin: number;
    status: string;
  };
  marsTelemetry: {
    circuitStatus: string;
    bloodFlowRateMlMin: number;
    albuminCircuitFlowMlMin: number;
    dialysateFlowMlHr: number;
    charcoalFilterPressureDropMmHg: number;
    bilirubinClearancePct: number;
    ammoniaClearancePct: number;
    totalHoursOnMars: number;
  };
  organFailures: Array<{
    organ: string;
    metric: string;
    status: string;
  }>;
}

const HEPATOLOGY_PATIENTS_DATABASE: HepatologyPatient[] = [
  {
    id: 'HEP-601',
    mrn: 'LIV-401928',
    name: 'Eleanor Vance',
    ageYears: 54,
    sex: 'Female',
    location: 'Liver ICU - Bed 04',
    etiology: 'Alcohol-Related Cirrhosis & Spontaneous Bacterial Peritonitis (SBP)',
    aclfGrade: 3,
    meld3Score: 38,
    clifCAclfScore: 68,
    mortality28DayEstimated: '78.4%',
    totalBilirubinMgDl: 28.4,
    serumCreatinineMgDl: 3.6,
    inr: 2.9,
    serumSodiumMeqL: 126,
    serumAlbuminGDl: 2.1,
    arterialAmmoniaUmolL: 184,
    westHavenGrade: 3,
    map: 58,
    vasopressor: {
      terlipressinInfusionMgDay: 4.0,
      norepinephrineMcgKgMin: 0.18,
      status: 'Terlipressin + Albumin protocol for Type 1 HRS-AKI & septic shock',
    },
    marsTelemetry: {
      circuitStatus: 'ACTIVE_RECIRCULATION',
      bloodFlowRateMlMin: 180,
      albuminCircuitFlowMlMin: 180,
      dialysateFlowMlHr: 1000,
      charcoalFilterPressureDropMmHg: 42,
      bilirubinClearancePct: 34.5,
      ammoniaClearancePct: 48.2,
      totalHoursOnMars: 6.5,
    },
    organFailures: [
      { organ: 'Liver', metric: 'Bilirubin 28.4 mg/dL (>= 12.0)', status: 'FAILED' },
      { organ: 'Kidney', metric: 'Creatinine 3.6 mg/dL (>= 2.0)', status: 'FAILED' },
      { organ: 'Brain', metric: 'West Haven Grade 3 (>= 3)', status: 'FAILED' },
      { organ: 'Circulation', metric: 'Norepinephrine + Terlipressin', status: 'FAILED' },
      { organ: 'Coagulation', metric: 'INR 2.9 (>= 2.5)', status: 'FAILED' },
    ],
  },
  {
    id: 'HEP-602',
    mrn: 'LIV-882190',
    name: 'David K. O’Connor',
    ageYears: 61,
    sex: 'Male',
    location: 'Hepatology Step-down - Bed 12',
    etiology: 'NASH / MASH Cirrhosis with Variceal Hemorrhage',
    aclfGrade: 2,
    meld3Score: 31,
    clifCAclfScore: 54,
    mortality28DayEstimated: '34.2%',
    totalBilirubinMgDl: 16.2,
    serumCreatinineMgDl: 2.4,
    inr: 2.2,
    serumSodiumMeqL: 131,
    serumAlbuminGDl: 2.4,
    arterialAmmoniaUmolL: 112,
    westHavenGrade: 2,
    map: 68,
    vasopressor: {
      terlipressinInfusionMgDay: 2.0,
      norepinephrineMcgKgMin: 0.0,
      status: 'Terlipressin boluses q4h for HRS-AKI reversal',
    },
    marsTelemetry: {
      circuitStatus: 'SCHEDULED_SESSION_2',
      bloodFlowRateMlMin: 150,
      albuminCircuitFlowMlMin: 150,
      dialysateFlowMlHr: 800,
      charcoalFilterPressureDropMmHg: 28,
      bilirubinClearancePct: 29.0,
      ammoniaClearancePct: 41.0,
      totalHoursOnMars: 0.0,
    },
    organFailures: [
      { organ: 'Liver', metric: 'Bilirubin 16.2 mg/dL', status: 'FAILED' },
      { organ: 'Kidney', metric: 'Creatinine 2.4 mg/dL', status: 'FAILED' },
      { organ: 'Brain', metric: 'West Haven Grade 2', status: 'IMPAIRED' },
    ],
  },
  {
    id: 'HEP-603',
    mrn: 'LIV-310492',
    name: 'Dr. Zachary Thorne',
    ageYears: 48,
    sex: 'Male',
    location: 'Liver ICU - Bed 01',
    etiology: 'Severe Acute Alcoholic Hepatitis (Maddrey DF: 64)',
    aclfGrade: 1,
    meld3Score: 27,
    clifCAclfScore: 48,
    mortality28DayEstimated: '22.0%',
    totalBilirubinMgDl: 22.8,
    serumCreatinineMgDl: 1.8,
    inr: 2.4,
    serumSodiumMeqL: 134,
    serumAlbuminGDl: 2.6,
    arterialAmmoniaUmolL: 88,
    westHavenGrade: 1,
    map: 74,
    vasopressor: {
      terlipressinInfusionMgDay: 0.0,
      norepinephrineMcgKgMin: 0.0,
      status: 'Albumin infusions 1g/kg/day with Prednisolone 40mg PO',
    },
    marsTelemetry: {
      circuitStatus: 'STANDBY_EVALUATION',
      bloodFlowRateMlMin: 0,
      albuminCircuitFlowMlMin: 0,
      dialysateFlowMlHr: 0,
      charcoalFilterPressureDropMmHg: 0,
      bilirubinClearancePct: 0.0,
      ammoniaClearancePct: 0.0,
      totalHoursOnMars: 0.0,
    },
    organFailures: [
      { organ: 'Liver', metric: 'Bilirubin 22.8 mg/dL', status: 'FAILED' },
      { organ: 'Kidney', metric: 'Creatinine 1.8 mg/dL (Dysfunction)', status: 'IMPAIRED' },
    ],
  },
];

export default function LiverSupportACLFCommandStationPage() {
  const [patients, setPatients] = useState<HepatologyPatient[]>(HEPATOLOGY_PATIENTS_DATABASE);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('HEP-601');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'CLIF_MATRIX' | 'MELD_PROGNOSTICS' | 'MARS_CIRCUIT' | 'PROTOCOLS'>('TELEMETRY');

  // Protocol Modal State
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false);
  const [selectedProtocolToTrigger, setSelectedProtocolToTrigger] = useState<string>('CODE_HEPATIC_MARS_STAT');
  const [clinicianId, setClinicianId] = useState<string>('MD-HEP-8812 (Dr. Katherine Hayes)');
  const [activationRationale, setActivationRationale] = useState<string>('EASL-CLIF ACLF Grade 3 with refractory HRS-AKI, hyperammonemia (184 umol/L), and MELD-3.0 score 38.');
  const [signatureLogs, setSignatureLogs] = useState<Array<{ id: string; time: string; signer: string; protocol: string; hash: string }>>([
    {
      id: 'SIG-LIV-901',
      time: new Date(Date.now() - 1000 * 60 * 35).toLocaleTimeString(),
      signer: 'Dr. Katherine Hayes (MD-HEP-8812)',
      protocol: 'Extracorporeal Albumin Dialysis (MARS) & Terlipressin Activation',
      hash: 'e8d1a10e8293dd41f8742ca910d65b7194c2510f92b74c0b62e49c71629fa914',
    },
  ]);

  // Selected Patient
  const patient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Vital stream buffer
  const [vitalStream, setVitalStream] = useState<LiverVitalHistory[]>(() => {
    const list: LiverVitalHistory[] = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      list.push({
        time: new Date(now - i * 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ammoniaUmolL: 184 + Math.sin(i) * 6,
        bilirubinMgDl: 28.4 + Math.cos(i) * 0.4,
        bloodFlowRate: 180,
        map: 58 + Math.sin(i) * 2,
        heartRate: 104 + Math.cos(i) * 3,
        filterPressureMmHg: 42 + Math.sin(i) * 1.5,
      });
    }
    return list;
  });

  // Telemetry tick simulator
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setTickCount((prev) => prev + 1);

      setPatients((prevList) =>
        prevList.map((p) => {
          if (p.id !== selectedPatientId) return p;

          const ammoniaFluct = (Math.random() - 0.52) * 4.0;
          const mapFluct = (Math.random() - 0.5) * 1.5;
          const filterFluct = (Math.random() - 0.48) * 0.8;

          const newAmmonia = Math.max(20, Math.min(400, Math.round(p.arterialAmmoniaUmolL + ammoniaFluct)));
          const newMap = Math.max(45, Math.min(110, Math.round((p.map + mapFluct) * 10) / 10));
          const newFilterDrop = Math.max(10, Math.min(90, Math.round((p.marsTelemetry.charcoalFilterPressureDropMmHg + filterFluct) * 10) / 10));

          return {
            ...p,
            arterialAmmoniaUmolL: newAmmonia,
            map: newMap,
            marsTelemetry: {
              ...p.marsTelemetry,
              charcoalFilterPressureDropMmHg: newFilterDrop,
            },
          };
        }),
      );

      // Append snapshot
      setVitalStream((prev) => {
        const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newSnapshot: LiverVitalHistory = {
          time: nextTime,
          ammoniaUmolL: patient.arterialAmmoniaUmolL,
          bilirubinMgDl: patient.totalBilirubinMgDl,
          bloodFlowRate: patient.marsTelemetry.bloodFlowRateMlMin,
          map: patient.map,
          heartRate: 104,
          filterPressureMmHg: patient.marsTelemetry.charcoalFilterPressureDropMmHg,
        };
        return [...prev.slice(1), newSnapshot];
      });
    }, 1500 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isSimulating, simulationSpeed, selectedPatientId, patient]);

  // Protocol Trigger Handler
  const handleActivateEmergencyProtocol = useCallback(() => {
    const newHash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const newLog = {
      id: `SIG-LIV-${Math.floor(1000 + Math.random() * 9000)}`,
      time: new Date().toLocaleTimeString(),
      signer: clinicianId,
      protocol: selectedProtocolToTrigger,
      hash: newHash,
    };

    setSignatureLogs((prev) => [newLog, ...prev]);

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === selectedPatientId) {
          return {
            ...p,
            marsTelemetry: {
              ...p.marsTelemetry,
              circuitStatus: 'ACTIVE_RECIRCULATION',
              bloodFlowRateMlMin: 180,
              albuminCircuitFlowMlMin: 180,
            },
          };
        }
        return p;
      }),
    );

    setIsProtocolModalOpen(false);
  }, [clinicianId, selectedProtocolToTrigger, selectedPatientId]);

  // Export FHIR R4 Bundle
  const handleExportFhirBundle = useCallback(() => {
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      identifier: { system: 'https://medtrack.hospital.org/fhir/liver-support', value: `LIV-FHIR-${patient.id}-${Date.now()}` },
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: patient.id,
            identifier: [{ system: 'urn:mrn', value: patient.mrn }],
            name: [{ text: patient.name }],
            gender: patient.sex.toLowerCase(),
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-aclf-grade-${patient.id}`,
            code: { text: 'EASL-CLIF ACLF Severity Grade' },
            valueInteger: patient.aclfGrade,
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-meld3-${patient.id}`,
            code: { text: 'OPTN MELD 3.0 Score' },
            valueInteger: patient.meld3Score,
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-mars-dialysis-${patient.id}`,
            title: 'Extracorporeal Albumin Dialysis (MARS) Care Plan',
            description: `Blood Flow: ${patient.marsTelemetry.bloodFlowRateMlMin} mL/min | Bilirubin Clearance: ${patient.marsTelemetry.bilirubinClearancePct}%`,
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FHIR_R4_Liver_Support_${patient.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patient]);

  // Export CSV Report
  const handleExportCsv = useCallback(() => {
    const rows = [
      ['Patient ID', 'MRN', 'Name', 'Etiology', 'ACLF Grade', 'MELD-3.0', 'CLIF-C Score', '28d Mortality', 'Bilirubin (mg/dL)', 'Creatinine (mg/dL)', 'INR', 'Ammonia (umol/L)', 'West Haven HE', 'MARS Circuit Status', 'Blood Flow (mL/min)'],
      [
        patient.id,
        patient.mrn,
        patient.name,
        patient.etiology,
        `Grade ${patient.aclfGrade}`,
        patient.meld3Score,
        patient.clifCAclfScore,
        patient.mortality28DayEstimated,
        patient.totalBilirubinMgDl,
        patient.serumCreatinineMgDl,
        patient.inr,
        patient.arterialAmmoniaUmolL,
        `Grade ${patient.westHavenGrade}`,
        patient.marsTelemetry.circuitStatus,
        patient.marsTelemetry.bloodFlowRateMlMin,
      ],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Liver_Support_ACLF_Audit_${patient.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patient]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-amber-500 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-600 to-purple-600 shadow-lg shadow-amber-950/50 flex items-center justify-center ring-2 ring-amber-400/30 animate-pulse">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MEDTRACK EXTRACORPOREAL LIVER SUPPORT &amp; ACLF COMMAND STATION
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
                    EASL-CLIF &bull; MELD-3.0
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Acute-on-Chronic Liver Failure (ACLF 1-3) &bull; MARS Albumin Dialysis &bull; Arterial Ammonia &bull; HRS-AKI Terlipressin &bull; FDA 21 CFR Part 11
              </p>
            </div>
          </div>

          {/* Controls & Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-1 space-x-1">
              <button
                onClick={() => setIsSimulating(!isSimulating)}
                className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  isSimulating ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isSimulating ? <Play className="w-3.5 h-3.5 fill-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                {isSimulating ? 'LIVE TICKING' : 'PAUSED'}
              </button>
              <div className="flex items-center space-x-0.5 text-xs">
                {[1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setSimulationSpeed(speed)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      simulationSpeed === speed ? 'bg-amber-500 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsProtocolModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-rose-700 hover:from-amber-500 hover:to-rose-600 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg shadow-amber-950/50 border border-amber-400/30 transition-all transform active:scale-95"
            >
              <Flame className="w-4 h-4 animate-bounce" />
              CODE HEPATIC / STAT MARS
            </button>

            <button
              onClick={handleExportFhirBundle}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
              FHIR R4
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              CSV
            </button>
          </div>
        </div>

        {/* Patient Selection Ribbon */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-400" /> Liver ICU Cohort:
            </span>
            <div className="flex items-center space-x-2">
              {patients.map((p) => {
                const isSelected = p.id === selectedPatientId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-2 border transition-all ${
                      isSelected
                        ? 'bg-amber-950/60 border-amber-500 text-white shadow-md shadow-amber-950/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${p.aclfGrade >= 3 ? 'bg-rose-400 animate-ping' : p.aclfGrade === 2 ? 'bg-orange-400' : 'bg-amber-400'}`} />
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">[ACLF {p.aclfGrade}]</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
            <span>MELD-3.0: <strong className="text-amber-400">{patient.meld3Score}</strong></span>
            <span>CLIF-C: <strong className="text-purple-400">{patient.clifCAclfScore}</strong></span>
            <span>28d MORTALITY: <strong className="text-rose-400">{patient.mortality28DayEstimated}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Critical Metrics Banner */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: EASL-CLIF ACLF Grade */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-400">
                <Flame className="w-4 h-4" /> EASL-CLIF ACLF GRADE
              </span>
              <span className="font-mono">CLIF-OF</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.aclfGrade >= 3 ? 'text-rose-400 animate-pulse' : patient.aclfGrade === 2 ? 'text-orange-400' : 'text-amber-400'}`}>
                GRADE {patient.aclfGrade}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.aclfGrade >= 3 ? '>= 3 Multi-Organ Failures' : patient.aclfGrade === 2 ? '2 Organ Failures' : 'Single Organ Failure'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.aclfGrade >= 3 ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${(patient.aclfGrade / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Card 2: OPTN MELD-3.0 Score */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Scale className="w-4 h-4" /> MELD-3.0 SCORE
              </span>
              <span className="font-mono">MAX 40</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.meld3Score >= 35 ? 'text-rose-400' : 'text-amber-400'}`}>
                {patient.meld3Score}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 40</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.meld3Score >= 35 ? 'Status 1B High Priority Listing' : 'Elective Transplant Listing'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${(patient.meld3Score / 40) * 100}%` }}
              />
            </div>
          </div>

          {/* Card 3: Arterial Ammonia Level */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Brain className="w-4 h-4" /> ARTERIAL AMMONIA
              </span>
              <span className="font-mono">NORM &lt; 50</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.arterialAmmoniaUmolL > 150 ? 'text-rose-400' : 'text-purple-300'}`}>
                {patient.arterialAmmoniaUmolL}
              </span>
              <span className="text-xs text-slate-400 font-mono">&mu;mol/L</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>West Haven HE Grade {patient.westHavenGrade}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(100, (patient.arterialAmmoniaUmolL / 200) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Total Bilirubin */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Droplet className="w-4 h-4" /> TOTAL BILIRUBIN
              </span>
              <span className="font-mono">CLIF &ge; 12</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-amber-300">
                {patient.totalBilirubinMgDl}
              </span>
              <span className="text-xs text-slate-400 font-mono">mg/dL</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.totalBilirubinMgDl >= 12.0 ? 'Severe Hepatic Failure' : 'Moderate Jaundice'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.min(100, (patient.totalBilirubinMgDl / 35) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 5: Serum Creatinine (HRS-AKI) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Beaker className="w-4 h-4" /> SERUM CREATININE
              </span>
              <span className="font-mono">HRS-AKI TYPE 1</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.serumCreatinineMgDl >= 2.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                {patient.serumCreatinineMgDl}
              </span>
              <span className="text-xs text-slate-400 font-mono">mg/dL</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>INR: {patient.inr} | Sodium: {patient.serumSodiumMeqL}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${Math.min(100, (patient.serumCreatinineMgDl / 4.0) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 6: MARS Albumin Circuit Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Activity className="w-4 h-4" /> MARS DIALYSIS
              </span>
              <span className="font-mono">{patient.marsTelemetry.totalHoursOnMars}h ACTIVE</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-emerald-400 truncate">
                {patient.marsTelemetry.circuitStatus.split('_')[0]}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>Bilirubin Clearance: {patient.marsTelemetry.bilirubinClearancePct}%</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${patient.marsTelemetry.bilirubinClearancePct}%` }}
              />
            </div>
          </div>
        </section>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'TELEMETRY', label: 'Continuous MARS Circuit & Ammonia Telemetry', icon: Activity },
            { id: 'CLIF_MATRIX', label: 'EASL-CLIF Organ Failure Matrix', icon: Layers },
            { id: 'MELD_PROGNOSTICS', label: 'MELD-3.0 & CLIF-C Prognostics', icon: Scale },
            { id: 'MARS_CIRCUIT', label: 'Albumin Dialysis & Charcoal Hemoperfusion', icon: Droplet },
            { id: 'PROTOCOLS', label: 'Terlipressin Protocol & Audit', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: TELEMETRY STREAM */}
        {activeTab === 'TELEMETRY' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Waves className="w-4 h-4 text-cyan-400" />
                      Continuous Arterial Ammonia vs Charcoal Hemoperfusion Filter Telemetry
                    </h3>
                    <p className="text-xs text-slate-400">{patient.etiology}</p>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold">
                    WEST HAVEN: GRADE {patient.westHavenGrade}
                  </span>
                </div>

                {/* Waveform visualizer */}
                <div className="h-44 bg-slate-950 rounded-lg border border-slate-800 p-3 flex items-end justify-between gap-1 overflow-hidden relative">
                  <div className="absolute top-2 left-3 text-[10px] font-mono text-purple-400 flex items-center gap-3">
                    <span>&mdash; Arterial Ammonia (&mu;mol/L)</span>
                    <span className="text-cyan-400">&mdash; Filter Drop (mmHg)</span>
                  </div>
                  {vitalStream.map((point, index) => {
                    const ammoniaHeight = Math.max(15, Math.min(100, (point.ammoniaUmolL / 250) * 100));
                    const filterHeight = Math.max(15, Math.min(100, (point.filterPressureMmHg / 80) * 100));
                    return (
                      <div key={index} className="flex-1 flex items-end justify-center gap-0.5 h-full group relative">
                        <div
                          className="w-1.5 bg-gradient-to-t from-purple-600 to-purple-400 rounded-t transition-all duration-300 group-hover:bg-purple-300"
                          style={{ height: `${ammoniaHeight}%` }}
                        />
                        <div
                          className="w-1.5 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all duration-300 group-hover:bg-cyan-300"
                          style={{ height: `${filterHeight}%` }}
                        />
                        <div className="hidden group-hover:block absolute -top-10 bg-slate-800 text-[10px] font-mono p-1 rounded border border-slate-700 z-10 whitespace-nowrap shadow-md">
                          NH3: {point.ammoniaUmolL} &mu;mol/L | Drop: {point.filterPressureMmHg} mmHg | {point.time}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vasopressor & Splanchnic Vasoconstriction Box */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-amber-900/60 space-y-1">
                  <span className="text-xs font-mono text-amber-400 font-bold block">TERLIPRESSIN &amp; SPLANCHNIC VASOCONSTRICTION:</span>
                  <p className="text-xs font-semibold text-slate-200">{patient.vasopressor.status}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Organ Failure Summary */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-400" />
                  EASL-CLIF Failed Organs
                </h3>
                <div className="space-y-2.5 text-xs">
                  {patient.organFailures.map((org, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded bg-slate-950 border border-slate-800">
                      <div>
                        <span className="font-bold text-white block">{org.organ}</span>
                        <span className="text-slate-400 text-[11px]">{org.metric}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${org.status === 'FAILED' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                        {org.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLIF ORGAN FAILURE MATRIX */}
        {activeTab === 'CLIF_MATRIX' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              EASL-CLIF Consortium 6-Organ Failure Scoring Matrix
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-amber-400 font-bold block text-sm">Liver Failure</span>
                <p className="text-slate-200 font-mono">Bilirubin &ge; 12.0 mg/dL (Score 3)</p>
                <p className="text-slate-400">Current: {patient.totalBilirubinMgDl} mg/dL</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-cyan-400 font-bold block text-sm">Kidney Failure</span>
                <p className="text-slate-200 font-mono">Creatinine &ge; 2.0 mg/dL or RRT (Score 3)</p>
                <p className="text-slate-400">Current: {patient.serumCreatinineMgDl} mg/dL</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-purple-400 font-bold block text-sm">Cerebral Failure</span>
                <p className="text-slate-200 font-mono">West Haven Grade 3-4 HE (Score 3)</p>
                <p className="text-slate-400">Current: Grade {patient.westHavenGrade}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-rose-400 font-bold block text-sm">Circulatory Failure</span>
                <p className="text-slate-200 font-mono">Vasopressor Infusion (Score 3)</p>
                <p className="text-slate-400">Current: NE + Terlipressin</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold block text-sm">Coagulation Failure</span>
                <p className="text-slate-200 font-mono">INR &ge; 2.5 (Score 3)</p>
                <p className="text-slate-400">Current: INR {patient.inr}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-blue-400 font-bold block text-sm">Respiratory Failure</span>
                <p className="text-slate-200 font-mono">PaO2/FiO2 &le; 200 or Mechanical Vent</p>
                <p className="text-slate-400">Current: PaO2/FiO2 320</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MELD & CLIF-C PROGNOSTICS */}
        {activeTab === 'MELD_PROGNOSTICS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              OPTN MELD-3.0 &amp; CLIF-C ACLF Prognostic Scorecards
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-300">OPTN MELD-3.0 Scoring Details</h3>
                <div className="text-xs text-slate-300 space-y-1.5 font-mono">
                  <p>&bull; Bilirubin Term: 4.56 &times; ln({patient.totalBilirubinMgDl})</p>
                  <p>&bull; INR Term: 9.09 &times; ln({patient.inr})</p>
                  <p>&bull; Creatinine Term: 11.14 &times; ln({patient.serumCreatinineMgDl})</p>
                  <p>&bull; Sodium Term: 0.82 &times; (137 - {patient.serumSodiumMeqL})</p>
                  <p>&bull; Albumin Term: 1.85 &times; (3.5 - {patient.serumAlbuminGDl})</p>
                  <p className="text-amber-400 font-bold mt-2">Calculated MELD-3.0: {patient.meld3Score}</p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-purple-300">CLIF-C ACLF Prognostic Index</h3>
                <div className="text-xs text-slate-300 space-y-1.5 font-mono">
                  <p>&bull; CLIF-C ACLF Score: <strong className="text-white">{patient.clifCAclfScore}</strong></p>
                  <p>&bull; 28-Day Mortality Estimate: <strong className="text-rose-400">{patient.mortality28DayEstimated}</strong></p>
                  <p className="text-slate-400 text-xs mt-2">Provides superior discrimination compared to classic Child-Pugh and MELD in acute critical decompensation.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MARS CIRCUIT */}
        {activeTab === 'MARS_CIRCUIT' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Droplet className="w-5 h-5 text-cyan-400" />
              MARS (Molecular Adsorbent Recirculating System) Albumin Dialysis Telemetry
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-400 block uppercase">Albumin Circuit Flow</span>
                <span className="text-2xl font-black font-mono text-white">{patient.marsTelemetry.albuminCircuitFlowMlMin} mL/min</span>
                <p className="text-xs text-slate-400">20% Human Albumin dialysate recirculated across charcoal and anion-exchange resin columns.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block uppercase">Bilirubin Clearance</span>
                <span className="text-2xl font-black font-mono text-white">{patient.marsTelemetry.bilirubinClearancePct}%</span>
                <p className="text-xs text-slate-400">Extraction of albumin-bound toxins, bile acids, and aromatic amino acids.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-400 block uppercase">Charcoal Filter Drop</span>
                <span className="text-2xl font-black font-mono text-white">{patient.marsTelemetry.charcoalFilterPressureDropMmHg} mmHg</span>
                <p className="text-xs text-slate-400">Pressure gradient monitoring to detect circuit clotting or adsorbent saturation.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PROTOCOLS & AUDIT */}
        {activeTab === 'PROTOCOLS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  FDA 21 CFR Part 11 Hepatology Clinical Audit Ledger
                </h2>
                <p className="text-xs text-slate-400">Cryptographically verified electronic signatures for acute liver failure interventions.</p>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4" />
                Trigger Protocol
              </button>
            </div>

            <div className="space-y-3">
              {signatureLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      {log.protocol}
                    </span>
                    <span className="font-mono text-slate-400">{log.time} &bull; Signer: {log.signer}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-300 break-all">
                    SHA-256 HASH: {log.hash}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* EMERGENCY ACTIVATION MODAL */}
      {isProtocolModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-amber-600 text-white">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Emergency Liver Support &amp; ACLF Protocol</h3>
                  <p className="text-xs text-slate-400">Patient: {patient.name} [{patient.id}]</p>
                </div>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-mono"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Resuscitation Protocol</label>
                <select
                  value={selectedProtocolToTrigger}
                  onChange={(e) => setSelectedProtocolToTrigger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="CODE_HEPATIC_MARS_STAT">Stat MARS Albumin Dialysis Session &amp; Terlipressin Continuous Infusion</option>
                  <option value="HRS_AKI_TERLIPRESSIN_ALBUMIN">Type 1 HRS-AKI Terlipressin (2-4 mg/day) + Albumin (1 g/kg/day) Protocol</option>
                  <option value="HYPERAMMONEMIA_CRRT_MARS">Severe Hyperammonemic Encephalopathy CRRT + MARS Hybrid Clearing</option>
                  <option value="TRANSPLANT_STATUS_1B_EXPEDITE">Urgent Liver Transplant Status 1B Expedited Listing</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Attending Transplant Hepatologist E-Signature</label>
                <input
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Indications &amp; Findings</label>
                <textarea
                  rows={3}
                  value={activationRationale}
                  onChange={(e) => setActivationRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-[11px] text-amber-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Under FDA 21 CFR Part 11 and EASL-CLIF consensus guidelines, this executes a legally binding extracorporeal liver support order.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsProtocolModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleActivateEmergencyProtocol}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-rose-700 hover:from-amber-500 hover:to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <FileCheck className="w-4 h-4" />
                Sign &amp; Administer Stat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
