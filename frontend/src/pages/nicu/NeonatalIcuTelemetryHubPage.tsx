import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Activity,
  Heart,
  Zap,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  Download,
  Search,
  Filter,
  Flame,
  Radio,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Info,
  Droplets,
  Layers,
  Thermometer,
  Wind,
  PlusCircle,
  Eye,
  Sliders,
  Cpu,
  RefreshCw,
  X,
  Stethoscope,
  Sparkles,
  Baby,
  Snowflake,
  Waves,
  Gauge,
  Syringe,
  AlertOctagon,
  LifeBuoy,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * Clinical Interfaces & Telemetry Models
 * ───────────────────────────────────────────────────────────── */

export interface NeonatalVitals {
  timestamp: string;
  heartRate: number;
  respRate: number;
  preDuctalSpO2: number;
  postDuctalSpO2: number;
  map: number;
  systolicBp: number;
  diastolicBp: number;
  cvp: number;
  coreTempC: number;
  skinTempC: number;
  etCO2: number;
  paO2: number;
  paCO2: number;
  ph: number;
  baseExcess: number;
  lactateMmolL: number;
  plateletsK: number;
  urineOutputMlKgHr: number;
  glucoseMgDl: number;
  totalBilirubinMgDl: number;
}

export interface MedicationOrder {
  name: string;
  dose: string;
  indication: string;
  route?: string;
}

export interface HypothermiaState {
  isCooling: boolean;
  phase: "NONE" | "INDUCTION" | "MAINTENANCE" | "REWARMING" | "NORMOTHERMIA";
  elapsedCoolingHours: number;
  targetCoreTemp: number;
  actualCoreTemp: number;
  rewarmingRatePerHour: number;
  aEEGPattern:
    | "CONTINUOUS_NORMAL_VOLTAGE"
    | "DISCONTINUOUS_NORMAL_VOLTAGE"
    | "DISCONTINUOUS_LOW_VOLTAGE"
    | "BURST_SUPPRESSION"
    | "CONTINUOUS_LOW_VOLTAGE";
}

export interface HfovSettings {
  mapCmH2O: number;
  amplitudeDeltaP: number;
  frequencyHz: number;
  fio2: number;
  iToERatio: string;
  iNO_PPM?: number;
}

export interface SimvSettings {
  pipCmH2O: number;
  peepCmH2O: number;
  rateBpm: number;
  fio2: number;
  tidalVolumeMlKg: number;
}

export interface CpapSettings {
  peepCmH2O: number;
  fio2: number;
  flowLpm: number;
}

export interface NeonatalPatient {
  id: string;
  mrn: string;
  name: string;
  sex: "MALE" | "FEMALE";
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  currentWeightGrams: number;
  chronologicalAgeDays: number;
  correctedGABirthWeeks: number;
  bedNumber: string;
  incubatorType: string;
  primaryDiagnosis: string;
  acuityTier: "CRITICAL" | "EMERGENCY_COOLING" | "HIGH_RISK" | "STABLE" | "CODE_BLUE";
  respiratorySupport: "HFOV" | "HFOV_PLUS_INO" | "CONVENTIONAL_SIMV" | "NIV_NCPAP" | "ROOM_AIR";
  hfovSettings?: HfovSettings;
  simvSettings?: SimvSettings;
  cpapSettings?: CpapSettings;
  hypothermiaStatus: HypothermiaState;
  currentVitals: NeonatalVitals;
  medications: MedicationOrder[];
  nSofaScore: number;
  snappeIIScore: number;
  oxygenationIndex: number;
  inotropicScoreVIS: number;
  ductalGradient: number;
  bellsNecStage: string;
  sarnatHieStage: string;
}

export interface ClinicalAlarm {
  id: string;
  patientId: string;
  patientName: string;
  severity: "CRITICAL" | "HIGH" | "WARNING" | "INFO";
  triggerParameter: string;
  measuredValue: string;
  targetRange: string;
  clinicalMeaning: string;
  suggestedAction: string;
  timestamp: string;
  acknowledged: boolean;
}

/* ─────────────────────────────────────────────────────────────
 * Initial Patient Fixtures
 * ───────────────────────────────────────────────────────────── */

