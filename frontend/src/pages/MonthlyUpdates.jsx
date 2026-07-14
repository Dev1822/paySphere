import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import api from "../services/api";


// ── Icons ──────────────────────────────────────────────────────────────────
const PayrollIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
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
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const HelpCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const SupportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const EnterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const GiftIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);
const ScissorsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
    <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
    <line x1="8.12" y1="8.12" x2="12" y2="12"/>
  </svg>
);
const TrendIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);
const PersonSlashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="22" y1="2" x2="14" y2="14"/>
  </svg>
);
const SpeedoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l4-4"/>
    <circle cx="12" cy="12" r="1" fill="#6366F1"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const EditIcon2 = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ── Avatar ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6"];

const getAvatarColor = (name) => {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const Avatar = ({ name, color, size = 42 }) => {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color || getAvatarColor(name),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: "white", flexShrink: 0,
    }}>{initials}</div>
  );
};

// ── Quick action chips ─────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Add Leave",     icon: <CalendarIcon />, template: " took X days leave" },
  { label: "Add Overtime",  icon: <ClockIcon />,    template: " worked X hours overtime" },
  { label: "Add Bonus",     icon: <GiftIcon />,     template: " received ₹X bonus" },
  { label: "Add Deduction", icon: <ScissorsIcon />, template: " has ₹X deduction" },
];

// No initial hardcoded activity — starts empty, populated by user input

// ── Parse natural language input (matches against real employees) ──────────
function parseInput(text, employeeList = []) {
  const lower = text.toLowerCase();

  // Try to match the input against actual employee names
  let name = null;

  // 1. Try full name match (case-insensitive): "Ravi Kumar took..." → "Ravi Kumar"
  for (const emp of employeeList) {
    if (lower.startsWith(emp.fullName.toLowerCase())) {
      name = emp.fullName;
      break;
    }
  }

  // 2. Try first-name match: "Ravi took..." → matches "Ravi Kumar"
  if (!name) {
    for (const emp of employeeList) {
      const firstName = emp.fullName.split(" ")[0].toLowerCase();
      // Check if input starts with the first name followed by a space or action word
      if (lower.startsWith(firstName + " ")) {
        name = emp.fullName;
        break;
      }
    }
  }

  // 3. Fallback: try the old regex for any capitalized name
  if (!name) {
    const nameMatch = text.match(/^([A-Za-z]+(?:\s[A-Za-z]+)?)/);
    name = nameMatch ? nameMatch[1] : "Unknown";
  }

  const tags = [];
  const leaveMatch = lower.match(/(\d+)\s*day[s]?\s*leave/);
  if (leaveMatch) tags.push({ label: `– ${leaveMatch[1]} day${leaveMatch[1]>1?"s":""} leave`, bg: "#FEF2F2", color: "#DC2626" });
  const overtimeMatch = lower.match(/(\d+)\s*hour[s]?\s*overtime/);
  if (overtimeMatch) tags.push({ label: `+ ${overtimeMatch[1]} hr overtime`, bg: "#EFF6FF", color: "#2563EB" });
  const bonusMatch = lower.match(/₹?([\d,]+)\s*bonus/);
  if (bonusMatch) tags.push({ label: `+ ₹${bonusMatch[1]} bonus`, bg: "#F0FDF4", color: "#16A34A" });
  const dedMatch = lower.match(/₹?([\d,]+)\s*deduction/);
  if (dedMatch) tags.push({ label: `– ₹${dedMatch[1]} deduction`, bg: "#FEF2F2", color: "#DC2626" });
  if (tags.length === 0) tags.push({ label: text.slice(0,30), bg: "#F3F4F6", color: "#374151" });
  return { name, tags, note: null, pending: true };
}

const COLORS = ["#818CF8","#34D399","#FB7185","#FBBF24","#60A5FA","#A78BFA"];

