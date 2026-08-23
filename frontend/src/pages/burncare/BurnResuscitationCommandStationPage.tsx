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

interface BurnVitalHistory {
  time: string;
  infusionRateMlHr: number;
  urineOutputMl: number;
  map: number;
  heartRate: number;
  iapMmHg: number;
  tempC: number;
  spo2: number;
}

interface BurnPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: string;
  location: string;
  mechanism: string;
  tbsaPercent: number;
  weightKg: number;
  timeSinceBurnHours: number;
  severity: 'CRITICAL_MAJOR_BURN' | 'MODERATE_BURN' | 'ELECTRICAL_HIGH_VOLTAGE' | 'INHALATION_INJURY';
  resuscitationFormula: 'PARKLAND' | 'MODIFIED_BROOKE' | 'GALVESTON_PEDIATRIC';
  calculated24hFluidMl: number;
  first8hTargetMl: number;
  next16hTargetMl: number;
  fluidAdministeredMl: number;
  currentInfusionRateMlHr: number;
  hourlyUrineOutputMl: number;
  targetUoMinMlHr: number;
  targetUoMaxMlHr: number;
  map: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  tempC: number;
  spo2: number;
  fio2: number;
  pao2: number;
  carboxyhemoglobinPercent: number;
  inhalationGrade: string;
  intraAbdominalPressureMmHg: number;
  lactate: number;
  creatinine: number;
  compartmentPressures: {
    rightForearm: number;
    leftForearm: number;
    rightThigh: number;
    leftThigh: number;
  };
  burnDistribution: Array<{
    region: string;
    depth: string;
    pct: number;
  }>;
}