const INITIAL_PATIENTS: NeonatalPatient[] = [
  {
    id: "NEO-001",
    mrn: "NICU-892401",
    name: "Baby Boy Henderson",
    sex: "MALE",
    gestationalAgeWeeks: 25.4,
    birthWeightGrams: 740,
    currentWeightGrams: 785,
    chronologicalAgeDays: 4,
    correctedGABirthWeeks: 26.0,
    bedNumber: "NICU-POD-A-01",
    incubatorType: "Dräger Isolette 8000 Plus",
    primaryDiagnosis: "Extreme Prematurity, RDS Stage IV, Hemodynamically Significant PDA",
    acuityTier: "CRITICAL",
    respiratorySupport: "HFOV",
    hfovSettings: {
      mapCmH2O: 14.5,
      amplitudeDeltaP: 34,
      frequencyHz: 12,
      fio2: 0.45,
      iToERatio: "1:2",
    },
    hypothermiaStatus: {
      isCooling: false,
      phase: "NONE",
      elapsedCoolingHours: 0,
      targetCoreTemp: 36.8,
      actualCoreTemp: 36.7,
      rewarmingRatePerHour: 0.0,
      aEEGPattern: "CONTINUOUS_NORMAL_VOLTAGE",
    },
    currentVitals: {
      timestamp: new Date().toISOString(),
      heartRate: 158,
      respRate: 48,
      preDuctalSpO2: 94,
      postDuctalSpO2: 86,
      map: 28,
      systolicBp: 39,
      diastolicBp: 22,
      cvp: 4.5,
      coreTempC: 36.7,
      skinTempC: 36.4,
      etCO2: 44,
      paO2: 58,
      paCO2: 52,
      ph: 7.29,
      baseExcess: -4.2,
      lactateMmolL: 2.6,
      plateletsK: 110,
      urineOutputMlKgHr: 1.8,
      glucoseMgDl: 82,
      totalBilirubinMgDl: 6.4,
    },
    medications: [
      { name: "Surfactant (Poractant alfa)", dose: "200 mg/kg (LISA day 1)", indication: "Surfactant Deficiency", route: "LISA" },
      { name: "Acetaminophen (IV)", dose: "15 mg/kg q6h", indication: "PDA Closure" },
      { name: "Caffeine Citrate", dose: "10 mg/kg q24h", indication: "Apnea of Prematurity" },
      { name: "Dopamine Infusion", dose: "5 mcg/kg/min", indication: "Inotropic Support" },
    ],
    nSofaScore: 3,
    snappeIIScore: 38,
    oxygenationIndex: 11.2,
    inotropicScoreVIS: 5.0,
    ductalGradient: 8.0,
    bellsNecStage: "STAGE_0_NORMAL",
    sarnatHieStage: "NOT_APPLICABLE",
  },
  {
    id: "NEO-002",
    mrn: "NICU-910243",
    name: "Baby Girl Kowalski",
    sex: "FEMALE",
    gestationalAgeWeeks: 39.2,
    birthWeightGrams: 3420,
    currentWeightGrams: 3380,
    chronologicalAgeDays: 1,
    correctedGABirthWeeks: 39.3,
    bedNumber: "NICU-POD-A-04",
    incubatorType: "Criticool Whole-Body Hypothermia System",
    primaryDiagnosis: "Perinatal Asphyxia, Moderate HIE, Sarnat Stage II",
    acuityTier: "EMERGENCY_COOLING",
    respiratorySupport: "CONVENTIONAL_SIMV",
    simvSettings: {
      pipCmH2O: 22,
      peepCmH2O: 6,
      rateBpm: 35,
      fio2: 0.35,
      tidalVolumeMlKg: 5.2,
    },
    hypothermiaStatus: {
      isCooling: true,
      phase: "MAINTENANCE",
      elapsedCoolingHours: 28.5,
      targetCoreTemp: 33.5,
      actualCoreTemp: 33.4,
      rewarmingRatePerHour: 0.0,
      aEEGPattern: "DISCONTINUOUS_LOW_VOLTAGE",
    },
    currentVitals: {
      timestamp: new Date().toISOString(),
      heartRate: 104,
      respRate: 34,
      preDuctalSpO2: 98,
      postDuctalSpO2: 97,
      map: 46,
      systolicBp: 62,
      diastolicBp: 38,
      cvp: 6.2,
      coreTempC: 33.4,
      skinTempC: 32.9,
      etCO2: 36,
      paO2: 88,
      paCO2: 38,
      ph: 7.36,
      baseExcess: -2.1,
      lactateMmolL: 1.8,
      plateletsK: 165,
      urineOutputMlKgHr: 2.4,
      glucoseMgDl: 94,
      totalBilirubinMgDl: 4.8,
    },
    medications: [
      { name: "Morphine Infusion", dose: "10 mcg/kg/hr", indication: "Comfort & Shivering Suppression" },
      { name: "Phenobarbital", dose: "20 mg/kg IV loading", indication: "Clinical Seizure Prophylaxis" },
      { name: "Ampicillin + Gentamicin", dose: "Standard renal dosing", indication: "Empiric Sepsis Rule-Out" },
    ],
    nSofaScore: 1,
    snappeIIScore: 22,
    oxygenationIndex: 3.5,
    inotropicScoreVIS: 0.0,
    ductalGradient: 1.0,
    bellsNecStage: "STAGE_0_NORMAL",
    sarnatHieStage: "STAGE_II_MODERATE",
  },
  {
    id: "NEO-003",
    mrn: "NICU-783204",
    name: "Baby Boy Montgomery",
    sex: "MALE",
    gestationalAgeWeeks: 38.0,
    birthWeightGrams: 3100,
    currentWeightGrams: 3050,
    chronologicalAgeDays: 2,
    correctedGABirthWeeks: 38.3,
    bedNumber: "NICU-POD-B-02",
    incubatorType: "Giraffe Omnibed Carestation",
    primaryDiagnosis: "Meconium Aspiration Syndrome, Severe PPHN with Right-to-Left Shunting",
    acuityTier: "CRITICAL",
    respiratorySupport: "HFOV_PLUS_INO",
    hfovSettings: {
      mapCmH2O: 20.0,
      amplitudeDeltaP: 46,
      frequencyHz: 10,
      fio2: 0.85,
      iToERatio: "1:2",
      iNO_PPM: 20,
    },
    hypothermiaStatus: {
      isCooling: false,
      phase: "NONE",
      elapsedCoolingHours: 0,
      targetCoreTemp: 37.0,
      actualCoreTemp: 37.1,
      rewarmingRatePerHour: 0.0,
      aEEGPattern: "CONTINUOUS_NORMAL_VOLTAGE",
    },
    currentVitals: {
      timestamp: new Date().toISOString(),
      heartRate: 168,
      respRate: 58,
      preDuctalSpO2: 95,
      postDuctalSpO2: 79,
      map: 40,
      systolicBp: 56,
      diastolicBp: 32,
      cvp: 8.8,
      coreTempC: 37.1,
      skinTempC: 36.8,
      etCO2: 48,
      paO2: 52,
      paCO2: 54,
      ph: 7.22,
      baseExcess: -7.5,
      lactateMmolL: 4.8,
      plateletsK: 88,
      urineOutputMlKgHr: 0.9,
      glucoseMgDl: 68,
      totalBilirubinMgDl: 5.2,
    },
    medications: [
      { name: "Inhaled Nitric Oxide (iNO)", dose: "20 ppm", indication: "Pulmonary Vasodilation" },
      { name: "Milrinone Infusion", dose: "0.33 mcg/kg/min", indication: "PVR Reduction & Lusitropy" },
      { name: "Epinephrine Infusion", dose: "0.05 mcg/kg/min", indication: "Systemic Afterload Support" },
      { name: "Hydrocortisone", dose: "1 mg/kg q8h", indication: "Refractory Hypotension" },
    ],
    nSofaScore: 6,
    snappeIIScore: 54,
    oxygenationIndex: 32.7,
    inotropicScoreVIS: 15.3,
    ductalGradient: 16.0,
    bellsNecStage: "STAGE_0_NORMAL",
    sarnatHieStage: "NOT_APPLICABLE",
  },
  {
    id: "NEO-004",
    mrn: "NICU-640192",
    name: "Baby Girl Patel",
    sex: "FEMALE",
    gestationalAgeWeeks: 27.1,
    birthWeightGrams: 890,
    currentWeightGrams: 930,
    chronologicalAgeDays: 14,
    correctedGABirthWeeks: 29.1,
    bedNumber: "NICU-POD-C-03",
    incubatorType: "Atom Infant Incubator V-2200",
    primaryDiagnosis: "Prematurity, Suspected Necrotizing Enterocolitis (Bell Stage IIA), Late-Onset Sepsis",
    acuityTier: "HIGH_RISK",
    respiratorySupport: "NIV_NCPAP",
    cpapSettings: {
      peepCmH2O: 6,
      fio2: 0.30,
      flowLpm: 6,
    },
    hypothermiaStatus: {
      isCooling: false,
      phase: "NONE",
      elapsedCoolingHours: 0,
      targetCoreTemp: 36.8,
      actualCoreTemp: 37.3,
      rewarmingRatePerHour: 0.0,
      aEEGPattern: "CONTINUOUS_NORMAL_VOLTAGE",
    },
    currentVitals: {
      timestamp: new Date().toISOString(),
      heartRate: 172,
      respRate: 64,
      preDuctalSpO2: 93,
      postDuctalSpO2: 92,
      map: 31,
      systolicBp: 44,
      diastolicBp: 24,
      cvp: 3.8,
      coreTempC: 37.3,
      skinTempC: 37.0,
      etCO2: 39,
      paO2: 72,
      paCO2: 44,
      ph: 7.31,
      baseExcess: -4.0,
      lactateMmolL: 3.1,
      plateletsK: 74,
      urineOutputMlKgHr: 1.2,
      glucoseMgDl: 142,
      totalBilirubinMgDl: 8.9,
    },
    medications: [
      { name: "Vancomycin + Meropenem", dose: "Strict IV micro-infusion", indication: "Empiric NEC/Sepsis Coverage" },
      { name: "Total Parenteral Nutrition (TPN)", dose: "130 mL/kg/day", indication: "NPO Bowel Rest" },
      { name: "Normal Saline Bolus", dose: "10 mL/kg over 30 min", indication: "Volume Expansion" },
    ],
    nSofaScore: 4,
    snappeIIScore: 42,
    oxygenationIndex: 2.5,
    inotropicScoreVIS: 0.0,
    ductalGradient: 1.0,
    bellsNecStage: "STAGE_IIA_PROVEN_MILD",
    sarnatHieStage: "NOT_APPLICABLE",
  },
];

