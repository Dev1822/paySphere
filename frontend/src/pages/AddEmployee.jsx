import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import ThemeToggle from "../components/ThemeToggle";
import api from "../services/api";
import useCtrlEnterSubmit from "../hooks/useCtrlEnterSubmit";
import { getCurrencySymbol } from "../utils/currency";

// ── Icons ──────────────────────────────────────────────────────────────────
const GridIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const PeopleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const PersonPlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const HelpCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const SupportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ── Avatar ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6"];

const Avatar = ({ name, size = 36 }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: AVATAR_COLORS[colorIndex],
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.34, fontWeight: 700, color: "white", flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

export default function AddEmployee() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const companyName = localStorage.getItem("companyName") || "Acme Corp";

  // Form state
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [department, setDepartment] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [csvFile, setCsvFile] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const fileInputRef = useRef(null);
  const formRef = useRef(null);
  useCtrlEnterSubmit(formRef);
  // Recently added employees
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const token = localStorage.getItem("token");

  // Fetch recent employees
  const fetchRecent = async () => {
    try {
      const res = await api.get(`/api/employees?page=1&limit=5`);
      setRecentEmployees(res.data.employees || []);
    } catch (err) {
      console.error("Failed to fetch recent employees:", err);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    if (token) {
      setTimeout(() => { fetchRecent(); }, 0);
    } else {
      setTimeout(() => setLoadingRecent(false), 0);
    }
  }, [token]);

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setError("Please select a CSV file.");
      return;
    }

    setUploadingCsv(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await api.post(
        "/api/employees/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setSuccess(`${res.data.imported} employees imported successfully.`);
      setCsvFile(null);

      const recent = await api.get("/api/employees/recent");
      setRecentEmployees(recent.data.employees);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.response?.data?.message || "CSV import failed.");
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const salaryNum = parseFloat(monthlySalary.replace(/,/g, ""));
    const otNum = overtimeRate ? parseFloat(overtimeRate.replace(/,/g, "")) : undefined;

    if (isNaN(salaryNum) || salaryNum <= 0) {
      setError("Monthly salary must be a positive number.");
      setLoading(false);
      return;
    }

    try {
      const dobDate = dateOfBirth ? new Date(dateOfBirth + "T12:00:00.000Z") : undefined;
      const joiningDateDate = joiningDate ? new Date(joiningDate + "T12:00:00.000Z") : undefined;

      await api.post(`/api/employees`, {
        fullName,
        role,
        department,
        monthlySalary: salaryNum,
        overtimeRate: otNum,
        currency,
        dateOfBirth: dobDate,
        joiningDate: joiningDateDate,
      });

      setSuccess("Employee added successfully!");
      setFullName("");
      setRole("");
      setDepartment("");
      setMonthlySalary("");
      setOvertimeRate("");
      setDateOfBirth("");
      setJoiningDate("");
      fetchRecent(); // Refresh recent list
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add employee.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFullName("");
    setRole("");
    setDepartment("");
    setMonthlySalary("");
    setOvertimeRate("");
    setDateOfBirth("");
    setJoiningDate("");
    setError("");
    setSuccess("");
    navigate("/dashboard");
  };

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: <GridIcon /> },
    { id: "employees", label: "Employees", path: "/dashboard?tab=employees", icon: <PeopleIcon /> },
    { id: "settings", label: "Settings", path: "/settings", icon: <SupportIcon /> },
  ];

  const getInitials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const fmt = (n, c = "INR") => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c }).format(n);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>Add Employee | PaySphere</title>
        <meta name="description" content="Add a new employee to your company roster." />
      </Helmet>

      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 fixed inset-y-0 left-0 flex flex-col z-50 transition-transform duration-300 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-200 dark:shadow-none">
              {getCurrencySymbol(currency)}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">{companyName}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">Payroll ID: 8821</p>
            </div>
          </div>
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={() => setIsSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition ${item.id === "employees"
                ? "bg-indigo-50 dark:bg-indigo-950/30 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
          <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
            <SupportIcon />
            Help & Support
          </button>
          <button onClick={() => navigate("/monthly-updates")} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-200 dark:shadow-none transition">
            Run Payroll
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">

        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">Ledger Payroll</span>
            <button className="hidden sm:block text-blue-600 dark:text-blue-400 font-semibold border-b-2 border-blue-600 dark:border-blue-400 pb-0.5 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-500">
            <ThemeToggle />
            <button className="hidden sm:flex p-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" aria-label="BellIcon">
        <BellIcon />
      </button>
            <button className="hidden sm:flex p-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" aria-label="HelpCircleIcon">
        <HelpCircleIcon />
      </button>
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {getInitials(companyName)}
            </div>
            <button
              onClick={() => {
                dispatch(logout());
                localStorage.removeItem("companyName");
                navigate("/auth");
              }}
              className="px-3 py-1.5 text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">

            {/* ── LEFT: Form Section ── */}
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white mb-2">Add Employee</h1>
              <p className="text-gray-500 dark:text-slate-500 text-sm mb-8">
                Enter basic details to add someone to the next payroll run.
              </p>

              <form ref={formRef} onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 transition-colors duration-200">
                {/* Full Name */}
                <label className="block mb-5">
                  <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">Full Name</span>
                  <input
                    id="employee-full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                    className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-transparent dark:border-slate-800 outline-none transition text-sm"
                  />
                </label>

                {/* Salary Row */}
                <div className="flex flex-col sm:flex-col gap-4 mb-6">
                  <label className="flex-1">
                    <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">Currency</span>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white border border-transparent dark:border-slate-800 outline-none transition text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </label>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex-1">
                      <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">Monthly Salary</span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 font-semibold text-sm">{getCurrencySymbol(currency)}</span>
                        <input
                          id="employee-salary"
                          type="text"
                          value={monthlySalary}
                          onChange={(e) => setMonthlySalary(e.target.value.replace(/[^0-9,]/g, ""))}
                          placeholder="45,000"
                          required
                          className="w-full pl-8 pr-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-transparent dark:border-slate-800 outline-none transition text-sm"
                        />
                      </div>
                    </label>

                    <label className="flex-1">
                      <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">Overtime Rate (Optional)</span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 font-semibold text-sm">{getCurrencySymbol(currency)}</span>
                        <input
                          id="employee-overtime"
                          type="text"
                          value={overtimeRate}
                          onChange={(e) => setOvertimeRate(e.target.value.replace(/[^0-9,]/g, ""))}
                          placeholder="250 / hr"
                          className="w-full pl-8 pr-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-transparent dark:border-slate-800 outline-none transition text-sm"
                        />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Role */}
                <label className="block mb-5">
                  <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">Role</span>
                  <input
                    id="employee-role"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    required
                    className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-transparent dark:border-slate-800 outline-none transition text-sm"
                  />
                </label>

                {/* Department Field */}
                <label className="block mb-5">
                  <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
                    Department
                  </span>
                  <input
                    id="employee-department"
                    type="text"
                    list="department-suggestions"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Engineering, Sales, HR, Marketing"
                    className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-transparent dark:border-slate-800 outline-none transition text-sm"
                  />
                  <datalist id="department-suggestions">
                    <option value="Engineering" />
                    <option value="Sales" />
                    <option value="Marketing" />
                    <option value="Human Resources" />
                    <option value="Finance" />
                    <option value="Operations" />
                    <option value="Design" />
                  </datalist>
                </label>

                {/* Dates */}
                <div className="mb-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex-1">
                      <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">Date of Birth (Optional)</span>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-transparent dark:border-slate-800 outline-none transition text-sm"
                      />
                    </label>
                    <label className="flex-1">
                      <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">Joining Date (Optional)</span>
                      <input
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-transparent dark:border-slate-800 outline-none transition text-sm"
                      />
                    </label>
                  </div>
                </div>

                {/* Messages */}
                {error && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {success}
                  </div>
                )}

                {/* Submit and Cancel Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full sm:w-1/2 py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    id="add-employee-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-1/2 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <PersonPlusIcon />
                    {loading ? "Adding..." : "Add Employee"}
                  </button>
                </div>
              </form>
            </div>


            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2">
                Bulk Upload Employees
              </h3>

              <p className="text-xs text-gray-500 mb-4">
                Upload a CSV file to add multiple employees at once.
              </p>

              <div
                className={`border-2 border-dashed rounded-xl p-5 text-center transition ${csvFile
                  ? "border-green-400 bg-green-50"
                  : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
                  }`}
              >
                {!csvFile ? (
                  <>
                    <div className="text-3xl mb-2">📄</div>

                    <p className="text-sm font-semibold text-gray-700">
                      Choose CSV file
                    </p>

                    <p className="text-xs text-gray-500 mt-1 mb-3">
                      Only .csv files are supported
                    </p>

                    <label className="inline-block cursor-pointer px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                      Browse File

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        hidden
                        onChange={(e) =>
                          setCsvFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-3 border border-green-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-2xl">
                        📄
                      </div>

                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {csvFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(csvFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCsvFile(null);

                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="ml-3 w-7 h-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCsvUpload}
                disabled={!csvFile || uploadingCsv}
                className="mt-4 w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                {uploadingCsv ? "Uploading..." : "Upload CSV"}
              </button>
            </div>
            {/* ── RIGHT: Sidebar Cards ── */}
            <div className="w-full lg:w-72 xl:w-80 flex flex-col gap-6">

              {/* Recently Added */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-colors duration-200">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircleIcon />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Recently Added</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-450 mt-0.5 leading-relaxed">
                      Employees added here will automatically appear in your {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} payroll worksheet.
                    </p>
                  </div>
                </div>

                <div className="space-y-0">
                  {loadingRecent ? (
                    <div className="py-6 text-center text-sm text-gray-500">Loading...</div>
                  ) : recentEmployees.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500">No employees added yet.</div>
                  ) : (
                    recentEmployees.slice(0, 3).map((emp) => (
                      <div key={emp._id} className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-slate-800 last:border-0">
                        <Avatar name={emp.fullName} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{emp.fullName}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-500 truncate">
                            {emp.role || "Employee"} {emp.department ? `• ${emp.department}` : ""}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {fmt(emp.monthlySalary, emp.currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => navigate("/dashboard")}
                  className="mt-3 text-blue-600 dark:text-blue-450 text-sm font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition flex items-center gap-1"
                >
                  View Full Directory <ArrowRightIcon />
                </button>
              </div>

              {/* Speed Tip Card */}
              <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-gray-800 via-gray-900 to-gray-950 p-6 text-white shadow-lg">
                {/* Decorative circles */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
                <div className="absolute top-12 right-10 w-16 h-16 rounded-full bg-blue-500/10" />

                <div className="relative z-10">
                  <h3 className="font-bold text-base mb-1.5">Speed Tip</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    You can bulk upload employees via CSV in the Settings menu for larger teams.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}
