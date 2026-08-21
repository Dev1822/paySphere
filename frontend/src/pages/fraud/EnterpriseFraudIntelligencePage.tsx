import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Activity,
  Zap,
  Search,
  Filter,
  Download,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Cpu,
  Layers,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  ScanLine,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Network,
  Key,
  Fingerprint,
  FileWarning,
  Target,
  Terminal,
  Bug,
  Info,
  X,
  ChevronRight,
  DollarSign,
  AlertOctagon,
  FileText,
  Sliders,
  Radio,
  Server,
  Globe,
} from "lucide-react";

/* ─────────────────────────── Types ─────────────────────────── */

export type AnomalySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
export type AnomalyType =
  | "GHOST_EMPLOYEE"
  | "DUPLICATE_DIRECT_DEPOSIT"
  | "BENFORD_LAW_VIOLATION"
  | "SALARY_SPIKE_OUTLIER"
  | "OFF_CYCLE_OVERTIME_INFLATION"
  | "GEOGRAPHIC_IMPOSSIBLE_TRAVEL"
  | "TAX_ID_COLLISION"
  | "UNAUTHORIZED_OFF_HOURS_MUTATION";

export type IncidentStatus = "ACTIVE" | "INVESTIGATING" | "MITIGATED" | "FALSE_POSITIVE" | "RESOLVED";

export interface FraudIncident {
  id: string;
  incidentCode: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  status: IncidentStatus;
  riskScore: number;
  employeeId: string;
  employeeName: string;
  department: string;
  amountInvolved: number;
  detectedAt: string;
  deviation: {
    zScore?: number;
    expectedValue?: number;
    actualValue?: number;
    benfordScore?: number;
    matchingAccountsCount?: number;
    description: string;
  };
  forensicContext: {
    sourceIp: string;
    userAgent: string;
    bankAccountMasked: string;
    routingNumber: string;
    taxIdMasked: string;
    geoLocation: string;
    deviceFingerprint: string;
  };
  auditTrail: Array<{
    timestamp: string;
    actor: string;
    action: string;
    notes?: string;
  }>;
}

export interface BenfordDigitStat {
  digit: number;
  theoreticalProb: number;
  empiricalProb: number;
  count: number;
  deviation: number;
}

export interface AccountCluster {
  accountMasked: string;
  routingNumber: string;
  totalEmployees: number;
  totalDisbursement: number;
  employees: Array<{
    id: string;
    name: string;
    department: string;
    monthlySalary: number;
    joinedDate: string;
  }>;
  riskRating: "CRITICAL" | "HIGH" | "MEDIUM";
}

/* ─────────────────────────── Initial Mock Data ─────────────────────────── */

