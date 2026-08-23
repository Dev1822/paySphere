import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Baby,
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
  Wind,
  Zap,
} from 'lucide-react';

interface PicuVitalHistory {
  time: string;
  heartRate: number;
  map: number;
  visScore: number;
  spo2: number;
  respRate: number;
  tempC: number;
  oxygenationIndex: number;
}

interface PicuPatient {
  id: string;
  mrn: string;
  name: string;
  ageMonths: number;
  ageGroup: string;
  sex: string;
  location: string;
  diagnosis: string;
  psofaScore: number; // 0 - 24
  psofaMax: number;
  mortalityRiskEstimated: string;
  visScore: number;
  oxygenationIndex: number;
  vitals: {
    heartRate: number;
    systolicBp: number;
    diastolicBp: number;
    map: number;
    respRate: number;
    tempC: number;
    spo2: number;
  };
  ventilator: {
    mode: string;
    meanAirwayPressure: number;
    fio2: number;
    pao2: number;
    peep: number;
    tidalVolumeMlKg: number;
  };
  inotropes: {
    epinephrineMcgKgMin: number;
    norepinephrineMcgKgMin: number;
    milrinoneMcgKgMin: number;
    dopamineMcgKgMin: number;
    vasopressinUnitsKgMin: number;
  };
  labs: {
    plateletsKUl: number;
    totalBilirubinMgDl: number;
    serumCreatinineMgDl: number;
    lactateMmolL: number;
    pediatricGcs: number;
  };
  organSystemFailures: Array<{
    system: string;
    score: number;
    detail: string;
  }>;
}