const BURN_PATIENTS_DATABASE: BurnPatient[] = [
  {
    id: 'BURN-501',
    mrn: 'BRN-209841',
    name: 'Captain Marcus Bennett',
    ageYears: 42,
    sex: 'Male',
    location: 'Burn ICU - Bed 01',
    mechanism: 'Industrial Flash Fire & Closed-Space Smoke Inhalation',
    tbsaPercent: 45,
    weightKg: 80,
    timeSinceBurnHours: 4.5,
    severity: 'CRITICAL_MAJOR_BURN',
    resuscitationFormula: 'PARKLAND',
    calculated24hFluidMl: 14400,
    first8hTargetMl: 7200,
    next16hTargetMl: 7200,
    fluidAdministeredMl: 4800,
    currentInfusionRateMlHr: 900,
    hourlyUrineOutputMl: 38,
    targetUoMinMlHr: 40,
    targetUoMaxMlHr: 80,
    map: 68,
    heartRate: 118,
    systolicBp: 98,
    diastolicBp: 54,
    tempC: 35.8,
    spo2: 96,
    fio2: 0.50,
    pao2: 92,
    carboxyhemoglobinPercent: 12.4,
    inhalationGrade: 'AIS Grade 3 (Severe Mucosal Ulceration)',
    intraAbdominalPressureMmHg: 16,
    lactate: 3.8,
    creatinine: 1.4,
    compartmentPressures: {
      rightForearm: 22,
      leftForearm: 18,
      rightThigh: 16,
      leftThigh: 15,
    },
    burnDistribution: [
      { region: 'Anterior Trunk', depth: 'Full Thickness (3rd Deg)', pct: 14 },
      { region: 'Posterior Trunk', depth: 'Deep Partial (2nd Deg)', pct: 12 },
      { region: 'Right Upper Extremity', depth: 'Full Thickness Circumferential', pct: 9 },
      { region: 'Left Upper Extremity', depth: 'Deep Partial', pct: 6 },
      { region: 'Head & Neck', depth: 'Partial Thickness', pct: 4 },
    ],
  },
  {
    id: 'BURN-502',
    mrn: 'BRN-774120',
    name: 'Helena Gutierrez',
    ageYears: 68,
    sex: 'Female',
    location: 'Burn ICU - Bed 03',
    mechanism: 'Domestic Natural Gas Explosion & Scald Injury',
    tbsaPercent: 55,
    weightKg: 65,
    timeSinceBurnHours: 7.0,
    severity: 'CRITICAL_MAJOR_BURN',
    resuscitationFormula: 'MODIFIED_BROOKE',
    calculated24hFluidMl: 7150,
    first8hTargetMl: 3575,
    next16hTargetMl: 3575,
    fluidAdministeredMl: 3900,
    currentInfusionRateMlHr: 450,
    hourlyUrineOutputMl: 42,
    targetUoMinMlHr: 32.5,
    targetUoMaxMlHr: 65.0,
    map: 72,
    heartRate: 104,
    systolicBp: 108,
    diastolicBp: 58,
    tempC: 36.4,
    spo2: 94,
    fio2: 0.40,
    pao2: 86,
    carboxyhemoglobinPercent: 4.2,
    inhalationGrade: 'AIS Grade 1 (Mild Erythema)',
    intraAbdominalPressureMmHg: 19,
    lactate: 2.9,
    creatinine: 1.8,
    compartmentPressures: {
      rightForearm: 14,
      leftForearm: 15,
      rightThigh: 20,
      leftThigh: 19,
    },
    burnDistribution: [
      { region: 'Anterior Trunk', depth: 'Full Thickness', pct: 16 },
      { region: 'Posterior Trunk', depth: 'Deep Partial', pct: 15 },
      { region: 'Right Lower Extremity', depth: 'Deep Partial', pct: 12 },
      { region: 'Left Lower Extremity', depth: 'Deep Partial', pct: 12 },
    ],
  },
  {
    id: 'BURN-503',
    mrn: 'BRN-902184',
    name: 'Lucas Campbell',
    ageYears: 29,
    sex: 'Male',
    location: 'Burn Trauma Bay 02',
    mechanism: '13.8 kV High-Voltage Electrical Contact',
    tbsaPercent: 28,
    weightKg: 85,
    timeSinceBurnHours: 2.0,
    severity: 'ELECTRICAL_HIGH_VOLTAGE',
    resuscitationFormula: 'PARKLAND',
    calculated24hFluidMl: 9520,
    first8hTargetMl: 4760,
    next16hTargetMl: 4760,
    fluidAdministeredMl: 2200,
    currentInfusionRateMlHr: 1100,
    hourlyUrineOutputMl: 115,
    targetUoMinMlHr: 85,
    targetUoMaxMlHr: 130,
    map: 84,
    heartRate: 128,
    systolicBp: 122,
    diastolicBp: 68,
    tempC: 37.0,
    spo2: 98,
    fio2: 0.30,
    pao2: 104,
    carboxyhemoglobinPercent: 1.8,
    inhalationGrade: 'AIS Grade 0 (None)',
    intraAbdominalPressureMmHg: 12,
    lactate: 4.2,
    creatinine: 2.1,
    compartmentPressures: {
      rightForearm: 36, // Emergency Escharotomy Trigger (> 30 mmHg)
      leftForearm: 14,
      rightThigh: 24,
      leftThigh: 16,
    },
    burnDistribution: [
      { region: 'Right Upper Extremity (Entrance)', depth: 'Full Thickness / Charred', pct: 9 },
      { region: 'Right Lower Extremity (Exit)', depth: 'Full Thickness', pct: 11 },
      { region: 'Anterior Trunk', depth: 'Deep Partial', pct: 8 },
    ],
  },
];