export default function MonthlyUpdates() {
  const navigate = useNavigate();
  const [activePage, setActivePage]   = useState("employees");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput]             = useState("");
  const [activity, setActivity]       = useState([]);
  const [nextId, setNextId]           = useState(1);
  const [employees, setEmployees]     = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [finalizing, setFinalizing]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [payrollResults, setPayrollResults] = useState(null);
  const [finalizeError, setFinalizeError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ defaultOvertimeRate: 0, defaultDailyRate: 0 });
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const companyName = localStorage.getItem("companyName") || "Acme Corp";
  const token = localStorage.getItem("token");

  // Fetch real employees from API
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get(`/api/employees`);

        setEmployees(res.data.employees);
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    if (token) fetchEmployees();
    else setLoadingEmployees(false);
  }, [token]);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get(`/api/auth/settings`);

        setSettings(res.data);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    };
    if (token) fetchSettings();
  }, [token]);

  const saveSettings = async () => {
    setUpdatingSettings(true);
    try {
      await api.put(`/api/auth/settings`, settings);

      setShowSettings(false);
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setUpdatingSettings(false);
    }
  };

  const getCompInitials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const handleSubmit = () => {
    if (!input.trim()) return;
    const parsed = parseInput(input.trim(), employees);
    const color = COLORS[nextId % COLORS.length];
    setActivity(prev => [{ ...parsed, id: nextId, color }, ...prev]);
    setNextId(n => n + 1);
    setInput("");
  };

  const handleDelete = (id) => setActivity(prev => prev.filter(a => a.id !== id));

  const handleKey = (e) => { if (e.key === "Enter") handleSubmit(); };

  const insertTemplate = (tpl) => {
    setInput(prev => prev ? prev + tpl : "Name" + tpl);
  };

  const pendingCount = activity.filter(a => a.pending).length;

  const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN");

  // Finalize payroll
  const handleFinalize = async () => {
    if (activity.length === 0) return;
    setFinalizing(true);
    setFinalizeError("");

    try {
      const now = new Date();
      const res = await api.post(
        `/api/payroll/finalize`,
        {
          activities: activity.map(a => ({ name: a.name, tags: a.tags })),
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        }
      );

      setPayrollResults(res.data);
      setShowResults(true);

      // Mark all activities as no longer pending
      setActivity(prev => prev.map(a => ({ ...a, pending: false })));
    } catch (err) {
      setFinalizeError(err.response?.data?.message || "Failed to finalize payroll.");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", fontFamily: "'DM Sans','Segoe UI',sans-serif", display: "flex", overflowX: "hidden" }}>
      <Helmet>
        <title>Monthly Updates | PaySphere</title>
        <meta name="description" content="Log employee earnings, deductions, and leave updates for the current payroll cycle." />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=DM+Serif+Display&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav-btn { width:100%; display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:10px; border:none; font-family:'DM Sans',sans-serif; font-size:14.5px; cursor:pointer; margin-bottom:2px; text-align:left; transition:background 0.15s, color 0.15s; }
        .chip-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; background:white; border:1.5px solid #E5E7EB; border-radius:99px; font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:500; color:#374151; cursor:pointer; transition:border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .chip-btn:hover { border-color:#9CA3AF; background:#F9FAFB; box-shadow:0 2px 6px rgba(0,0,0,0.06); }
        .icon-btn { background:none; border:none; cursor:pointer; display:flex; align-items:center; padding:6px; border-radius:8px; transition:background 0.15s; }
        .icon-btn:hover { background:#F3F4F6; }
        .activity-row { display:flex; align-items:center; gap:14px; padding:16px 20px; background:white; border-bottom:1px solid #F0F1F3; transition:background 0.15s; }
        .activity-row:last-child { border-bottom:none; }
        .activity-row:hover { background:#FAFAFA; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:100; backdrop-filter:blur(4px); }
        .modal-box { background:white; border-radius:20px; width:92%; max-width:600px; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.2); }
        
        @media (min-width: 768px) {
          .desktop-ml { margin-left: 236px !important; }
          aside { transform: translateX(0) !important; }
          .desktop-p { padding: 44px 48px 80px !important; }
          .desktop-flex-row { flex-direction: row !important; }
          .desktop-bottom-left { left: 236px !important; }
          .desktop-row-padding { padding: 16px 36px !important; }
        }
        
        @media (max-width: 480px) {
          .activity-row { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .chip-btn { padding: 7px 12px !important; font-size: 12px !important; }
        }
        
        @media (max-width: 640px) {
          .bottom-cta-inner { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; text-align: center !important; }
          .bottom-cta-btn { width: 100% !important; }
          .modal-box { width: 96% !important; margin: 10px !important; }
        }
      `}</style>

      {/* ── Sidebar Backdrop ── */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40
          }} 
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 236, background: "white",
        display: "flex", flexDirection: "column",
        borderRight: "1.5px solid #F0F1F3",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
        transform: isSidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
      }}>
        {/* Company */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #F0F1F3" }}>
          <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:"#2563EB", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <PayrollIcon />
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:14.5, color:"#111827" }}>{companyName}</div>
                <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1, textTransform:"uppercase", letterSpacing:"0.05em" }}>Payroll ID: 8821</div>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 8 }}
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
            { id:"settings",   label:"Payroll Settings", icon:<SpeedoIcon /> },
          ].map(item => (
            <button key={item.id} className="nav-btn"
              onClick={() => {
                setIsSidebarOpen(false); // Close on selection on mobile
                if (item.id === "dashboard" || item.id === "employees") {
                  navigate("/dashboard");
                } else if (item.id === "settings") {
                  setShowSettings(true);
                } else {
                  setActivePage(item.id);
                }
              }}
              style={{
                background: activePage===item.id ? "#EEF2FF" : "transparent",
                color:      activePage===item.id ? "#2563EB"  : "#6B7280",
                fontWeight: activePage===item.id ? 700 : 500,
              }}
              onMouseEnter={e => { if (activePage!==item.id) { e.currentTarget.style.background="#F9FAFB"; e.currentTarget.style.color="#374151"; }}}
              onMouseLeave={e => { if (activePage!==item.id) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#6B7280"; }}}
            >{item.icon}{item.label}</button>
          ))}
        </nav>

        <div style={{ padding:"14px 12px 20px", borderTop:"1.5px solid #F0F1F3", display:"flex", flexDirection:"column", gap:8 }}>
          <button className="nav-btn" style={{ background:"transparent", color:"#6B7280", fontWeight:500 }}
            onMouseEnter={e=>e.currentTarget.style.background="#F9FAFB"}
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
          background:"white", borderBottom:"1.5px solid #F0F1F3",
          padding:"0 20px", height:62,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          position:"sticky", top:0, zIndex:9,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 8 }}
              className="md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E3A8A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span style={{ fontWeight:800, fontSize:17, color:"#1E3A8A", letterSpacing:"-0.01em" }}>PaySphere</span>
            <button style={{
              display:"none", alignItems:"center", gap:5,
              background:"none", border:"none", fontFamily:"'DM Sans',sans-serif",
              fontSize:14.5, fontWeight:700, color:"#2563EB", cursor:"pointer",
              borderBottom:"2px solid #2563EB", paddingBottom:2,
            }} className="sm:flex">April 2026 <ChevronDown /></button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button style={{ background:"none", border:"none", cursor:"pointer", display:"flex" }}><BellIcon /></button>
            <button style={{ background:"none", border:"none", cursor:"pointer", display:"flex" }}><HelpCircleIcon /></button>
            <div style={{ width:34, height:34, borderRadius:"50%", background:"#1E3A5F", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"white", cursor:"pointer" }}>
              {getCompInitials(companyName)}
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("companyName");
                navigate("/auth");
              }}
              style={{
                padding:"6px 12px", fontSize:13, fontWeight:600,
                color:"#EF4444", border:"1px solid #FECACA", borderRadius:8,
                background:"transparent", cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
                transition:"background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background="#FEF2F2"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="desktop-p" style={{ flex:1, padding:"30px 20px 100px", display:"flex", flexDirection:"column", alignItems:"center" }}>

          {/* Title */}
          <div style={{ textAlign:"center", marginBottom:30, width:"100%", maxWidth:760 }}>
            <h1 style={{
              fontFamily:"'DM Serif Display',serif",
              fontSize:32, fontWeight:400, color:"#111827",
              letterSpacing:"-0.02em", marginBottom:8,
            }}>Monthly Updates</h1>
            <p style={{ fontSize:15, color:"#9CA3AF" }}>Log earnings and deductions with natural language.</p>
          </div>

          {/* Input */}
          <div style={{
            width:"100%", maxWidth:760,
            background:"white", borderRadius:16,
            border:"1.5px solid #E5E7EB",
            boxShadow:"0 2px 12px rgba(0,0,0,0.05)",
            display:"flex", alignItems:"center",
            padding:"6px 6px 6px 22px",
            marginBottom:18,
            transition:"border-color 0.18s, box-shadow 0.18s",
          }}
          onFocusCapture={e => { e.currentTarget.style.borderColor="#2563EB"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(37,99,235,0.08),0 2px 12px rgba(0,0,0,0.05)"; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor="#E5E7EB"; e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.05)"; }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type like: Ravi took 2 days leave and 5 hours overtime"
              style={{
                flex:1, border:"none", outline:"none",
                fontFamily:"'DM Sans',sans-serif",
                fontSize:15.5, color:"#374151",
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

          {/* Quick action chips */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center", marginBottom:40, width:"100%", maxWidth:760 }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} className="chip-btn" onClick={() => insertTemplate(a.template)}>
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{ width:"100%", maxWidth:760 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:11.5, fontWeight:700, color:"#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                Recent Activity
              </span>
              {pendingCount > 0 && (
                <span style={{ fontSize:13, color:"#9CA3AF", fontWeight:500 }}>
                  {pendingCount} update{pendingCount>1?"s":""} pending review
                </span>
              )}
            </div>

            <div style={{
              background:"white", borderRadius:16,
              border:"1.5px solid #F0F1F3",
              boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
              overflow:"hidden",
            }}>
              {activity.length === 0 && (
                <div style={{ padding:"32px", textAlign:"center", color:"#9CA3AF", fontSize:14 }}>
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
                    <span style={{ fontWeight:700, fontSize:14.5, color:"#111827", marginRight:2 }}>
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
                      <button className="icon-btn" onClick={() => handleDelete(item.id)} title="Delete"><TrashIcon /></button>
                      <button className="icon-btn" title="Edit"><EditIcon2 /></button>
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
                icon: <SpeedoIcon />,
                label: "PENDING REVIEW",
                value: String(pendingCount),
                sub: pendingCount === 0 ? "All clear" : "Needs review", subColor: pendingCount > 0 ? "#F59E0B" : "#16A34A",
              },
            ].map((stat, i) => (
              <div key={i} style={{
                flex:1, background:"white",
                borderRadius:16, padding:"22px 22px 20px",
                border:"1.5px solid #F0F1F3",
                boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ marginBottom:14 }}>{stat.icon}</div>
                <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
                  {stat.label}
                </div>
                <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                  <span style={{
                    fontFamily:"'DM Serif Display',serif",
                    fontSize:30, fontWeight:400, color:"#111827",
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
            background:"white",
            borderTop:"1.5px solid #F0F1F3",
            padding:"16px 20px",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 -4px 20px rgba(0,0,0,0.06)",
            zIndex:8,
          }}>
            <div className="bottom-cta-inner" style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              width:"100%", maxWidth:760,
            }}>
              <div>
                <div style={{ fontSize:11.5, fontWeight:600, color:"#9CA3AF", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:3 }}>
                  Current Batch
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"#111827" }}>
                  {activity.length} Update{activity.length !== 1 ? "s" : ""} Logged
                </div>
              </div>

              {finalizeError && (
                <div style={{ fontSize:13, color:"#EF4444", fontWeight:600, maxWidth:240, textAlign:"center" }}>
                  {finalizeError}
                </div>
              )}

              <button
                className="bottom-cta-btn"
                onClick={handleFinalize}
                disabled={finalizing || activity.length === 0}
                style={{
                  padding:"13px 28px",
                  background: activity.length === 0 ? "#9CA3AF" : finalizing ? "#6B7280" : "#1E3A8A",
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
              >{finalizing ? "Processing..." : "Review & Finalize"}</button>
            </div>
          </div>

          {/* Settings Modal */}
          {showSettings && (
            <div className="modal-overlay" onClick={() => setShowSettings(false)}>
              <div className="modal-box" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                <div style={{ padding:"28px 28px 20px", borderBottom:"1.5px solid #F0F1F3" }}>
                  <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, fontWeight:400, color:"#111827" }}>
                    Payroll Settings
                  </h2>
                  <p style={{ fontSize:14, color:"#6B7280" }}>Set default rates for all employees.</p>
                </div>
                
                <div style={{ padding:"24px 28px" }}>
                  <label style={{ display:"block", marginBottom:20 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8, display:"block" }}>
                      Default Overtime Rate (₹ / hr)
                    </span>
                    <input 
                      type="number"
                      value={settings.defaultOvertimeRate}
                      onChange={(e) => setSettings({ ...settings, defaultOvertimeRate: parseFloat(e.target.value) || 0 })}
                      style={{ width:"100%", padding:"12px 16px", background:"#F3F4F6", border:"1.5px solid transparent", borderRadius:12, fontSize:15, fontWeight:600, color:"#111827", outline:"none" }}
                    />
                  </label>

                  <label style={{ display:"block", marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8, display:"block" }}>
                      Default Daily Deduction (₹ / day)
                    </span>
                    <input 
                      type="number"
                      value={settings.defaultDailyRate}
                      onChange={(e) => setSettings({ ...settings, defaultDailyRate: parseFloat(e.target.value) || 0 })}
                      style={{ width:"100%", padding:"12px 16px", background:"#F3F4F6", border:"1.5px solid transparent", borderRadius:12, fontSize:15, fontWeight:600, color:"#111827", outline:"none" }}
                    />
                  </label>
                  <p style={{ fontSize:12, color:"#9CA3AF", fontStyle:"italic" }}>
                    * Individual employee overtime rates will still take priority if set.
                  </p>
                </div>

                <div style={{ padding:"16px 28px 24px", borderTop:"1.5px solid #F0F1F3", display:"flex", gap:12, justifyContent:"flex-end" }}>
                  <button onClick={() => setShowSettings(false)} className="chip-btn" style={{ borderRadius:10 }}>Cancel</button>
                  <button onClick={saveSettings} disabled={updatingSettings} style={{
                    padding:"11px 24px", borderRadius:10, border:"none", background:"#2563EB", color:"white", fontWeight:700, cursor: updatingSettings ? "not-allowed" : "pointer"
                  }}>
                    {updatingSettings ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payroll Results Modal */}
          {showResults && payrollResults && (
            <div className="modal-overlay" onClick={() => setShowResults(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div style={{ padding:"28px 28px 20px", borderBottom:"1.5px solid #F0F1F3" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <h2 style={{
                      fontFamily:"'DM Serif Display',serif",
                      fontSize:24, fontWeight:400, color:"#111827",
                    }}>Payroll Finalized</h2>
                    <button
                      onClick={() => setShowResults(false)}
                      style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#9CA3AF", padding:8 }}
                    >✕</button>
                  </div>
                  <p style={{ fontSize:14, color:"#6B7280" }}>{payrollResults.message}</p>

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
                </div>

                {/* Results List */}
                <div style={{ padding:"8px 0" }}>
                  {payrollResults.results.map((r, i) => (
                    <div key={i} style={{
                      padding:"18px 28px",
                      borderBottom: i < payrollResults.results.length - 1 ? "1px solid #F0F1F3" : "none",
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                        <Avatar name={r.employeeName} size={38} />
                        <div>
                          <div style={{ fontWeight:700, fontSize:14.5, color:"#111827" }}>{r.employeeName}</div>
                          <div style={{ fontSize:12, color:"#9CA3AF" }}>Base: {fmt(r.baseSalary)}</div>
                        </div>
                      </div>

                      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
                        {r.leaveDays > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color:"#6B7280" }}>{r.leaveDays} day{r.leaveDays > 1 ? "s" : ""} leave</span>
                            <span style={{ color:"#DC2626", fontWeight:600 }}>- {fmt(r.leaveDeduction)}</span>
                          </div>
                        )}
                        {r.overtimeHours > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color:"#6B7280" }}>{r.overtimeHours} hr{r.overtimeHours > 1 ? "s" : ""} overtime</span>
                            <span style={{ color:"#2563EB", fontWeight:600 }}>+ {fmt(r.overtimePay)}</span>
                          </div>
                        )}
                        {r.bonus > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color:"#6B7280" }}>Bonus</span>
                            <span style={{ color:"#16A34A", fontWeight:600 }}>+ {fmt(r.bonus)}</span>
                          </div>
                        )}
                        {r.deductions > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                            <span style={{ color:"#6B7280" }}>Deductions</span>
                            <span style={{ color:"#DC2626", fontWeight:600 }}>- {fmt(r.deductions)}</span>
                          </div>
                        )}
                      </div>

                      <div style={{
                        display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"10px 14px", borderRadius:10,
                        background:"#EEF2FF",
                      }}>
                        <span style={{ fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.05em" }}>Net Salary</span>
                        <span style={{ fontSize:20, fontWeight:700, color:"#2563EB" }}>{fmt(r.netSalary)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modal Footer */}
                <div style={{ padding:"16px 28px 24px", borderTop:"1.5px solid #F0F1F3", display:"flex", gap:12, justifyContent:"flex-end" }}>
                  <button
                    onClick={() => setShowResults(false)}
                    style={{
                      padding:"11px 24px", borderRadius:10,
                      border:"1.5px solid #E5E7EB", background:"white",
                      fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600,
                      color:"#374151", cursor:"pointer",
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

        </main>
      </div>
    </div>
  );
}