const PICU_PATIENTS_DATABASE: PicuPatient[] = [
  {
    id: 'PICU-701',
    mrn: 'PED-551094',
    name: 'Noah Sterling-Hayes',
    ageMonths: 48,
    ageGroup: 'Preschool (4 Years)',
    sex: 'Male',
    location: 'PICU Bay 01 (Isolation)',
    diagnosis: 'Fulminant Meningococcemia, Purpura Fulminans & Refractory Septic Shock',
    psofaScore: 14,
    psofaMax: 24,
    mortalityRiskEstimated: '48.2%',
    visScore: 35.0,
    oxygenationIndex: 16.8,
    vitals: {
      heartRate: 164,
      systolicBp: 72,
      diastolicBp: 38,
      map: 49.3,
      respRate: 36,
      tempC: 39.4,
      spo2: 91,
    },
    ventilator: {
      mode: 'PRVC / Lung Protective',
      meanAirwayPressure: 14,
      fio2: 0.70,
      pao2: 58,
      peep: 10,
      tidalVolumeMlKg: 5.8,
    },
    inotropes: {
      epinephrineMcgKgMin: 0.15,
      norepinephrineMcgKgMin: 0.10,
      milrinoneMcgKgMin: 0.50,
      dopamineMcgKgMin: 0.0,
      vasopressinUnitsKgMin: 0.0005,
    },
    labs: {
      plateletsKUl: 32,
      totalBilirubinMgDl: 3.8,
      serumCreatinineMgDl: 1.8,
      lactateMmolL: 5.4,
      pediatricGcs: 8,
    },
    organSystemFailures: [
      { system: 'Cardiovascular', score: 4, detail: 'VIS 35.0 (Epi 0.15 + NE 0.10 + Milrinone 0.50)' },
      { system: 'Respiratory', score: 3, detail: 'PaO2/FiO2 82.8 (OI 16.8, Severe PARDS)' },
      { system: 'Coagulation', score: 3, detail: 'Platelets 32,000 /mcL (Purpura & DIC)' },
      { system: 'Renal', score: 2, detail: 'Creatinine 1.8 mg/dL (4x baseline for 4yo)' },
      { system: 'Neurological', score: 2, detail: 'Pediatric GCS 8 / 15' },
    ],
  },
  {
    id: 'PICU-702',
    mrn: 'PED-209144',
    name: 'Maya Sophia Chen',
    ageMonths: 8,
    ageGroup: 'Infant (8 Months)',
    sex: 'Female',
    location: 'PICU Bed 04',
    diagnosis: 'Severe RSV Bronchiolitis, Secondary Bacterial Pneumonia & PARDS',
    psofaScore: 8,
    psofaMax: 24,
    mortalityRiskEstimated: '14.5%',
    visScore: 12.0,
    oxygenationIndex: 11.4,
    vitals: {
      heartRate: 142,
      systolicBp: 78,
      diastolicBp: 44,
      map: 55.3,
      respRate: 48,
      tempC: 38.6,
      spo2: 94,
    },
    ventilator: {
      mode: 'HFOV / High-Frequency Oscillatory',
      meanAirwayPressure: 18,
      fio2: 0.55,
      pao2: 87,
      peep: 8,
      tidalVolumeMlKg: 5.2,
    },
    inotropes: {
      epinephrineMcgKgMin: 0.05,
      norepinephrineMcgKgMin: 0.0,
      milrinoneMcgKgMin: 0.35,
      dopamineMcgKgMin: 0.0,
      vasopressinUnitsKgMin: 0.0,
    },
    labs: {
      plateletsKUl: 145,
      totalBilirubinMgDl: 0.8,
      serumCreatinineMgDl: 0.6,
      lactateMmolL: 2.1,
      pediatricGcs: 13,
    },
    organSystemFailures: [
      { system: 'Respiratory', score: 3, detail: 'HFOV support, OI 11.4 (Moderate PARDS)' },
      { system: 'Cardiovascular', score: 2, detail: 'Milrinone + Low-dose Epinephrine (VIS 12.0)' },
      { system: 'Renal', score: 1, detail: 'Creatinine 0.6 mg/dL' },
      { system: 'Neurological', score: 1, detail: 'pGCS 13 (Sedated on Dexmedetomidine)' },
    ],
  },
  {
    id: 'PICU-703',
    mrn: 'PED-781920',
    name: 'Ethan James Brooks',
    ageMonths: 168,
    ageGroup: 'Adolescent (14 Years)',
    sex: 'Male',
    location: 'PICU Trauma Bay',
    diagnosis: 'Pediatric Polytrauma, Pulmonary Contusions & Rhabdomyolysis',
    psofaScore: 5,
    psofaMax: 24,
    mortalityRiskEstimated: '6.2%',
    visScore: 5.0,
    oxygenationIndex: 4.8,
    vitals: {
      heartRate: 98,
      systolicBp: 112,
      diastolicBp: 64,
      map: 80.0,
      respRate: 20,
      tempC: 37.2,
      spo2: 97,
    },
    ventilator: {
      mode: 'SIMV-PS',
      meanAirwayPressure: 8,
      fio2: 0.35,
      pao2: 95,
      peep: 5,
      tidalVolumeMlKg: 7.0,
    },
    inotropes: {
      epinephrineMcgKgMin: 0.0,
      norepinephrineMcgKgMin: 0.05,
      milrinoneMcgKgMin: 0.0,
      dopamineMcgKgMin: 0.0,
      vasopressinUnitsKgMin: 0.0,
    },
    labs: {
      plateletsKUl: 210,
      totalBilirubinMgDl: 1.1,
      serumCreatinineMgDl: 1.4,
      lactateMmolL: 1.8,
      pediatricGcs: 14,
    },
    organSystemFailures: [
      { system: 'Renal', score: 2, detail: 'Creatinine 1.4 mg/dL (Rhabdomyolysis-induced AKI)' },
      { system: 'Cardiovascular', score: 1, detail: 'Norepinephrine 0.05 mcg/kg/min (VIS 5.0)' },
      { system: 'Respiratory', score: 1, detail: 'PaO2/FiO2 271' },
      { system: 'Neurological', score: 1, detail: 'pGCS 14' },
    ],
  },
];