export default function BurnResuscitationCommandStationPage() {
  const [patients, setPatients] = useState<BurnPatient[]>(BURN_PATIENTS_DATABASE);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('BURN-501');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'TBSA_MAP' | 'PARKLAND_SCHEDULE' | 'IAP_CREEP' | 'PROTOCOLS'>('TELEMETRY');

  // Protocol Modal State
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false);
  const [selectedProtocolToTrigger, setSelectedProtocolToTrigger] = useState<string>('CODE_BURN_ESCHAROTOMY');
  const [clinicianId, setClinicianId] = useState<string>('MD-BURN-4491 (Dr. Allison Cross)');
  const [activationRationale, setActivationRationale] = useState<string>('Circumferential full-thickness forearm burn with compartment pressure 36 mmHg (> 30 mmHg threshold) & loss of radial Doppler signal.');
  const [signatureLogs, setSignatureLogs] = useState<Array<{ id: string; time: string; signer: string; protocol: string; hash: string }>>([
    {
      id: 'SIG-BRN-801',
      time: new Date(Date.now() - 1000 * 60 * 25).toLocaleTimeString(),
      signer: 'Dr. Allison Cross (MD-BURN-4491)',
      protocol: 'ABA Parkland Resuscitation & Inhalation Protocol Activation',
      hash: 'f9c2a10e8293dd41f8742ca910d65b7194c2510f92b74c0b62e49c71629fa812',
    },
  ]);

  // Selected Patient
  const patient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Fluid creep metric
  const fluidCreepRatio = useMemo(() => {
    return Math.round((patient.fluidAdministeredMl / patient.weightKg) * 10) / 10;
  }, [patient.fluidAdministeredMl, patient.weightKg]);

  // Vital stream buffer
  const [vitalStream, setVitalStream] = useState<BurnVitalHistory[]>(() => {
    const list: BurnVitalHistory[] = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      list.push({
        time: new Date(now - i * 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        infusionRateMlHr: 900,
        urineOutputMl: 38 + Math.sin(i) * 4,
        map: 68 + Math.cos(i) * 2,
        heartRate: 118 + Math.sin(i) * 3,
        iapMmHg: 16,
        tempC: 35.8,
        spo2: 96,
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

          const uoFluct = (Math.random() - 0.5) * 3.0;
          const mapFluct = (Math.random() - 0.5) * 1.5;
          const hrFluct = (Math.random() - 0.5) * 2.0;

          const newUo = Math.max(10, Math.min(250, Math.round(p.hourlyUrineOutputMl + uoFluct)));
          const newMap = Math.max(50, Math.min(115, Math.round((p.map + mapFluct) * 10) / 10));
          const newHr = Math.max(50, Math.min(160, Math.round(p.heartRate + hrFluct)));
          const newFluidsGiven = p.fluidAdministeredMl + Math.round(p.currentInfusionRateMlHr / 40);

          return {
            ...p,
            hourlyUrineOutputMl: newUo,
            map: newMap,
            heartRate: newHr,
            fluidAdministeredMl: newFluidsGiven,
            systolicBp: Math.round(newMap * 1.25 + (Math.random() * 2 - 1)),
            diastolicBp: Math.round(newMap * 0.75 + (Math.random() * 2 - 1)),
          };
        }),
      );

      // Append snapshot
      setVitalStream((prev) => {
        const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newSnapshot: BurnVitalHistory = {
          time: nextTime,
          infusionRateMlHr: patient.currentInfusionRateMlHr,
          urineOutputMl: patient.hourlyUrineOutputMl,
          map: patient.map,
          heartRate: patient.heartRate,
          iapMmHg: patient.intraAbdominalPressureMmHg,
          tempC: patient.tempC,
          spo2: patient.spo2,
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
      id: `SIG-BRN-${Math.floor(1000 + Math.random() * 9000)}`,
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
            compartmentPressures: {
              ...p.compartmentPressures,
              rightForearm: selectedProtocolToTrigger === 'CODE_BURN_ESCHAROTOMY' ? 14 : p.compartmentPressures.rightForearm,
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
      identifier: { system: 'https://medtrack.hospital.org/fhir/burn-care', value: `BRN-FHIR-${patient.id}-${Date.now()}` },
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
            id: `obs-tbsa-${patient.id}`,
            code: { text: 'Total Body Surface Area Burned' },
            valueQuantity: { value: patient.tbsaPercent, unit: '%' },
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-iap-${patient.id}`,
            code: { text: 'Intra-Abdominal Bladder Pressure' },
            valueQuantity: { value: patient.intraAbdominalPressureMmHg, unit: 'mmHg' },
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-burn-parkland-${patient.id}`,
            title: `ABA ${patient.resuscitationFormula} Resuscitation Care Plan`,
            description: `Calculated 24h: ${patient.calculated24hFluidMl} mL | Infusing: ${patient.currentInfusionRateMlHr} mL/hr`,
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FHIR_R4_Burn_Resuscitation_${patient.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patient]);

  // Export CSV Report
  const handleExportCsv = useCallback(() => {
    const rows = [
      ['Patient ID', 'MRN', 'Name', 'Mechanism', 'TBSA %', 'Weight (kg)', 'Formula', '24h Target (mL)', 'Fluids Given (mL)', 'Infusion Rate (mL/h)', 'Urine Output (mL/h)', 'MAP (mmHg)', 'HR (BPM)', 'IAP (mmHg)', 'Fluid Creep Ratio (mL/kg)'],
      [
        patient.id,
        patient.mrn,
        patient.name,
        patient.mechanism,
        `${patient.tbsaPercent}%`,
        patient.weightKg,
        patient.resuscitationFormula,
        patient.calculated24hFluidMl,
        patient.fluidAdministeredMl,
        patient.currentInfusionRateMlHr,
        patient.hourlyUrineOutputMl,
        patient.map,
        patient.heartRate,
        patient.intraAbdominalPressureMmHg,
        `${fluidCreepRatio} mL/kg`,
      ],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Burn_Resuscitation_Audit_${patient.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patient, fluidCreepRatio]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-amber-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-600 to-rose-600 shadow-lg shadow-amber-950/50 flex items-center justify-center ring-2 ring-amber-400/30 animate-pulse">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MEDTRACK BURN CRITICAL CARE COMMAND STATION
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
                    ABA 2026 Resuscitation Engine
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Parkland / Modified Brooke &bull; Dynamic Hourly UO Titration &bull; Fluid Creep &amp; IACS Guard &bull; Inhalation AIS &bull; FDA 21 CFR Part 11
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
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-red-700 hover:from-amber-500 hover:to-red-600 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg shadow-amber-950/50 border border-amber-400/30 transition-all transform active:scale-95"
            >
              <Flame className="w-4 h-4 animate-bounce" />
              CODE BURN PROTOCOL
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
              <Users className="w-3.5 h-3.5 text-amber-400" /> Burn ICU Cohort:
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
                    <span className={`w-2 h-2 rounded-full ${p.tbsaPercent >= 40 ? 'bg-rose-400 animate-ping' : 'bg-amber-400'}`} />
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">[{p.tbsaPercent}% TBSA]</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
            <span>MRN: <strong className="text-slate-200">{patient.mrn}</strong></span>
            <span>WEIGHT: <strong className="text-cyan-400">{patient.weightKg} kg</strong></span>
            <span>TIME: <strong className="text-amber-400">T+{patient.timeSinceBurnHours}h Post-Burn</strong></span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Critical Metrics Banner */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: TBSA Burn Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Flame className="w-4 h-4" /> TOTAL BURN AREA
              </span>
              <span className="font-mono">TBSA %</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-amber-400">
                {patient.tbsaPercent}%
              </span>
              <span className="text-xs text-slate-400 font-mono">TBSA</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.tbsaPercent >= 40 ? 'Critical Major Thermal Injury' : 'Moderate Burn Area'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${patient.tbsaPercent}%` }}
              />
            </div>
          </div>

          {/* Card 2: Hourly Urine Output Target */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Droplet className="w-4 h-4" /> HOURLY URINE OUTPUT
              </span>
              <span className="font-mono">GOAL: {patient.targetUoMinMlHr}-{patient.targetUoMaxMlHr}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.hourlyUrineOutputMl < patient.targetUoMinMlHr ? 'text-rose-400' : 'text-emerald-400'}`}>
                {patient.hourlyUrineOutputMl}
              </span>
              <span className="text-xs text-slate-400 font-mono">mL/hr</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>STATUS:</span>
              <span className={`font-semibold ${patient.hourlyUrineOutputMl < patient.targetUoMinMlHr ? 'text-rose-400' : 'text-emerald-400'}`}>
                {patient.hourlyUrineOutputMl < patient.targetUoMinMlHr ? 'OLIGURIC (+25% Rate)' : 'ON TARGET'}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.hourlyUrineOutputMl < patient.targetUoMinMlHr ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (patient.hourlyUrineOutputMl / patient.targetUoMaxMlHr) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 3: Crystalloid Infusion Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Syringe className="w-4 h-4" /> CURRENT INFUSION
              </span>
              <span className="font-mono">{patient.resuscitationFormula}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-cyan-300">
                {patient.currentInfusionRateMlHr}
              </span>
              <span className="text-xs text-slate-400 font-mono">mL/hr</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>24h GIVEN: {patient.fluidAdministeredMl} mL</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${Math.min(100, (patient.fluidAdministeredMl / patient.calculated24hFluidMl) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Intra-Abdominal Pressure (IAP) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Gauge className="w-4 h-4" /> BLADDER PRESSURE (IAP)
              </span>
              <span className="font-mono">NORM &lt; 12</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.intraAbdominalPressureMmHg >= 20 ? 'text-rose-400 animate-pulse' : patient.intraAbdominalPressureMmHg >= 16 ? 'text-orange-400' : 'text-purple-300'}`}>
                {patient.intraAbdominalPressureMmHg}
              </span>
              <span className="text-xs text-slate-400 font-mono">mmHg</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.intraAbdominalPressureMmHg >= 20 ? 'Abdominal Compartment Syndrome' : patient.intraAbdominalPressureMmHg >= 16 ? 'Grade II IAH (Fluid Creep Warning)' : 'Normal IAP'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.intraAbdominalPressureMmHg >= 20 ? 'bg-rose-500' : patient.intraAbdominalPressureMmHg >= 16 ? 'bg-orange-500' : 'bg-purple-500'}`}
                style={{ width: `${Math.min(100, (patient.intraAbdominalPressureMmHg / 25) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 5: Inhalation COHb & Airway */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-400">
                <Wind className="w-4 h-4" /> CARBOXYHEMOGLOBIN
              </span>
              <span className="font-mono">COHb &lt; 3%</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.carboxyhemoglobinPercent > 10 ? 'text-rose-400' : 'text-slate-200'}`}>
                {patient.carboxyhemoglobinPercent}%
              </span>
              <span className="text-xs text-slate-400 font-mono">COHb</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.inhalationGrade}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-rose-500"
                style={{ width: `${Math.min(100, (patient.carboxyhemoglobinPercent / 20) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 6: Core Temperature */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Thermometer className="w-4 h-4" /> CORE TEMP
              </span>
              <span className="font-mono">NORM 36.5-37.5</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.tempC < 36.0 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {patient.tempC}&deg;C
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.tempC < 36.0 ? 'Hypothermia: Active Warming Indicated' : 'Normothermic'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, ((patient.tempC - 34) / 4.0) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'TELEMETRY', label: 'Resuscitation Telemetry & Dynamic UO', icon: Activity },
            { id: 'TBSA_MAP', label: 'Lund-Browder & TBSA Distribution', icon: Flame },
            { id: 'PARKLAND_SCHEDULE', label: 'Parkland 24h Fluid Schedule', icon: Timer },
            { id: 'IAP_CREEP', label: 'Intra-Abdominal Pressure & Fluid Creep', icon: Gauge },
            { id: 'PROTOCOLS', label: 'Escharotomy & Clinical Protocols', icon: ShieldCheck },
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
                      Continuous Crystalloid Infusion vs Hourly Urine Output Titration Stream
                    </h3>
                    <p className="text-xs text-slate-400">{patient.mechanism}</p>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                    FLUID RATIO: {fluidCreepRatio} mL/kg
                  </span>
                </div>

                {/* Waveform visualizer */}
                <div className="h-44 bg-slate-950 rounded-lg border border-slate-800 p-3 flex items-end justify-between gap-1 overflow-hidden relative">
                  <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-400 flex items-center gap-3">
                    <span>&mdash; Infusion Rate (mL/h)</span>
                    <span className="text-amber-400">&mdash; Hourly Urine Output (mL/h)</span>
                  </div>
                  {vitalStream.map((point, index) => {
                    const rateHeight = Math.max(15, Math.min(100, (point.infusionRateMlHr / 1200) * 100));
                    const uoHeight = Math.max(15, Math.min(100, (point.urineOutputMl / 100) * 100));
                    return (
                      <div key={index} className="flex-1 flex items-end justify-center gap-0.5 h-full group relative">
                        <div
                          className="w-1.5 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all duration-300 group-hover:bg-cyan-300"
                          style={{ height: `${rateHeight}%` }}
                        />
                        <div
                          className="w-1.5 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t transition-all duration-300 group-hover:bg-amber-300"
                          style={{ height: `${uoHeight}%` }}
                        />
                        <div className="hidden group-hover:block absolute -top-10 bg-slate-800 text-[10px] font-mono p-1 rounded border border-slate-700 z-10 whitespace-nowrap shadow-md">
                          Rate: {point.infusionRateMlHr} mL/h | UO: {Math.round(point.urineOutputMl)} mL/h | {point.time}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Extremity Compartment Pressures Box */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-amber-900/60 space-y-2">
                  <span className="text-xs font-mono text-amber-400 font-bold block">INVASIVE EXTREMITY COMPARTMENT PRESSURES:</span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className={`p-2 rounded border ${patient.compartmentPressures.rightForearm > 30 ? 'bg-rose-950 border-rose-500 text-rose-300 font-bold animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
                      <span className="text-[10px] text-slate-500 block">R FOREARM</span>
                      {patient.compartmentPressures.rightForearm} mmHg
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      <span className="text-[10px] text-slate-500 block">L FOREARM</span>
                      {patient.compartmentPressures.leftForearm} mmHg
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      <span className="text-[10px] text-slate-500 block">R THIGH</span>
                      {patient.compartmentPressures.rightThigh} mmHg
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      <span className="text-[10px] text-slate-500 block">L THIGH</span>
                      {patient.compartmentPressures.leftThigh} mmHg
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Resuscitation Summary */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-cyan-400" />
                  Resuscitation Fluid Dynamics
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Total 24h Target</span>
                    <span className="font-mono font-bold text-cyan-400">{patient.calculated24hFluidMl} mL</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">First 8h Target</span>
                    <span className="font-mono font-bold text-cyan-400">{patient.first8hTargetMl} mL</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Current Infused Total</span>
                    <span className="font-mono font-bold text-amber-400">{patient.fluidAdministeredMl} mL</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Bladder Pressure (IAP)</span>
                    <span className="font-mono font-bold text-purple-400">{patient.intraAbdominalPressureMmHg} mmHg</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Serum Lactate</span>
                    <span className="font-mono font-bold text-rose-400">{patient.lactate} mmol/L</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TBSA BODY MAP */}
        {activeTab === 'TBSA_MAP' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              Lund-Browder Anatomic Burn Distribution &amp; Depth Stratification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {patient.burnDistribution.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block text-sm">{item.region}</span>
                      <span className="text-slate-400">{item.depth}</span>
                    </div>
                    <span className="text-base font-black font-mono text-amber-400 px-3 py-1 rounded bg-slate-900 border border-amber-900/60">
                      {item.pct}% TBSA
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-xs">
                <h3 className="text-sm font-bold text-white">Rule of Nines Anatomic Breakdown</h3>
                <div className="space-y-1.5 text-slate-300 font-mono">
                  <p>&bull; Head &amp; Neck: 9% (4.5% Anterior, 4.5% Posterior)</p>
                  <p>&bull; Anterior Trunk: 18% (Chest 9%, Abdomen 9%)</p>
                  <p>&bull; Posterior Trunk: 18% (Upper Back 9%, Lower Back 9%)</p>
                  <p>&bull; Upper Extremities: 18% (9% each arm)</p>
                  <p>&bull; Lower Extremities: 36% (18% each leg)</p>
                  <p>&bull; Perineum &amp; Genitalia: 1%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PARKLAND RESUSCITATION SCHEDULE */}
        {activeTab === 'PARKLAND_SCHEDULE' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Timer className="w-5 h-5 text-cyan-400" />
              24-Hour Resuscitation Timeline &amp; Fluid Partitioning
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-cyan-300">First 8 Hours (50% of 24h Volume)</h3>
                <div className="text-xs text-slate-300 space-y-2">
                  <p>Target Volume: <strong className="text-white font-mono">{patient.first8hTargetMl} mL</strong></p>
                  <p>Starting Infusion Rate: <strong className="text-white font-mono">{Math.round(patient.first8hTargetMl / 8)} mL/hr</strong></p>
                  <p className="text-slate-400">Note: Calculated from the exact time of burn injury, not hospital arrival time.</p>
                </div>
              </div>
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-300">Next 16 Hours (Remaining 50%)</h3>
                <div className="text-xs text-slate-300 space-y-2">
                  <p>Target Volume: <strong className="text-white font-mono">{patient.next16hTargetMl} mL</strong></p>
                  <p>Starting Infusion Rate: <strong className="text-white font-mono">{Math.round(patient.next16hTargetMl / 16)} mL/hr</strong></p>
                  <p className="text-slate-400">Dynamic titration continues based on hourly urine output and end-organ perfusion.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: IAP & FLUID CREEP */}
        {activeTab === 'IAP_CREEP' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Gauge className="w-5 h-5 text-purple-400" />
              Intra-Abdominal Pressure (IAP) &amp; Fluid Creep Surveillance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-400 block uppercase">Bladder Pressure</span>
                <span className="text-2xl font-black font-mono text-white">{patient.intraAbdominalPressureMmHg} mmHg</span>
                <p className="text-xs text-slate-400">Grade II IAH (16-20 mmHg). Initiate Albumin colloid rescue to prevent full abdominal compartment syndrome.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-400 block uppercase">Fluid Creep Ratio</span>
                <span className="text-2xl font-black font-mono text-white">{fluidCreepRatio} mL/kg</span>
                <p className="text-xs text-slate-400">Cumulative resuscitation fluid &gt; 250 mL/kg triggers severe edema and secondary compartment syndrome warning.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-rose-400 block uppercase">Surgical Decompression Trigger</span>
                <span className="text-2xl font-black font-mono text-white">&gt; 20 mmHg</span>
                <p className="text-xs text-slate-400">Sustained IAP &gt; 20 mmHg with new oliguria or ventilatory failure requires stat decompressive laparotomy.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PROTOCOLS */}
        {activeTab === 'PROTOCOLS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  FDA 21 CFR Part 11 Burn Critical Care Clinical Audit Ledger
                </h2>
                <p className="text-xs text-slate-400">Cryptographically verified digital audit logs for emergency burn interventions.</p>
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
                  <h3 className="text-base font-bold text-white">Emergency Burn Resuscitation Protocol</h3>
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
                <label className="block text-slate-300 font-semibold mb-1">Select Resuscitation / Surgical Protocol</label>
                <select
                  value={selectedProtocolToTrigger}
                  onChange={(e) => setSelectedProtocolToTrigger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="CODE_BURN_ESCHAROTOMY">Emergency Bedside Escharotomy / Fasciotomy (Compartment Pressure &gt; 30 mmHg)</option>
                  <option value="ALBUMIN_COLLOID_RESCUE">5% Albumin Colloid Rescue Protocol (Fluid Creep &amp; IAP &gt; 16 mmHg)</option>
                  <option value="INHALATION_ARDS_BRONCH">Inhalation Injury Bronchoscopy &amp; ARDSNet Lung Protection</option>
                  <option value="MYOGLOBINURIA_BICARB">Electrical Burn Bicarbonate Alkalinization Protocol</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Burn Critical Care Surgeon E-Signature</label>
                <input
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Rationale &amp; Findings</label>
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
                  Under FDA 21 CFR Part 11 and ABA guidelines, this action executes a high-assurance burn surgical resuscitation order.
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
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-red-700 hover:from-amber-500 hover:to-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <FileCheck className="w-4 h-4" />
                Sign &amp; Execute Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