const INITIAL_INCIDENTS: FraudIncident[] = [
  {
    id: "INC-9821",
    incidentCode: "FRD-2026-09821",
    anomalyType: "DUPLICATE_DIRECT_DEPOSIT",
    severity: "CRITICAL",
    status: "ACTIVE",
    riskScore: 96,
    employeeId: "EMP-4102",
    employeeName: "Marcus Vance & Elena Rostova",
    department: "Cloud Infrastructure / Operations",
    amountInvolved: 42800,
    detectedAt: "2026-08-21T14:12:05Z",
    deviation: {
      matchingAccountsCount: 3,
      description: "Identical routing and account number linked to 3 distinct active employee records.",
    },
    forensicContext: {
      sourceIp: "198.51.100.44",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      bankAccountMasked: "•••• •••• 8842",
      routingNumber: "021000021 (JPMorgan Chase)",
      taxIdMasked: "XXX-XX-9481",
      geoLocation: "Frankfurt, Germany",
      deviceFingerprint: "fp_98a7cf21b5",
    },
    auditTrail: [
      {
        timestamp: "2026-08-21T14:12:05Z",
        actor: "Automated Zero-Trust AI Engine",
        action: "Anomaly flagged on automated payroll batch pre-flight check",
      },
    ],
  },
  {
    id: "INC-9822",
    incidentCode: "FRD-2026-09822",
    anomalyType: "GHOST_EMPLOYEE",
    severity: "CRITICAL",
    status: "INVESTIGATING",
    riskScore: 94,
    employeeId: "EMP-1089",
    employeeName: "Arthur Pendelton (Unverified)",
    department: "Enterprise Sales",
    amountInvolved: 31500,
    detectedAt: "2026-08-21T13:45:20Z",
    deviation: {
      description: "0 badge swipes, 0 VPN authentications, and no active manager sign-offs for 120 days.",
    },
    forensicContext: {
      sourceIp: "203.0.113.19",
      userAgent: "Python/3.11 aiohttp/3.8.4",
      bankAccountMasked: "•••• •••• 3109",
      routingNumber: "121000358 (Wells Fargo)",
      taxIdMasked: "XXX-XX-1120",
      geoLocation: "Unknown / Tor Exit Node",
      deviceFingerprint: "fp_tor_9921ab",
    },
    auditTrail: [
      {
        timestamp: "2026-08-21T13:45:20Z",
        actor: "Workforce Identity Reconciliation Daemon",
        action: "Flagged dormant account scheduled for executive bonus payout",
      },
    ],
  },
  {
    id: "INC-9823",
    incidentCode: "FRD-2026-09823",
    anomalyType: "SALARY_SPIKE_OUTLIER",
    severity: "HIGH",
    status: "ACTIVE",
    riskScore: 88,
    employeeId: "EMP-3042",
    employeeName: "Chloe Davenport",
    department: "Global Procurement",
    amountInvolved: 68400,
    detectedAt: "2026-08-21T11:30:15Z",
    deviation: {
      zScore: 4.82,
      expectedValue: 14200,
      actualValue: 68400,
      description: "Gaussian Z-Score 4.82 standard deviations above historical 12-month rolling compensation baseline.",
    },
    forensicContext: {
      sourceIp: "192.0.2.88",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      bankAccountMasked: "•••• •••• 7715",
      routingNumber: "071000013 (Bank of America)",
      taxIdMasked: "XXX-XX-4419",
      geoLocation: "Chicago, IL, USA",
      deviceFingerprint: "fp_mac_71829e",
    },
    auditTrail: [
      {
        timestamp: "2026-08-21T11:30:15Z",
        actor: "Statistical Variance Sentinel",
        action: "Detected off-cycle manual salary override without corresponding L3 ticket",
      },
    ],
  },
  {
    id: "INC-9824",
    incidentCode: "FRD-2026-09824",
    anomalyType: "BENFORD_LAW_VIOLATION",
    severity: "HIGH",
    status: "ACTIVE",
    riskScore: 82,
    employeeId: "DEPT-EXP-99",
    employeeName: "Departmental Expense Batch #8812",
    department: "Field Marketing & Events",
    amountInvolved: 149200,
    detectedAt: "2026-08-21T09:18:40Z",
    deviation: {
      benfordScore: 0.048,
      description: "First-digit 8 & 9 frequency (42.1%) violates Benford distribution (Expected ~10.9%), indicating structured threshold circumvention ($4,990 / $9,950 claims).",
    },
    forensicContext: {
      sourceIp: "198.51.100.12",
      userAgent: "PaySphere-BulkDisbursement-Service/v4.2",
      bankAccountMasked: "•••• •••• Multiple",
      routingNumber: "Multiple",
      taxIdMasked: "Multiple",
      geoLocation: "San Francisco, CA, USA",
      deviceFingerprint: "fp_corp_gateway_01",
    },
    auditTrail: [
      {
        timestamp: "2026-08-21T09:18:40Z",
        actor: "Benford Goodness-of-Fit Analyzer",
        action: "Mean Absolute Deviation (MAD) 0.048 exceeded threshold (0.015)",
      },
    ],
  },
  {
    id: "INC-9825",
    incidentCode: "FRD-2026-09825",
    anomalyType: "UNAUTHORIZED_OFF_HOURS_MUTATION",
    severity: "MEDIUM",
    status: "MITIGATED",
    riskScore: 68,
    employeeId: "EMP-0814",
    employeeName: "Devin Zhao",
    department: "Human Resources",
    amountInvolved: 18500,
    detectedAt: "2026-08-20T23:44:11Z",
    deviation: {
      description: "Direct DB payroll ledger mutation executed at 03:44 AM UTC from non-enclave endpoint.",
    },
    forensicContext: {
      sourceIp: "185.220.101.5",
      userAgent: "PostmanRuntime/7.36.0",
      bankAccountMasked: "•••• •••• 9011",
      routingNumber: "111000025 (Citibank)",
      taxIdMasked: "XXX-XX-6022",
      geoLocation: "Reykjavik, Iceland",
      deviceFingerprint: "fp_postman_headless_02",
    },
    auditTrail: [
      {
        timestamp: "2026-08-20T23:44:11Z",
        actor: "Zero-Trust SOC Guard",
        action: "Flagged unauthorized mutation token usage",
      },
      {
        timestamp: "2026-08-21T00:15:00Z",
        actor: "Admin (Kill-Switch)",
        action: "Revoked session tokens & placed automated disbursement freeze",
      },
    ],
  },
];