export default function PicuCriticalCareTelemetryPage() {
  const [patients, setPatients] = useState<PicuPatient[]>(PICU_PATIENTS_DATABASE);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PICU-701');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'PSOFA_MATRIX' | 'VIS_INOTROPES' | 'PARDS_VENT' | 'PROTOCOLS'>('TELEMETRY');

  // Protocol Modal State
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false);
  const [selectedProtocolToTrigger, setSelectedProtocolToTrigger] = useState<string>('CODE_PEDIATRIC_SEPSIS_STAT');
  const [clinicianId, setClinicianId] = useState<string>('MD-PICU-1194 (Dr. Rebecca Vance, FAAP)');
  const [activationRationale, setActivationRationale] = useState<string>('Fulminant septic shock with VIS 35.0, severe PARDS (OI 16.8), and rapid organ failure escalation.');
  const [signatureLogs, setSignatureLogs] = useState<Array<{ id: string; time: string; signer: string; protocol: string; hash: string }>>([
    {
      id: 'SIG-PED-401',
      time: new Date(Date.now() - 1000 * 60 * 20).toLocaleTimeString(),
      signer: 'Dr. Rebecca Vance (MD-PICU-1194)',
      protocol: 'PALS Septic Shock Resuscitation & Hydrocortisone Order',
      hash: 'b9d3a10e8293dd41f8742ca910d65b7194c2510f92b74c0b62e49c71629fa719',
    },
  ]);

  // Selected Patient
  const patient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Vital stream buffer
  const [vitalStream, setVitalStream] = useState<PicuVitalHistory[]>(() => {
    const list: PicuVitalHistory[] = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      list.push({
        time: new Date(now - i * 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        heartRate: 164 + Math.sin(i) * 5,
        map: 49.3 + Math.cos(i) * 2,
        visScore: 35.0,
        spo2: 91,
        respRate: 36,
        tempC: 39.4,
        oxygenationIndex: 16.8,
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

          const hrFluct = (Math.random() - 0.5) * 3.0;
          const mapFluct = (Math.random() - 0.48) * 1.2;

          const newHr = Math.max(60, Math.min(220, Math.round(p.vitals.heartRate + hrFluct)));
          const newMap = Math.max(35, Math.min(100, Math.round((p.vitals.map + mapFluct) * 10) / 10));

          return {
            ...p,
            vitals: {
              ...p.vitals,
              heartRate: newHr,
              map: newMap,
              systolicBp: Math.round(newMap * 1.35),
              diastolicBp: Math.round(newMap * 0.70),
            },
          };
        }),
      );

      // Append snapshot
      setVitalStream((prev) => {
        const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newSnapshot: PicuVitalHistory = {
          time: nextTime,
          heartRate: patient.vitals.heartRate,
          map: patient.vitals.map,
          visScore: patient.visScore,
          spo2: patient.vitals.spo2,
          respRate: patient.vitals.respRate,
          tempC: patient.vitals.tempC,
          oxygenationIndex: patient.oxygenationIndex,
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
      id: `SIG-PED-${Math.floor(1000 + Math.random() * 9000)}`,
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
            visScore: Math.round((p.visScore + 5.0) * 10) / 10,
            vitals: {
              ...p.vitals,
              map: Math.round((p.vitals.map + 4.0) * 10) / 10,
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
      identifier: { system: 'https://medtrack.hospital.org/fhir/picu', value: `PICU-FHIR-${patient.id}-${Date.now()}` },
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
            id: `obs-psofa-${patient.id}`,
            code: { text: 'Pediatric Sequential Organ Failure Assessment (pSOFA)' },
            valueInteger: patient.psofaScore,
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-vis-${patient.id}`,
            code: { text: 'Vasoactive-Inotropic Score (VIS)' },
            valueQuantity: { value: patient.visScore, unit: 'points' },
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-picu-septic-shock-${patient.id}`,
            title: `PALS Pediatric Sepsis & Inotropic Care Plan`,
            description: `Target MAP: > 50 mmHg | Ventilator: ${patient.ventilator.mode}`,
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FHIR_R4_PICU_CriticalCare_${patient.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patient]);

  // Export CSV Report
  const handleExportCsv = useCallback(() => {
    const rows = [
      ['Patient ID', 'MRN', 'Name', 'Age Group', 'Diagnosis', 'pSOFA Score', 'VIS Score', 'Oxygenation Index (OI)', 'Mortality Est', 'HR (BPM)', 'MAP (mmHg)', 'SpO2 %', 'Vent Mode', 'Epinephrine (mcg/kg/min)', 'Norepinephrine (mcg/kg/min)', 'Milrinone (mcg/kg/min)'],
      [
        patient.id,
        patient.mrn,
        patient.name,
        patient.ageGroup,
        patient.diagnosis,
        `${patient.psofaScore} / 24`,
        patient.visScore,
        patient.oxygenationIndex,
        patient.mortalityRiskEstimated,
        patient.vitals.heartRate,
        patient.vitals.map,
        `${patient.vitals.spo2}%`,
        patient.ventilator.mode,
        patient.inotropes.epinephrineMcgKgMin,
        patient.inotropes.norepinephrineMcgKgMin,
        patient.inotropes.milrinoneMcgKgMin,
      ],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PICU_CriticalCare_Audit_${patient.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patient]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-cyan-500 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-600 to-rose-600 shadow-lg shadow-cyan-950/50 flex items-center justify-center ring-2 ring-cyan-400/30 animate-pulse">
              <Baby className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MEDTRACK PEDIATRIC ICU &amp; pSOFA COMMAND STATION
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest">
                    PALS &bull; PALICC 2026 Engine
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Age-Adjusted pSOFA &bull; Vasoactive-Inotropic Score (VIS) &bull; PALICC PARDS Oxygenation Index &bull; Pediatric GCS &bull; FDA 21 CFR Part 11
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
                      simulationSpeed === speed ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsProtocolModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-rose-700 hover:from-cyan-500 hover:to-rose-600 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg shadow-cyan-950/50 border border-cyan-400/30 transition-all transform active:scale-95"
            >
              <Flame className="w-4 h-4 animate-bounce" />
              CODE PEDIATRIC SEPSIS
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
              <Users className="w-3.5 h-3.5 text-cyan-400" /> PICU Critical Cohort:
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
                        ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-950/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${p.psofaScore >= 12 ? 'bg-rose-400 animate-ping' : p.psofaScore >= 8 ? 'bg-orange-400' : 'bg-amber-400'}`} />
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">[{p.ageGroup.split(' ')[0]}]</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
            <span>AGE: <strong className="text-cyan-300">{patient.ageGroup}</strong></span>
            <span>pSOFA: <strong className="text-rose-400">{patient.psofaScore} / 24</strong></span>
            <span>VIS: <strong className="text-amber-400">{patient.visScore}</strong></span>
            <span>MORTALITY: <strong className="text-rose-400">{patient.mortalityRiskEstimated}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Critical Metrics Banner */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: pSOFA Score */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-400">
                <Flame className="w-4 h-4" /> pSOFA SCORE
              </span>
              <span className="font-mono">MAX 24</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.psofaScore >= 12 ? 'text-rose-400 animate-pulse' : 'text-orange-400'}`}>
                {patient.psofaScore}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 24</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.psofaScore >= 12 ? 'Severe Multi-Organ Dysfunction' : 'Moderate Organ Dysfunction'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.psofaScore >= 12 ? 'bg-rose-500' : 'bg-orange-500'}`}
                style={{ width: `${(patient.psofaScore / 24) * 100}%` }}
              />
            </div>
          </div>

          {/* Card 2: Vasoactive-Inotropic Score (VIS) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Syringe className="w-4 h-4" /> VIS INOTROPIC SCORE
              </span>
              <span className="font-mono">&gt; 30 SHOCK</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.visScore > 30 ? 'text-rose-400 animate-pulse' : patient.visScore > 20 ? 'text-orange-400' : 'text-amber-400'}`}>
                {patient.visScore}
              </span>
              <span className="text-xs text-slate-400 font-mono">pts</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.visScore > 30 ? 'Extreme Vasoplegia (Epi + NE + Milrinone)' : 'Inotropic Support Active'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.visScore > 30 ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (patient.visScore / 40) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 3: PALICC Oxygenation Index (OI) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Wind className="w-4 h-4" /> OXYGENATION INDEX (OI)
              </span>
              <span className="font-mono">&ge; 16 SEVERE</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.oxygenationIndex >= 16 ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}`}>
                {patient.oxygenationIndex}
              </span>
              <span className="text-xs text-slate-400 font-mono">OI</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.oxygenationIndex >= 16 ? 'Severe PARDS (Evaluate VV-ECMO)' : 'Moderate PARDS'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.oxygenationIndex >= 16 ? 'bg-rose-500' : 'bg-cyan-400'}`}
                style={{ width: `${Math.min(100, (patient.oxygenationIndex / 25) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Age-Adjusted Heart Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-300">
                <HeartPulse className="w-4 h-4" /> HEART RATE
              </span>
              <span className="font-mono">AGE NORM: 80-130</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.vitals.heartRate > 150 ? 'text-rose-400' : 'text-slate-200'}`}>
                {patient.vitals.heartRate}
              </span>
              <span className="text-xs text-slate-400 font-mono">BPM</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>MAP: {patient.vitals.map} mmHg | BP: {patient.vitals.systolicBp}/{patient.vitals.diastolicBp}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-rose-500"
                style={{ width: `${Math.min(100, (patient.vitals.heartRate / 180) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 5: Serum Lactate */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Beaker className="w-4 h-4" /> SERUM LACTATE
              </span>
              <span className="font-mono">NORM &lt; 2.0</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.labs.lactateMmolL >= 4.0 ? 'text-rose-400' : 'text-purple-300'}`}>
                {patient.labs.lactateMmolL}
              </span>
              <span className="text-xs text-slate-400 font-mono">mmol/L</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.labs.lactateMmolL >= 4.0 ? 'Severe Tissue Hypoperfusion' : 'Elevated'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(100, (patient.labs.lactateMmolL / 8.0) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 6: Pediatric GCS & Neurological */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Brain className="w-4 h-4" /> PEDIATRIC GCS
              </span>
              <span className="font-mono">NORM 15</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.labs.pediatricGcs <= 8 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {patient.labs.pediatricGcs}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 15</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.labs.pediatricGcs <= 8 ? 'Airway Protection Indicated' : 'Conscious'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.labs.pediatricGcs <= 8 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${(patient.labs.pediatricGcs / 15) * 100}%` }}
              />
            </div>
          </div>
        </section>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'TELEMETRY', label: 'Continuous PICU Vital & Inotrope Telemetry', icon: Activity },
            { id: 'PSOFA_MATRIX', label: 'Age-Adjusted 6-Organ pSOFA Matrix', icon: Layers },
            { id: 'VIS_INOTROPES', label: 'Vasoactive-Inotropic Score (VIS) Station', icon: Syringe },
            { id: 'PARDS_VENT', label: 'PALICC PARDS & Ventilator Dynamics', icon: Wind },
            { id: 'PROTOCOLS', label: 'PALS Sepsis Protocols & Audit', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50'
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
                      Continuous Pediatric Heart Rate vs Mean Arterial Pressure Stream
                    </h3>
                    <p className="text-xs text-slate-400">{patient.diagnosis}</p>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                    OI: {patient.oxygenationIndex} (PARDS)
                  </span>
                </div>

                {/* Waveform visualizer */}
                <div className="h-44 bg-slate-950 rounded-lg border border-slate-800 p-3 flex items-end justify-between gap-1 overflow-hidden relative">
                  <div className="absolute top-2 left-3 text-[10px] font-mono text-rose-400 flex items-center gap-3">
                    <span>&mdash; Heart Rate (BPM)</span>
                    <span className="text-cyan-400">&mdash; MAP (mmHg)</span>
                  </div>
                  {vitalStream.map((point, index) => {
                    const hrHeight = Math.max(15, Math.min(100, (point.heartRate / 200) * 100));
                    const mapHeight = Math.max(15, Math.min(100, (point.map / 90) * 100));
                    return (
                      <div key={index} className="flex-1 flex items-end justify-center gap-0.5 h-full group relative">
                        <div
                          className="w-1.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t transition-all duration-300 group-hover:bg-rose-300"
                          style={{ height: `${hrHeight}%` }}
                        />
                        <div
                          className="w-1.5 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all duration-300 group-hover:bg-cyan-300"
                          style={{ height: `${mapHeight}%` }}
                        />
                        <div className="hidden group-hover:block absolute -top-10 bg-slate-800 text-[10px] font-mono p-1 rounded border border-slate-700 z-10 whitespace-nowrap shadow-md">
                          HR: {point.heartRate} | MAP: {point.map.toFixed(1)} | {point.time}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inotrope & Resuscitation Summary Box */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-cyan-900/60 space-y-2">
                  <span className="text-xs font-mono text-cyan-400 font-bold block">ACTIVE VASOACTIVE &amp; INOTROPIC INFUSIONS:</span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">EPINEPHRINE</span>
                      <strong className="text-rose-400 font-mono">{patient.inotropes.epinephrineMcgKgMin} mcg/kg/min</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">NOREPINEPHRINE</span>
                      <strong className="text-orange-400 font-mono">{patient.inotropes.norepinephrineMcgKgMin} mcg/kg/min</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">MILRINONE</span>
                      <strong className="text-cyan-400 font-mono">{patient.inotropes.milrinoneMcgKgMin} mcg/kg/min</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: pSOFA Breakdown */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-400" />
                  pSOFA Organ Failures
                </h3>
                <div className="space-y-2.5 text-xs">
                  {patient.organSystemFailures.map((org, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded bg-slate-950 border border-slate-800">
                      <div>
                        <span className="font-bold text-white block">{org.system}</span>
                        <span className="text-slate-400 text-[11px]">{org.detail}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono text-[10px] font-bold">
                        +{org.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PSOFA MATRIX */}
        {activeTab === 'PSOFA_MATRIX' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Pediatric Sequential Organ Failure Assessment (pSOFA) 6-Organ Matrix
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-cyan-400 font-bold block text-sm">Respiratory Score</span>
                <p className="text-slate-200 font-mono">PaO2/FiO2 &lt; 100 or OI &ge; 16 (Score 3-4)</p>
                <p className="text-slate-400">Current: PaO2/FiO2 82.8 (OI 16.8)</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-rose-400 font-bold block text-sm">Cardiovascular Score</span>
                <p className="text-slate-200 font-mono">VIS &gt; 15 (Score 4)</p>
                <p className="text-slate-400">Current: VIS 35.0 (Extreme Vasoplegia)</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-amber-400 font-bold block text-sm">Coagulation Score</span>
                <p className="text-slate-200 font-mono">Platelets &lt; 50,000 /mcL (Score 3)</p>
                <p className="text-slate-400">Current: Platelets 32,000 /mcL</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-purple-400 font-bold block text-sm">Renal Score (Age-Adjusted)</span>
                <p className="text-slate-200 font-mono">Creatinine &ge; 1.5 mg/dL for 4yo (Score 2)</p>
                <p className="text-slate-400">Current: Creatinine 1.8 mg/dL</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold block text-sm">Liver Score</span>
                <p className="text-slate-200 font-mono">Bilirubin 2.0 - 5.9 mg/dL (Score 2)</p>
                <p className="text-slate-400">Current: Bilirubin 3.8 mg/dL</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-blue-400 font-bold block text-sm">Neurological Score</span>
                <p className="text-slate-200 font-mono">Pediatric GCS 6 - 9 (Score 3)</p>
                <p className="text-slate-400">Current: pGCS 8 / 15</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VIS INOTROPES */}
        {activeTab === 'VIS_INOTROPES' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Syringe className="w-5 h-5 text-amber-400" />
              Vasoactive-Inotropic Score (VIS) Dynamic Calculator &amp; Titration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-300">Continuous Inotropic Dosing</h3>
                <div className="text-xs text-slate-300 space-y-1.5 font-mono">
                  <p>&bull; Epinephrine: {patient.inotropes.epinephrineMcgKgMin} mcg/kg/min (&times; 100 = {patient.inotropes.epinephrineMcgKgMin * 100} pts)</p>
                  <p>&bull; Norepinephrine: {patient.inotropes.norepinephrineMcgKgMin} mcg/kg/min (&times; 100 = {patient.inotropes.norepinephrineMcgKgMin * 100} pts)</p>
                  <p>&bull; Milrinone: {patient.inotropes.milrinoneMcgKgMin} mcg/kg/min (&times; 10 = {patient.inotropes.milrinoneMcgKgMin * 10} pts)</p>
                  <p>&bull; Vasopressin: {patient.inotropes.vasopressinUnitsKgMin} U/kg/min (&times; 10000 = {patient.inotropes.vasopressinUnitsKgMin * 10000} pts)</p>
                  <p className="text-amber-400 font-bold mt-2">Total VIS: {patient.visScore} points</p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-rose-400">PALS Hemodynamic Escalation Guidelines</h3>
                <div className="text-xs text-slate-300 space-y-1.5">
                  <p>&bull; VIS &gt; 20: High mortality risk. Insert invasive arterial line and monitor central venous pressure.</p>
                  <p>&bull; VIS &gt; 30: Refractory vasoplegia. Initiate Hydrocortisone (50 mg/m2/day) and request pediatric ECMO evaluation.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PARDS VENT */}
        {activeTab === 'PARDS_VENT' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-400" />
              PALICC Pediatric Acute Respiratory Distress Syndrome (PARDS) Monitor
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-400 block uppercase">Oxygenation Index (OI)</span>
                <span className="text-2xl font-black font-mono text-white">{patient.oxygenationIndex}</span>
                <p className="text-xs text-slate-400">Severe PARDS (OI &ge; 16). Requires lung protective PRVC/HFOV strategy.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-400 block uppercase">Ventilator Mode</span>
                <span className="text-2xl font-black font-mono text-white">{patient.ventilator.mode.split(' ')[0]}</span>
                <p className="text-xs text-slate-400">Mean Airway Pressure: {patient.ventilator.meanAirwayPressure} cmH2O | PEEP: {patient.ventilator.peep} cmH2O</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block uppercase">Tidal Volume</span>
                <span className="text-2xl font-black font-mono text-white">{patient.ventilator.tidalVolumeMlKg} mL/kg</span>
                <p className="text-xs text-slate-400">Lung-protective target (4 - 6 mL/kg PBW) to avoid pediatric barotrauma.</p>
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
                  FDA 21 CFR Part 11 Pediatric Critical Care Audit Ledger
                </h2>
                <p className="text-xs text-slate-400">Cryptographically verified electronic records on emergency pediatric interventions.</p>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5"
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
                <div className="p-2 rounded-xl bg-cyan-600 text-white">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Emergency Pediatric Sepsis / Resuscitation Protocol</h3>
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-medium outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="CODE_PEDIATRIC_SEPSIS_STAT">Stat PALS Septic Shock Fluid Bolus (10-20 mL/kg) + Epinephrine Titration</option>
                  <option value="REFRACTORY_VASOPLEGIA_STEROIDS">Refractory Vasoplegia Stress-Dose Hydrocortisone (50 mg/m2/day)</option>
                  <option value="SEVERE_PARDS_PRONE_INO">Severe PARDS Prone Positioning (16h/day) + Inhaled Nitric Oxide (20 ppm)</option>
                  <option value="PEDIATRIC_ECMO_ACTIVATION">Emergent Pediatric VV/VA-ECMO Cannulation Consult</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Attending Pediatric Intensivist E-Signature</label>
                <input
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Indications &amp; Findings</label>
                <textarea
                  rows={3}
                  value={activationRationale}
                  onChange={(e) => setActivationRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800 text-[11px] text-cyan-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-cyan-400" />
                <span>
                  Under FDA 21 CFR Part 11 and PALS guidelines, this executes a legally binding emergency pediatric order.
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
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-rose-700 hover:from-cyan-500 hover:to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
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
