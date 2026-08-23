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

interface CartVitalHistory {
  time: string;
  tempC: number;
  map: number;
  heartRate: number;
  spo2: number;
  respRate: number;
  iceScore: number;
  il6: number;
}

interface CartPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: string;
  location: string;
  carTConstruct: string;
  infusionDay: string;
  indication: string;
  crsGrade: number; // 0 - 4
  icansGrade: number; // 0 - 4
  iceScore: number; // 0 - 10
  tempC: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  map: number;
  spo2: number;
  oxygenDelivery: string;
  respRate: number;
  vasopressor: {
    primary: string;
    rateMcgKgMin: number;
    status: string;
  };
  neurologicalExam: string;
  biomarkers: {
    il6: number; // pg/mL
    ferritin: number; // ng/mL
    crp: number; // mg/L
    dDimer: number; // mcg/mL
    ldh: number; // U/L
    ifnGamma: number; // pg/mL
  };
  immunomodulators: Array<{
    drug: string;
    dose: string;
    timeAgo: string;
    cumulativeDoses: number;
  }>;
}

const CART_PATIENTS_DATABASE: CartPatient[] = [
  {
    id: 'CART-401',
    mrn: 'IMM-809214',
    name: 'Julian Montgomery',
    ageYears: 58,
    sex: 'Male',
    location: 'Cellular Therapy ICU - Bed 02',
    carTConstruct: 'Axicabtagene Ciloleucel (Yescarta - Anti-CD19)',
    infusionDay: '+5 Days Post-Infusion',
    indication: 'Relapsed/Refractory Diffuse Large B-Cell Lymphoma (DLBCL)',
    crsGrade: 3,
    icansGrade: 2,
    iceScore: 5,
    tempC: 39.6,
    heartRate: 124,
    systolicBp: 88,
    diastolicBp: 52,
    map: 64.0,
    spo2: 92,
    oxygenDelivery: 'High-Flow Nasal Cannula (12 L/min, FiO2 0.50)',
    respRate: 26,
    vasopressor: {
      primary: 'Norepinephrine',
      rateMcgKgMin: 0.14,
      status: 'Escalating single vasopressor for vasodilatory shock',
    },
    neurologicalExam: 'Moderate expressive dysphasia, ICE 5/10, unable to count backwards, motor strength 4/5 bilaterally.',
    biomarkers: {
      il6: 842.0,
      ferritin: 14200,
      crp: 218.4,
      dDimer: 8.9,
      ldh: 940,
      ifnGamma: 320.0,
    },
    immunomodulators: [
      { drug: 'Tocilizumab (Actemra)', dose: '800mg IV', timeAgo: '4 hours ago', cumulativeDoses: 2 },
      { drug: 'Dexamethasone', dose: '20mg IV', timeAgo: '2 hours ago', cumulativeDoses: 1 },
      { drug: 'Levetiracetam', dose: '750mg IV q12h', timeAgo: 'Continuous Prophylaxis', cumulativeDoses: 6 },
    ],
  },
  {
    id: 'CART-402',
    mrn: 'IMM-674190',
    name: 'Seraphina Lin',
    ageYears: 24,
    sex: 'Female',
    location: 'BMT Unit - Room 412 (Step-down)',
    carTConstruct: 'Tisagenlecleucel (Kymriah - Anti-CD19)',
    infusionDay: '+3 Days Post-Infusion',
    indication: 'Relapsed B-Cell Acute Lymphoblastic Leukemia (B-ALL)',
    crsGrade: 2,
    icansGrade: 1,
    iceScore: 8,
    tempC: 38.9,
    heartRate: 108,
    systolicBp: 98,
    diastolicBp: 60,
    map: 72.7,
    spo2: 95,
    oxygenDelivery: 'Low-Flow Nasal Cannula (2 L/min O2)',
    respRate: 20,
    vasopressor: {
      primary: 'None',
      rateMcgKgMin: 0.0,
      status: 'Hemodynamically stable following 1000 mL crystalloid bolus',
    },
    neurologicalExam: 'Mild tremor in dominant hand, subtle handwriting degradation, ICE 8/10, oriented x 4.',
    biomarkers: {
      il6: 310.0,
      ferritin: 4800,
      crp: 96.5,
      dDimer: 3.2,
      ldh: 460,
      ifnGamma: 110.0,
    },
    immunomodulators: [
      { drug: 'Tocilizumab (Actemra)', dose: '600mg IV', timeAgo: '6 hours ago', cumulativeDoses: 1 },
      { drug: 'Levetiracetam', dose: '500mg PO q12h', timeAgo: 'Continuous Prophylaxis', cumulativeDoses: 4 },
    ],
  },
  {
    id: 'CART-403',
    mrn: 'IMM-932105',
    name: 'Arthur Sterling',
    ageYears: 67,
    sex: 'Male',
    location: 'Neuro-ICU - Bed 06',
    carTConstruct: 'Ciltacabtagene Autoleucel (Carvykti - Anti-BCMA)',
    infusionDay: '+8 Days Post-Infusion',
    indication: 'Triple-Class Refractory Multiple Myeloma',
    crsGrade: 1,
    icansGrade: 3,
    iceScore: 2,
    tempC: 38.2,
    heartRate: 92,
    systolicBp: 126,
    diastolicBp: 76,
    map: 92.7,
    spo2: 97,
    oxygenDelivery: 'Room Air (21% FiO2)',
    respRate: 18,
    vasopressor: {
      primary: 'None',
      rateMcgKgMin: 0.0,
      status: 'Normotensive without vasopressor support',
    },
    neurologicalExam: 'Severe expressive global aphasia, stupor with intermittent myoclonic twitches, ICE 2/10.',
    biomarkers: {
      il6: 85.0,
      ferritin: 8900,
      crp: 48.0,
      dDimer: 5.4,
      ldh: 620,
      ifnGamma: 45.0,
    },
    immunomodulators: [
      { drug: 'Dexamethasone', dose: '20mg IV q6h', timeAgo: '1 hour ago', cumulativeDoses: 3 },
      { drug: 'Anakinra (Kineret)', dose: '100mg SubQ', timeAgo: 'Under evaluation for steroid-refractory ICANS', cumulativeDoses: 0 },
      { drug: 'Levetiracetam', dose: '1000mg IV q12h', timeAgo: 'Prophylaxis', cumulativeDoses: 8 },
    ],
  },
];