/* ─────────────────────────────────────────────────────────────
 * Main Component
 * ───────────────────────────────────────────────────────────── */

export default function NeonatalIcuTelemetryHubPage() {
  const [patients, setPatients] = useState<NeonatalPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("NEO-001");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterAcuity, setFilterAcuity] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"COMMAND" | "DECISION_SUPPORT" | "HYPOTHERMIA_72H" | "HFOV_CIRCUIT" | "ALERTS">("COMMAND");

  // Interactive Inspector Modals
  const [showTelemetryInspector, setShowTelemetryInspector] = useState<boolean>(false);
  const [showBloodGasModal, setShowBloodGasModal] = useState<boolean>(false);
  const [showHypothermiaModal, setShowHypothermiaModal] = useState<boolean>(false);
  const [showHfovModal, setShowHfovModal] = useState<boolean>(false);
  const [showPatientDrawer, setShowPatientDrawer] = useState<boolean>(false);
  const [showEmergencyActionModal, setShowEmergencyActionModal] = useState<string | null>(null);

  // Active alarms list
  const [alarms, setAlarms] = useState<ClinicalAlarm[]>([
    {
      id: "ALARM-01",
      patientId: "NEO-003",
      patientName: "Baby Boy Montgomery",
      severity: "CRITICAL",
      triggerParameter: "Oxygenation Index (OI)",
      measuredValue: "32.7",
      targetRange: "< 15.0",
      clinicalMeaning: "Severe hypoxemic respiratory failure with refractory PPHN right-to-left ductal shunting.",
      suggestedAction: "Maintain iNO at 20 ppm; prepare bedside ECMO cannulation circuit.",
      timestamp: new Date().toLocaleTimeString(),
      acknowledged: false,
    },
    {
      id: "ALARM-02",
      patientId: "NEO-001",
      patientName: "Baby Boy Henderson",
      severity: "WARNING",
      triggerParameter: "Pre/Post Ductal Delta",
      measuredValue: "8.0%",
      targetRange: "< 5.0%",
      clinicalMeaning: "Moderate right-to-left shunt across PDA; pulmonary vascular resistance elevated.",
      suggestedAction: "Obtain TnECHO; continue IV acetaminophen course.",
      timestamp: new Date().toLocaleTimeString(),
      acknowledged: false,
    },
  ]);

  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Real-time Telemetry Simulation Engine
  useEffect(() => {
    if (!isPlaying) return;
    const intervalTime = Math.max(500, Math.floor(1800 / simSpeed));
    const interval = setInterval(() => {
      setTickCount((prev) => prev + 1);
      setPatients((prevPatients) =>
        prevPatients.map((patient) => {
          const isSelected = patient.id === selectedPatientId;
          const v = patient.currentVitals;

          // Realistic micro-fluctuations
          const hrDelta = (Math.random() - 0.5) * 3;
          const newHR = Math.max(80, Math.min(200, Math.round(v.heartRate + hrDelta)));
          const preSpo2Delta = (Math.random() - 0.5) * 0.8;
          const newPreSpo2 = Math.max(75, Math.min(100, Math.round(v.preDuctalSpO2 + preSpo2Delta)));
          const postSpo2Delta = (Math.random() - 0.5) * 0.8;
          const newPostSpo2 = Math.max(68, Math.min(newPreSpo2, Math.round(v.postDuctalSpO2 + postSpo2Delta)));
          const newGradient = Math.round((newPreSpo2 - newPostSpo2) * 10) / 10;

          // Core temperature fluctuation
          let newCoreTemp = v.coreTempC;
          let newElapsedHours = patient.hypothermiaStatus.elapsedCoolingHours;
          if (patient.hypothermiaStatus.isCooling) {
            newElapsedHours += 0.05 * simSpeed;
            if (patient.hypothermiaStatus.phase === "MAINTENANCE") {
              const tempNoise = (Math.random() - 0.5) * 0.06;
              newCoreTemp = Math.round((33.5 + tempNoise) * 100) / 100;
            }
          }

          // Recalculate OI
          let airwayMap = 14;
          let fio2 = 0.4;
          if (patient.hfovSettings) {
            airwayMap = patient.hfovSettings.mapCmH2O;
            fio2 = patient.hfovSettings.fio2;
          }
          const oi = Math.round(((airwayMap * fio2 * 100) / v.paO2) * 10) / 10;

          return {
            ...patient,
            hypothermiaStatus: {
              ...patient.hypothermiaStatus,
              actualCoreTemp: newCoreTemp,
              elapsedCoolingHours: Math.round(newElapsedHours * 10) / 10,
            },
            currentVitals: {
              ...v,
              timestamp: new Date().toISOString(),
              heartRate: newHR,
              preDuctalSpO2: newPreSpo2,
              postDuctalSpO2: newPostSpo2,
              coreTempC: newCoreTemp,
            },
            ductalGradient: newGradient,
            oxygenationIndex: oi,
          };
        })
      );
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, selectedPatientId]);

  // Inject Crisis Scenarios
  const handleInjectCrisis = (crisisType: string) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPatientId) return p;

        if (crisisType === "APNEA_BRADYCARDIA") {
          return {
            ...p,
            acuityTier: "CRITICAL",
            currentVitals: {
              ...p.currentVitals,
              heartRate: 68,
              respRate: 0,
              preDuctalSpO2: 74,
              postDuctalSpO2: 70,
            },
          };
        } else if (crisisType === "HIE_REWARMING_OVERSHOOT") {
          return {
            ...p,
            hypothermiaStatus: {
              ...p.hypothermiaStatus,
              phase: "REWARMING",
              rewarmingRatePerHour: 0.85, // Critical >0.5C/hr
              actualCoreTemp: 35.2,
            },
          };
        } else if (crisisType === "PPHN_SHUNT_CRISIS") {
          return {
            ...p,
            acuityTier: "CRITICAL",
            currentVitals: {
              ...p.currentVitals,
              preDuctalSpO2: 96,
              postDuctalSpO2: 76,
              paO2: 44,
            },
            ductalGradient: 20.0,
            oxygenationIndex: 38.5,
          };
        } else if (crisisType === "PNEUMOTHORAX") {
          return {
            ...p,
            acuityTier: "CRITICAL",
            currentVitals: {
              ...p.currentVitals,
              heartRate: 192,
              map: 19,
              preDuctalSpO2: 81,
              postDuctalSpO2: 79,
              ph: 7.15,
            },
          };
        }
        return p;
      })
    );

    // Add alert
    const newAlarm: ClinicalAlarm = {
      id: "ALARM-" + Date.now().toString().slice(-4),
      patientId: activePatient.id,
      patientName: activePatient.name,
      severity: "CRITICAL",
      triggerParameter: crisisType.replace(/_/g, " "),
      measuredValue: "Emergency Value",
      targetRange: "Physiologic Target",
      clinicalMeaning: "Acute clinical deterioration simulated via CDS sentry engine.",
      suggestedAction: "Immediate bedside clinical intervention and NRP team verification.",
      timestamp: new Date().toLocaleTimeString(),
      acknowledged: false,
    };
    setAlarms((prev) => [newAlarm, ...prev]);
  };

  // Reset to Baseline
  const handleReset = () => {
    setPatients(INITIAL_PATIENTS);
    setTickCount(0);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Timestamp",
      "MRN",
      "Name",
      "GA_Weeks",
      "BirthWeight_g",
      "HeartRate_BPM",
      "RespRate_BPM",
      "PreDuctal_SpO2_Pct",
      "PostDuctal_SpO2_Pct",
      "Ductal_Delta_Pct",
      "MAP_mmHg",
      "CoreTemp_C",
      "nSOFA_Score",
      "OxygenationIndex",
      "CoolingPhase",
    ];

    const rows = patients.map((p) => {
      const v = p.currentVitals;
      return [
        v.timestamp,
        p.mrn,
        ' + p.name + ',
        p.gestationalAgeWeeks,
        p.birthWeightGrams,
        v.heartRate,
        v.respRate,
        v.preDuctalSpO2,
        v.postDuctalSpO2,
        p.ductalGradient,
        v.map,
        v.coreTempC,
        p.nSofaScore,
        p.oxygenationIndex,
        p.hypothermiaStatus.phase,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "NICU_Telemetry_Report_" + Date.now() + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export HL7 FHIR R4 Bundle
  const handleExportFHIR = () => {
    const p = activePatient;
    const bundle = {
      resourceType: "Bundle",
      id: "bundle-nicu-" + p.id + "-" + Date.now(),
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: "urn:uuid:patient-" + p.id,
          resource: {
            resourceType: "Patient",
            id: p.id,
            identifier: [{ system: "http://hospital.medtrack.org/mrn", value: p.mrn }],
            name: [{ text: p.name }],
            gender: p.sex.toLowerCase(),
            extension: [
              {
                url: "http://hl7.org/fhir/StructureDefinition/patient-birthWeight",
                valueQuantity: { value: p.birthWeightGrams, unit: "g", system: "http://unitsofmeasure.org", code: "g" },
              },
              {
                url: "http://hl7.org/fhir/StructureDefinition/patient-gestationalAge",
                valueQuantity: { value: p.gestationalAgeWeeks, unit: "wk", system: "http://unitsofmeasure.org", code: "wk" },
              },
            ],
          },
        },
        {
          fullUrl: "urn:uuid:obs-pre-ductal-" + p.id,
          resource: {
            resourceType: "Observation",
            status: "final",
            code: { coding: [{ system: "http://loinc.org", code: "59408-5", display: "Pre-ductal Oxygen saturation" }] },
            subject: { reference: "urn:uuid:patient-" + p.id },
            valueQuantity: { value: p.currentVitals.preDuctalSpO2, unit: "%", system: "http://unitsofmeasure.org" },
          },
        },
        {
          fullUrl: "urn:uuid:obs-nsofa-" + p.id,
          resource: {
            resourceType: "Observation",
            status: "final",
            code: { coding: [{ system: "http://medtrack.org/scores", code: "nSOFA", display: "Neonatal Sequential Organ Failure Assessment" }] },
            subject: { reference: "urn:uuid:patient-" + p.id },
            valueInteger: p.nSofaScore,
          },
        },
      ],
    };

    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute("download", "FHIR_R4_NICU_Bundle_" + p.id + ".json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bedNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAcuity = filterAcuity === "ALL" || p.acuityTier === filterAcuity;
    return matchesSearch && matchesAcuity;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      {/* ─────────────────────────────────────────────────────────────
       * 1. Command Station Header
       * ───────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center">
              <Baby className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  NICU Critical Care & Neonatal Telemetry Command Station
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  DECISION SUPPORT v4.2
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                HFOV Oscillatory Ventilation • Whole-Body Hypothermia Protocol • nSOFA / SNAPPE-II Scoring • Ductal Shunt Sentry
              </p>
            </div>
          </div>

          {/* Control Bar */}
          <div className="flex flex-wrap items-center gap-2 self-stretch xl:self-auto">
            {/* Live Streaming Indicator */}
            <div className="flex items-center px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium">
              <span className={"w-2.5 h-2.5 rounded-full mr-2 " + (isPlaying ? "bg-emerald-400 animate-ping" : "bg-amber-400")} />
              <span className="text-slate-300">{isPlaying ? "TELEMETRY LIVE" : "STREAM PAUSED"}</span>
              <span className="text-slate-500 ml-2 font-mono">#{tickCount}</span>
            </div>

            {/* Play / Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 mr-1 text-amber-400" /> : <Play className="w-3.5 h-3.5 mr-1 text-emerald-400" />}
              {isPlaying ? "Pause" : "Resume"}
            </button>

            {/* Sim Speed */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={
                    "px-2.5 py-1 text-xs font-bold rounded " +
                    (simSpeed === spd ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200")
                  }
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition"
              title="Reset to Baseline Telemetry"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              className="flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-cyan-400" />
              CSV
            </button>

            {/* FHIR Export */}
            <button
              onClick={handleExportFHIR}
              className="flex items-center px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 border border-cyan-600/40 rounded-lg text-xs font-semibold transition"
            >
              <FileText className="w-3.5 h-3.5 mr-1 text-cyan-400" />
              HL7 FHIR
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
       * 2. Patient Selector Bar (High-Density Patient Strips)
       * ───────────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center">
              <Baby className="w-4 h-4 mr-1.5 text-cyan-400" />
              Active Neonatal Cohort ({patients.length})
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search MRN / Name / Pod..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48"
              />
            </div>

            {/* Filter */}
            <select
              value={filterAcuity}
              onChange={(e) => setFilterAcuity(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Acuity Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="EMERGENCY_COOLING">Therapeutic Cooling</option>
              <option value="HIGH_RISK">High Risk</option>
              <option value="STABLE">Stable</option>
            </select>
          </div>
        </div>

        {/* Patient Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPatients.map((p) => {
            const isSelected = p.id === selectedPatientId;
            const isCooling = p.hypothermiaStatus.isCooling;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className={
                  "cursor-pointer p-3.5 rounded-xl border transition duration-150 relative overflow-hidden " +
                  (isSelected
                    ? "bg-slate-900 border-cyan-500/80 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/50"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900")
                }
              >
                {/* Acuity top strip */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-300">{p.bedNumber}</span>
                  <span
                    className={
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase " +
                      (p.acuityTier === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : p.acuityTier === "EMERGENCY_COOLING"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : p.acuityTier === "HIGH_RISK"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30")
                    }
                  >
                    {p.acuityTier.replace("_", " ")}
                  </span>
                </div>

                <div className="font-semibold text-sm text-white truncate">{p.name}</div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                  <span>GA: {p.gestationalAgeWeeks}w</span>
                  <span>•</span>
                  <span>BW: {p.birthWeightGrams}g</span>
                  <span>•</span>
                  <span>Day {p.chronologicalAgeDays}</span>
                </div>

                {/* Quick telemetry metrics */}
                <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px]">
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/40">
                    <span className="text-[10px] text-slate-500 block">HR / BPM</span>
                    <span className="font-mono font-bold text-emerald-400">{p.currentVitals.heartRate}</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/40">
                    <span className="text-[10px] text-slate-500 block">SpO2 (Pre)</span>
                    <span className="font-mono font-bold text-cyan-400">{p.currentVitals.preDuctalSpO2}%</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/40">
                    <span className="text-[10px] text-slate-500 block">nSOFA</span>
                    <span className={"font-mono font-bold " + (p.nSofaScore >= 4 ? "text-rose-400" : "text-amber-400")}>
                      {p.nSofaScore}
                    </span>
                  </div>
                </div>

                {/* Respiratory & Hypothermia badges */}
                <div className="flex items-center space-x-1.5 mt-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {p.respiratorySupport}
                  </span>
                  {isCooling && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50 flex items-center">
                      <Snowflake className="w-2.5 h-2.5 mr-0.5" />
                      33.5°C ({p.hypothermiaStatus.phase})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
       * 3. Patient Dossier & Emergency Crisis Bar
       * ───────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-800 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
              {activePatient.sex === "MALE" ? "♂" : "♀"}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">{activePatient.name}</h2>
                <span className="text-xs font-mono text-slate-400">MRN: {activePatient.mrn}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {activePatient.bedNumber}
                </span>
                <span className="text-xs text-slate-400">({activePatient.incubatorType})</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                <span className="text-slate-400 font-semibold">Diagnosis:</span> {activePatient.primaryDiagnosis}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                <span>Gestational Age: <strong className="text-slate-200">{activePatient.gestationalAgeWeeks}w</strong></span>
                <span>•</span>
                <span>Birth Weight: <strong className="text-slate-200">{activePatient.birthWeightGrams}g</strong></span>
                <span>•</span>
                <span>Current: <strong className="text-slate-200">{activePatient.currentWeightGrams}g</strong></span>
                <span>•</span>
                <span>Corrected GA: <strong className="text-slate-200">{activePatient.correctedGABirthWeeks}w</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Action & Simulation Injectors */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPatientDrawer(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center"
            >
              <Eye className="w-3.5 h-3.5 mr-1 text-cyan-400" />
              Patient Dossier
            </button>

            {/* Crisis Simulation Menu */}
            <div className="relative group">
              <button className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-700/50 rounded-lg text-xs font-semibold transition flex items-center">
                <Flame className="w-3.5 h-3.5 mr-1 text-rose-400" />
                Simulate Crisis
              </button>
              <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50">
                <button
                  onClick={() => handleInjectCrisis("APNEA_BRADYCARDIA")}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded hover:text-white"
                >
                  ⚠️ Severe Apnea & Bradycardia (HR &lt; 70)
                </button>
                <button
                  onClick={() => handleInjectCrisis("PPHN_SHUNT_CRISIS")}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded hover:text-white"
                >
                  🫀 PPHN Shunt Crisis (Ductal Delta &gt; 18%)
                </button>
                <button
                  onClick={() => handleInjectCrisis("HIE_REWARMING_OVERSHOOT")}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded hover:text-white"
                >
                  ❄️ Rapid Rewarming Overshoot (&gt; 0.5°C/hr)
                </button>
                <button
                  onClick={() => handleInjectCrisis("PNEUMOTHORAX")}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded hover:text-white"
                >
                  🫁 Tension Pneumothorax on HFOV
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
       * 4. Navigation Tabs
       * ───────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-800 mb-6 space-x-1 overflow-x-auto pb-1">
        {[
          { id: "COMMAND", label: "Real-Time Telemetry Grid", icon: Activity },
          { id: "DECISION_SUPPORT", label: "CDS & Clinical Scoring", icon: Cpu },
          { id: "HYPOTHERMIA_72H", label: "72h Hypothermia Protocol", icon: Snowflake },
          { id: "HFOV_CIRCUIT", label: "HFOV & Ventilator Telemetry", icon: Waves },
          { id: "ALERTS", label: "Active Clinical Alarms (" + alarms.length + ")", icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={
                "flex items-center px-4 py-2.5 text-xs md:text-sm font-semibold rounded-t-lg transition whitespace-nowrap " +
                (isActive
                  ? "bg-slate-900 text-cyan-400 border-t-2 border-cyan-400 border-x border-slate-800 shadow-inner"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40")
              }
            >
              <Icon className={"w-4 h-4 mr-2 " + (isActive ? "text-cyan-400" : "text-slate-500")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
       * 5. TAB 1: Real-Time Telemetry Command Station Grid
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === "COMMAND" && (
        <div className="space-y-6">
          {/* Top Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Heart Rate Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center font-medium">
                  <Heart className="w-4 h-4 mr-1 text-rose-500 animate-pulse" />
                  HEART RATE
                </span>
                <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Target: 110 - 160 BPM
                </span>
              </div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl md:text-4xl font-extrabold font-mono text-white">
                  {activePatient.currentVitals.heartRate}
                </span>
                <span className="text-xs text-slate-400 font-mono">BPM</span>
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center mt-2">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Sinus rhythm • Continuous ECG Lead II
              </div>
            </div>

            {/* Pre & Post Ductal SpO2 Card */}
            <div
              onClick={() => setShowTelemetryInspector(true)}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 relative overflow-hidden shadow-lg cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center font-medium">
                  <Droplets className="w-4 h-4 mr-1 text-cyan-400" />
                  PRE / POST DUCTAL SpO2
                </span>
                <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">PRE (Right Wrist)</span>
                  <span className="text-2xl font-extrabold font-mono text-cyan-400">
                    {activePatient.currentVitals.preDuctalSpO2}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">POST (Foot)</span>
                  <span className="text-2xl font-extrabold font-mono text-blue-400">
                    {activePatient.currentVitals.postDuctalSpO2}%
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-amber-400 flex items-center mt-2">
                <span>Ductal Delta: <strong>{activePatient.ductalGradient}%</strong></span>
                <span className="text-slate-500 mx-1.5">•</span>
                <span>{activePatient.ductalGradient >= 10 ? "Severe R-L Shunt" : "Acceptable Shunt"}</span>
              </div>
            </div>

            {/* Blood Pressure & MAP */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center font-medium">
                  <Gauge className="w-4 h-4 mr-1 text-amber-400" />
                  ARTERIAL BP / MAP
                </span>
                <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Target MAP ≥ {activePatient.gestationalAgeWeeks} mmHg
                </span>
              </div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl md:text-4xl font-extrabold font-mono text-white">
                  {activePatient.currentVitals.map}
                </span>
                <span className="text-xs text-slate-400 font-mono">mmHg (MAP)</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-mono">
                Sys: {activePatient.currentVitals.systolicBp} / Dia: {activePatient.currentVitals.diastolicBp} mmHg • CVP: {activePatient.currentVitals.cvp}
              </div>
            </div>

            {/* Core & Skin Thermal Telemetry */}
            <div
              onClick={() => setShowHypothermiaModal(true)}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 relative overflow-hidden shadow-lg cursor-pointer transition group"
            >
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center font-medium">
                  <Thermometer className="w-4 h-4 mr-1 text-cyan-300" />
                  THERMAL TELEMETRY
                </span>
                {activePatient.hypothermiaStatus.isCooling && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    COOLING ACTIVE
                  </span>
                )}
              </div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl md:text-4xl font-extrabold font-mono text-cyan-300">
                  {activePatient.currentVitals.coreTempC}°C
                </span>
                <span className="text-xs text-slate-400 font-mono">Core (Esophageal)</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                Skin: {activePatient.currentVitals.skinTempC}°C • Target: {activePatient.hypothermiaStatus.targetCoreTemp}°C
              </div>
            </div>
          </div>

          {/* Dual Visual Trends: Dual SpO2 & HFOV Wave Simulation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dual Pre/Post Ductal SpO2 Trend */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Pre vs Post-Ductal SpO2 Real-Time Trend</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">Sampling: 1 Hz</span>
              </div>

              {/* Dynamic Wave Visualization */}
              <div className="h-44 bg-slate-950 border border-slate-800 rounded-lg p-3 relative flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 z-10">
                  <span>100% Target</span>
                  <span>Current Delta: {activePatient.ductalGradient}%</span>
                  <span>90% Threshold</span>
                </div>

                {/* Simulated Graph Lines */}
                <div className="relative h-28 flex items-center">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 100">
                    {/* Grid lines */}
                    <line x1="0" y1="20" x2="400" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
                    <line x1="0" y1="50" x2="400" y2="50" stroke="#1e293b" strokeDasharray="3,3" />
                    <line x1="0" y1="80" x2="400" y2="80" stroke="#1e293b" strokeDasharray="3,3" />

                    {/* Pre-ductal line (Cyan) */}
                    <path
                      d="M 0,30 Q 50,25 100,28 T 200,24 T 300,32 T 400,26"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                    />

                    {/* Post-ductal line (Blue/Amber depending on delta) */}
                    <path
                      d={"M 0," + (30 + activePatient.ductalGradient * 2) + " Q 50," + (28 + activePatient.ductalGradient * 2) + " 100," + (32 + activePatient.ductalGradient * 2) + " T 200," + (30 + activePatient.ductalGradient * 2) + " T 300," + (34 + activePatient.ductalGradient * 2) + " T 400," + (30 + activePatient.ductalGradient * 2)}
                      fill="none"
                      stroke={activePatient.ductalGradient >= 10 ? "#f43f5e" : "#60a5fa"}
                      strokeWidth="2.5"
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium pt-2 border-t border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-1 bg-cyan-400 rounded-full inline-block"></span>
                    <span className="text-slate-300">Pre-ductal: {activePatient.currentVitals.preDuctalSpO2}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-1 bg-blue-400 rounded-full inline-block"></span>
                    <span className="text-slate-300">Post-ductal: {activePatient.currentVitals.postDuctalSpO2}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ventilator / HFOV Telemetry Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Ventilator & Oscillatory Telemetry</h3>
                </div>
                <button
                  onClick={() => setShowHfovModal(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  Adjust Parameters &gt;
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Mode</span>
                  <span className="text-sm font-bold text-white">{activePatient.respiratorySupport}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Airway MAP</span>
                  <span className="text-lg font-bold font-mono text-cyan-400">
                    {activePatient.hfovSettings?.mapCmH2O || 14} <span className="text-xs text-slate-500">cmH2O</span>
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Delta-P Amp</span>
                  <span className="text-lg font-bold font-mono text-cyan-400">
                    {activePatient.hfovSettings?.amplitudeDeltaP || 30} <span className="text-xs text-slate-500">cmH2O</span>
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">FiO2</span>
                  <span className="text-lg font-bold font-mono text-amber-400">
                    {Math.round((activePatient.hfovSettings?.fio2 || 0.4) * 100)}%
                  </span>
                </div>
              </div>

              {/* Oxygenation Index Sentry */}
              <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300">Oxygenation Index (OI)</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activePatient.oxygenationIndex >= 25
                      ? "Severe hypoxemic respiratory failure (iNO / ECMO alert)"
                      : "Acceptable oxygenation efficiency"}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={
                      "text-xl font-mono font-extrabold " +
                      (activePatient.oxygenationIndex >= 25
                        ? "text-rose-400"
                        : activePatient.oxygenationIndex >= 15
                        ? "text-amber-400"
                        : "text-emerald-400")
                    }
                  >
                    {activePatient.oxygenationIndex}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Blood Gas & Acid-Base Row */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Arterial Blood Gas (ABG) & Micro-Metabolic Panel</h3>
              </div>
              <button
                onClick={() => setShowBloodGasModal(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Inspect Acid-Base Dynamics &gt;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block">pH (7.35-7.45)</span>
                <span
                  className={
                    "text-lg font-bold font-mono " +
                    (activePatient.currentVitals.ph < 7.25 ? "text-rose-400" : "text-emerald-400")
                  }
                >
                  {activePatient.currentVitals.ph}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block">PaCO2 (35-45)</span>
                <span className="text-lg font-bold font-mono text-cyan-300">{activePatient.currentVitals.paCO2}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block">PaO2 (50-80)</span>
                <span className="text-lg font-bold font-mono text-cyan-300">{activePatient.currentVitals.paO2}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block">Base Excess</span>
                <span className="text-lg font-bold font-mono text-amber-400">{activePatient.currentVitals.baseExcess}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block">Lactate (mmol/L)</span>
                <span
                  className={
                    "text-lg font-bold font-mono " +
                    (activePatient.currentVitals.lactateMmolL >= 3.0 ? "text-rose-400" : "text-emerald-400")
                  }
                >
                  {activePatient.currentVitals.lactateMmolL}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 block">Platelets (k/uL)</span>
                <span className="text-lg font-bold font-mono text-slate-200">{activePatient.currentVitals.plateletsK}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * 6. TAB 2: Clinical Decision Support & Scoring Engines
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === "DECISION_SUPPORT" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* nSOFA Organ Dysfunction Scoring */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">nSOFA Scoring Matrix</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Score: {activePatient.nSofaScore} / 9
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Neonatal Sequential Organ Failure Assessment (Wynn JL et al.). Evaluates respiratory, cardiovascular inotrope need, and platelet consumptive coagulopathy.
            </p>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300">Respiratory Subscore</span>
                  <span className="text-[10px] text-slate-500 block">SpO2/FiO2 Ratio</span>
                </div>
                <span className="text-sm font-mono font-bold text-cyan-400">
                  {activePatient.oxygenationIndex >= 25 ? "+3 pts" : activePatient.oxygenationIndex >= 15 ? "+2 pts" : "+1 pt"}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300">Cardiovascular VIS Subscore</span>
                  <span className="text-[10px] text-slate-500 block">Inotropic / Pressor Score</span>
                </div>
                <span className="text-sm font-mono font-bold text-cyan-400">
                  {activePatient.inotropicScoreVIS >= 15 ? "+3 pts" : activePatient.inotropicScoreVIS >= 5 ? "+2 pts" : "+1 pt"}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300">Hematologic Platelet Subscore</span>
                  <span className="text-[10px] text-slate-500 block">{activePatient.currentVitals.plateletsK} k/uL</span>
                </div>
                <span className="text-sm font-mono font-bold text-cyan-400">
                  {activePatient.currentVitals.plateletsK < 50 ? "+3 pts" : activePatient.currentVitals.plateletsK < 100 ? "+2 pts" : "+1 pt"}
                </span>
              </div>
            </div>
          </div>

          {/* SNAPPE-II Risk Calculator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Gauge className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">SNAPPE-II Predictor</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Score: {activePatient.snappeIIScore} pts
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Score for Neonatal Acute Physiology, Perinatal Extension-II. Predicts neonatal in-hospital mortality & multi-organ failure.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Birth Weight Extension:</span>
                <span className="font-mono text-slate-200">{activePatient.birthWeightGrams &lt; 750 ? "+17 pts" : "+10 pts"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Lowest Mean BP:</span>
                <span className="font-mono text-slate-200">{activePatient.currentVitals.map &lt; 20 ? "+28 pts" : activePatient.currentVitals.map &lt; 30 ? "+19 pts" : "0 pts"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">PaO2 / FiO2 Ratio:</span>
                <span className="font-mono text-slate-200">{activePatient.currentVitals.paO2 &lt; 50 ? "+16 pts" : "+5 pts"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Predicted Mortality Tier:</span>
                <span className="font-bold text-amber-400">
                  {activePatient.snappeIIScore >= 50 ? "High (>45%)" : "Moderate (10-30%)"}
                </span>
              </div>
            </div>
          </div>

          {/* PPHN & Oxygenation Index Engine */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Oxygenation Index (OI)</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                OI: {activePatient.oxygenationIndex}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Formula: (MAP × FiO₂ × 100) ÷ PaO₂. Evaluates severity of persistent pulmonary hypertension of the newborn (PPHN).
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">iNO Initiation Threshold (OI &ge; 25):</span>
                <span className={"font-bold " + (activePatient.oxygenationIndex >= 25 ? "text-rose-400" : "text-emerald-400")}>
                  {activePatient.oxygenationIndex >= 25 ? "TRIGGERED" : "NORMAL"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ECMO Evaluation Threshold (OI &ge; 40):</span>
                <span className={"font-bold " + (activePatient.oxygenationIndex >= 40 ? "text-rose-400" : "text-slate-400")}>
                  {activePatient.oxygenationIndex >= 40 ? "ECMO CANDIDATE" : "BELOW THRESHOLD"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * 7. TAB 3: 72-Hour Therapeutic Hypothermia Protocol
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === "HYPOTHERMIA_72H" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center">
                <Snowflake className="w-5 h-5 mr-2 text-cyan-400" />
                Whole-Body Therapeutic Hypothermia 72-Hour Protocol
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Neuroprotection for Moderate-to-Severe Hypoxic-Ischemic Encephalopathy (HIE). Target core temp: 33.5°C (33.0 - 34.0°C).
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Current Phase:</span>
              <span className="px-3 py-1 bg-cyan-950 text-cyan-300 font-bold border border-cyan-800 rounded-lg text-xs">
                {activePatient.hypothermiaStatus.phase}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block font-semibold">1. INDUCTION (0 - 4h)</span>
              <span className="text-sm font-bold text-slate-200 mt-1 block">Target: 33.5°C</span>
              <p className="text-[11px] text-slate-500 mt-1">Rapid cooling initiation within 6h of birth</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/50 bg-cyan-950/20">
              <span className="text-xs text-cyan-400 block font-semibold">2. MAINTENANCE (4 - 72h)</span>
              <span className="text-sm font-bold text-white mt-1 block">Elapsed: {activePatient.hypothermiaStatus.elapsedCoolingHours}h</span>
              <p className="text-[11px] text-slate-400 mt-1">Continuous esophageal core temp &amp; aEEG tracking</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block font-semibold">3. REWARMING (72 - 84h)</span>
              <span className="text-sm font-bold text-slate-200 mt-1 block">&le; 0.5°C / hr</span>
              <p className="text-[11px] text-slate-500 mt-1">Slow controlled rewarming to prevent seizures</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block font-semibold">4. NORMOTHERMIA (84h+)</span>
              <span className="text-sm font-bold text-slate-200 mt-1 block">36.5 - 37.5°C</span>
              <p className="text-[11px] text-slate-500 mt-1">Avoid hyperthermia &amp; secondary injury</p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * 8. TAB 4: HFOV & Ventilator Telemetry Circuit
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === "HFOV_CIRCUIT" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <Waves className="w-6 h-6 text-cyan-400" />
              <div>
                <h3 className="text-lg font-bold text-white">High-Frequency Oscillatory Ventilation (HFOV) Circuit</h3>
                <p className="text-xs text-slate-400">SensorMax Flow Sensor &amp; Active Exhalation Diaphragm Telemetry</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400">Oscillator Settings</h4>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Frequency:</span>
                <span className="font-mono font-bold text-white">{activePatient.hfovSettings?.frequencyHz || 10} Hz</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Amplitude (Delta-P):</span>
                <span className="font-mono font-bold text-cyan-400">{activePatient.hfovSettings?.amplitudeDeltaP || 30} cmH2O</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Mean Airway Pressure (MAP):</span>
                <span className="font-mono font-bold text-cyan-400">{activePatient.hfovSettings?.mapCmH2O || 14} cmH2O</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">I:E Ratio:</span>
                <span className="font-mono font-bold text-white">{activePatient.hfovSettings?.iToERatio || "1:2"}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400">Gas Exchange &amp; iNO</h4>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Delivered FiO2:</span>
                <span className="font-mono font-bold text-amber-400">{Math.round((activePatient.hfovSettings?.fio2 || 0.4) * 100)}%</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Inhaled Nitric Oxide (iNO):</span>
                <span className="font-mono font-bold text-cyan-300">{activePatient.hfovSettings?.iNO_PPM || 0} ppm</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">Calculated OI:</span>
                <span className="font-mono font-bold text-rose-400">{activePatient.oxygenationIndex}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400">Safety Interlocks</h4>
              <div className="text-xs space-y-2">
                <div className="flex items-center text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Chest Wiggle Factor (CWF) Optimal
                </div>
                <div className="flex items-center text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  No Barotrauma / Pneumothorax
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * 9. TAB 5: Active Clinical Alarms
       * ───────────────────────────────────────────────────────────── */}
      {activeTab === "ALERTS" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-rose-500" />
              Active Clinical Alarms &amp; Safety Sentry ({alarms.length})
            </h3>
          </div>

          <div className="space-y-3">
            {alarms.map((al) => (
              <div
                key={al.id}
                className={
                  "p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 " +
                  (al.severity === "CRITICAL"
                    ? "bg-rose-950/30 border-rose-800/60"
                    : "bg-amber-950/30 border-amber-800/60")
                }
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase " +
                        (al.severity === "CRITICAL" ? "bg-rose-500 text-white" : "bg-amber-500 text-black")
                      }
                    >
                      {al.severity}
                    </span>
                    <span className="text-xs font-bold text-white">{al.patientName}</span>
                    <span className="text-xs font-mono text-slate-400">({al.triggerParameter})</span>
                  </div>
                  <p className="text-xs text-slate-300">{al.clinicalMeaning}</p>
                  <p className="text-[11px] text-cyan-300 font-semibold">Suggested: {al.suggestedAction}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-500 font-mono">{al.timestamp}</span>
                  <button
                    onClick={() => setAlarms(alarms.filter((a) => a.id !== al.id))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg border border-slate-700 transition"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * 10. Modals & Clinical Inspectors
       * ───────────────────────────────────────────────────────────── */}
      {/* Telemetry Inspector Modal */}
      {showTelemetryInspector && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center">
                <Droplets className="w-5 h-5 mr-2 text-cyan-400" />
                Pre vs Post-Ductal Shunt Inspector ({activePatient.name})
              </h3>
              <button onClick={() => setShowTelemetryInspector(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-300">
              <p>
                <strong>Pre-ductal Sensor:</strong> Right hand/wrist measures oxygenated blood before ductus arteriosus insertion.
              </p>
              <p>
                <strong>Post-ductal Sensor:</strong> Lower extremities measure blood after mixing through PDA.
              </p>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-semibold">Calculated Gradient:</span>
                <span className="text-xl font-bold font-mono text-cyan-400">{activePatient.ductalGradient}%</span>
                <p className="text-[11px] text-slate-500 mt-1">
                  {activePatient.ductalGradient >= 10
                    ? "Gradient &ge; 10%: High probability of severe right-to-left ductal shunting (PPHN)."
                    : "Gradient &lt; 5%: Minimal or balanced ductal shunting."}
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTelemetryInspector(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Dossier Drawer */}
      {showPatientDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full p-6 shadow-2xl overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center">
                <Baby className="w-5 h-5 mr-2 text-cyan-400" />
                Patient Dossier
              </h3>
              <button onClick={() => setShowPatientDrawer(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <h4 className="font-bold text-white mb-2">Demographics &amp; Anthropometry</h4>
                <div className="space-y-1 text-slate-300">
                  <div>Name: <strong>{activePatient.name}</strong></div>
                  <div>MRN: <strong className="font-mono">{activePatient.mrn}</strong></div>
                  <div>Gestational Age: <strong>{activePatient.gestationalAgeWeeks} weeks</strong></div>
                  <div>Birth Weight: <strong>{activePatient.birthWeightGrams} g</strong></div>
                  <div>Current Weight: <strong>{activePatient.currentWeightGrams} g</strong></div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <h4 className="font-bold text-white mb-2">Active Medications &amp; Infusions</h4>
                <div className="space-y-2">
                  {activePatient.medications.map((m, idx) => (
                    <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="font-semibold text-cyan-300">{m.name}</div>
                      <div className="text-slate-400 text-[11px]">{m.dose} • {m.indication}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowPatientDrawer(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