const INITIAL_BENFORD: BenfordDigitStat[] = [
  { digit: 1, theoreticalProb: 30.1, empiricalProb: 24.2, count: 121, deviation: -5.9 },
  { digit: 2, theoreticalProb: 17.6, empiricalProb: 16.8, count: 84, deviation: -0.8 },
  { digit: 3, theoreticalProb: 12.5, empiricalProb: 11.2, count: 56, deviation: -1.3 },
  { digit: 4, theoreticalProb: 9.7, empiricalProb: 18.4, count: 92, deviation: 8.7 },
  { digit: 5, theoreticalProb: 7.9, empiricalProb: 6.4, count: 32, deviation: -1.5 },
  { digit: 6, theoreticalProb: 6.7, empiricalProb: 5.8, count: 29, deviation: -0.9 },
  { digit: 7, theoreticalProb: 5.8, empiricalProb: 4.6, count: 23, deviation: -1.2 },
  { digit: 8, theoreticalProb: 5.1, empiricalProb: 5.2, count: 26, deviation: 0.1 },
  { digit: 9, theoreticalProb: 4.6, empiricalProb: 7.4, count: 37, deviation: 2.8 },
];

const INITIAL_CLUSTERS: AccountCluster[] = [
  {
    accountMasked: "•••• •••• 8842",
    routingNumber: "021000021 (JPMorgan Chase)",
    totalEmployees: 3,
    totalDisbursement: 42800,
    riskRating: "CRITICAL",
    employees: [
      { id: "EMP-4102", name: "Marcus Vance", department: "Cloud Infrastructure", monthlySalary: 14500, joinedDate: "2025-03-12" },
      { id: "EMP-4109", name: "Elena Rostova", department: "Operations", monthlySalary: 13800, joinedDate: "2025-06-01" },
      { id: "EMP-4115", name: "Tarik Al-Mansoor", department: "IT Support", monthlySalary: 14500, joinedDate: "2025-08-14" },
    ],
  },
  {
    accountMasked: "•••• •••• 4491",
    routingNumber: "121000358 (Wells Fargo)",
    totalEmployees: 2,
    totalDisbursement: 28900,
    riskRating: "HIGH",
    employees: [
      { id: "EMP-2091", name: "Liam O Connor", department: "Product Marketing", monthlySalary: 15400, joinedDate: "2024-11-20" },
      { id: "EMP-2098", name: "Samantha Briggs", department: "Demand Generation", monthlySalary: 13500, joinedDate: "2025-01-10" },
    ],
  },
  {
    accountMasked: "•••• •••• 1205",
    routingNumber: "071000013 (Bank of America)",
    totalEmployees: 2,
    totalDisbursement: 19800,
    riskRating: "MEDIUM",
    employees: [
      { id: "EMP-5510", name: "David Kim", department: "Facilities", monthlySalary: 9900, joinedDate: "2023-09-15" },
      { id: "EMP-5514", name: "Min-Jun Kim", department: "Logistics", monthlySalary: 9900, joinedDate: "2024-04-02" },
    ],
  },
];

/* ─────────────────────────── Component ─────────────────────────── */