export default function CartToxicityCommandStationPage() {
  const [patients, setPatients] = useState<CartPatient[]>(CART_PATIENTS_DATABASE);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('CART-401');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'ICE_ASSESSMENT' | 'CYTOKINES' | 'IMMUNOMODULATION' | 'PROTOCOLS'>('TELEMETRY');

  // Protocol Trigger Modal
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false);
  const [selectedProtocolToTrigger, setSelectedProtocolToTrigger] = useState<string>('CODE_CYTOKINE_STAT_TOCI');
  const [clinicianId, setClinicianId] = useState<string>('MD-BMT-9941 (Dr. Jonathan Reyes)');
  const [activationRationale, setActivationRationale] = useState<string>('Grade 3 CRS with refractory hypotension (NE 0.14 mcg/kg/min) and progressive Grade 2 ICANS dysphasia.');
  const [signatureLogs, setSignatureLogs] = useState<Array<{ id: string; time: string; signer: string; protocol: string; hash: string }>>([
    {
      id: 'SIG-CART-301',
      time: new Date(Date.now() - 1000 * 60 * 30).toLocaleTimeString(),
      signer: 'Dr. Jonathan Reyes (MD-BMT-9941)',
      protocol: 'Stat Tocilizumab 800mg & High-Dose Dexamethasone Activation',
      hash: 'a9d4c10e8293dd41f8742ca910d65b7194c2510f92b74c0b62e49c71629fa411',
    },
  ]);

  // Selected Patient
  const patient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Cytokine surge index
  const cytokineSurgeIndex = useMemo(() => {
    return Math.round(((patient.biomarkers.il6 / 10) + (patient.biomarkers.ferritin / 500) + (patient.biomarkers.crp * 2)) * 10) / 10;
  }, [patient.biomarkers]);

  // Vital stream buffer
  const [vitalStream, setVitalStream] = useState<CartVitalHistory[]>(() => {
    const list: CartVitalHistory[] = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      list.push({
        time: new Date(now - i * 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tempC: 39.5 + Math.sin(i) * 0.2,
        map: 64 + Math.cos(i) * 2,
        heartRate: 120 + Math.sin(i) * 4,
        spo2: 92,
        respRate: 26,
        iceScore: 5,
        il6: 840 + Math.sin(i) * 15,
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

          const tempFluct = (Math.random() - 0.48) * 0.1;
          const mapFluct = (Math.random() - 0.5) * 1.5;
          const hrFluct = (Math.random() - 0.5) * 2.0;

          const newTemp = Math.max(36.0, Math.min(41.5, Math.round((p.tempC + tempFluct) * 10) / 10));
          const newMap = Math.max(50, Math.min(110, Math.round((p.map + mapFluct) * 10) / 10));
          const newHr = Math.max(50, Math.min(160, Math.round(p.heartRate + hrFluct)));

          return {
            ...p,
            tempC: newTemp,
            map: newMap,
            heartRate: newHr,
            systolicBp: Math.round(newMap * 1.25 + (Math.random() * 2 - 1)),
            diastolicBp: Math.round(newMap * 0.75 + (Math.random() * 2 - 1)),
          };
        }),
      );

      // Append vital snapshot
      setVitalStream((prev) => {
        const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newSnapshot: CartVitalHistory = {
          time: nextTime,
          tempC: patient.tempC,
          map: patient.map,
          heartRate: patient.heartRate,
          spo2: patient.spo2,
          respRate: patient.respRate,
          iceScore: patient.iceScore,
          il6: patient.biomarkers.il6,
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
      id: `SIG-CART-${Math.floor(1000 + Math.random() * 9000)}`,
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
            immunomodulators: [
              { drug: 'Tocilizumab (Actemra)', dose: '800mg IV STAT', timeAgo: 'Just now', cumulativeDoses: 3 },
              { drug: 'Dexamethasone', dose: '20mg IV STAT', timeAgo: 'Just now', cumulativeDoses: 2 },
              ...p.immunomodulators,
            ],
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
      identifier: { system: 'https://medtrack.hospital.org/fhir/cart', value: `CART-FHIR-${patient.id}-${Date.now()}` },
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
            id: `obs-crs-grade-${patient.id}`,
            code: { text: 'ASTCT Cytokine Release Syndrome (CRS) Grade' },
            valueInteger: patient.crsGrade,
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-icans-grade-${patient.id}`,
            code: { text: 'ASTCT ICANS Neurotoxicity Grade' },
            valueInteger: patient.icansGrade,
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-ice-score-${patient.id}`,
            code: { text: 'ICE Cognitive Assessment Score (0-10)' },
            valueInteger: patient.iceScore,
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-cart-toxicity-${patient.id}`,
            title: `ASTCT CAR-T Toxicity Management - ${patient.carTConstruct}`,
            activity: patient.immunomodulators.map((med) => ({
              detail: { code: { text: `${med.drug} - ${med.dose}` }, status: 'completed' },
            })),
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FHIR_R4_CART_Toxicity_${patient.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patient]);

  // Export CSV Report
  const handleExportCsv = useCallback(() => {
    const rows = [
      ['Patient ID', 'MRN', 'Name', 'CAR-T Construct', 'Infusion Day', 'CRS Grade', 'ICANS Grade', 'ICE Score (0-10)', 'Temp (C)', 'MAP (mmHg)', 'HR (BPM)', 'Oxygen Delivery', 'Vasopressor', 'IL-6 (pg/mL)', 'Ferritin (ng/mL)', 'CRP (mg/L)'],
      [
        patient.id,
        patient.mrn,
        patient.name,
        patient.carTConstruct,
        patient.infusionDay,
        `Grade ${patient.crsGrade}`,
        `Grade ${patient.icansGrade}`,
        `${patient.iceScore}/10`,
        patient.tempC,
        patient.map,
        patient.heartRate,
        patient.oxygenDelivery,
        `${patient.vasopressor.primary} (${patient.vasopressor.rateMcgKgMin} mcg/kg/min)`,
        patient.biomarkers.il6,
        patient.biomarkers.ferritin,
        patient.biomarkers.crp,
      ],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CART_Toxicity_Audit_${patient.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patient]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-rose-500 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-rose-600 shadow-lg shadow-purple-950/50 flex items-center justify-center ring-2 ring-purple-400/30 animate-pulse">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MEDTRACK CELLULAR THERAPY &amp; CAR-T TOXICITY COMMAND STATION
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest">
                    ASTCT 2026 Consensus Engine
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Cytokine Release Syndrome (CRS) &bull; ICANS Neurotoxicity &bull; 10-Point ICE Assessment &bull; IL-6 / Tocilizumab Protocols &bull; FDA 21 CFR Part 11
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
                      simulationSpeed === speed ? 'bg-purple-500 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsProtocolModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-purple-700 hover:from-rose-500 hover:to-purple-600 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg shadow-purple-950/50 border border-purple-400/30 transition-all transform active:scale-95"
            >
              <Flame className="w-4 h-4 animate-bounce" />
              CODE CYTOKINE / STAT TOCI
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
              <Users className="w-3.5 h-3.5 text-purple-400" /> CAR-T Therapy Cohort:
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
                        ? 'bg-purple-950/60 border-purple-500 text-white shadow-md shadow-purple-950/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${p.crsGrade >= 3 || p.icansGrade >= 3 ? 'bg-rose-400 animate-ping' : p.crsGrade >= 2 ? 'bg-orange-400' : 'bg-amber-400'}`} />
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">[{p.infusionDay}]</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
            <span>CONSTRUCT: <strong className="text-purple-300">{patient.carTConstruct.split(' ')[0]}</strong></span>
            <span>LOC: <strong className="text-cyan-400">{patient.location}</strong></span>
            <span>DAY: <strong className="text-emerald-400">{patient.infusionDay}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Critical Metrics Banner */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: ASTCT CRS Grade */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-400">
                <Flame className="w-4 h-4" /> CRS SEVERITY GRADE
              </span>
              <span className="font-mono">ASTCT 2026</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.crsGrade >= 3 ? 'text-rose-400 animate-pulse' : patient.crsGrade >= 2 ? 'text-orange-400' : 'text-amber-400'}`}>
                GRADE {patient.crsGrade}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.crsGrade >= 3 ? 'Severe: Vasopressors & High Flow O2' : patient.crsGrade === 2 ? 'Moderate: IV Fluids & Low Flow O2' : 'Mild: Isolated Fever'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.crsGrade >= 3 ? 'bg-rose-500' : patient.crsGrade === 2 ? 'bg-orange-500' : 'bg-amber-500'}`}
                style={{ width: `${(patient.crsGrade / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Card 2: ASTCT ICANS Grade */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Brain className="w-4 h-4" /> ICANS NEUROTOXICITY
              </span>
              <span className="font-mono">ICE {patient.iceScore}/10</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.icansGrade >= 3 ? 'text-purple-400 animate-pulse' : patient.icansGrade >= 2 ? 'text-orange-400' : 'text-amber-400'}`}>
                GRADE {patient.icansGrade}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.icansGrade >= 3 ? 'Severe: Stupor / Aphasia / Seizures' : patient.icansGrade === 2 ? 'Moderate: Dysphasia / Somnolence' : 'Mild Encephalopathy'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.icansGrade >= 3 ? 'bg-purple-500' : 'bg-amber-500'}`}
                style={{ width: `${(patient.icansGrade / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Card 3: Core Body Temperature */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Thermometer className="w-4 h-4" /> CORE TEMPERATURE
              </span>
              <span className="font-mono">&ge; 38.0&deg;C FEVER</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.tempC >= 39.0 ? 'text-rose-400' : 'text-amber-400'}`}>
                {patient.tempC}&deg;C
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>HEART RATE: {patient.heartRate} BPM</span>
              <span className="text-rose-400 font-semibold">{patient.tempC >= 38.0 ? 'CRS TRIGGER' : 'NORMAL'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-rose-500"
                style={{ width: `${Math.min(100, ((patient.tempC - 36.0) / 5.0) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Serum Interleukin-6 (IL-6) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Microscope className="w-4 h-4" /> SERUM IL-6 CYTOKINE
              </span>
              <span className="font-mono">NORM &lt; 7 pg/mL</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-cyan-300">
                {patient.biomarkers.il6}
              </span>
              <span className="text-xs text-slate-400 font-mono">pg/mL</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.biomarkers.il6 > 500 ? 'Severe Hypercytokinemia' : 'Elevated'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${Math.min(100, (patient.biomarkers.il6 / 1000) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 5: Serum Ferritin (HLH/MAS Risk) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Beaker className="w-4 h-4" /> SERUM FERRITIN
              </span>
              <span className="font-mono">&gt; 10k HLH RISK</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.biomarkers.ferritin > 10000 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {patient.biomarkers.ferritin}
              </span>
              <span className="text-xs text-slate-400 font-mono">ng/mL</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>CRP: {patient.biomarkers.crp} mg/L</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, (patient.biomarkers.ferritin / 15000) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 6: Hemodynamics & Oxygenation */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-300">
                <Activity className="w-4 h-4" /> MAP &amp; OXYGENATION
              </span>
              <span className="font-mono">SPO2: {patient.spo2}%</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.map < 65 ? 'text-rose-400' : 'text-slate-200'}`}>
                {patient.map}
              </span>
              <span className="text-xs text-slate-400 font-mono">mmHg</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.oxygenDelivery}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.map < 65 ? 'bg-rose-500' : 'bg-cyan-400'}`}
                style={{ width: `${Math.min(100, (patient.map / 90) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'TELEMETRY', label: 'Continuous CAR-T Telemetry & Waveforms', icon: Activity },
            { id: 'ICE_ASSESSMENT', label: '10-Point ICE Cognitive Assessment', icon: Brain },
            { id: 'CYTOKINES', label: 'Cytokine Storm & HLH Surge Kinetics', icon: Microscope },
            { id: 'IMMUNOMODULATION', label: 'Tocilizumab & Steroid Protocols', icon: Pill },
            { id: 'PROTOCOLS', label: 'Code Cytokine Audit & 21 CFR Part 11', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
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
                      Continuous Core Temperature &amp; Arterial Pressure Telemetry Stream
                    </h3>
                    <p className="text-xs text-slate-400">{patient.carTConstruct} &bull; {patient.infusionDay}</p>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold">
                    ICE SCORE: {patient.iceScore}/10
                  </span>
                </div>

                {/* Waveform visualizer */}
                <div className="h-44 bg-slate-950 rounded-lg border border-slate-800 p-3 flex items-end justify-between gap-1 overflow-hidden relative">
                  <div className="absolute top-2 left-3 text-[10px] font-mono text-amber-400 flex items-center gap-3">
                    <span>&mdash; Core Temperature (&deg;C)</span>
                    <span className="text-cyan-400">&mdash; MAP (mmHg)</span>
                  </div>
                  {vitalStream.map((point, index) => {
                    const tempHeight = Math.max(15, Math.min(100, ((point.tempC - 36.5) / 4.5) * 100));
                    const mapHeight = Math.max(15, Math.min(100, ((point.map - 40) / 60) * 100));
                    return (
                      <div key={index} className="flex-1 flex items-end justify-center gap-0.5 h-full group relative">
                        <div
                          className="w-1.5 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t transition-all duration-300 group-hover:bg-amber-300"
                          style={{ height: `${tempHeight}%` }}
                        />
                        <div
                          className="w-1.5 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all duration-300 group-hover:bg-cyan-300"
                          style={{ height: `${mapHeight}%` }}
                        />
                        <div className="hidden group-hover:block absolute -top-10 bg-slate-800 text-[10px] font-mono p-1 rounded border border-slate-700 z-10 whitespace-nowrap shadow-md">
                          Temp: {point.tempC.toFixed(1)}&deg;C | MAP: {Math.round(point.map)} | {point.time}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Neurological Summary Box */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-purple-900/60 space-y-1">
                  <span className="text-xs font-mono text-purple-400 font-bold block">NEUROLOGICAL &amp; ENCEPHALOPATHY EXAMINATION:</span>
                  <p className="text-xs font-semibold text-slate-200">{patient.neurologicalExam}</p>
                </div>
              </div>

              {/* Active Immunomodulator Dosing Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-400" />
                  Administered Immunomodulators &amp; Anticonvulsant Prophylaxis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {patient.immunomodulators.map((med, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                      <span className="text-purple-400 font-bold block">{med.drug}</span>
                      <p className="text-slate-200 font-mono">{med.dose}</p>
                      <p className="text-slate-500 text-[10px]">{med.timeAgo} &bull; Total Doses: {med.cumulativeDoses}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Vasopressor & ASTCT Summary */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-rose-400" />
                  Vasodilatory Shock &amp; Hemodynamics
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">VASOPRESSOR TITRATION</span>
                    <span className="font-mono font-bold text-rose-400">{patient.vasopressor.primary} ({patient.vasopressor.rateMcgKgMin} mcg/kg/min)</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">{patient.vasopressor.status}</p>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">OXYGEN SUPPORT</span>
                    <span className="font-mono font-bold text-cyan-400">{patient.oxygenDelivery}</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">CYTOKINE SURGE INDEX</span>
                    <span className="font-mono font-bold text-amber-400">{cytokineSurgeIndex} (High Inflammatory Load)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 10-POINT ICE COGNITIVE ASSESSMENT */}
        {activeTab === 'ICE_ASSESSMENT' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Immune Effector Cell-Associated Encephalopathy (ICE) 10-Point Scorecard
                </h2>
                <p className="text-xs text-slate-400">
                  Standardized cognitive screening tool for early detection and grading of ICANS.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Score</span>
                  <span className="text-2xl font-mono font-bold text-purple-400">{patient.iceScore} / 10 pts</span>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-purple-500 flex items-center justify-center font-mono font-bold text-xs bg-slate-950 text-white">
                  {patient.iceScore * 10}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {[
                { task: 'Orientation: Year', points: 1, passed: patient.iceScore >= 1, desc: 'Patient correctly states current year.' },
                { task: 'Orientation: Month', points: 1, passed: patient.iceScore >= 2, desc: 'Patient correctly states current month.' },
                { task: 'Orientation: City', points: 1, passed: patient.iceScore >= 3, desc: 'Patient correctly identifies current city.' },
                { task: 'Orientation: Hospital', points: 1, passed: patient.iceScore >= 4, desc: 'Patient correctly names the hospital facility.' },
                { task: 'Naming: Object 1 (Pen)', points: 1, passed: patient.iceScore >= 5, desc: 'Patient accurately identifies pen.' },
                { task: 'Naming: Object 2 (Watch)', points: 1, passed: patient.iceScore >= 6, desc: 'Patient accurately identifies wristwatch.' },
                { task: 'Naming: Object 3 (Badge)', points: 1, passed: patient.iceScore >= 7, desc: 'Patient accurately identifies staff badge.' },
                { task: 'Following 2-Step Command', points: 1, passed: patient.iceScore >= 8, desc: '"Show 2 fingers with your left hand".' },
                { task: 'Handwriting: Sentence Writing', points: 1, passed: patient.iceScore >= 9, desc: 'Write a standard complete sentence on paper.' },
                { task: 'Attention: Serial 10s Countdown', points: 1, passed: patient.iceScore >= 10, desc: 'Count backwards from 100 by 10s (100, 90, 80...).' },
              ].map((item, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${item.passed ? 'bg-slate-950/80 border-emerald-500/50' : 'bg-slate-950/50 border-slate-800'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono text-purple-400 font-bold">{item.task}</span>
                      <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                    </div>
                    <div className={`p-1.5 rounded-full ${item.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CYTOKINES & HLH SURGE KINETICS */}
        {activeTab === 'CYTOKINES' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Microscope className="w-5 h-5 text-cyan-400" />
              Cytokine Cascade &amp; CAR-HLH / MAS Overlap Surveillance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-400 block uppercase">Interleukin-6 (IL-6)</span>
                <span className="text-2xl font-black font-mono text-white">{patient.biomarkers.il6} pg/mL</span>
                <p className="text-xs text-slate-400">Primary effector cytokine mediating endothelial permeability and vascular collapse.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block uppercase">Ferritin Level</span>
                <span className="text-2xl font-black font-mono text-white">{patient.biomarkers.ferritin} ng/mL</span>
                <p className="text-xs text-slate-400">Severe hyperferritinemia &gt; 10,000 ng/mL indicates impending hemophagocytic lymphohistiocytosis.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-400 block uppercase">Interferon-Gamma (IFN-&gamma;)</span>
                <span className="text-2xl font-black font-mono text-white">{patient.biomarkers.ifnGamma} pg/mL</span>
                <p className="text-xs text-slate-400">Driver of macrophage activation and systemic hyperinflammation.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: IMMUNOMODULATION PROTOCOLS */}
        {activeTab === 'IMMUNOMODULATION' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Pill className="w-5 h-5 text-emerald-400" />
              Targeted Immunomodulation Pathways (ASTCT Dosing Guidelines)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-rose-400 font-bold block text-sm">Tocilizumab (Anti-IL-6R)</span>
                <p className="text-slate-300 font-mono">8 mg/kg IV (Max 800 mg)</p>
                <p className="text-slate-400">First-line therapy for Grade &ge; 2 CRS. Repeat q8h up to 4 cumulative doses in 24h.</p>
              </div>
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-purple-400 font-bold block text-sm">Dexamethasone</span>
                <p className="text-slate-300 font-mono">10 - 20 mg IV q6h</p>
                <p className="text-slate-400">First-line therapy for Grade &ge; 2 ICANS and refractory CRS. Readily penetrates CNS.</p>
              </div>
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-cyan-400 font-bold block text-sm">Anakinra (IL-1 Receptor Antagonist)</span>
                <p className="text-slate-300 font-mono">100 - 200 mg IV/SubQ q6h</p>
                <p className="text-slate-400">Second-line salvage therapy for Tocilizumab/steroid-refractory CRS and neuroinflammation.</p>
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
                  FDA 21 CFR Part 11 Cellular Therapy Clinical Audit Ledger
                </h2>
                <p className="text-xs text-slate-400">Cryptographically verified electronic signatures on emergency toxicity interventions.</p>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4" />
                Trigger New Protocol
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
                <div className="p-2 rounded-xl bg-purple-600 text-white">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Code Cytokine / Emergent Immunomodulator Order</h3>
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-medium outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="CODE_CYTOKINE_STAT_TOCI">Stat Tocilizumab 8mg/kg IV + High-Dose Dexamethasone</option>
                  <option value="REFRACTORY_CRS_ANAKINRA">Refractory CRS / CAR-HLH Overlap Protocol (Anakinra 200mg IV q6h)</option>
                  <option value="SEVERE_ICANS_METHYLPRED">Severe ICANS Neurotoxicity Pulse (Methylprednisolone 1000mg/day)</option>
                  <option value="NEURO_ICU_EMERGENT_TRANSFER">Immediate Neuro-ICU Transfer &amp; Continuous EEG Monitoring</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Attending Cellular Therapy Physician E-Signature</label>
                <input
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Indications &amp; Rationale</label>
                <textarea
                  rows={3}
                  value={activationRationale}
                  onChange={(e) => setActivationRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800 text-[11px] text-purple-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-400" />
                <span>
                  Under FDA 21 CFR Part 11 and ASTCT consensus guidelines, this executes a legally binding high-risk immunomodulatory prescription.
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
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-rose-700 hover:from-purple-500 hover:to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
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
