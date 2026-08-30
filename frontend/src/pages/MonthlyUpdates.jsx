import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAppStore } from "../store/useAppStore";
import ThemeToggle from "../components/ThemeToggle";
import NotificationCenter from "../components/common/NotificationCenter";
import api from "../services/api";
import { useJobProgress } from "../hooks/useJobProgress";


// ── Icons ──────────────────────────────────────────────────────────────────
const PayrollIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const GridIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const PeopleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const SpeedoIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const SupportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const HelpCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const EnterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const EditIcon2 = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TrendIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const PersonSlashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/>
  </svg>
);
const StatsSpeedoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
);

// ── Avatar ─────────────────────────────────────────────────────────────────
const Avatar = ({ name, color, size = 36 }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color || "#3B82F6",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 700, color: "white", flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

// ── Quick Actions ──────────────────────────────────────────────────────────
const getQuickActions = (currency) => [
  { icon: "📋", label: "2 days leave", template: " took 2 days leave" },
  { icon: "⚡", label: "5 hrs overtime", template: " logged 5 hours overtime" },
  { icon: "🎁", label: `${formatCurrency(2000, currency)} bonus`, template: ` got ${formatCurrency(2000, currency)} bonus` },
  { icon: "💸", label: `${formatCurrency(500, currency)} deduction`, template: ` had ${formatCurrency(500, currency)} deduction` },
];

function parseInput(text, employeeList, currency = 'INR') {
  const lower = text.toLowerCase();
  const symbol = getCurrencySymbol(currency);

  // Parse tags early so they're available even in ambiguous cases
  const tags = [];
  const leaveMatch = lower.match(/(\d+)\s*day[s]?\s*leave/);
  if (leaveMatch) tags.push({ label: `\u2013 ${leaveMatch[1]} day${leaveMatch[1]>1?"s":""} leave`, bg: "#FEF2F2", color: "#DC2626" });
  const overtimeMatch = lower.match(/(\d+)\s*hour[s]?\s*overtime/);
  if (overtimeMatch) tags.push({ label: `+ ${overtimeMatch[1]} hr overtime`, bg: "#EFF6FF", color: "#2563EB" });
  const bonusMatch = lower.match(/(?:[\u20b9$€£])?([\d,]+)\s*bonus/);
  if (bonusMatch) tags.push({ label: `+ ${symbol}${bonusMatch[1]} bonus`, bg: "#F0FDF4", color: "#16A34A" });
  const dedMatch = lower.match(/(?:[\u20b9$€£])?([\d,]+)\s*deduction/);
  if (dedMatch) tags.push({ label: `\u2013 ${symbol}${dedMatch[1]} deduction`, bg: "#FEF2F2", color: "#DC2626" });
  if (tags.length === 0) tags.push({ label: text.slice(0,30), bg: "#F3F4F6", color: "#374151" });

  // 1. Try exact full-name match
  let name = null;
  let employeeId = null;
  for (const emp of employeeList) {
    if (lower.startsWith(emp.fullName.toLowerCase())) {
      name = emp.fullName;
      employeeId = emp._id;
      break;
    }
  }

  // 2. Try first-name match: "Ravi took..." -> matches "Ravi Kumar" / "Ravi Singh"
  if (!name) {
    const firstMatches = [];
    for (const emp of employeeList) {
      const firstName = emp.fullName.split(" ")[0].toLowerCase();
      if (lower.startsWith(firstName + " ")) {
        firstMatches.push({ fullName: emp.fullName, _id: emp._id });
      }
    }
    if (firstMatches.length === 1) {
      name = firstMatches[0].fullName;
      employeeId = firstMatches[0]._id;
    } else if (firstMatches.length > 1) {
      return { employeeId: null, name: null, tags, note: null, pending: true, ambiguousMatches: firstMatches, rawInput: text };
    }
  }

  // 3. Fallback: try the old regex for any capitalized name
  if (!name) {
    const nameMatch = text.match(/^([A-Za-z]+(?:\s[A-Za-z]+)?)/);
    name = nameMatch ? nameMatch[1] : "Unknown";
    const matchedEmp = employeeList.find(emp => emp.fullName.toLowerCase() === name.toLowerCase());
    employeeId = matchedEmp ? matchedEmp._id : null;
  }

  return { employeeId, name, tags, note: null, pending: true };
}

const COLORS = ["#818CF8","#34D399","#FB7185","#FBBF24","#60A5FA","#A78BFA"];

export default function MonthlyUpdates() {
  const navigate = useNavigate();
  const themeMode = useAppStore((state) => state.themeMode);
  const logoutUser = useAppStore((state) => state.logoutUser);
  const isDark = themeMode === "dark";

  const [isMobile] = useState(() => window.innerWidth <= 480);

  const [activePage, setActivePage]   = useState("employees");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput]             = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [activity, setActivity]       = useState([]);
  const [nextId, setNextId]           = useState(1);
  const [employees, setEmployees]     = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [finalizing, setFinalizing]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [payrollResults, setPayrollResults] = useState(null);
  const [finalizeError, setFinalizeError] = useState("");
  const { progress, startJob } = useJobProgress('payroll_finalize');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ defaultOvertimeRate: 0, defaultDailyRate: 0 });
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const companyName = localStorage.getItem("companyName") || "Acme Corp";
  const token = useAppStore((state) => state.token) || localStorage.getItem("token");
  const currency = localStorage.getItem("currency") || "INR";

  useEffect(() => {
    if (!token) {
      navigate('/auth');
    }
  }, [token, navigate]);

  // Fetch all active employees page-by-page to avoid huge payloads.
  // The monthly-updates input box needs the full list to resolve names,
  // but we still use the server's pagination so each round-trip is small.
  useEffect(() => {
    const fetchAllEmployees = async () => {
      try {
        const PAGE_SIZE = 50;
        let page = 1;
        let allEmployees = [];
        let totalPages = 1;

        do {
          const res = await api.get(`/api/employees?page=${page}&limit=${PAGE_SIZE}`);
          const data = res.data;
          allEmployees = allEmployees.concat(data.employees || []);
          totalPages = data.totalPages || 1;
          page++;
        } while (page <= totalPages);

        setEmployees(allEmployees);
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    if (token) fetchAllEmployees();
    else setTimeout(() => setLoadingEmployees(false), 0);
  }, [token]);




  const getCompInitials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const handleSubmit = () => {
    if (!input.trim()) return;
    const parsed = parseInput(input.trim(), employees, currency);
    if (parsed.ambiguousMatches && parsed.ambiguousMatches.length > 1) {
      setDisambiguationMatches(parsed.ambiguousMatches);
      setPendingParsed(parsed);
      return;
    }
    const color = COLORS[nextId % COLORS.length];
    setActivity(prev => [{ ...parsed, id: nextId, color }, ...prev]);
    setNextId(n => n + 1);
    setInput("");
  };

  const handleDisambiguationSelect = (emp) => {
    const color = COLORS[nextId % COLORS.length];
    setActivity(prev => [{ ...pendingParsed, employeeId: emp._id, name: emp.fullName, id: nextId, color }, ...prev]);
    setNextId(n => n + 1);
    setInput("");
    setDisambiguationMatches([]);
    setPendingParsed(null);
  };

  const handleDisambiguationCancel = () => {
    setDisambiguationMatches([]);
    setPendingParsed(null);
  };

  const handleDelete = (id) => setActivity(prev => prev.filter(a => a.id !== id));

  const handleKey = (e) => { if (e.key === "Enter") handleSubmit(); };

  const insertTemplate = (tpl) => {
    setInput(prev => prev ? prev + tpl : "Name" + tpl);
  };

  // Handle Attendance Calendar Apply (#137)
  const handleApplyCalendar = ({ employeeName, employeeId, tags }) => {
    const color = COLORS[nextId % COLORS.length];
    // Prefer the id the calendar already resolved. Falling back to a
    // case-insensitive name match reproduces #93/#274, where two employees
    // sharing a name silently attributed one's attendance to the other.
    const matchedEmp = employees.find(emp => emp.fullName.toLowerCase() === employeeName.toLowerCase());
    const empId = employeeId || (matchedEmp ? matchedEmp._id : null);
    setActivity(prev => [{ employeeId: empId, name: employeeName, tags, pending: true, id: nextId, color }, ...prev]);
    setNextId(n => n + 1);
  };

  const pendingCount = activity.filter(a => a.pending).length;

  const handleFinalize = async () => {
    if (activity.length === 0) return;
    setFinalizing(true);
    setFinalizeError("");

    try {
      const now = new Date();
      // Use WebSocket job starting instead of regular API call
      startJob({
        activities: activity.map(a => ({ name: a.name, tags: a.tags })),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
    } catch (err) {
      setFinalizeError(err.message || "Failed to start payroll process.");
      setFinalizing(false);
    }
  };

  // Watch for job completion
  useEffect(() => {
    if (progress.status === 'completed' && progress.message) {
      try {
        const results = JSON.parse(progress.message);
        setPayrollResults(results);
        setShowResults(true);
        setActivity(prev => prev.map(a => ({ ...a, pending: false })));
        setFinalizing(false);
      } catch (e) {}
    } else if (progress.status === 'error') {
      setFinalizeError(progress.message || "Error processing payroll");
      setFinalizing(false);
    }
  }, [progress.status, progress.message]);

  return (
    <div style={{ minHeight: "100vh", background: isDark ? "#090d16" : "#F3F4F6", fontFamily: "'DM Sans','Segoe UI',sans-serif", display: "flex", overflowX: "hidden", transition: "background 0.2s" }}>
      <Helmet>
        <title>Monthly Updates | PaySphere</title>
        <meta name="description" content="Log employee earnings, deductions, and leave updates for the current payroll cycle." />
      </Helmet>


      {/* ── Sidebar Backdrop ── */}
      {isSidebarOpen && (
        <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()} 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40
          }} 
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 236, background: isDark ? "#111827" : "white",
        display: "flex", flexDirection: "column",
        borderRight: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
        transform: isSidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease, background-color 0.2s, border-color 0.2s",
      }}>
        {/* Company */}
        <div style={{ padding: "22px 20px 18px", borderBottom: isDark ? "1px solid #1e293b" : "1px solid #F0F1F3" }}>
          <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:"#2563EB", display:"flex", alignItems:"center", justifyContent:"center", boxShadow: "0 4px 12px rgba(37,99,235,0.2)" }}>
                <PayrollIcon />
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:14.5, color: isDark ? "white" : "#111827" }}>{companyName}</div>
                <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1, textTransform:"uppercase", letterSpacing:"0.05em" }}>Payroll ID: 8821</div>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}
              className="md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <nav style={{ flex:1, padding:"4px 12px" }}>
          {[
            { id:"dashboard",  label:"Dashboard",  icon:<GridIcon /> },
            { id:"employees",  label:"Employees",  icon:<PeopleIcon /> },
            { id:"settings",   label:"Settings", icon:<SpeedoIcon /> },
          ].map(item => (
            <button key={item.id} className="nav-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => {
                setIsSidebarOpen(false); // Close on selection on mobile
                if (item.id === "dashboard" || item.id === "employees") {
                  navigate("/dashboard");
                } else if (item.id === "settings") {
                  navigate("/settings");
                } else {
                  setActivePage(item.id);
                }
              }}
              style={{
                background: activePage===item.id ? (isDark ? "#1e293b" : "#EEF2FF") : "transparent",
                color:      activePage===item.id ? (isDark ? "#3b82f6" : "#2563EB")  : (isDark ? "#94a3b8" : "#6B7280"),
                fontWeight: activePage===item.id ? 700 : 500,
              }}
              onMouseEnter={e => { if (activePage!==item.id) { e.currentTarget.style.background=isDark ? "#1e293b" : "#F9FAFB"; e.currentTarget.style.color=isDark ? "white" : "#374151"; }}}
              onMouseLeave={e => { if (activePage!==item.id) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=isDark ? "#94a3b8" : "#6B7280"; }}}
            >{item.icon}{item.label}</button>
          ))}
        </nav>

        <div style={{ padding:"14px 12px 20px", borderTop: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3", display:"flex", flexDirection:"column", gap:8 }}>
          <button className="nav-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" style={{ background:"transparent", color: isDark ? "#94a3b8" : "#6B7280", fontWeight:500 }}
            onMouseEnter={e=>e.currentTarget.style.background=isDark ? "#1e293b" : "#F9FAFB"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          ><SupportIcon /> Help &amp; Support</button>
          <button style={{
            width:"100%", padding:"13px 0", background:"#2563EB", color:"white",
            border:"none", borderRadius:12, fontFamily:"'DM Sans',sans-serif",
            fontSize:14.5, fontWeight:700, cursor:"pointer", transition:"background 0.15s",
          }}
          onMouseEnter={e=>e.currentTarget.style.background="#1D4ED8"}
          onMouseLeave={e=>e.currentTarget.style.background="#2563EB"}
          >Run Payroll</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="desktop-ml" style={{ flex:1, display:"flex", flexDirection:"column", transition: "margin-left 0.3s ease" }}>

        {/* Top Bar */}
        <header style={{
          background: isDark ? "#111827" : "white", borderBottom: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3",
          padding:"0 20px", height:62,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          position:"sticky", top:0, zIndex:9,
          transition: "background-color 0.2s, border-color 0.2s"
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 8 }}
              className="md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#3b82f6" : "#1E3A8A"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span style={{ fontWeight:800, fontSize:17, color: isDark ? "#3b82f6" : "#1E3A8A", letterSpacing:"-0.01em" }}>PaySphere</span>
            <button style={{
              display:"none", alignItems:"center", gap:5,
              background:"none", border:"none", fontFamily:"'DM Sans',sans-serif",
              fontSize:14.5, fontWeight:700, color: isDark ? "#3b82f6" : "#2563EB", cursor:"pointer",
              borderBottom: isDark ? "2px solid #3b82f6" : "2px solid #2563EB", paddingBottom:2,
            }} className="sm:flex focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} <ChevronDown /></button>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <ThemeToggle />
            <NotificationCenter />
            <button style={{ background:"none", border:"none", cursor:"pointer", display:"flex", p:2, color: isDark ? "#cbd5e1" : "#6B7280" }}><HelpCircleIcon /></button>
            <div style={{ width:34, height:34, borderRadius:"50%", background:"#1E3A5F", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"white", cursor:"pointer" }}>
              {getCompInitials(companyName)}
            </div>
            <button
              onClick={() => {
                logoutUser();
                localStorage.removeItem("companyName");
                navigate("/auth");
              }}
              style={{
                padding:"6px 12px", fontSize:13, fontWeight:600,
                color:"#EF4444", border: isDark ? "1px solid #7f1d1d" : "1px solid #FECACA", borderRadius:8,
                background:"transparent", cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
                transition:"background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background=isDark ? "#7f1d1d20" : "#FEF2F2"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page */}
        {isMobile ? (
          <PayrollWizard />
        ) : (
          <main className="desktop-p" style={{ flex:1, padding:"30px 20px 100px", display:"flex", flexDirection:"column", alignItems:"center" }}>

          {/* Title */}
          <div data-tour="generate-payroll-section" style={{ textAlign:"center", marginBottom:30, width:"100%", maxWidth:760 }}>
            <h1 style={{
              fontFamily:"'DM Serif Display',serif",
              fontSize:32, fontWeight:400, color: isDark ? "white" : "#111827",
              letterSpacing:"-0.02em", marginBottom:8,
            }}>Monthly Updates</h1>
            <p style={{ fontSize:15, color: isDark ? "#cbd5e1" : "#9CA3AF" }}>Log earnings and deductions with natural language.</p>
          </div>

          {/* Input */}
          <div style={{
            width:"100%", maxWidth:760,
            background: isDark ? "#111827" : "white", borderRadius:16,
            border: isDark
              ? (isInputFocused ? "1.5px solid #3b82f6" : "1.5px solid #1e293b")
              : (isInputFocused ? "1.5px solid #2563EB" : "1.5px solid #E5E7EB"),
            boxShadow: isInputFocused
              ? (isDark ? "0 0 0 3px rgba(59,130,246,0.15),0 2px 12px rgba(0,0,0,0.3)" : "0 0 0 3px rgba(37,99,235,0.08),0 2px 12px rgba(0,0,0,0.05)")
              : (isDark ? "0 2px 12px rgba(0,0,0,0.2)" : "0 2px 12px rgba(0,0,0,0.05)"),
            display:"flex", alignItems:"center",
            padding:"6px 6px 6px 22px",
            marginBottom:18,
            transition:"border-color 0.18s, box-shadow 0.18s, background-color 0.18s",
          }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="Type like: Ravi took 2 days leave and 5 hours overtime"
              style={{
                flex:1, border:"none", outline:"none",
                fontFamily:"'DM Sans',sans-serif",
                fontSize:15.5, color: isDark ? "white" : "#374151",
                background:"transparent",
              }}
            />
            <button
              onClick={handleSubmit}
              style={{
                width:44, height:44, borderRadius:12,
                background:"#2563EB", border:"none",
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", flexShrink:0,
                transition:"background 0.15s, transform 0.12s",
              }}
              onMouseEnter={e=>{ e.currentTarget.style.background="#1D4ED8"; e.currentTarget.style.transform="scale(1.05)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="#2563EB"; e.currentTarget.style.transform="none"; }}
            ><EnterIcon /></button>
          </div>

          {/* Quick action chips & Attendance Calendar Button */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center", marginBottom:40, width:"100%", maxWidth:760 }}>
            <button
              className="chip-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => {
                if (employees.length > 0) {
                  setShowEmpPicker(true);
                } else {
                  // Fallback sample employee if empty
                  setSelectedCalendarEmp({ fullName: "Employee 1" });
                  setIsCalendarOpen(true);
                }
              }}
              style={{
                background: isDark ? "#1e293b" : "#EEF2FF",
                borderColor: isDark ? "#3b82f6" : "#2563EB",
                color: isDark ? "#60A5FA" : "#2563EB",
                fontWeight: 700,
              }}
            >
              📅 Open Attendance Calendar
            </button>
            {getQuickActions(currency).map((action) => (
              <button key={action.label} className="chip-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" onClick={() => insertTemplate(action.template)}>
                {action.icon} {action.label}
              </button>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{ width:"100%", maxWidth:760 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:11.5, fontWeight:700, color: isDark ? "#cbd5e1" : "#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                Recent Activity
              </span>
              {pendingCount > 0 && (
                <span style={{ fontSize:13, color: isDark ? "#cbd5e1" : "#9CA3AF", fontWeight:500 }}>
                  {pendingCount} update{pendingCount>1?"s":""} pending review
                </span>
              )}
            </div>

            <div style={{
              background: isDark ? "#111827" : "white", borderRadius:16,
              border: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3",
              boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              overflow:"hidden",
            }}>
              {activity.length === 0 && (
                <div style={{ padding:"32px", textAlign:"center", color: isDark ? "#94a3b8" : "#9CA3AF", fontSize:14 }}>
                  No updates yet. Start typing above!
                </div>
              )}
              {activity.map((item) => (
                <div key={item.id}
                  className="activity-row"
                  style={{ borderLeft: item.pending ? "3px solid #2563EB" : "3px solid transparent" }}
                >
                  <Avatar name={item.name} color={item.color} size={42} />
                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:14.5, color: isDark ? "white" : "#111827", marginRight:2 }}>
                      {item.name}
                    </span>
                    {item.pending && (
                      <span style={{
                        width:8, height:8, borderRadius:"50%",
                        background:"#2563EB", display:"inline-block", flexShrink:0,
                      }}/>
                    )}
                    {item.tags.map((tag, i) => (
                      <span key={i} style={{
                        fontSize:12.5, fontWeight:600,
                        padding:"4px 10px", borderRadius:6,
                        background:tag.bg, color:tag.color,
                      }}>{tag.label}</span>
                    ))}
                    {item.note && (
                      <span style={{ fontSize:13, color:"#9CA3AF", fontStyle:"italic" }}>{item.note}</span>
                    )}
                  </div>
                  {item.pending && (
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      <button className="icon-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" onClick={() => handleDelete(item.id)} title="Delete"><TrashIcon /></button>
                      <button className="icon-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" title="Edit"><EditIcon2 /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="desktop-flex-row" style={{ width:"100%", maxWidth:760, display:"flex", flexDirection: "column", gap:16, marginTop:24 }}>
            {[
              {
                icon: <TrendIcon />,
                label: "TOTAL EMPLOYEES",
                value: loadingEmployees ? "..." : String(employees.length),
                sub: "On Payroll", subColor: "#9CA3AF",
              },
              {
                icon: <PersonSlashIcon />,
                label: "UPDATES LOGGED",
                value: String(activity.length),
                sub: activity.length === 0 ? "None yet" : "This month", subColor: "#9CA3AF",
              },
              {
                icon: <StatsSpeedoIcon />,
                label: "PENDING REVIEW",
                value: String(pendingCount),
                sub: pendingCount === 0 ? "All clear" : "Needs review", subColor: pendingCount > 0 ? "#F59E0B" : "#16A34A",
              },
            ].map((stat, i) => (
              <div key={i} style={{
                flex:1, background: isDark ? "#111827" : "white",
                borderRadius:16, padding:"22px 22px 20px",
                border: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3",
                boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ marginBottom:14 }}>{stat.icon}</div>
                <div style={{ fontSize:11, fontWeight:700, color: isDark ? "#94a3b8" : "#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
                  {stat.label}
                </div>
                <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                  <span style={{
                    fontFamily:"'DM Serif Display',serif",
                    fontSize:30, fontWeight:400, color: isDark ? "white" : "#111827",
                    letterSpacing:"-0.02em",
                  }}>{stat.value}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:stat.subColor }}>{stat.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA bar */}
          <div className="desktop-bottom-left" style={{
            position:"fixed", bottom:0,
            left:0, right:0,
            background: isDark ? "#111827" : "white",
            borderTop: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3",
            padding:"16px 20px",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 -4px 20px rgba(0,0,0,0.06)",
            zIndex:8,
            transition: "background-color 0.2s, border-color 0.2s"
          }}>
            <div className="bottom-cta-inner" style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              width:"100%", maxWidth:760,
            }}>
              <div>
                <div style={{ fontSize:11.5, fontWeight:600, color: isDark ? "#cbd5e1" : "#9CA3AF", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:3 }}>
                  Current Batch
                </div>
                <div style={{ fontSize:15, fontWeight:700, color: isDark ? "white" : "#111827" }}>
                  {activity.length} Update{activity.length !== 1 ? "s" : ""} Logged
                </div>
              </div>

              {finalizeError && (
                <div style={{ fontSize:13, color:"#EF4444", fontWeight:600, maxWidth:240, textAlign:"center" }}>
                  {finalizeError}
                </div>
              )}

              <button
                className="bottom-cta-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                onClick={handleFinalize}
                disabled={finalizing || activity.length === 0 || progress.status === 'starting' || progress.status === 'running'}
                style={{
                  padding:"13px 28px",
                  background: activity.length === 0 ? (isDark ? "#334155" : "#9CA3AF") : finalizing ? (isDark ? "#475569" : "#6B7280") : (isDark ? "#3b82f6" : "#1E3A8A"),
                  color:"white",
                  border:"none", borderRadius:12,
                  fontFamily:"'DM Sans',sans-serif",
                  fontSize:15, fontWeight:700,
                  cursor: activity.length === 0 || finalizing ? "not-allowed" : "pointer",
                  transition:"background 0.15s, transform 0.12s",
                  opacity: finalizing ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (activity.length > 0 && !finalizing) { e.currentTarget.style.background="#1E40AF"; e.currentTarget.style.transform="translateY(-1px)"; }}}
                onMouseLeave={e => { if (activity.length > 0 && !finalizing) { e.currentTarget.style.background="#1E3A8A"; e.currentTarget.style.transform="none"; }}}
              >
                {finalizing 
                  ? (progress.status === 'running' ? `Processing... ${progress.percent}%` : "Processing...") 
                  : "Review & Finalize"}
              </button>
              
              {/* Progress bar container */}
              {finalizing && progress.status === 'running' && (
                <div style={{ position: "absolute", top: 0, left: 0, height: 3, width: "100%", background: "#E5E7EB" }}>
                  <div style={{ height: "100%", background: "#2563EB", width: `${progress.percent}%`, transition: "width 0.3s ease" }} />
                </div>
              )}
            </div>
          </div>


          {/* Payroll Results Modal */}
          {showResults && payrollResults && (
            <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()} className="modal-overlay" onClick={() => setShowResults(false)}>
              <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()} className="modal-box" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div style={{ padding:"28px 28px 20px", borderBottom: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <h2 style={{
                      fontFamily:"'DM Serif Display',serif",
                      fontSize:24, fontWeight:400, color: isDark ? "white" : "#111827",
                    }}>Payroll Finalized</h2>
                    <button
                      onClick={() => setShowResults(false)}
                      style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#9CA3AF", padding:8 }}
                    >✕</button>
                  </div>
                  <p style={{ fontSize:14, color: isDark ? "#cbd5e1" : "#6B7280" }}>{payrollResults.message}</p>

                  {payrollResults.errors && payrollResults.errors.length > 0 && (
                    <div style={{
                      marginTop:12, padding:"10px 14px", borderRadius:10,
                      background:"#FEF2F2", border:"1px solid #FECACA",
                      fontSize:13, color:"#DC2626", fontWeight:500,
                    }}>
                      {payrollResults.errors.map((err, i) => (
                        <div key={i}>⚠ {err}</div>
                      ))}
                    </div>
                  )}

                  {bulkEmailMsg && (
                    <div style={{
                      marginTop:12, padding:"10px 14px", borderRadius:10,
                      background: isDark ? "#1e293b" : "#EFF6FF", border: isDark ? "1px solid #334155" : "1px solid #BFDBFE",
                      fontSize:13, color: isDark ? "#60A5FA" : "#1D4ED8", fontWeight:600,
                    }}>
                      📧 {bulkEmailMsg}
                    </div>
                  )}
                </div>

                {/* Results List */}
                <div style={{ padding:"8px 0" }}>
                  {payrollResults.results.map((r, i) => (
                    <div key={i} style={{
                      padding:"18px 28px",
                      borderBottom: i < payrollResults.results.length - 1 ? (isDark ? "1px solid #1e293b" : "1px solid #F0F1F3") : "none",
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                        <Avatar name={r.employeeName} size={38} />
                        <div>
                          <div style={{ fontWeight:700, fontSize:14.5, color: isDark ? "white" : "#111827", display: "flex", alignItems: "center", gap: 8 }}>
                            {r.employeeName}
                            {emailStatuses[r.employeeName] === "sent" && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#F0FDF4", color: "#16A34A" }}>
                                Sent ✉️
                              </span>
                            )}
                            {emailStatuses[r.employeeName] === "no_email" && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#FFFBEB", color: "#D97706" }}>
                                No Email ⚠️
                              </span>
                            )}
                            {emailStatuses[r.employeeName] === "failed" && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#FEF2F2", color: "#DC2626" }}>
                                Failed ❌
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:12, color:"#9CA3AF" }}>Base: {fmt(r.baseSalary, r.currency)}</div>
                        </div>
                      </div>

                      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
                        {r.leaveDays > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color: isDark ? "#cbd5e1" : "#6B7280" }}>{r.leaveDays} day{r.leaveDays > 1 ? "s" : ""} leave</span>
                            <span style={{ color:"#DC2626", fontWeight:600 }}>- {fmt(r.leaveDeduction, r.currency)}</span>
                          </div>
                        )}
                        {r.overtimeHours > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color: isDark ? "#cbd5e1" : "#6B7280" }}>{r.overtimeHours} hr{r.overtimeHours > 1 ? "s" : ""} overtime</span>
                            <span style={{ color: isDark ? "#3b82f6" : "#2563EB", fontWeight:600 }}>+ {fmt(r.overtimePay, r.currency)}</span>
                          </div>
                        )}
                        {r.bonus > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color: isDark ? "#cbd5e1" : "#6B7280" }}>Bonus</span>
                            <span style={{ color:"#16A34A", fontWeight:600 }}>+ {fmt(r.bonus, r.currency)}</span>
                          </div>
                        )}
                        {r.deductions > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color: isDark ? "#cbd5e1" : "#6B7280" }}>Deductions</span>
                            <span style={{ color:"#DC2626", fontWeight:600 }}>- {fmt(r.deductions, r.currency)}</span>
                          </div>
                        )}
                      </div>

                      <div style={{
                        display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"10px 14px", borderRadius:10,
                        background: isDark ? "#1e293b" : "#EEF2FF",
                      }}>
                        <span style={{ fontSize:12, fontWeight:700, color: isDark ? "#cbd5e1" : "#6B7280", textTransform:"uppercase", letterSpacing:"0.05em" }}>Net Salary</span>
                        <span style={{ fontSize:20, fontWeight:700, color: isDark ? "#3b82f6" : "#2563EB" }}>{fmt(r.netSalary, r.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modal Footer */}
                <div style={{ padding:"16px 28px 24px", borderTop: isDark ? "1.5px solid #1e293b" : "1.5px solid #F0F1F3", display:"flex", gap:10, justifyContent:"flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={handleSendAllEmails}
                    disabled={sendingBulkEmail}
                    style={{
                      padding:"11px 20px", borderRadius:10,
                      border: "none", background: isDark ? "#8B5CF6" : "#7C3AED",
                      fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700,
                      color: "white", cursor: sendingBulkEmail ? "not-allowed" : "pointer",
                      opacity: sendingBulkEmail ? 0.7 : 1,
                    }}
                  >
                    {sendingBulkEmail ? "Sending Emails... ⏳" : "📧 Email All Payslips"}
                  </button>
                  <button
                    onClick={handleCopySummary}
                    style={{
                      padding:"11px 20px", borderRadius:10,
                      border: isDark ? "1.5px solid #10B981" : "1.5px solid #059669",
                      background: copiedSummary ? (isDark ? "#064E3B" : "#ECFDF5") : (isDark ? "#1e293b" : "white"),
                      fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700,
                      color: isDark ? "#A7F3D0" : "#059669", cursor:"pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {copiedSummary ? "Copied to Clipboard! ✅" : "📋 Copy Summary"}
                  </button>
                  <button
                    onClick={handleExportCsv}
                    style={{
                      padding:"11px 20px", borderRadius:10,
                      border: isDark ? "1.5px solid #334155" : "1.5px solid #E5E7EB", background: isDark ? "#1e293b" : "white",
                      fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600,
                      color: isDark ? "#cbd5e1" : "#374151", cursor:"pointer",
                    }}
                  >Export CSV</button>
                  <button
                    onClick={() => setShowResults(false)}
                    style={{
                      padding:"11px 24px", borderRadius:10,
                      border: isDark ? "1.5px solid #334155" : "1.5px solid #E5E7EB", background: isDark ? "#1e293b" : "white",
                      fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600,
                      color: isDark ? "#cbd5e1" : "#374151", cursor:"pointer",
                    }}
                  >Close</button>
                  <button
                    onClick={() => { setShowResults(false); navigate("/dashboard"); }}
                    style={{
                      padding:"11px 24px", borderRadius:10,
                      border:"none", background:"#2563EB",
                      fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700,
                      color:"white", cursor:"pointer",
                    }}
                  >Go to Dashboard</button>
                </div>
              </div>
            </div>
          )}

          {/* Disambiguation Picker Modal (#274) */}
          {disambiguationMatches.length > 0 && (
            <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()} className="modal-overlay" onClick={handleDisambiguationCancel}>
              <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()} className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>
                  {pendingParsed && pendingParsed.rawInput
                    ? `Which employee did you mean?`
                    : "Multiple matches found"}
                </h3>
                <p style={{ fontSize: "13.5px", color: isDark ? "#9CA3AF" : "#6B7280", marginBottom: "18px" }}>
                  Multiple employees share this first name. Please select the correct one:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto", marginBottom: "20px" }}>
                  {disambiguationMatches.map(emp => (
                    <button
                      key={emp._id}
                      onClick={() => handleDisambiguationSelect(emp)}
                      aria-label={`Select ${emp.fullName}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        border: isDark ? "1px solid #1e293b" : "1px solid #E5E7EB",
                        background: isDark ? "#111827" : "#F9FAFB",
                        color: isDark ? "white" : "#111827",
                        fontSize: "14.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span>{emp.fullName}</span>
                      <span style={{ fontSize: "12.5px", color: "#2563EB" }}>Select</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleDisambiguationCancel}
                    aria-label="Cancel employee selection"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#9CA3AF",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Employee Picker Modal for Calendar (#137) */}
          {showEmpPicker && (
            <div role="dialog" aria-modal="true" aria-label="Select Employee for Calendar" className="modal-overlay" onClick={() => setShowEmpPicker(false)}>
              <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()} className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>Select Employee for Calendar</h3>
                <p style={{ fontSize: "13.5px", color: isDark ? "#9CA3AF" : "#6B7280", marginBottom: "18px" }}>
                  Choose an employee to open their 31-day muster roll attendance calendar grid:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto", marginBottom: "20px" }}>
                  {employees.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#9CA3AF", padding: "16px" }}>No employees found.</div>
                  ) : (
                    employees.map(emp => (
                      <button
                        key={emp._id || emp.fullName}
                        onClick={() => {
                          setSelectedCalendarEmp(emp);
                          setShowEmpPicker(false);
                          setIsCalendarOpen(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          border: isDark ? "1px solid #1e293b" : "1px solid #E5E7EB",
                          background: isDark ? "#111827" : "#F9FAFB",
                          color: isDark ? "white" : "#111827",
                          fontSize: "14.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span>👤 {emp.fullName}</span>
                        <span style={{ fontSize: "12.5px", color: "#2563EB" }}>Select ➔</span>
                      </button>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowEmpPicker(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#9CA3AF",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Attendance & Leave Calendar Modal (#137) */}
          <AttendanceCalendarModal
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            employee={selectedCalendarEmp}
            onApply={handleApplyCalendar}
            isDark={isDark}
          />

        </main>
        )}
      </div>
    </div>
  );
}