export default function EnterpriseFraudIntelligencePage() {
  const [incidents, setIncidents] = useState<FraudIncident[]>(INITIAL_INCIDENTS);
  const [benfordStats, setBenfordStats] = useState<BenfordDigitStat[]>(INITIAL_BENFORD);
  const [accountClusters, setAccountClusters] = useState<AccountCluster[]>(INITIAL_CLUSTERS);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"stream" | "benford" | "clusters" | "telemetry" | "standards">("stream");
  const [selectedIncident, setSelectedIncident] = useState<FraudIncident | null>(null);
  const [isKillSwitchArmed, setIsKillSwitchArmed] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(1);
  const [tickCount, setTickCount] = useState(0);
  const [alertNotification, setAlertNotification] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  // Simulation loop generating synthetic telemetry
  useEffect(() => {
    if (isSimulating) {
      const intervalMs = 2500 / simSpeed;
      timerRef.current = setInterval(() => {
        setTickCount((prev) => prev + 1);

        if (Math.random() > 0.65) {
          const types: AnomalyType[] = [
            "SALARY_SPIKE_OUTLIER",
            "BENFORD_LAW_VIOLATION",
            "DUPLICATE_DIRECT_DEPOSIT",
            "OFF_CYCLE_OVERTIME_INFLATION",
            "UNAUTHORIZED_OFF_HOURS_MUTATION",
          ];
          const chosenType = types[Math.floor(Math.random() * types.length)];
          const randomId = Math.floor(1000 + Math.random() * 9000);
          const randomAmount = Math.floor(5000 + Math.random() * 45000);
          const randomRisk = Math.floor(65 + Math.random() * 34);

          const newIncident: FraudIncident = {
            id: `INC-${randomId}`,
            incidentCode: `FRD-2026-${randomId}`,
            anomalyType: chosenType,
            severity: randomRisk > 90 ? "CRITICAL" : randomRisk > 75 ? "HIGH" : "MEDIUM",
            status: "ACTIVE",
            riskScore: randomRisk,
            employeeId: `EMP-${Math.floor(1000 + Math.random() * 8000)}`,
            employeeName: `Simulated Entity #${randomId}`,
            department: ["Engineering", "Finance", "Sales", "HR", "Procurement"][Math.floor(Math.random() * 5)],
            amountInvolved: randomAmount,
            detectedAt: new Date().toISOString(),
            deviation: {
              zScore: parseFloat((2.5 + Math.random() * 3.5).toFixed(2)),
              description: `Simulated streaming anomaly trigger: ${chosenType.replace(/_/g, " ")}`,
            },
            forensicContext: {
              sourceIp: `198.51.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
              userAgent: "PaySphere-Telemetry-Node/v2.1",
              bankAccountMasked: `•••• •••• ${Math.floor(1000 + Math.random() * 9000)}`,
              routingNumber: "021000021 (JPMorgan Chase)",
              taxIdMasked: "XXX-XX-9901",
              geoLocation: "Ashburn, VA, USA",
              deviceFingerprint: `fp_sim_${Math.random().toString(36).substring(7)}`,
            },
            auditTrail: [
              {
                timestamp: new Date().toISOString(),
                actor: "Real-Time Telemetry Stream Sandbox",
                action: "Flagged dynamic streaming anomaly event",
              },
            ],
          };

          setIncidents((prev) => [newIncident, ...prev.slice(0, 49)]);
          setAlertNotification(`⚠️ New ${newIncident.severity} Anomaly Detected: ${newIncident.incidentCode}`);
          setTimeout(() => setAlertNotification(null), 4000);
        }
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSimulating, simSpeed]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchesSearch =
        inc.incidentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.forensicContext.bankAccountMasked.includes(searchQuery);

      const matchesSeverity = selectedSeverity === "ALL" || inc.severity === selectedSeverity;
      const matchesType = selectedType === "ALL" || inc.anomalyType === selectedType;
      const matchesStatus = selectedStatus === "ALL" || inc.status === selectedStatus;

      return matchesSearch && matchesSeverity && matchesType && matchesStatus;
    });
  }, [incidents, searchQuery, selectedSeverity, selectedType, selectedStatus]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = incidents.length;
    const active = incidents.filter((i) => i.status === "ACTIVE").length;
    const critical = incidents.filter((i) => i.severity === "CRITICAL" && i.status === "ACTIVE").length;
    const amountAtRisk = incidents
      .filter((i) => i.status === "ACTIVE" || i.status === "INVESTIGATING")
      .reduce((sum, i) => sum + i.amountInvolved, 0);
    const avgRisk = total > 0 ? Math.round(incidents.reduce((sum, i) => sum + i.riskScore, 0) / total) : 0;
    const totalMitigated = incidents.filter((i) => i.status === "MITIGATED").length;

    return { total, active, critical, amountAtRisk, avgRisk, totalMitigated };
  }, [incidents]);

  // Mitigation Handlers
  const handleMitigate = useCallback((incidentId: string, actionType: "FREEZE" | "HOLD" | "WHITELIST" | "INVESTIGATE") => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc;
        let newStatus: IncidentStatus = inc.status;
        let actionDesc = "";

        if (actionType === "FREEZE") {
          newStatus = "MITIGATED";
          actionDesc = "Automated Kill-Switch: Direct deposit execution frozen and account locked.";
        } else if (actionType === "HOLD") {
          newStatus = "INVESTIGATING";
          actionDesc = "Manual Disbursement Hold placed pending executive sign-off.";
        } else if (actionType === "WHITELIST") {
          newStatus = "FALSE_POSITIVE";
          actionDesc = "Auditor verified legitimate variance; whitelisted with cryptographic tag.";
        } else if (actionType === "INVESTIGATE") {
          newStatus = "INVESTIGATING";
          actionDesc = "Escalated to Corporate Forensic Audit & Legal Team.";
        }

        return {
          ...inc,
          status: newStatus,
          auditTrail: [
            ...inc.auditTrail,
            {
              timestamp: new Date().toISOString(),
              actor: "Principal Security Officer (Session Active)",
              action: actionDesc,
            },
          ],
        };
      })
    );
  }, []);

  // Global Kill-Switch Trigger
  const triggerGlobalKillSwitch = () => {
    if (!isKillSwitchArmed) {
      setIsKillSwitchArmed(true);
      return;
    }

    setIncidents((prev) =>
      prev.map((inc) => ({
        ...inc,
        status: inc.status === "ACTIVE" ? "MITIGATED" : inc.status,
        auditTrail: [
          ...inc.auditTrail,
          {
            timestamp: new Date().toISOString(),
            actor: "EMERGENCY GLOBAL KILL-SWITCH",
            action: "System-wide automated freeze of all active high-risk payroll disbursement rails.",
          },
        ],
      }))
    );
    setIsKillSwitchArmed(false);
    setAlertNotification("🚨 EMERGENCY KILL-SWITCH EXECUTED: All high-risk payroll transactions frozen.");
    setTimeout(() => setAlertNotification(null), 5000);
  };

  // CSV Audit Export
  const exportToCSV = () => {
    const headers = [
      "Incident Code",
      "Anomaly Type",
      "Severity",
      "Status",
      "Risk Score",
      "Employee Name",
      "Department",
      "Amount Involved ($)",
      "Bank Account",
      "Routing Number",
      "Detected At",
    ];

    const rows = filteredIncidents.map((i) => [
      i.incidentCode,
      i.anomalyType,
      i.severity,
      i.status,
      i.riskScore,
      `"${i.employeeName}"`,
      `"${i.department}"`,
      i.amountInvolved,
      i.forensicContext.bankAccountMasked,
      i.forensicContext.routingNumber,
      i.detectedAt,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PaySphere_Fraud_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityBadge = (severity: AnomalySeverity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "HIGH":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "MEDIUM":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "LOW":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case "ACTIVE":
        return "bg-rose-950/80 text-rose-400 border-rose-800/60 animate-pulse";
      case "INVESTIGATING":
        return "bg-amber-950/80 text-amber-300 border-amber-800/60";
      case "MITIGATED":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800/60";
      case "FALSE_POSITIVE":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      {/* Alert Notification Toast */}
      {alertNotification && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-rose-500 text-slate-100 px-4 py-3 rounded-lg shadow-2xl flex items-center space-x-3 animate-bounce">
          <AlertOctagon className="w-5 h-5 text-rose-400" />
          <span className="text-sm font-medium">{alertNotification}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Enterprise Zero-Trust Payroll Fraud & Anomaly Intelligence Hub
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded border bg-rose-950 text-rose-400 border-rose-800">
                  SOC Tier 1 Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Continuous Statistical Anomaly Engine • Benford Goodness-of-Fit • Graph Identity Clustering • 21 CFR Part 11 Audit Trail
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Simulation Controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 space-x-1">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                isSimulating ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulating ? "Pause Stream" : "Live Simulation"}</span>
            </button>
            {isSimulating && (
              <div className="flex items-center space-x-1 px-1">
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSimSpeed(spd as 1 | 2 | 4)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      simSpeed === spd ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export Forensic CSV</span>
          </button>

          {/* Kill-Switch */}
          <button
            onClick={triggerGlobalKillSwitch}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border ${
              isKillSwitchArmed
                ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-400 animate-pulse"
                : "bg-slate-900 hover:bg-rose-950/40 text-rose-400 border-rose-900/60"
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>{isKillSwitchArmed ? "CONFIRM EMERGENCY FREEZE" : "Arm Kill-Switch"}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 my-6">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Anomaly Incidents</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{metrics.total}</span>
            <span className="text-xs text-rose-400 font-medium">+{tickCount} ticks</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Real-time ledger monitor</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Critical Outliers</span>
            <Zap className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400">{metrics.critical}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
              Immediate Hold
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Z-Score &gt; 3.5 or Duplicate IBAN</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Amount at Direct Risk</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">
              ${metrics.amountAtRisk.toLocaleString()}
            </span>
            <span className="text-xs text-amber-300 font-medium">Flagged</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Pre-settlement escrow held</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Benford MAD Score</span>
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-cyan-400">0.048</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              Non-Conformant
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Threshold: &le; 0.015 conformant</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Account Collisions</span>
            <Network className="w-4 h-4 text-violet-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-violet-400">{accountClusters.length}</span>
            <span className="text-xs text-violet-300 font-medium">Clusters</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Shared direct deposit nodes</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Automated Mitigations</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{metrics.totalMitigated}</span>
            <span className="text-xs text-emerald-400 font-medium">Applied</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Zero disbursement leakage</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("stream")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "stream"
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Real-Time Anomaly Stream</span>
          <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300">
            {filteredIncidents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("benford")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "benford"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Benford First-Digit Inspector</span>
        </button>

        <button
          onClick={() => setActiveTab("clusters")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "clusters"
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Identity & Account Collision Graph</span>
        </button>

        <button
          onClick={() => setActiveTab("telemetry")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "telemetry"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Zero-Trust Forensic Audit Logs</span>
        </button>

        <button
          onClick={() => setActiveTab("standards")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "standards"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Regulatory Compliance Matrix</span>
        </button>
      </div>

      {/* Tab 1: Real-Time Anomaly Stream */}
      {activeTab === "stream" && (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search incident code, employee name, department, or masked bank account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical Severity</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="LOW">Low Severity</option>
              </select>
            </div>

            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">All Anomaly Types</option>
                <option value="DUPLICATE_DIRECT_DEPOSIT">Duplicate Direct Deposit</option>
                <option value="GHOST_EMPLOYEE">Ghost Employee</option>
                <option value="SALARY_SPIKE_OUTLIER">Salary Spike Outlier</option>
                <option value="BENFORD_LAW_VIOLATION">Benford Law Violation</option>
                <option value="UNAUTHORIZED_OFF_HOURS_MUTATION">Off-Hours Mutation</option>
              </select>
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">All Incident Statuses</option>
                <option value="ACTIVE">Active (Action Needed)</option>
                <option value="INVESTIGATING">Under Investigation</option>
                <option value="MITIGATED">Mitigated / Frozen</option>
                <option value="FALSE_POSITIVE">Whitelisted (Clean)</option>
              </select>
            </div>
          </div>

          {/* Incidents Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Incident / Time</th>
                    <th className="py-3 px-4">Anomaly Vector</th>
                    <th className="py-3 px-4">Entity & Dept</th>
                    <th className="py-3 px-4">Risk & Severity</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Forensic Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        No active fraud incidents matching the specified filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white flex items-center space-x-1.5">
                            <span>{inc.incidentCode}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(inc.detectedAt).toLocaleTimeString()} • {new Date(inc.detectedAt).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-sans font-medium text-slate-200 block">
                            {inc.anomalyType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-slate-400 line-clamp-1">
                            {inc.deviation.description}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-sans font-semibold text-slate-200">{inc.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{inc.department}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getSeverityBadge(inc.severity)}`}>
                              {inc.severity}
                            </span>
                            <span className="text-xs font-bold text-rose-400">
                              {inc.riskScore}/100
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-amber-400">
                            ${inc.amountInvolved.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getStatusBadge(inc.status)}`}>
                            {inc.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5 font-sans">
                            <button
                              onClick={() => setSelectedIncident(inc)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Inspect Forensic Payload"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {inc.status === "ACTIVE" && (
                              <>
                                <button
                                  onClick={() => handleMitigate(inc.id, "FREEZE")}
                                  className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-[10px] font-bold transition"
                                  title="Kill-Switch Freeze"
                                >
                                  Freeze
                                </button>
                                <button
                                  onClick={() => handleMitigate(inc.id, "HOLD")}
                                  className="px-2 py-1 rounded bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-[10px] font-bold transition"
                                  title="Disbursement Hold"
                                >
                                  Hold
                                </button>
                              </>
                            )}

                            {inc.status !== "FALSE_POSITIVE" && (
                              <button
                                onClick={() => handleMitigate(inc.id, "WHITELIST")}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition"
                                title="Whitelist Verified"
                              >
                                Whitelist
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Benford First-Digit Inspector */}
      {activeTab === "benford" && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <span>Benford Law Empirical vs Theoretical Probability Distribution</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Logarithmic frequency distribution of leading digits (1-9) across all historical disbursements. Deviations &gt; 5% suggest structured invoice / payout threshold manipulation.
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 bg-cyan-500 rounded-sm"></div>
                  <span className="text-slate-300">Empirical (Actual)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 bg-slate-600 rounded-sm"></div>
                  <span className="text-slate-300">Theoretical (Benford)</span>
                </div>
              </div>
            </div>

            {/* Bar Chart Visualization */}
            <div className="grid grid-cols-9 gap-3 pt-6 items-end h-64">
              {benfordStats.map((item) => (
                <div key={item.digit} className="flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex items-end justify-center space-x-1 h-44">
                    {/* Actual Bar */}
                    <div
                      style={{ height: `${(item.empiricalProb / 35) * 100}%` }}
                      className={`w-1/2 rounded-t transition-all ${
                        Math.abs(item.deviation) > 5 ? "bg-rose-500" : "bg-cyan-500"
                      }`}
                    ></div>
                    {/* Theoretical Bar */}
                    <div
                      style={{ height: `${(item.theoreticalProb / 35) * 100}%` }}
                      className="w-1/2 bg-slate-700 rounded-t"
                    ></div>
                  </div>

                  <div className="mt-3 text-center">
                    <span className="font-bold text-sm text-white">Digit {item.digit}</span>
                    <div className="text-[10px] font-mono text-cyan-300">{item.empiricalProb}%</div>
                    <div className="text-[10px] font-mono text-slate-500">Exp: {item.theoreticalProb}%</div>
                    <div
                      className={`text-[10px] font-bold ${
                        item.deviation > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {item.deviation > 0 ? `+${item.deviation}%` : `${item.deviation}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Goodness-of-Fit Diagnostic Summary
              </h4>
              <ul className="text-xs space-y-2 text-slate-300 font-mono">
                <li className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Total Analyzed Transactions:</span>
                  <span className="font-bold text-white">514 records</span>
                </li>
                <li className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Mean Absolute Deviation (MAD):</span>
                  <span className="font-bold text-rose-400">0.048 (Non-Conformant)</span>
                </li>
                <li className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Primary Outlier Cluster:</span>
                  <span className="font-bold text-amber-400">Digit 4 (+8.7% spike)</span>
                </li>
                <li className="flex justify-between py-1">
                  <span className="text-slate-400">Diagnostic Verdict:</span>
                  <span className="font-bold text-rose-400">High probability of $4,000-$4,999 invoice threshold splitting</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Forensic Auditor Recommendations
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                The statistical spike at Leading Digit 4 coincides with marketing expense disbursements just below the $5,000 secondary approval threshold. Recommended action: Execute automated drill-down audit on Departmental Batch #8812 and temporarily suspend unverified batch reconciliations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Identity & Account Collision Graph */}
      {activeTab === "clusters" && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Network className="w-4 h-4 text-violet-400" />
              <span>Multi-Identity Direct Deposit Collision Clusters</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Discovered routing nodes where single destination banking accounts are linked across distinct employee IDs and Social Security / Tax profiles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accountClusters.map((cluster, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-xs text-white">{cluster.accountMasked}</div>
                        <div className="text-[10px] text-slate-500">{cluster.routingNumber}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getSeverityBadge(cluster.riskRating)}`}>
                      {cluster.riskRating}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    <div className="text-[11px] font-semibold text-slate-400">Linked Identity Nodes ({cluster.totalEmployees}):</div>
                    {cluster.employees.map((emp) => (
                      <div key={emp.id} className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{emp.name}</span>
                          <span className="font-mono text-emerald-400">${emp.monthlySalary.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span>{emp.department}</span>
                          <span className="font-mono">{emp.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Pool at Risk:</span>
                  <span className="text-sm font-bold text-amber-400 font-mono">
                    ${cluster.totalDisbursement.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Zero-Trust Forensic Audit Logs */}
      {activeTab === "telemetry" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 pb-3 border-b border-slate-800">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>Immutable Cryptographic Forensic Audit Log (FDA 21 CFR Part 11 / SOC 2)</span>
          </h3>

          <div className="mt-4 font-mono text-xs space-y-2 max-h-96 overflow-y-auto pr-2">
            {incidents.flatMap((i) => i.auditTrail).map((trail, index) => (
              <div key={index} className="p-2.5 rounded bg-slate-950 border border-slate-800/80 flex items-start space-x-3">
                <span className="text-cyan-400 text-[11px] whitespace-nowrap">
                  {new Date(trail.timestamp).toISOString()}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">
                  {trail.actor}
                </span>
                <span className="text-slate-200 flex-1">{trail.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Regulatory Compliance Matrix */}
      {activeTab === "standards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 pb-3 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Enterprise Financial & Security Controls</span>
            </h3>
            <ul className="mt-4 space-y-3 text-xs text-slate-300">
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-white">SOX Section 404 Internal Controls:</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">Automated dual-authorization enforcement on all compensation adjustments exceeding 15% variance.</p>
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-white">FDA 21 CFR Part 11 Audit Trail:</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">Cryptographically signed append-only audit trail capturing user IP, user-agent, and reason notes.</p>
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Zero-Trust Network Access (ZTNA):</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">Continuous session evaluation terminating tokens associated with anomalous geographical geolocation hops.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 pb-3 border-b border-slate-800">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>Cryptographic Governance & Vault Status</span>
            </h3>
            <ul className="mt-4 space-y-3 text-xs text-slate-300">
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-white">AES-256-GCM Direct Deposit Encryption:</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">All banking routing numbers and account IDs encrypted at rest with hardware HSM envelope keys.</p>
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Post-Quantum Lattice Signature Ready:</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">Compatible with NIST FIPS 204 (ML-DSA) for tamper-proof payroll disbursement ledger sealing.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal Forensic Inspector */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Forensic Incident Inspector: {selectedIncident.incidentCode}</h3>
                  <p className="text-xs text-slate-400">{selectedIncident.anomalyType.replace(/_/g, " ")}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block">Target Entity:</span>
                  <span className="font-bold text-white">{selectedIncident.employeeName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department:</span>
                  <span className="font-bold text-white">{selectedIncident.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Amount Involved:</span>
                  <span className="font-bold text-amber-400">${selectedIncident.amountInvolved.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Risk Score:</span>
                  <span className="font-bold text-rose-400">{selectedIncident.riskScore}/100</span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-300">Forensic Context & Network Metadata:</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div>Source IP: <span className="text-slate-200">{selectedIncident.forensicContext.sourceIp}</span></div>
                  <div>GeoLocation: <span className="text-slate-200">{selectedIncident.forensicContext.geoLocation}</span></div>
                  <div>Masked Account: <span className="text-slate-200">{selectedIncident.forensicContext.bankAccountMasked}</span></div>
                  <div>Routing: <span className="text-slate-200">{selectedIncident.forensicContext.routingNumber}</span></div>
                  <div>Device Fingerprint: <span className="text-slate-200">{selectedIncident.forensicContext.deviceFingerprint}</span></div>
                  <div>Masked Tax ID: <span className="text-slate-200">{selectedIncident.forensicContext.taxIdMasked}</span></div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 mb-2">Audit History Trail:</h4>
                <div className="space-y-1.5 text-xs font-mono">
                  {selectedIncident.auditTrail.map((tr, i) => (
                    <div key={i} className="text-slate-400 text-[11px]">
                      <span className="text-cyan-400">{new Date(tr.timestamp).toLocaleTimeString()}</span> •{" "}
                      <span className="text-slate-200">{tr.actor}:</span> {tr.action}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  handleMitigate(selectedIncident.id, "FREEZE");
                  setSelectedIncident(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
              >
                Apply Direct Deposit Freeze
              </button>
              <button
                onClick={() => {
                  handleMitigate(selectedIncident.id, "WHITELIST");
                  setSelectedIncident(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Mark as Whitelisted
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
